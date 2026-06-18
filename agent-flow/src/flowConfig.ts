export type Phase = 'input' | 'decompose' | 'prioritize' | 'persist' | 'execute' | 'monitor';

export interface FlowStep {
  id: string;
  label: string;
  description: string;
  phase: Phase;
  codeRef?: string;
  dataFlow?: string;
  example?: string;
}

export interface FlowEdge {
  source: string;
  target: string;
  label?: string;
}

export interface FlowNote {
  id: string;
  appearsWithStep: number;
  color: { bg: string; border: string };
  content: string;
}

export interface FlowConfig {
  id: string;
  label: string;
  description: string;
  steps: FlowStep[];
  edges: FlowEdge[];
  notes: FlowNote[];
}

export const phaseColors: Record<Phase, { bg: string; border: string; label: string }> = {
  input:      { bg: '#f0f7ff', border: '#4a9eed', label: 'Input' },
  decompose:  { bg: '#f5f0ff', border: '#8b5cf6', label: 'Decompose' },
  prioritize: { bg: '#fff8e6', border: '#f59e0b', label: 'Prioritize' },
  persist:    { bg: '#e6faf0', border: '#06b6d4', label: 'Persist' },
  execute:    { bg: '#fff0f0', border: '#ef4444', label: 'Execute' },
  monitor:    { bg: '#f0fff4', border: '#22c55e', label: 'Monitor' },
};

// ===================================================================
// FLOW 1: System Architecture
// ===================================================================

const systemSteps: FlowStep[] = [
  {
    id: 's1', label: 'User Enters Vague Goal', phase: 'input',
    description: 'Types ambition into the command center dashboard',
    codeRef: 'src/app/page.tsx', dataFlow: 'React state → POST /api/goals',
    example: '"Launch a dog-walking booking app"',
  },
  {
    id: 's2', label: 'Auth & CSRF Gate', phase: 'input',
    description: 'Middleware validates token and origin before processing',
    codeRef: 'src/middleware.ts', dataFlow: 'Request headers → MC_API_TOKEN check → CSRF origin check',
    example: 'Request rejected if token missing or cross-origin',
  },
  {
    id: 's3', label: 'Goal Decomposition Engine', phase: 'decompose',
    description: 'AI analyzes goal, produces recursive milestone + task tree',
    codeRef: 'src/features/goal-decomposition/index.ts', dataFlow: 'Goal text → LLM prompt → GoalNode[] tree',
    example: '→ 4 milestones: Research, Build UI, Payments, Marketing',
  },
  {
    id: 's4', label: 'Tree → Tasks Adapter', phase: 'decompose',
    description: 'Flattens goal tree into prioritized Task[] array',
    codeRef: 'src/features/goal-decomposition/adapter.ts', dataFlow: 'GoalNode[] → adaptGoalTreeToTasks() → Task[]',
    example: '→ 12 tasks: "Research competitors (2hr)", "Build page (8hr)", ...',
  },
  {
    id: 's5', label: 'Priority Assignment', phase: 'prioritize',
    description: 'Zod enums tag each task with urgency + importance',
    codeRef: 'src/lib/validations.ts', dataFlow: 'task.urgency = "urgent"|"not-urgent", task.importance = "important"|"not-important"',
    example: '"Research competitors" → Urgent + Important → Do First',
  },
  {
    id: 's6', label: 'Eisenhower Matrix Display', phase: 'prioritize',
    description: 'Tasks plotted into 4 quadrants — user always sees #1 priority',
    codeRef: 'src/components/eisenhower-summary.tsx', dataFlow: 'GET /api/tasks → quadrant sort → UI render',
    example: 'Top-left quadrant: "Research competitors" highlighted',
  },
  {
    id: 's7', label: 'Dual-Layer Persistence', phase: 'persist',
    description: 'Tasks and goals saved to SQLite (db.ts) + JSON files (data.ts)',
    codeRef: 'src/lib/db.ts + src/lib/data.ts', dataFlow: 'saveTask() → INSERT INTO tasks (...) + writeFile(tasks.json)',
    example: 'SQLite: 12 rows inserted. JSON: tasks.json updated.',
  },
  {
    id: 's8', label: 'Daemon Cron Poll', phase: 'execute',
    description: 'node-cron fires every 5 min, dispatcher loads pending tasks',
    codeRef: 'scripts/daemon/scheduler.ts → dispatcher.ts', dataFlow: 'cron "*/5 * * * *" → dispatchTasks() → read tasks.json',
    example: '3:00 AM — 5 pending tasks found, daemon wakes up',
  },
  {
    id: 's9', label: 'AI Agent Spawns', phase: 'execute',
    description: 'Runner spawns CLI Agents subprocess with task prompt',
    codeRef: 'scripts/daemon/runner.ts', dataFlow: 'prompt → child_process.spawn() → stdout capture (10MB cap)',
    example: 'Agent writes BookingPage.tsx, runs npm install, scrapes data',
  },
  {
    id: 's10', label: 'CLI Engine Execution', phase: 'execute',
    description: 'Python engine executes terminal commands with native shell access',
    codeRef: 'cli-engine/main.py + tools.py', dataFlow: 'Python subprocess → bash/read/write/glob/grep → file system',
    example: '$ mkdir src/pages; $ touch src/pages/index.tsx',
  },
  {
    id: 's11', label: 'Result Processing', phase: 'monitor',
    description: 'Agent output parsed, task status updated via API',
    codeRef: 'scripts/daemon/runner.ts → PUT /api/tasks/[id]', dataFlow: 'stdout → parseClaudeOutput() → PUT → data.ts → saveTask()',
    example: 'Task #42 → "done". Task #43 → "failed" (error logged).',
  },
  {
    id: 's12', label: 'Health Tracking', phase: 'monitor',
    description: 'Session stats written to daemon-status.json',
    codeRef: 'scripts/daemon/health.ts', dataFlow: 'registerSession() → completeSession() → flushStatus()',
    example: 'Status: 3 done, 1 failed, 1 running. Uptime: 5hr 12min.',
  },
  {
    id: 's13', label: 'Dashboard Live Refresh', phase: 'monitor',
    description: 'React hooks poll API every 5s, command center updates in real-time',
    codeRef: 'src/hooks/use-dashboard-data.ts → src/app/page.tsx', dataFlow: 'useEffect → setInterval(5s) → GET /api/dashboard → re-render',
    example: 'Morning: 8 tasks Done, 2 In Progress, 3 approvals needed',
  },
];

