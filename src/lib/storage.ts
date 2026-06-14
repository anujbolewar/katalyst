/**
 * Storage abstraction: SQLite with JSON file fallback.
 *
 * When data/katalyst.db exists → uses SQLite (WAL mode) AS PRIMARY,
 * plus dual-writes to data/*.json files so that the daemon
 * (scripts/daemon/) can read tasks directly from JSON.
 *
 * When DB doesn't exist → falls back to data/*.json files only.
 */

import { isDbAvailable, getAll, insert, getDb } from "./db";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import type {
  Task, TasksFile,
  Goal, GoalsFile,
  InboxMessage, InboxFile,
  ActivityEvent, ActivityLogFile,
  Project, ProjectsFile,
  DecisionItem, DecisionsFile,
  AgentDefinition, AgentsFile,
  ActiveRun, ActiveRunsFile,
  GoalTreeRecord, GoalTreeFile,
  BrainDumpEntry, BrainDumpFile,
} from "./types";

import * as jsonData from "./data";
import { generateId } from "./utils";

const DATA_DIR = path.resolve(process.cwd(), "data");

/** Write data to a JSON file in data/ (side effect — used for dual-write to keep daemon in sync). */
function syncJsonFile(filename: string, data: unknown): void {
  const fp = path.join(DATA_DIR, filename);
  try { mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ok */ }
  writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseJson(row: unknown, fallback: unknown[] = []): string[] {
  if (Array.isArray(row)) return row as string[];
  if (typeof row === "string") { try { return JSON.parse(row); } catch { return fallback as string[]; } }
  return fallback as string[];
}

function toDbRow(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = (Array.isArray(v) || (typeof v === "object" && v !== null)) ? JSON.stringify(v) : v;
  }
  return out;
}

/** Convert snake_case SQLite column names to camelCase. */
function toCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const camelKey = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camelKey] = v;
  }
  return out;
}

// ─── Tasks ─────────────────────────────────────────────────────────────────

export async function getTasks(): Promise<TasksFile> {
  if (!isDbAvailable()) return jsonData.getTasks();
  const rows = getAll<Record<string, unknown>>("tasks").map(toCamel);
  const tasks = rows.map((r) => ({
    ...r,
    collaborators: parseJson(r.collaborators),
    subtasks: parseJson(r.subtasks),
    blockedBy: parseJson(r.blockedBy),
    dailyActions: parseJson(r.dailyActions),
    acceptanceCriteria: parseJson(r.acceptanceCriteria),
    comments: parseJson(r.comments),
    tags: parseJson(r.tags),
    fieldTaskIds: parseJson(r.fieldTasks),
  })) as unknown as Task[];
  return { tasks };
}

export async function mutateTasks<T>(fn: (data: TasksFile) => Promise<T>): Promise<T> {
  if (!isDbAvailable()) return jsonData.mutateTasks(fn);
  const data = await getTasks();
  const result = await fn(data);
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM tasks").run();
    for (const t of data.tasks) {
      insert("tasks", toDbRow(t as unknown as Record<string, unknown>));
    }
  })();
  syncJsonFile("tasks.json", data);
  return result;
}

// ─── Goals ─────────────────────────────────────────────────────────────────

export async function getGoals(): Promise<GoalsFile> {
  if (!isDbAvailable()) return jsonData.getGoals();
  const rows = getAll<Record<string, unknown>>("goals").map(toCamel);
  const goals = rows.map((r) => ({
    ...r,
    milestones: parseJson(r.milestones),
    tasks: parseJson(r.tasks),
  })) as unknown as Goal[];
  return { goals };
}

export async function mutateGoals<T>(fn: (data: GoalsFile) => Promise<T>): Promise<T> {
  if (!isDbAvailable()) return jsonData.mutateGoals(fn);
  const data = await getGoals();
  const result = await fn(data);
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM goals").run();
    for (const g of data.goals) {
      insert("goals", toDbRow(g as unknown as Record<string, unknown>));
    }
  })();
  syncJsonFile("goals.json", data);
  return result;
}

