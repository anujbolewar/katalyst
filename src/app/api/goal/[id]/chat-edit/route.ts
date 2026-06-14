import { NextResponse } from "next/server";
import { spawn, type ChildProcessWithoutNullStreams, execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "daemon-config.json");

const CHAT_EDIT_PROMPT = `You are a precise graph editor. Given a task tree (JSON) and a user's chat message, return ONLY the specific node-level changes needed — NOT the full tree.

Current tree:
{currentTree}

User request: "{request}"

Rules:
- Return ONLY a JSON object with "explanation" and "diffs" — no other text
- Each diff must have "action" ("update" | "add" | "remove") and "nodeId"
- "update": change an existing node's title/description. Include "title" and/or "description"
- "add": add a new child node. Include "nodeId" (new unique id), "parentId", "title", and "description"
- "remove": delete a node. Include just "nodeId"
- Keep titles under 80 chars
- Be minimal — only include nodes that actually change

Return format:
{
  "explanation": "Brief description of what changed and why",
  "diffs": [
    { "action": "update", "nodeId": "x", "title": "new title" },
    { "action": "add", "nodeId": "new-1", "parentId": "x", "title": "...", "description": "..." },
    { "action": "remove", "nodeId": "y" }
  ]
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

export async function POST(
  request: Request,
  _ctx: { params: Promise<{ id: string }> },
) {
  let body: { tree?: unknown; message?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.message?.trim() || !body.tree) {
    return NextResponse.json({ error: "message and tree required" }, { status: 400 });
  }

  const prompt = CHAT_EDIT_PROMPT
    .replace("{currentTree}", JSON.stringify(body.tree))
    .replace("{request}", body.message);

  const ollama = loadOllamaConfig();
  const model = ollama.enabled && ollama.model
    ? `opencode-go/${ollama.model}`
    : "opencode-go/deepseek-v4-pro";

  const opencodeBin =
    findBinary(process.env.OPENCODE_BIN ?? "", "/home/ab-11/.nvm/versions/node/v22.22.2/bin/opencode") ??
    whichBinary("opencode");
  const claudeBin =
    findBinary(process.env.CLAUDE_BIN ?? "", "/home/ab-11/.local/bin/claude") ??
    whichBinary("claude");
  const bin = opencodeBin ?? claudeBin;
  if (!bin) return NextResponse.json({ error: "No LLM backend" }, { status: 500 });

  const args = opencodeBin
    ? ["run", prompt, "--format", "json", "--model", model]
    : ["-p", prompt, "--output-format", "json", "--max-turns", "3"];

  const env: Record<string, string | undefined> = { ...process.env };
  if (ollama.enabled && ollama.model) {
    env.OPENAI_API_BASE = "http://localhost:11434/v1";
    env.OPENAI_API_KEY = "ollama";
  }

  const child: ChildProcessWithoutNullStreams = spawn(bin, args, {
    env: env as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
  }) as unknown as ChildProcessWithoutNullStreams;

  let stdout = "";
  child.stdout.on("data", (c: Buffer) => {
    if (stdout.length < 200_000) stdout += c.toString();
  });

  await new Promise<void>((resolve) => {
    const t = setTimeout(() => { child.kill(); resolve(); }, 45_000);
    child.on("close", () => { clearTimeout(t); resolve(); });
    child.on("error", () => { clearTimeout(t); resolve(); });
  });

  if (!stdout.trim()) return NextResponse.json({ error: "No output from LLM" }, { status: 500 });

  let text = stdout;
  if (opencodeBin) {
    const parts: string[] = [];
    for (const line of stdout.split("\n")) {
      try {
        const e = JSON.parse(line);
        if (e.type === "text" && e.part?.text) parts.push(e.part.text);
      } catch { /* skip */ }
    }
    text = parts.join("\n");
  } else {
    try {
      const e = JSON.parse(stdout);
      if (e.result) text = e.result;
    } catch { /* keep raw */ }
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return NextResponse.json({ error: "No JSON in response", raw: text.slice(0, 500) }, { status: 500 });

  let data: { explanation?: string; diffs?: unknown[] };
  try {
    data = JSON.parse(match[0]);
  } catch {
    return NextResponse.json({ error: "Invalid JSON in response", raw: match[0].slice(0, 500) }, { status: 500 });
  }

  if (!data.explanation || !Array.isArray(data.diffs)) {
    return NextResponse.json({ error: "Missing explanation or diffs array" }, { status: 500 });
  }

  const validDiffs = data.diffs.filter((d: unknown) => {
    const diff = d as Record<string, unknown>;
    return diff && typeof diff.action === "string" && typeof diff.nodeId === "string";
  });

  if (validDiffs.length === 0) {
    return NextResponse.json({ error: "No valid diffs returned" }, { status: 500 });
  }

  return NextResponse.json({
    explanation: data.explanation,
    diffs: validDiffs,
  });
}