const systemEdges: FlowEdge[] = [
  { source: 's1', target: 's2' },
  { source: 's2', target: 's3' },
  { source: 's3', target: 's4' },
  { source: 's4', target: 's5' },
  { source: 's5', target: 's6' },
  { source: 's6', target: 's7' },
  { source: 's7', target: 's8' },
  { source: 's8', target: 's9' },
  { source: 's9', target: 's10' },
  { source: 's10', target: 's11' },
  { source: 's11', target: 's12' },
  { source: 's12', target: 's13' },
];

const systemNotes: FlowNote[] = [
  {
    id: 'sn1', appearsWithStep: 1,
    color: { bg: '#f0f7ff', border: '#4a9eed' },
    content: `User opens Katalyst dashboard.\nTypes: "I want to launch a\ndog-walking booking app\nbut I don't know where to start."\n\nThis is where Katalyst begins.`,
  },
  {
    id: 'sn3', appearsWithStep: 3,
    color: { bg: '#f5f0ff', border: '#8b5cf6' },
    content: `Decomposition Result:\n\n1. Research Phase\n   - Competitor analysis\n   - Pricing strategy\n2. Build Phase\n   - Booking page (React)\n   - Payment integration\n3. Marketing Phase\n   - Landing page\n   - Social media setup\n\nEstimated effort: 24 hours`,
  },
  {
    id: 'sn6', appearsWithStep: 6,
    color: { bg: '#fff8e6', border: '#f59e0b' },
    content: `Eisenhower Matrix:\n\nDo First (Urgent+Important):\n  → Research competitors (2hr)\n\nSchedule (Not Urgent+Important):\n  → Build booking page (8hr)\n  → Payment integration (6hr)\n\nDelegate (Urgent+Not Imp):\n  → Social media setup (1hr)\n\nEliminate (Not Urgent+Not Imp):\n  → Logo design (deferred)`,
  },
  {
    id: 'sn9', appearsWithStep: 9,
    color: { bg: '#fff0f0', border: '#ef4444' },
    content: `Agent Output:\n\n$ mkdir src/pages/booking\n$ cat > src/pages/booking/index.tsx\n$ npm install react react-dom\n$ curl https://competitor.com/api/pricing\n\n▸ 3 files created\n▸ 2 packages installed\n▸ Pricing data scraped`,
  },
  {
    id: 'sn13', appearsWithStep: 13,
    color: { bg: '#f0fff4', border: '#22c55e' },
    content: `Dashboard @ 8:00 AM:\n\nResearch: ✅ Done\nBooking page: ✅ Done\nPayments: 🔄 In Progress\nMarketing plan: ⏳ Pending\n\nUnread inbox: 2 messages\nDecisions needed: 3\nUptime: 5 hours 12 minutes`,
  },
];