// ─── Projects ──────────────────────────────────────────────────────────────

export async function getProjects(): Promise<ProjectsFile> {
  if (!isDbAvailable()) return jsonData.getProjects();
  const rows = getAll<Record<string, unknown>>("projects").map(toCamel);
  const projects = rows.map((r) => ({
    ...r,
    tags: parseJson(r.tags),
  })) as unknown as Project[];
  return { projects };
}

// ─── Inbox ─────────────────────────────────────────────────────────────────

export async function getInbox(): Promise<InboxFile> {
  if (!isDbAvailable()) return jsonData.getInbox();
  const rows = getAll<Record<string, unknown>>("inbox").map(toCamel);
  const messages = rows.map((r) => ({
    ...r,
    from: (r as Record<string, unknown>).from ?? r.from,
    to: (r as Record<string, unknown>).to ?? r.to,
  })) as unknown as InboxMessage[];
  return { messages };
}

export async function mutateInbox<T>(fn: (data: InboxFile) => Promise<T>): Promise<T> {
  if (!isDbAvailable()) return jsonData.mutateInbox(fn);
  const data = await getInbox();
  const result = await fn(data);
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM inbox").run();
    for (const m of data.messages) {
      insert("inbox", toDbRow(m as unknown as Record<string, unknown>));
    }
  })();
  syncJsonFile("inbox.json", data);
  return result;
}

// ─── Activity Log ──────────────────────────────────────────────────────────

export async function getActivityLog(): Promise<ActivityLogFile> {
  if (!isDbAvailable()) return jsonData.getActivityLog();
  const rows = getAll<Record<string, unknown>>("activity_log").map(toCamel);
  return { events: rows as unknown as ActivityEvent[] };
}

export async function mutateActivityLog<T>(fn: (data: ActivityLogFile) => Promise<T>): Promise<T> {
  if (!isDbAvailable()) return jsonData.mutateActivityLog(fn);
  const data = await getActivityLog();
  const result = await fn(data);
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM activity_log").run();
    for (const e of data.events) {
      insert("activity_log", toDbRow(e as unknown as Record<string, unknown>));
    }
  })();
  syncJsonFile("activity-log.json", data);
  return result;
}

// ─── Decisions ─────────────────────────────────────────────────────────────

export async function getDecisions(): Promise<DecisionsFile> {
  if (!isDbAvailable()) return jsonData.getDecisions();
  const rows = getAll<Record<string, unknown>>("decisions").map(toCamel);
  const decisions = rows.map((r) => ({
    ...r,
    options: parseJson(r.options),
  })) as unknown as DecisionItem[];
  return { decisions };
}

// ─── Agents ────────────────────────────────────────────────────────────────

export async function getAgents(): Promise<AgentsFile> {
  if (!isDbAvailable()) return jsonData.getAgents();
  const rows = getAll<Record<string, unknown>>("agents").map(toCamel);
  const agents = rows.map((r) => ({
    ...r,
    capabilities: parseJson(r.capabilities),
  })) as unknown as AgentDefinition[];
  return { agents };
}

// ─── Active Runs ───────────────────────────────────────────────────────────

export async function getActiveRuns(): Promise<ActiveRunsFile> {
  if (!isDbAvailable()) return jsonData.getActiveRuns();
  const rows = getAll<Record<string, unknown>>("active_runs").map(toCamel);
  return { runs: rows as unknown as ActiveRun[] };
}

// ─── Project Mutations ────────────────────────────────────────────────────

export async function mutateProjects<T>(fn: (data: ProjectsFile) => Promise<T>): Promise<T> {
  if (!isDbAvailable()) return jsonData.mutateProjects(fn);
  const data = await getProjects();
  const result = await fn(data);
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM projects").run();
    for (const p of data.projects) {
      insert("projects", toDbRow({ ...p, teamMembers: JSON.stringify(p.teamMembers ?? []), tags: JSON.stringify(p.tags ?? []) } as unknown as Record<string, unknown>));
    }
  })();
  syncJsonFile("projects.json", data);
  return result;
}

