import { NextResponse } from "next/server";
import { spawn, type ChildProcessWithoutNullStreams, execSync } from "child_process";
import { existsSync } from "fs";
import { getGoalTrees, mutateGoalTrees } from "@/lib/storage";

const EDIT_PROMPT = `You are a workflow graph editor. Given the current task tree (JSON) and a user's change request,
modify the tree accordingly. You can add, remove, rename, or restructure nodes.

Current tree:
{currentTree}

User request: "{request}"

Rules:
- Preserve maximum 3 levels (root → category → task)
- Each leaf node must be a single concrete action
- Keep titles short (max 80 chars)
- Return ONLY a JSON object:
{
  "changeDescription": "Brief description of what changed",
  "tree": { "title": "...", "description": "...", "children": [...] }
}`;

function findBinary(...candidates: string[]): string | null {
  for (const c of candidates) { if (c && existsSync(c)) return c; }
  return null;
}

function whichBinary(name: string): string | null {
  try {
    const p = execSync(`which ${name} 2>/dev/null`, { encoding: "utf-8", timeout: 3000 }).trim();
    return p && existsSync(p) ? p : null;
  } catch { return null; }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { currentTree?: unknown; request?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.request?.trim() || !body.currentTree) {
    return NextResponse.json({ error: "request and currentTree required" }, { status: 400 });
  }

  const prompt = EDIT_PROMPT
    .replace("{currentTree}", JSON.stringify(body.currentTree))
    .replace("{request}", body.request);

  // Find backend
  const opencodeBin = findBinary(process.env.OPENCODE_BIN ?? "", "/home/ab-11/.nvm/versions/node/v22.22.2/bin/opencode") ?? whichBinary("opencode");
  const claudeBin = findBinary(process.env.CLAUDE_BIN ?? "", "/home/ab-11/.local/bin/claude") ?? whichBinary("claude");
  const bin = opencodeBin ?? claudeBin;
  if (!bin) return NextResponse.json({ error: "No LLM backend" }, { status: 500 });

  const args = opencodeBin
    ? ["run", prompt, "--format", "json", "--model", "opencode-go/deepseek-v4-pro"]
    : ["-p", prompt, "--output-format", "json", "--max-turns", "5"];

  const child: ChildProcessWithoutNullStreams = spawn(bin, args, {
    env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"],
  }) as unknown as ChildProcessWithoutNullStreams;

  let stdout = "";
  child.stdout.on("data", (c: Buffer) => { if (stdout.length < 500_000) stdout += c.toString(); });

  await new Promise<void>((resolve) => {
    const t = setTimeout(() => { child.kill(); resolve(); }, 60_000);
    child.on("close", () => { clearTimeout(t); resolve(); });
    child.on("error", () => { clearTimeout(t); resolve(); });
  });

  if (!stdout.trim()) return NextResponse.json({ error: "No output from LLM" }, { status: 500 });

  // Parse output
  let text = stdout;
  if (opencodeBin) {
    const parts: string[] = [];
    for (const line of stdout.split("\n")) {
      try { const e = JSON.parse(line); if (e.type === "text" && e.part?.text) parts.push(e.part.text); } catch {}
    }
    text = parts.join("\n");
  } else {
    try { const e = JSON.parse(stdout); if (e.result) text = e.result; } catch {}
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return NextResponse.json({ error: "No JSON in response" }, { status: 500 });

  const data = JSON.parse(match[0]);
  if (!data.tree || !data.changeDescription) {
    return NextResponse.json({ error: "Missing tree or changeDescription" }, { status: 500 });
  }

  // Save to goal_trees
  await mutateGoalTrees(async (trees) => {
    const idx = trees.trees.findIndex((t) => t.goalId === id);
    if (idx >= 0) {
      trees.trees[idx].rootNode = data.tree;
      trees.trees[idx].updatedAt = new Date().toISOString();
    }
  });

  return NextResponse.json({ changeDescription: data.changeDescription, tree: data.tree });
}