// ===================================================================
// FLOW 2: Daemon Execution Loop
// ===================================================================

const daemonSteps: FlowStep[] = [
  {
    id: 'd1', label: 'Cron Trigger (5 min)', phase: 'execute',
    description: 'node-cron fires, calls dispatcher.dispatchTasks()',
    codeRef: 'scripts/daemon/scheduler.ts', dataFlow: 'cron.schedule("*/5 * * * *", dispatchTasks)',
    example: '[03:00:00] Polling cycle started',
  },
  {
    id: 'd2', label: 'Load Pending Tasks', phase: 'execute',
    description: 'Reads tasks.json + missions.json for uncompleted tasks',
    codeRef: 'scripts/daemon/dispatcher.ts → getPendingTasks()', dataFlow: 'readFile(tasks.json) → filter(status != "done") → pending[]',
    example: 'Found: 5 pending tasks, 2 missions',
  },
  {
    id: 'd3', label: 'Check Blocked Tasks', phase: 'execute',
    description: 'Skips tasks that have pending human decisions',
    codeRef: 'scripts/daemon/prompt-builder.ts → hasPendingDecision()', dataFlow: 'read decisions.json → task.decisionId → if unresolved: skip',
    example: 'Task #42 blocked (pending approval). 4 tasks unblocked.',
  },
  {
    id: 'd4', label: 'Build AI Prompt', phase: 'execute',
    description: 'Constructs full prompt: goal context + task details + output format',
    codeRef: 'scripts/daemon/prompt-builder.ts → buildTaskPrompt()', dataFlow: 'task object + goal context → template engine → prompt string',
    example: '"You are a Katalyst developer agent. Goal: Launch dog-walking app. Task: Research competitor pricing. Output: JSON with findings."',
  },
  {
    id: 'd5', label: 'Resolve Agent Binary', phase: 'execute',
    description: 'Detects available CLI agent binaries on system',
    codeRef: 'scripts/daemon/runner.ts → resolveBinary()', dataFlow: 'check PATH → find CLI agent binary → resolve',
    example: 'Resolved: CLI agent binary found at /usr/local/bin/cli-agent',
  },
  {
    id: 'd6', label: 'Validate & Sanitize', phase: 'execute',
    description: 'Validates binary exists, builds safe env, scrubs secrets',
    codeRef: 'scripts/daemon/security.ts', dataFlow: 'validateBinary() → buildSafeEnv() → scrubCredentials()',
    example: 'Binary OK. API keys redacted from env. Safe env built.',
  },
  {
    id: 'd7', label: 'Spawn Subprocess', phase: 'execute',
    description: 'Spawns AI agent as child process, streams prompt via stdin',
    codeRef: 'scripts/daemon/runner.ts → spawn()', dataFlow: 'child_process.spawn(binary, args, { env, cwd, timeout }) → stdin.write(prompt)',
    example: '$ cli-agent --print < /tmp/prompt-42.txt',
  },
  {
    id: 'd8', label: 'Capture Output', phase: 'execute',
    description: 'Captures stdout (max 10MB), handles timeout + process tree kill',
    codeRef: 'scripts/daemon/runner.ts → spawn()', dataFlow: 'proc.stdout.on("data") → stdout buffer → max 10MB cap',
    example: 'Output captured: 847KB stdout, 0 stderr, exit code 0',
  },
  {
    id: 'd9', label: 'Parse Agent Output', phase: 'execute',
    description: 'Extracts completion status, generated files, errors from stdout',
    codeRef: 'scripts/daemon/runner.ts → parseClaudeOutput()', dataFlow: 'stdout string → regex parse → { status, files, error }',
    example: 'Parsed: { status: "completed", files: ["Research.md"], tokens: 4521 }',
  },
  {
    id: 'd10', label: 'Update Task Status', phase: 'execute',
    description: 'PUT request to API updates task to "done" or "failed"',
    codeRef: 'PUT /api/tasks/[id] → src/app/api/tasks/[id]/route.ts', dataFlow: 'fetch(PUT, { status, result }) → data.ts → saveTask() → tasks.json',
    example: 'PUT /api/tasks/42 { "status": "done", "outputFile": "Research.md" }',
  },
  {
    id: 'd11', label: 'Record Session Health', phase: 'monitor',
    description: 'Completes/fails session, updates stats, writes status file',
    codeRef: 'scripts/daemon/health.ts', dataFlow: 'completeSession() | failSession() → stats++ → flushStatus() → daemon-status.json',
    example: 'daemon-status.json: { tasksCompleted: 3, tasksFailed: 1, uptimeMinutes: 312 }',
  },
  {
    id: 'd12', label: 'Loop Back', phase: 'execute',
    description: 'If more unblocked tasks remain, dispatch next one',
    codeRef: 'scripts/daemon/dispatcher.ts → dispatchTasks()', dataFlow: 'while (pending.length > 0 && activeSessions < maxConcurrency)',
    example: '3 tasks remaining. Next agent spawned for Task #43.',
  },
];

