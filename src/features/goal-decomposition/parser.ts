import type { GoalNode } from "./types";
import { TASK_STATUS_STARTED } from "./types";
import { nanoid } from "nanoid";

// ─── Flat Task List Parser ─────────────────────────────────────────────────
// Adapted from reworkd_platform/web/api/agent/task_output_parser.py

const ARRAY_REGEX =
  /\[\s*\]|(\[(?:\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*,?)*\s*\])/;

const NO_TASK_REGEX =
  /^No( (new|further|additional|extra|other))? tasks? (is )?(required|needed|added|created|inputted).*/i;

const TASK_DONE_REGEX = /^Task (complete|completed|finished|done|over|success).*/i;

const DO_NOTHING_REGEX = /^(\s*|Do nothing(\s.*)?)$/i;

const PREFIX_REGEX =
  /^(Task\s*\d*\.\s*|Task\s*\d*[-:]?\s*|Step\s*\d*[-:]?\s*|Step\s*[-:]?\s*|\d+\.\s*|\d+\s*[-:]?\s*|^\.\s*|^\.*)/i;

function extractArray(input: string): string[] {
  const match = input.match(ARRAY_REGEX);
  if (match?.[1]) {
    try {
      return JSON.parse(match[1]);
    } catch {
      // Fall through to multiline handler
    }
  }
  return handleMultiline(input);
}

function handleMultiline(input: string): string[] {
  const lines = input
    .split("\n")
    .map((line) => line.replace(/.*?(\d+\..+)/, "$1").trim())
    .filter((line) => line !== "");

  if (lines.some((line) => /^\d+\..+/.test(line))) {
    return lines;
  }
  throw new Error(`Failed to extract array from LLM response: ${input.slice(0, 200)}`);
}

function removePrefix(task: string): string {
  return task.replace(PREFIX_REGEX, "");
}

function realTaskFilter(task: string): boolean {
  return (
    !NO_TASK_REGEX.test(task) &&
    !TASK_DONE_REGEX.test(task) &&
    !DO_NOTHING_REGEX.test(task)
  );
}

export function parseFlatTaskList(
  text: string,
  completedTasks: string[] = []
): string[] {
  const arrayStr = extractArray(text);
  const allTasks = arrayStr.filter(realTaskFilter).map(removePrefix);
  return allTasks.filter((task) => !completedTasks.includes(task));
}

// ─── Tree Parser ───────────────────────────────────────────────────────────
interface RawTreeNode {
  title: string;
  description?: string;
  children?: RawTreeNode[];
}

export function parseGoalTree(input: string | Record<string, unknown>): GoalNode {
  let raw: RawTreeNode;

  if (typeof input === "string") {
    const jsonMatch = input.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in LLM response");
    }
    raw = JSON.parse(jsonMatch[0]) as RawTreeNode;
  } else {
    raw = input as unknown as RawTreeNode;
  }

  if (!raw.title || typeof raw.title !== "string") {
    throw new Error("Parsed tree node missing required 'title' field");
  }

  function convert(node: RawTreeNode): GoalNode {
    return {
      id: nanoid(),
      title: node.title,
      description: node.description,
      status: TASK_STATUS_STARTED,
      children: (node.children ?? []).map(convert),
    };
  }

  return convert(raw);
}