// ─── Decision Mutations ───────────────────────────────────────────────────

export async function mutateDecisions<T>(fn: (data: DecisionsFile) => Promise<T>): Promise<T> {
  if (!isDbAvailable()) return jsonData.mutateDecisions(fn);
  const data = await getDecisions();
  const result = await fn(data);
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM decisions").run();
    for (const d of data.decisions) {
      insert("decisions", toDbRow({ ...d, options: JSON.stringify(d.options) } as unknown as Record<string, unknown>));
    }
  })();
  syncJsonFile("decisions.json", data);
  return result;
}

// ─── Agent Mutations ──────────────────────────────────────────────────────

export async function mutateAgents<T>(fn: (data: AgentsFile) => Promise<T>): Promise<T> {
  if (!isDbAvailable()) return jsonData.mutateAgents(fn);
  const data = await getAgents();
  const result = await fn(data);
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM agents").run();
    for (const a of data.agents) {
      insert("agents", toDbRow({ ...a, capabilities: JSON.stringify(a.capabilities) } as unknown as Record<string, unknown>));
    }
  })();
  syncJsonFile("agents.json", data);
  return result;
}

// ─── Brain Dump Mutations ─────────────────────────────────────────────────

export async function getBrainDump(): Promise<BrainDumpFile> {
  if (!isDbAvailable()) return jsonData.getBrainDump();
  const rows = getAll<Record<string, unknown>>("brain_dump").map(toCamel);
  const entries = rows.map((r) => ({
    ...r,
    processed: typeof r.processed === "number" ? r.processed === 1 : Boolean(r.processed),
    tags: parseJson(r.tags),
  })) as unknown as BrainDumpEntry[];
  return { entries };
}

export async function mutateBrainDump<T>(fn: (data: BrainDumpFile) => Promise<T>): Promise<T> {
  if (!isDbAvailable()) return jsonData.mutateBrainDump(fn);
  const data = await getBrainDump();
  const result = await fn(data);
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM brain_dump").run();
    for (const e of data.entries) {
      insert("brain_dump", toDbRow({
        ...e,
        processed: e.processed ? 1 : 0,
        tags: JSON.stringify(e.tags ?? []),
      } as unknown as Record<string, unknown>));
    }
  })();
  syncJsonFile("brain-dump.json", data);
  return result;
}

// ─── Goal Trees ────────────────────────────────────────────────────────────

export async function getGoalTrees(): Promise<GoalTreeFile> {
  if (!isDbAvailable()) return jsonData.getGoalTrees();
  const rows = getAll<Record<string, unknown>>("goal_trees").map(toCamel);
  const trees = rows.map((r) => ({
    ...r,
    taskIds: parseJson(r.taskIds ?? r.task_ids),
    rootNode: typeof r.rootNode === "string" ? JSON.parse(r.rootNode as string) : r.rootNode,
    pipelineData: typeof r.pipelineData === "string" ? JSON.parse(r.pipelineData as string) : (r.pipelineData ?? {}),
  })) as unknown as GoalTreeRecord[];
  return { trees };
}

export async function mutateGoalTrees<T>(fn: (data: GoalTreeFile) => Promise<T>): Promise<T> {
  if (!isDbAvailable()) return jsonData.mutateGoalTrees(fn);
  const data = await getGoalTrees();
  const result = await fn(data);
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM goal_trees").run();
    for (const t of data.trees) {
      insert("goal_trees", toDbRow({
        goalId: t.goalId, goalTitle: t.goalTitle, taskIds: t.taskIds,
        rootNode: JSON.stringify(t.rootNode),
        pipelineData: JSON.stringify(t.pipelineData ?? {}),
        createdAt: t.createdAt, updatedAt: t.updatedAt,
      }));
    }
  })();
  syncJsonFile("goal-trees.json", data);
  return result;
}