const daemonEdges: FlowEdge[] = [
  { source: 'd1', target: 'd2' },
  { source: 'd2', target: 'd3' },
  { source: 'd3', target: 'd4' },
  { source: 'd4', target: 'd5' },
  { source: 'd5', target: 'd6' },
  { source: 'd6', target: 'd7' },
  { source: 'd7', target: 'd8' },
  { source: 'd8', target: 'd9' },
  { source: 'd9', target: 'd10' },
  { source: 'd10', target: 'd11' },
  { source: 'd11', target: 'd12' },
];

const daemonNotes: FlowNote[] = [
  {
    id: 'dn1', appearsWithStep: 1,
    color: { bg: '#fff0f0', border: '#ef4444' },
    content: `Scheduler Setup:\n\nimport * as cron from "node-cron";\n\nconst job = cron.schedule(\n  "*/5 * * * *",\n  () => dispatcher.dispatchTasks()\n);\n\nConfig from daemon-config.json:\n{\n  "polling": { "intervalMinutes": 5 },\n  "concurrency": { "maxParallelAgents": 3 }\n}`,
  },
  {
    id: 'dn4', appearsWithStep: 4,
    color: { bg: '#fff0f0', border: '#ef4444' },
    content: `Prompt Template:\n\nSystem: You are a Katalyst agent.\nYou have access to: bash, read,\nwrite, glob, grep.\n\nGoal: Launch dog-walking app\n\nTask #42: Research competitors\n- Find top 3 competitors\n- Extract pricing models\n- Note feature gaps\n\nOutput format: JSON\n{\n  "status": "done"|"failed",\n  "result": { ... }\n}`,
  },
  {
    id: 'dn7', appearsWithStep: 7,
    color: { bg: '#fff0f0', border: '#ef4444' },
    content: `Spawn Details:\n\nconst proc = spawn(binary, args, {\n  cwd: workspaceRoot,\n  env: safeEnv,       // sanitized\n  timeout: 30 * 60_000, // 30 min\n  maxBuffer: 10_000_000 // 10MB\n});\n\nproc.stdin.write(prompt);\nproc.stdin.end();\n\nlet stdout = '';\nproc.stdout.on('data',\n  (chunk) => stdout += chunk\n);`,
  },
  {
    id: 'dn11', appearsWithStep: 11,
    color: { bg: '#f0fff4', border: '#22c55e' },
    content: `Health Monitor State:\n\nclass HealthMonitor {\n  activeSessions: Map<id, Session>\n  history: SessionHistoryEntry[]\n  stats: {\n    tasksDispatched: 47\n    tasksCompleted: 42\n    tasksFailed: 5\n    uptimeMinutes: 312\n  }\n}\n\nflushStatus() writes to:\ndata/daemon-status.json`,
  },
];

// ===================================================================
// FLOW 3: Goal Decomposition Pipeline
// ===================================================================

