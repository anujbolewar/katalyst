import { NextResponse } from "next/server";
import { CLARIFY_GOAL_PROMPT, formatPrompt } from "@/features/goal-decomposition/prompts";

// Reuse the LLM backend from the decompose route
const BACKEND_URL = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/goal/decompose`;

// Lightweight LLM call — auto-detects opencode or claude from the decompose route's logic.
// We share the same detection via an internal fetch to keep things DRY.
import { spawn, type ChildProcessWithoutNullStreams, execSync } from "child_process";
import { existsSync } from "fs";

function findBinary(...candidates: string[]): string | null {
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

function whichBinary(name: string): string | null {
  try {
    const path = execSync(`which ${name} 2>/dev/null`, { encoding: "utf-8", timeout: 3000 }).trim();
    return path && existsSync(path) ? path : null;
  } catch {
    return null;
  }
}

function detectBackend(): { bin: string; args: (prompt: string) => string[]; parseOutput: (stdout: string) => string; name: string } | null {
  const opencodeBin =
    findBinary(
      process.env.OPENCODE_BIN ?? "",
      "/home/ab-11/.nvm/versions/node/v22.22.2/bin/opencode",
      "/usr/local/bin/opencode",
      "/usr/bin/opencode",
    ) ?? whichBinary("opencode");

  if (opencodeBin) {
    return {
      bin: opencodeBin,
      name: "opencode",
      args: (prompt: string) => ["run", prompt, "--format", "json", "--model", "opencode-go/deepseek-v4-pro"],
      parseOutput: (stdout: string): string => {
        const textParts: string[] = [];
        for (const line of stdout.split("\n")) {
          try {
            const evt = JSON.parse(line);
            if (evt.type === "text" && evt.part?.text) {
              textParts.push(evt.part.text);
            }
          } catch { /* skip */ }
        }
        return textParts.join("\n");
      },
    };
  }

  const claudeBin =
    findBinary(
      process.env.CLAUDE_BIN ?? "",
      "/home/ab-11/.local/bin/claude",
      "/usr/local/bin/claude",
      "/usr/bin/claude",
    ) ?? whichBinary("claude");

  if (claudeBin) {
    return {
      bin: claudeBin,
      name: "claude",
      args: (prompt: string) => ["-p", prompt, "--output-format", "json", "--max-turns", "5"],
      parseOutput: (stdout: string): string => {
        try {
          const env = JSON.parse(stdout);
          if (env.result && typeof env.result === "string") return env.result;
        } catch { }
        return stdout;
      },
    };
  }

  return null;
}

function spawnLlm(backend: ReturnType<typeof detectBackend>, prompt: string): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    if (!backend) return resolve({ stdout: "", stderr: "No backend", exitCode: 1 });
    const args = backend.args(prompt);
    const child: ChildProcessWithoutNullStreams = spawn(backend.bin, args, {
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    }) as unknown as ChildProcessWithoutNullStreams;

    let stdout = "";
    let stderr = "";
    const MAX = 500_000;

    child.stdout.on("data", (chunk: Buffer) => { if (stdout.length < MAX) stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { if (stderr.length < MAX) stderr += chunk.toString(); });

    const timer = setTimeout(() => child.kill("SIGTERM"), 60_000);
    child.on("close", (code: number | null) => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: code }); });
    child.on("error", () => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: null }); });
  });
}

export async function POST(request: Request) {
  let body: { goal?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const goal = body.goal?.trim();
  if (!goal || goal.length < 3) {
    return NextResponse.json({ error: "Goal must be at least 3 characters" }, { status: 400 });
  }

  const backend = detectBackend();
  if (!backend) {
    return NextResponse.json({ error: "No LLM backend found" }, { status: 500 });
  }

  const prompt = formatPrompt(CLARIFY_GOAL_PROMPT, { goal });
  const result = await spawnLlm(backend, prompt);

  if (result.exitCode !== 0 || !result.stdout.trim()) {
    return NextResponse.json(
      { error: `${backend.name} failed`, detail: result.stderr || "No output" },
      { status: 500 },
    );
  }

  const text = backend.parseOutput(result.stdout);

  // Extract JSON from response
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const data = JSON.parse(jsonMatch[0]);
    if (!data.questions || !Array.isArray(data.questions)) throw new Error("Missing questions array");
    return NextResponse.json({ goal, framingLogic: data.framingLogic ?? null, questions: data.questions });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to parse clarifying questions", detail: String(err), raw: text.slice(0, 300) },
      { status: 500 },
    );
  }
}
