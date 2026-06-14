import { NextResponse } from "next/server";
import { CLARIFY_GOAL_PROMPT, formatPrompt } from "@/features/goal-decomposition/prompts";
import { detectBackend, spawnLlm, extractJson } from "@/lib/llm";

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

  const backend = detectBackend("max");
  if (!backend) {
    return NextResponse.json({ error: "No LLM backend found. Install opencode or claude." }, { status: 500 });
  }

  const prompt = formatPrompt(CLARIFY_GOAL_PROMPT, { goal });

  let result;
  try {
    result = await spawnLlm(backend, prompt, 60_000);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to invoke ${backend.name}`, detail: String(err) },
      { status: 500 },
    );
  }

  if (result.exitCode !== 0 || !result.stdout.trim()) {
    return NextResponse.json(
      { error: `${backend.name} returned an error`, detail: result.stderr || "No output received", exitCode: result.exitCode },
      { status: 500 },
    );
  }

  const textContent = backend.parseOutput(result.stdout);

  try {
    const data = extractJson(textContent);
    if (!data.questions || !Array.isArray(data.questions)) {
      throw new Error("Missing questions array");
    }
    return NextResponse.json({
      goal,
      framingLogic: data.framingLogic ?? null,
      questions: data.questions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to parse clarifying questions", detail: String(err), rawResponse: textContent.slice(0, 500) },
      { status: 500 },
    );
  }
}