const goalSteps: FlowStep[] = [
  {
    id: 'g1', label: 'Raw Goal Input', phase: 'input',
    description: 'User submits goal via dashboard form',
    codeRef: 'src/app/page.tsx → POST /api/goals', dataFlow: 'Form submit → fetch(POST) → middleware → route.ts',
    example: 'Body: { "title": "Launch dog-walking app", "description": "Full SaaS..." }',
  },
  {
    id: 'g2', label: 'Zod Validation', phase: 'input',
    description: 'Goal schema validates title, description, and metadata',
    codeRef: 'src/lib/validations.ts', dataFlow: 'goalSchema.parse(body) → validated goal object',
    example: '✅ title: "Launch dog-walking app" (3-200 chars, passed)',
  },
  {
    id: 'g3', label: 'Persist Goal', phase: 'persist',
    description: 'Goal saved to SQLite + JSON dual storage',
    codeRef: 'src/lib/data.ts → saveGoal() → src/lib/db.ts', dataFlow: 'saveGoal(goal) → INSERT INTO goals + writeFile(goals.json)',
    example: 'Goal #g42 stored. Status: "active". SQLite row + JSON entry.',
  },
  {
    id: 'g4', label: 'LLM Decomposition Call', phase: 'decompose',
    description: 'Goal sent to AI for milestone + task tree generation',
    codeRef: 'src/features/goal-decomposition/index.ts', dataFlow: 'goal → LLM API call → recursive GoalNode[] tree',
    example: 'AI Response:\n{ milestones: [\n  { title: "Research", tasks: [...] },\n  { title: "Build", tasks: [...] }\n]}',
  },
  {
    id: 'g5', label: 'Goal Tree Construction', phase: 'decompose',
    description: 'Recursive tree built with parent-child milestone relationships',
    codeRef: 'src/features/goal-decomposition/goal-tree.ts', dataFlow: 'LLM response → parse → GoalNode { children: GoalNode[] }',
    example: 'Root: "Launch app"\n├─ Research (parent)\n│  ├─ Competitor analysis\n│  └─ Pricing strategy\n├─ Build (parent)\n│  ├─ Booking page\n│  └─ Payments\n└─ Market (parent)',
  },
  {
    id: 'g6', label: 'Tree → Task Flattening', phase: 'decompose',
    description: 'Adapter converts hierarchical tree into flat Task[] array',
    codeRef: 'src/features/goal-decomposition/adapter.ts', dataFlow: 'adaptGoalTreeToTasks(tree) → Task[] with parentGoalId, priority, estimates',
    example: '12 tasks extracted:\n- Task: "Competitor analysis" (2hr, parent: Research)\n- Task: "Build booking page" (8hr, parent: Build)\n...',
  },
  {
    id: 'g7', label: 'Task Priority Assignment', phase: 'prioritize',
    description: 'Each task gets urgency + importance enum values',
    codeRef: 'src/lib/validations.ts → importanceEnum, urgencyEnum', dataFlow: 'task.importance ← Zod enum, task.urgency ← Zod enum',
    example: 'Competitor analysis: urgency="urgent", importance="important"\nBuild page: urgency="not-urgent", importance="important"',
  },
  {
    id: 'g8', label: 'Bulk Task Persistence', phase: 'persist',
    description: 'All tasks saved to storage in batch',
    codeRef: 'src/lib/data.ts → saveTask() × N', dataFlow: 'for task of tasks: saveTask(task) → db.ts INSERT + tasks.json',
    example: '12 tasks saved. SQLite: 12 INSERTs. JSON: tasks.json updated.',
  },
  {
    id: 'g9', label: 'Quadrant Sorting', phase: 'prioritize',
    description: 'Tasks sorted into Eisenhower quadrants for display',
    codeRef: 'src/components/eisenhower-summary.tsx', dataFlow: 'tasks[] → filter by urgency×importance → 4 quadrant arrays',
    example: 'Do First: [Competitor analysis, Pricing strategy]\nSchedule: [Build page, Payments]\nDelegate: [Social media]\nEliminate: [Logo design]',
  },
  {
    id: 'g10', label: 'User Approval Flow', phase: 'prioritize',
    description: 'User reviews plan, approves tasks, or re-prioritizes',
    codeRef: 'src/components/task-detail-panel.tsx', dataFlow: 'User clicks approve → PUT /api/tasks/[id] → decision recorded',
    example: 'User approves 10 tasks, defers 2. Decisions saved to decisions.json.',
  },
];

const goalEdges: FlowEdge[] = [
  { source: 'g1', target: 'g2' },
  { source: 'g2', target: 'g3' },
  { source: 'g3', target: 'g4' },
  { source: 'g4', target: 'g5' },
  { source: 'g5', target: 'g6' },
  { source: 'g6', target: 'g7' },
  { source: 'g7', target: 'g8' },
  { source: 'g8', target: 'g9' },
  { source: 'g9', target: 'g10' },
];

