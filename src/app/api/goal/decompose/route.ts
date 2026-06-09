import { NextResponse } from "next/server";
import { spawn, type ChildProcessWithoutNullStreams, execSync } from "child_process";
import { existsSync } from "fs";
import { mutateTasks, mutateGoals, mutateGoalTrees } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import type { Goal, GoalType, GoalStatus, GoalTreeRecord, GoalTreeNode } from "@/lib/types";
import { TREE_DECOMPOSE_PROMPT, DECOMPOSE_WITH_PIPELINE_PROMPT, formatPrompt } from "@/features/goal-decomposition/prompts";
import { parseGoalTree } from "@/features/goal-decomposition/parser";
import { adaptGoalTreeToTasks } from "@/features/goal-decomposition/adapter";
import type { GoalNode } from "@/features/goal-decomposition/types";

// ─── LLM Backend Detection ──────────────────────────────────────────────────

interface LlmBackend {
  bin: string;
  args: (prompt: string) => string[];
  parseOutput: (stdout: string) => string;
  name: string;
}

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

function detectBackend(): LlmBackend | null {
  // Prefer opencode — supports multiple free models
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
      args: (prompt: string) => [
        "run", prompt,
        "--format", "json",
        "--model", "opencode-go/deepseek-v4-pro",
        "--variant", "max",
      ],
      parseOutput: (stdout: string): string => {
        // opencode outputs JSONL: one JSON object per line
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
    return {
      bin: claudeBin,
      name: "claude",
      args: (prompt: string) => [
        "-p", prompt,
        "--output-format", "json",
        "--max-turns", "10",
      ],
      parseOutput: (stdout: string): string => {
        // Claude wraps output in {"type":"result",...,"result":"..."}
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

// ─── Spawn LLM ──────────────────────────────────────────────────────────────

interface LlmResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  backend: string;
}

function spawnLlm(backend: LlmBackend, prompt: string, timeoutMs = 120_000): Promise<LlmResult> {
  return new Promise((resolve) => {
    const args = backend.args(prompt);
    const child: ChildProcessWithoutNullStreams = spawn(backend.bin, args, {
      env: { ...process.env },
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

// ─── POST /api/goal/decompose ───────────────────────────────────────────────

export async function POST(request: Request) {
  let body: { goal?: string; answers?: { id: string; question: string; answer: string }[] };
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

  // 1. Detect available LLM backend
  const backend = detectBackend();
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
  const prompt = formatPrompt(DECOMPOSE_WITH_PIPELINE_PROMPT, { goal: promptGoal });

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
    const tree = pipeline.decomposer?.tree;
    if (!tree) throw new Error("Missing decomposer.tree in response");
    rootNode = parseGoalTree(JSON.stringify(tree));
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to parse decomposition result",
        detail: String(err),
        rawResponse: textContent.slice(0, 500),
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
