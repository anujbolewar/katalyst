/**
 * One-time migration: JSON files → SQLite.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-sqlite.ts
 *
 * After migration:
 *   - data/*.json are backed up to data/backup-json/
 *   - data/katalyst.db is created
 *   - All future reads/writes use SQLite
 */

import { readFile, writeFile, mkdir, rename } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import Database from "better-sqlite3";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "katalyst.db");
const BACKUP_DIR = path.join(DATA_DIR, "backup-json");

interface JsonFile {
  name: string;
  table: string;
  key: string;
  /** Map JSON camelCase keys → SQL snake_case columns */
  columns?: Record<string, string>;
  mapRow?: (row: Record<string, unknown>) => Record<string, unknown>;
}

const FILES: JsonFile[] = [
  { name: "tasks.json", table: "tasks", key: "tasks",
    columns: { projectId: "project_id", milestoneId: "milestone_id", assignedTo: "assigned_to", estimatedMinutes: "estimated_minutes", actualMinutes: "actual_minutes", acceptanceCriteria: "acceptance_criteria", fieldTaskIds: "field_task_ids", dueDate: "due_date", createdAt: "created_at", updatedAt: "updated_at", completedAt: "completed_at", deletedAt: "deleted_at", dailyActions: "daily_actions", blockedBy: "blocked_by" },
    mapRow: (r) => ({ ...r, collaborators: JSON.stringify(r.collaborators ?? []), subtasks: JSON.stringify(r.subtasks ?? []), blockedBy: JSON.stringify(r.blockedBy ?? []), dailyActions: JSON.stringify(r.dailyActions ?? []), acceptanceCriteria: JSON.stringify(r.acceptanceCriteria ?? []), comments: JSON.stringify(r.comments ?? []), tags: JSON.stringify(r.tags ?? []), fieldTaskIds: JSON.stringify(r.fieldTaskIds ?? []) }) },
  { name: "goals.json", table: "goals", key: "goals",
    columns: { parentGoalId: "parent_goal_id", projectId: "project_id", createdAt: "created_at", deletedAt: "deleted_at" },
    mapRow: (r) => ({ ...r, milestones: JSON.stringify(r.milestones ?? []), tasks: JSON.stringify(r.tasks ?? []) }) },
  { name: "projects.json", table: "projects", key: "projects",
    columns: { createdAt: "created_at", updatedAt: "updated_at", completedAt: "completed_at", deletedAt: "deleted_at" },
    mapRow: (r) => ({ ...r, tags: JSON.stringify(r.tags ?? []), taskIds: JSON.stringify(r.taskIds ?? []) }) },
  { name: "inbox.json", table: "inbox", key: "messages",
    columns: { taskId: "task_id", createdAt: "created_at", readAt: "read_at" } },
  { name: "brain-dump.json", table: "brain_dump", key: "entries",
    columns: { capturedAt: "captured_at", convertedTo: "converted_to" },
    mapRow: (r) => ({ ...r, processed: r.processed ? 1 : 0, tags: JSON.stringify(r.tags ?? []) }) },
  { name: "activity-log.json", table: "activity_log", key: "events",
    columns: { taskId: "task_id" } },
  { name: "decisions.json", table: "decisions", key: "decisions",
    columns: { taskId: "task_id", createdAt: "created_at", answeredAt: "answered_at" },
    mapRow: (r) => ({ ...r, options: JSON.stringify(r.options ?? []) }) },
  { name: "agents.json", table: "agents", key: "agents",
    mapRow: (r) => ({ ...r, capabilities: JSON.stringify(r.capabilities ?? []) }) },
  { name: "goal-trees.json", table: "goal_trees", key: "trees",
    columns: { goalId: "goal_id", goalTitle: "goal_title", taskIds: "task_ids", rootNode: "root_node", createdAt: "created_at", updatedAt: "updated_at" },
    mapRow: (r) => ({ ...r, rootNode: JSON.stringify(r.rootNode), taskIds: JSON.stringify(r.taskIds ?? []) }) },
  { name: "active-runs.json", table: "active_runs", key: "runs",
    columns: { taskId: "task_id", agentId: "agent_id", startedAt: "started_at", endedAt: "ended_at", exitCode: "exit_code" } },
];

function toSnake(key: string, columns?: Record<string, string>): string {
  return columns?.[key] ?? key.replace(/([A-Z])/g, "_$1").toLowerCase();
}

async function main() {
  console.log("=== Katalyst: JSON → SQLite Migration ===\n");

  // Backup
  await mkdir(BACKUP_DIR, { recursive: true });
  console.log(`Backup dir: ${BACKUP_DIR}`);

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Import schema
  const { SCHEMA } = await import("../src/lib/schema");
  db.exec(SCHEMA);

  let totalRows = 0;

  for (const file of FILES) {
    const filePath = path.join(DATA_DIR, file.name);
    if (!existsSync(filePath)) {
      console.log(`  SKIP  ${file.name} (not found)`);
      continue;
    }

    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw);
    const rows = data[file.key] ?? [];

    if (rows.length === 0) {
      console.log(`  EMPTY ${file.name}`);
      continue;
    }

    const jsonKeys = Object.keys(rows[0]);
    const sqlColumns = jsonKeys.map((k) => toSnake(k, file.columns));
    const placeholders = jsonKeys.map(() => "?").join(", ");

    // Get actual table columns to filter unknown keys
    const tableInfo = db.prepare(`PRAGMA table_info(${file.table})`).all() as { name: string }[];
    const validColumns = new Set(tableInfo.map((c) => c.name));
    const validIndices = sqlColumns.map((col, i) => validColumns.has(col) ? i : -1).filter((i) => i >= 0);
    const filteredColumns = validIndices.map((i) => sqlColumns[i]);
    const filteredPlaceholders = validIndices.map(() => "?").join(", ");

    // Quote SQL reserved words
    const RESERVED = new Set(["from", "to"]);
    const quotedColumns = filteredColumns.map((c) => RESERVED.has(c.toLowerCase()) ? `"${c}"` : c);

    if (filteredColumns.length === 0) {
      console.log(`  SKIP  ${file.name} (no matching columns)`);
      continue;
    }

    const insert = db.prepare(
      `INSERT OR REPLACE INTO ${file.table} (${quotedColumns.join(", ")}) VALUES (${filteredPlaceholders})`,
    );

    db.transaction(() => {
      for (const row of rows) {
        const mapped = file.mapRow ? file.mapRow(row) : row;
        const values = validIndices.map((i) => mapped[jsonKeys[i]] ?? row[jsonKeys[i]] ?? null);
        insert.run(...values);
      }
    })();

    console.log(`  OK    ${file.name} → ${rows.length} rows`);

    // Backup
    await rename(filePath, path.join(BACKUP_DIR, file.name));

    totalRows += rows.length;
  }

  db.close();

  console.log(`\n✓ Done. ${totalRows} rows migrated.`);
  console.log(`  Database: ${DB_PATH}`);
  console.log(`  Backups:  ${BACKUP_DIR}/`);
  console.log(`\n  Verify: sqlite3 ${DB_PATH} ".tables"`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