const goalNotes: FlowNote[] = [
  {
    id: 'gn1', appearsWithStep: 1,
    color: { bg: '#f0f7ff', border: '#4a9eed' },
    content: `API Request:\n\nPOST /api/goals HTTP/1.1\nAuthorization: Bearer <token>\nContent-Type: application/json\n\n{\n  "title": "Launch dog-walking app",\n  "description": "Full SaaS platform\n    for booking dog walks online"\n}`,
  },
  {
    id: 'gn5', appearsWithStep: 5,
    color: { bg: '#f5f0ff', border: '#8b5cf6' },
    content: `GoalNode Interface:\n\ninterface GoalNode {\n  id: string;\n  title: string;\n  description?: string;\n  parentId?: string;\n  children: GoalNode[];\n  estimatedHours?: number;\n  priority?: "high" | "medium" | "low";\n  status: "pending" | "active" | "done";\n}`,
  },
  {
    id: 'gn6', appearsWithStep: 6,
    color: { bg: '#f5f0ff', border: '#8b5cf6' },
    content: `Adapter Output (Task[]):\n\n[\n  {\n    id: "t-001",\n    parentGoalId: "g42",\n    title: "Competitor analysis",\n    estimatedHours: 2,\n    urgency: "urgent",\n    importance: "important"\n  },\n  {\n    id: "t-002",\n    parentGoalId: "g42",\n    title: "Build booking page",\n    estimatedHours: 8\n  },\n  ... 10 more\n]`,
  },
  {
    id: 'gn9', appearsWithStep: 9,
    color: { bg: '#fff8e6', border: '#f59e0b' },
    content: `Eisenhower Quadrant Logic:\n\nconst quadrants = {\n  doFirst: tasks.filter(t =>\n    t.urgency === "urgent" &&\n    t.importance === "important"\n  ),\n  schedule: tasks.filter(t =>\n    t.urgency === "not-urgent" &&\n    t.importance === "important"\n  ),\n  delegate: tasks.filter(t =>\n    t.urgency === "urgent" &&\n    t.importance === "not-important"\n  ),\n  eliminate: tasks.filter(t =>\n    t.urgency === "not-urgent" &&\n    t.importance === "not-important"\n  ),\n};`,
  },
];

// ===================================================================
// FLOW 4: Agent Coordination & Memory
// ===================================================================

