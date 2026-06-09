// ─── SQLite Schema Definitions ─────────────────────────────────────────────

export const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  importance TEXT DEFAULT 'important',
  urgency TEXT DEFAULT 'not-urgent',
  kanban TEXT DEFAULT 'not-started',
  project_id TEXT,
  milestone_id TEXT,
  assigned_to TEXT,
  collaborators TEXT DEFAULT '[]',
  daily_actions TEXT DEFAULT '[]',
  subtasks TEXT DEFAULT '[]',
  blocked_by TEXT DEFAULT '[]',
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  acceptance_criteria TEXT DEFAULT '[]',
  field_task_ids TEXT DEFAULT '[]',
  comments TEXT DEFAULT '[]',
  tags TEXT DEFAULT '[]',
  notes TEXT DEFAULT '',
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT '' DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '' DEFAULT '',
  completed_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  type TEXT DEFAULT 'medium-term',
  timeframe TEXT,
  parent_goal_id TEXT,
  project_id TEXT,
  status TEXT DEFAULT 'not-started',
  milestones TEXT DEFAULT '[]',
  tasks TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT '',
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#6B7280',
  status TEXT DEFAULT 'active',
  tags TEXT DEFAULT '[]',
  task_ids TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT '' DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '' DEFAULT '',
  completed_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS inbox (
  id TEXT PRIMARY KEY,
  "from" TEXT NOT NULL DEFAULT '' DEFAULT '',
  "to" TEXT NOT NULL DEFAULT '' DEFAULT '',
  type TEXT DEFAULT 'update',
  task_id TEXT,
  subject TEXT DEFAULT '',
  body TEXT DEFAULT '',
  status TEXT DEFAULT 'unread',
  created_at TEXT NOT NULL DEFAULT '',
  read_at TEXT
);

CREATE TABLE IF NOT EXISTS brain_dump (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '' DEFAULT '',
  captured_at TEXT NOT NULL DEFAULT '' DEFAULT '',
  processed INTEGER DEFAULT 0,
  converted_to TEXT,
  tags TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT '',
  actor TEXT DEFAULT 'system',
  task_id TEXT,
  summary TEXT DEFAULT '',
  details TEXT DEFAULT '',
  timestamp TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '' DEFAULT '',
  description TEXT DEFAULT '',
  task_id TEXT,
  status TEXT DEFAULT 'pending',
  options TEXT DEFAULT '[]',
  answer TEXT,
  created_at TEXT NOT NULL DEFAULT '' DEFAULT '',
  answered_at TEXT
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  icon TEXT DEFAULT '',
  description TEXT DEFAULT '',
  instructions TEXT DEFAULT '',
  capabilities TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS goal_trees (
  goal_id TEXT PRIMARY KEY,
  goal_title TEXT NOT NULL DEFAULT '',
  task_ids TEXT DEFAULT '[]',
  root_node TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  pipeline_data TEXT DEFAULT '{}'
);

ALTER TABLE goal_trees ADD COLUMN pipeline_data TEXT DEFAULT '{}';

CREATE TABLE IF NOT EXISTS active_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL DEFAULT '',
  agent_id TEXT,
  pid INTEGER,
  status TEXT DEFAULT 'running',
  started_at TEXT NOT NULL DEFAULT '',
  ended_at TEXT,
  exit_code INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tasks_kanban ON tasks(kanban);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox(status);
CREATE INDEX IF NOT EXISTS idx_inbox_recipient ON inbox("to");
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_active_runs_status ON active_runs(status);
`;

export const TABLES = [
  "tasks", "goals", "projects", "inbox", "brain_dump",
  "activity_log", "decisions", "agents", "goal_trees", "active_runs",
] as const;
