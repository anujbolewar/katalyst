import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Ollama returned ${res.status}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    const models: string[] = (data.models as Array<{ name: string }> | undefined)
      ?.map((m) => m.name) ?? [];
    return NextResponse.json({ models });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ollama unreachable" },
      { status: 502 },
    );
  }
}