const agentSteps: FlowStep[] = [
  {
    id: 'a1', label: '5 Specialized Agent Personas', phase: 'input',
    description: 'Developer, Researcher, Marketer, Business Analyst, CEO (Me) — each with specific capabilities',
    codeRef: 'data/agents.json', dataFlow: 'Agent definitions loaded on app start via src/lib/data.ts',
    example: 'Developer: coding, testing, debugging, deployment\nResearcher: web-research, analysis, evaluation\nMarketer: copywriting, SEO, content, growth\nBusiness Analyst: strategy, planning, financials',
  },
  {
    id: 'a2', label: 'Agent Capability Registry', phase: 'persist',
    description: 'Each agent declares capabilities used for task-to-agent matching',
    codeRef: 'src/lib/data.ts → getAgents()', dataFlow: 'agents.json → parsed → Agent[] with capabilities[]',
    example: 'Task "Build booking page" → domain "coding" → matched to Developer agent',
  },
  {
    id: 'a3', label: 'Shared Context Snapshot', phase: 'persist',
    description: 'Auto-generated context file gives every agent the full project picture',
    codeRef: 'data/ai-context.md (auto-generated)', dataFlow: 'AI Context Snapshot: active projects, pending decisions, Eisenhower matrix, kanban status',
    example: 'Context includes: 1 active goal, 12 tasks, 3 pending decisions, active agent sessions — agents never work in isolation',
  },
  {
    id: 'a4', label: 'Concurrency Gate', phase: 'execute',
    description: 'Daemon checks maxParallelAgents before spawning — never overloads the system',
    codeRef: 'scripts/daemon/dispatcher.ts + daemon-config.json', dataFlow: 'activeSessions.size < maxParallelAgents(6) → can spawn, else: queue',
    example: 'Config: maxParallelAgents=6. Currently 2 active. 4 slots available. Spawning agent for Task #42.',
  },
  {
    id: 'a5', label: 'Domain-Based Task Assignment', phase: 'execute',
    description: 'Dispatcher matches task domain to agent capabilities for optimal execution',
    codeRef: 'scripts/daemon/dispatcher.ts → dispatchTasks()', dataFlow: 'task.domain ∩ agent.capabilities → best match selected',
    example: 'Task #42 (coding) → Developer agent\nTask #43 (research) → Researcher agent\nTask #44 (marketing) → Marketer agent',
  },
  {
    id: 'a6', label: 'Context Injection into Prompt', phase: 'execute',
    description: 'Full project context + task details + agent persona bundled into one prompt',
    codeRef: 'scripts/daemon/prompt-builder.ts → buildTaskPrompt()', dataFlow: 'ai-context.md + task + goal + agent persona → formatted prompt',
    example: 'Prompt includes: "You are the Developer agent. Goal: Launch app. Active tasks: 5. Pending decisions: 3. Current task: Build booking page (8hrs). Context: competitor research is done."',
  },
  {
    id: 'a7', label: 'Agent Spawn with Identity', phase: 'execute',
    description: 'Agent subprocess launches with persona, context, and task — acts as the assigned role',
    codeRef: 'scripts/daemon/runner.ts → spawn()', dataFlow: 'Prompt with persona → child_process.spawn() → agent acts as Developer/Researcher/etc.',
    example: '$ cli-agent --system-prompt "You are the Developer agent for Katalyst. Your capabilities: coding, testing, deployment..."',
  },
  {
    id: 'a8', label: 'Agent Reads Shared Memory', phase: 'execute',
    description: 'Agent has access to all project files — reads goals.json, tasks.json, decisions.json as needed',
    codeRef: 'cli-engine/tools.py → read, glob, grep', dataFlow: 'Agent can: readFile(tasks.json), glob("src/**/*.tsx"), grep("TODO", "src/")',
    example: 'Developer agent: grep("booking" src/) → finds existing booking code. Reads tasks.json to see what other agents are working on.',
  },
  {
    id: 'a9', label: 'Agent Writes Results Back', phase: 'execute',
    description: 'Agent saves files, writes task output, logs activity — updates shared state',
    codeRef: 'cli-engine/tools.py → write + src/app/api/activity-log/route.ts', dataFlow: 'Agent writes files → API call → saveTask() → append activity-log.json',
    example: 'Developer: creates BookingPage.tsx, writes Research.md. PUT /api/tasks/42 → { status: "done", outputFile: "Research.md" }. Activity logged: "Agent completed Task #42".',
  },
  {
    id: 'a10', label: 'Session Tracking', phase: 'monitor',
    description: 'Health monitor tracks every agent session — who worked on what, how long, result',
    codeRef: 'scripts/daemon/health.ts → registerSession() → completeSession()', dataFlow: 'Session { agentId, taskId, startTime } → complete → { endTime, result, tokensUsed }',
    example: 'Session #17: Developer agent, Task #42 "Build booking page", 8.3 min, tokens: 4521, result: done',
  },
  {
    id: 'a11', label: 'Multi-Agent Concurrency', phase: 'monitor',
    description: 'Multiple agents work simultaneously on different tasks — coordinated, not conflicting',
    codeRef: 'scripts/daemon/health.ts → activeSessions Map', dataFlow: 'Up to 6 agents running concurrently, each with isolated session, all tracked',
    example: 'Current status:\n1. Developer → Task #42 (Build page) · 8 min\n2. Researcher → Task #43 (Competitors) · 12 min\n3. Marketer → Task #44 (Copy) · 3 min\nIdle slots: 3 available',
  },
  {
    id: 'a12', label: 'Judge Verdict: Coordinated AI Team', phase: 'monitor',
    description: 'Not a single chatbot — a coordinated team of specialized AI agents with shared memory and orchestration',
    codeRef: 'All of scripts/daemon/ + data/agents.json + data/ai-context.md', dataFlow: 'Complete loop: persona definitions → context sharing → domain matching → concurrent execution → session tracking → activity logging',
    example: 'What the judge sees:\n✓ Specialized agents (not one generic AI)\n✓ Shared context (agents know what others did)\n✓ Concurrency control (no resource conflicts)\n✓ Full audit trail (every action logged)\n✓ Human-in-the-loop (decisions require approval)',
  },
];

