// ─── Task Status ───────────────────────────────────────────────────────────
export const TASK_STATUS_STARTED = "started" as const;
export const TASK_STATUS_EXECUTING = "executing" as const;
export const TASK_STATUS_COMPLETED = "completed" as const;
export const TASK_STATUS_FAILED = "failed" as const;

export type TaskStatus =
  | typeof TASK_STATUS_STARTED
  | typeof TASK_STATUS_EXECUTING
  | typeof TASK_STATUS_COMPLETED
  | typeof TASK_STATUS_FAILED;

// ─── Goal Tree Node ─────────────────────────────────────────────────────────
export interface GoalNode {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  children: GoalNode[];
  result?: string;
}

// ─── Analysis (tool selection) ──────────────────────────────────────────────
export interface Analysis {
  reasoning: string;
  action: "reason" | "search" | "code" | "browse";
  arg: string;
}

// ─── Decomposition Result ───────────────────────────────────────────────────
export interface DecompositionResult {
  goal: string;
  rootNode: GoalNode;
  rawPrompt: string;
  rawResponse: string;
}

// ─── Type Predicates ────────────────────────────────────────────────────────
export function isTaskStatus(value: string): value is TaskStatus {
  return [
    TASK_STATUS_STARTED,
    TASK_STATUS_EXECUTING,
    TASK_STATUS_COMPLETED,
    TASK_STATUS_FAILED,
  ].includes(value as TaskStatus);
}
