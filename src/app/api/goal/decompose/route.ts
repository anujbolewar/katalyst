import { NextResponse } from "next/server";
import { mutateTasks, mutateGoals, mutateGoalTrees } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import type { Goal, GoalType, GoalStatus, GoalTreeRecord, GoalTreeNode } from "@/lib/types";
import { DECOMPOSE_WITH_PIPELINE_PROMPT, FAST_DECOMPOSE_PROMPT, formatPrompt } from "@/features/goal-decomposition/prompts";
import { parseGoalTree } from "@/features/goal-decomposition/parser";
import { adaptGoalTreeToTasks } from "@/features/goal-decomposition/adapter";
import type { GoalNode } from "@/features/goal-decomposition/types";
import { detectBackend, spawnLlm } from "@/lib/llm";
import type { LlmResult } from "@/lib/llm";

// ─── POST /api/goal/decompose ───────────────────────────────────────────────

/**
 * Detect if the parsed pipeline object itself is a tree (has title + children).
 * Smaller models like deepseek-v4-pro may skip the {"tree": ...} wrapper and
 * return the tree object directly at the top level.
 */
function detectTopLevelTree(pipeline: Record<string, unknown>): unknown | null {
  if (typeof pipeline.title === "string" && Array.isArray(pipeline.children)) {
    return { title: pipeline.title, description: pipeline.description, children: pipeline.children };
  }
  return null;
}

export async function POST(request: Request) {
  let body: { goal?: string; answers?: { id: string; question: string; answer: string }[]; extraContext?: string; effortLevel?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const goal = body.goal?.trim();
  if (!goal || goal.length < 3) {
    return NextResponse.json({ error: "Goal must be at least 3 characters" }, { status: 400 });
  }

  const answers = body.answers ?? [];
  const extraContext = body.extraContext?.trim() ?? "";
  const isHighEffort = body.effortLevel === "high";

  // 1. Detect available LLM backend
  const backend = detectBackend("max");
  if (!backend) {
    return NextResponse.json(
      { error: "No LLM backend found. Install opencode or claude." },
      { status: 500 },
    );
  }

  // 2. Build the decomposition prompt — with clarifying answers if provided
  let promptGoal = goal;
  if (answers.length > 0) {
    const qaBlock = answers
      .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
      .join("\n\n");
    promptGoal = `${goal}\n\nClarifying context from user:\n${qaBlock}`;
  }

  const promptTemplate = isHighEffort ? DECOMPOSE_WITH_PIPELINE_PROMPT : FAST_DECOMPOSE_PROMPT;
  const prompt = formatPrompt(promptTemplate, {
    goal: promptGoal,
    extraContext: extraContext || "None provided",
  });

  // 3. Call the LLM
  let result: LlmResult;
  try {
    result = await spawnLlm(backend, prompt);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to invoke ${backend.name}`, detail: String(err) },
      { status: 500 },
    );
  }

  if (result.exitCode !== 0 || !result.stdout.trim()) {
    return NextResponse.json(
      {
        error: `${backend.name} returned an error`,
        detail: result.stderr || "No output received",
        exitCode: result.exitCode,
      },
      { status: 500 },
    );
  }

  // 4. Extract text from LLM output
  const textContent = backend.parseOutput(result.stdout);

  // 5. Parse pipeline output — extract researcher, tree, reviewer
  let pipeline: { researcher?: { brief: string; findings: string[] }; decomposer?: { tree: unknown }; reviewer?: { verdict: string; notes: string; suggestions: string[] } } = {};
  let rootNode;
  try {
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    pipeline = JSON.parse(jsonMatch[0]);

    // Low effort: tree is at top level. High effort: tree is nested under decomposer.
    // Fallback: smaller models may omit the "tree" wrapper and return the tree object directly.
    const tree = isHighEffort
      ? (pipeline.decomposer?.tree)
      : ((pipeline as unknown as { tree: unknown }).tree ?? detectTopLevelTree(pipeline));

    if (!tree) throw new Error("Missing tree in response");
    rootNode = parseGoalTree(tree as Record<string, unknown>);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to parse decomposition result",
        detail: String(err),
        rawResponse: textContent.slice(0, 2000),
      },
      { status: 500 },
    );
  }

  // 6. Adapt the tree to Task objects
  const tasks = adaptGoalTreeToTasks(rootNode);

  if (tasks.length === 0) {
    return NextResponse.json(
      { error: "No tasks were generated from the goal" },
      { status: 422 },
    );
  }

  // 7. Write tasks atomically
  await mutateTasks(async (data) => {
    for (const task of tasks) {
      data.tasks.push(task);
    }
  });

  // 8. Write a goal record
  const goalType: GoalType = "medium-term";
  const goalStatus: GoalStatus = "in-progress";
  const goalId = generateId("goal");
  await mutateGoals(async (data) => {
    const goalRecord: Goal = {
      id: goalId,
      title: goal,
      type: goalType,
      timeframe: new Date().toISOString(),
      parentGoalId: null,
      projectId: null,
      status: goalStatus,
      milestones: [],
      tasks: tasks.map((t) => t.id),
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    data.goals.push(goalRecord);
  });

  // 9. Save the goal tree for live rendering
  function stripStatus(node: GoalNode): GoalTreeNode {
    return {
      id: node.id,
      title: node.title,
      description: node.description,
      status: node.status,
      children: node.children.map(stripStatus),
    };
  }
  await mutateGoalTrees(async (data) => {
    const record: GoalTreeRecord = {
      goalId,
      goalTitle: goal,
      taskIds: tasks.map((t) => t.id),
      rootNode: stripStatus(rootNode),
      pipelineData: { researcher: pipeline.researcher, reviewer: pipeline.reviewer },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.trees.push(record);
  });

  return NextResponse.json(
    {
      goal: goal,
      goalId,
      taskCount: tasks.length,
      tasks: tasks.map((t) => ({ id: t.id, title: t.title })),
      backend: result.backend,
      pipeline: {
        researcher: pipeline.researcher ?? null,
        reviewer: pipeline.reviewer ?? null,
      },
    },
    { status: 201 },
  );
}