const agentEdges: FlowEdge[] = [
  { source: 'a1', target: 'a2' },
  { source: 'a2', target: 'a3' },
  { source: 'a3', target: 'a4' },
  { source: 'a4', target: 'a5' },
  { source: 'a5', target: 'a6' },
  { source: 'a6', target: 'a7' },
  { source: 'a7', target: 'a8' },
  { source: 'a8', target: 'a9' },
  { source: 'a9', target: 'a10' },
  { source: 'a10', target: 'a11' },
  { source: 'a11', target: 'a12' },
];

const agentNotes: FlowNote[] = [
  {
    id: 'an1', appearsWithStep: 1,
    color: { bg: '#f0f7ff', border: '#4a9eed' },
    content: `Agent Definitions (agents.json):\n\n{\n  "id": "developer",\n  "name": "Developer",\n  "capabilities": [\n    "coding", "testing",\n    "debugging", "deployment"\n  ],\n  "status": "active"\n}\n\n5 personas total:\nMe · Researcher · Developer\nMarketer · Business Analyst`,
  },
  {
    id: 'an3', appearsWithStep: 3,
    color: { bg: '#e6faf0', border: '#06b6d4' },
    content: `AI Context Snapshot (auto-generated):\n\n- Active Projects: 1\n- Pending Decisions: 3\n- Eisenhower Matrix:\n  DO: 2 tasks\n  SCHEDULE: 5 tasks\n- Kanban: 3 Done, 2 In Progress\n- Agent Sessions: 2 active\n\nEvery spawned agent receives\nthis full snapshot as context.\nThey never work blind.`,
  },
  {
    id: 'an5', appearsWithStep: 5,
    color: { bg: '#fff0f0', border: '#ef4444' },
    content: `Task → Agent Matching:\n\nfunction matchAgent(task, agents) {\n  return agents.find(a =>\n    a.capabilities.some(c =>\n      task.domain.includes(c)\n    )\n  );\n}\n\nExample:\n- "Build UI" → Developer (coding)\n- "SEO audit" → Marketer (seo)\n- "Market research" → Researcher\n- "Financial model" → Biz Analyst\n- "Approve plan" → Me (decisions)`,
  },
  {
    id: 'an11', appearsWithStep: 11,
    color: { bg: '#f0fff4', border: '#22c55e' },
    content: `Active Agent Sessions:\n\nMap {\n  "sess-17": {\n    agentId: "developer",\n    taskId: "t-042",\n    startedAt: "03:05:00",\n    pid: 28491\n  },\n  "sess-18": {\n    agentId: "researcher",\n    taskId: "t-043",\n    startedAt: "03:05:01",\n    pid: 28492\n  }\n}\n\nConcurrency: 2/6 slots used.\nNo resource conflicts — each\nagent has isolated workspace.`,
  },
  {
    id: 'an12', appearsWithStep: 12,
    color: { bg: '#f0fff4', border: '#22c55e' },
    content: `Judge's Checklist:\n\n☑ Specialized personas — not one\n   generic chatbot\n☑ Shared memory — agents know\n   project context and each other's work\n☑ Domain matching — right agent\n   for the right task\n☑ Concurrency control — max 6\n   parallel, no resource clashes\n☑ Full audit trail — every action\n   in activity-log.json\n☑ Human oversight — decisions\n   require user approval\n\nThis is a coordinated AI team,\nnot a single-agent loop.`,
  },
];

// ===================================================================
// Export all flows
// ===================================================================

export const flows: Record<string, FlowConfig> = {
  system: {
    id: 'system',
    label: 'System Flow',
    description: 'End-to-end: user types vague goal → AI breaks it down → daemon executes → dashboard tracks progress',
    steps: systemSteps,
    edges: systemEdges,
    notes: systemNotes,
  },
  daemon: {
    id: 'daemon',
    label: 'Daemon Loop',
    description: 'Deep dive into the autonomous agent execution cycle — cron poll → dispatch → spawn → track',
    steps: daemonSteps,
    edges: daemonEdges,
    notes: daemonNotes,
  },
  goal: {
    id: 'goal',
    label: 'Goal Pipeline',
    description: 'How a vague goal becomes prioritized tasks — decomposition, tree flattening, Eisenhower sorting',
    steps: goalSteps,
    edges: goalEdges,
    notes: goalNotes,
  },
  agents: {
    id: 'agents',
    label: 'Agent Coordination',
    description: 'How 5 specialized AI agents coordinate with shared memory, domain matching, concurrency control, and full audit trail',
    steps: agentSteps,
    edges: agentEdges,
    notes: agentNotes,
  },
};
