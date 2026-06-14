import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const ENV_FILE = path.resolve(process.cwd(), "cli-engine", ".env");

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {};
  const content = readFileSync(ENV_FILE, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

function writeEnv(vars: Record<string, string | null>): void {
  const dir = path.dirname(ENV_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const existing = readEnv();
  for (const [key, value] of Object.entries(vars)) {
    if (value === null) {
      delete existing[key];
    } else {
      existing[key] = value;
    }
  }

  const lines = Object.entries(existing).map(([k, v]) => `${k}=${v}`);
  writeFileSync(ENV_FILE, lines.join("\n") + "\n", "utf-8");
}

export async function GET() {
  const env = readEnv();
  return NextResponse.json(env);
}

export async function PUT(request: Request) {
  let body: Record<string, string | null>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const allowed = ["CUSTOM_ENGINE_API_KEY", "CUSTOM_ENGINE_BASE_URL"];
  const filtered: Record<string, string | null> = {};
  for (const key of allowed) {
    if (key in body) {
      filtered[key] = body[key];
    }
  }

  writeEnv(filtered);
  return NextResponse.json({ message: "Saved" });
}
