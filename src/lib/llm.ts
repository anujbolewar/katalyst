import { spawn, type ChildProcessWithoutNullStreams, execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "daemon-config.json");

// ─── Ollama Config ──────────────────────────────────────────────────────────

function loadOllamaConfig(): { enabled: boolean; model: string | null } {
  try {
    if (!existsSync(CONFIG_FILE)) return { enabled: false, model: null };
    const cfg = JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as Record<string, unknown>;
    const ollama = (cfg.execution as Record<string, unknown> | undefined)?.ollama as Record<string, unknown> | undefined;
    return {
      enabled: ollama?.enabled === true,
      model: typeof ollama?.model === "string" ? ollama.model : null,
    };
  } catch { return { enabled: false, model: null }; }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findBinary(...candidates: string[]): string | null {
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

function whichBinary(name: string): string | null {
  try {
    const p = execSync(`which ${name} 2>/dev/null`, { encoding: "utf-8", timeout: 3000 }).trim();
    return p && existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

// ─── LLM Backend ────────────────────────────────────────────────────────────

export interface LlmBackend {
  bin: string;
  name: string;
  isOllama: boolean;
  args: (prompt: string) => string[];
  parseOutput: (stdout: string) => string;
}

export interface LlmResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  backend: string;
}

/**
 * Detects the best available LLM backend.
 * Options for `variant`:
 *   - "max"  → adds --variant max (used for complex tasks: decompose, clarify)
 *   - "fast" → no variant flag (used for quick/non-critical calls)
 */
export function detectBackend(variant: "max" | "fast" = "max"): LlmBackend | null {
  const ollama = loadOllamaConfig();

  const opencodeBin =
    findBinary(
      process.env.OPENCODE_BIN ?? "",
      "/home/ab-11/.nvm/versions/node/v22.22.2/bin/opencode",
      "/usr/local/bin/opencode",
      "/usr/bin/opencode",
    ) ?? whichBinary("opencode");

  if (opencodeBin) {
    const baseModel = ollama.enabled && ollama.model
      ? `opencode-go/${ollama.model}`
      : "opencode-go/deepseek-v4-pro";

    const baseArgs = ["run", "--format", "json", "--model", baseModel];
    if (variant === "max") baseArgs.push("--variant", "max");

    return {
      bin: opencodeBin,
      name: "opencode",
      isOllama: ollama.enabled,
      args: (prompt: string) => [...baseArgs, prompt],
      parseOutput: (stdout: string): string => {
        const textParts: string[] = [];
        for (const line of stdout.split("\n")) {
          try {
            const evt = JSON.parse(line);
            if (evt.type === "text" && evt.part?.text) {
              textParts.push(evt.part.text);
            }
          } catch { /* skip non-JSON lines */ }
        }
        return textParts.join("\n");
      },
    };
  }

  // Fallback: Claude Code
  const claudeBin =
    findBinary(
      process.env.CLAUDE_BIN ?? "",
      "/home/ab-11/.local/bin/claude",
      "/usr/local/bin/claude",
      "/usr/bin/claude",
    ) ?? whichBinary("claude");

  if (claudeBin) {
    const maxTurns = variant === "max" ? 10 : 5;
    return {
      bin: claudeBin,
      name: "claude",
      isOllama: false,
      args: (prompt: string) => [
        "-p", prompt,
        "--output-format", "json",
        "--max-turns", String(maxTurns),
      ],
      parseOutput: (stdout: string): string => {
        try {
          const envelope = JSON.parse(stdout);
          if (envelope.result && typeof envelope.result === "string") {
            return envelope.result;
          }
        } catch { /* not JSON-wrapped */ }
        return stdout;
      },
    };
  }

  return null;
}

// ─── Spawn ──────────────────────────────────────────────────────────────────

export function spawnLlm(
  backend: LlmBackend,
  prompt: string,
  timeoutMs = 120_000,
): Promise<LlmResult> {
  return new Promise((resolve) => {
    const args = backend.args(prompt);
    const env = { ...process.env };

    if (backend.isOllama) {
      env.OPENAI_API_BASE = "http://localhost:11434/v1";
      env.OPENAI_API_KEY = "ollama";
    }

    const child: ChildProcessWithoutNullStreams = spawn(backend.bin, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    }) as unknown as ChildProcessWithoutNullStreams;

    let stdout = "";
    let stderr = "";
    const MAX_OUTPUT = 1_000_000;

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < MAX_OUTPUT) stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_OUTPUT) stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);

    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code, timedOut: false, backend: backend.name });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: stderr || String(err), exitCode: null, timedOut: false, backend: backend.name });
    });
  });
}

// ─── Parse JSON from LLM Output ────────────────────────────────────────────

export function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in LLM response");
  return JSON.parse(match[0]);
}
