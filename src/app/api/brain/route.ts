import { NextResponse } from "next/server";
import { getTasks, getGoals, getProjects, getGoalTrees } from "@/lib/storage";

interface GraphNode {
  id: string;
  label: string;
  type: "project" | "goal" | "task";
  group: number;
  size: number;
  status: string;
  url: string;
  progress?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: "task_link" | "parent_child" | "blocked_by";
  label?: string;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const [tasksData, goalsData, projectsData, treesData] = await Promise.all([
    getTasks(),
    getGoals(),
    getProjects(),
    getGoalTrees(),
  ]);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // ─── Projects ──────────────────────────────────────────────────────────────
  for (const p of projectsData.projects) {
    if (p.deletedAt) continue;
    nodes.push({
      id: p.id,
      label: p.name,
      type: "project",
      group: 0,
      size: 14,
      status: p.status ?? "active",
      url: `/ventures/${p.id}`,
    });
  }

  // ─── Goals ─────────────────────────────────────────────────────────────────
  const goalMap = new Map<string, typeof goalsData.goals[0]>();
  for (const g of goalsData.goals) {
    if (g.deletedAt) continue;
    goalMap.set(g.id, g);
    const taskCount = g.tasks?.length ?? 0;
    const linkedTaskObjs = (g.tasks ?? [])
      .map((tid) => tasksData.tasks.find((t) => t.id === tid && !t.deletedAt))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
    const done = linkedTaskObjs.filter((t) => t.kanban === "done").length;
    nodes.push({
      id: g.id,
      label: g.title,
      type: "goal",
      group: 1,
      size: 10 + Math.min(taskCount, 8),
      status: g.status ?? "not-started",
      progress: taskCount > 0 ? Math.round((done / taskCount) * 100) : 0,
      url: `/objectives/${g.id}`,
    });

    // Goal ↔ Tasks
    for (const tid of g.tasks ?? []) {
      if (tasksData.tasks.some((t) => t.id === tid && !t.deletedAt)) {
        edges.push({ source: g.id, target: tid, type: "task_link" });
      }
    }

    // Goal parent → child
    if (g.parentGoalId && goalMap.has(g.parentGoalId)) {
      edges.push({ source: g.parentGoalId, target: g.id, type: "parent_child" });
    }

    // Goal ↔ Project
    if (g.projectId) {
      edges.push({ source: g.projectId, target: g.id, type: "task_link", label: "belongs to" });
    }
  }

  // ─── Tasks ─────────────────────────────────────────────────────────────────
  for (const t of tasksData.tasks) {
    if (t.deletedAt) continue;
    const subDone = t.subtasks?.filter((s) => s.done).length ?? 0;
    const subTotal = t.subtasks?.length ?? 0;
    const pct = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0;
    nodes.push({
      id: t.id,
      label: t.title,
      type: "task",
      group: 2,
      size: 6 + Math.min(pct / 10, 8),
      status: t.kanban ?? "not-started",
      progress: pct,
      url: "", // tasks don't have detail pages
    });

    // Task blocked_by
    for (const bid of t.blockedBy ?? []) {
      edges.push({ source: bid, target: t.id, type: "blocked_by" });
    }

    // Task ↔ Project
    if (t.projectId) {
      edges.push({ source: t.projectId, target: t.id, type: "task_link" });
    }
  }

  // ─── Goal metadata from trees ─────────────────────────────────────────────
  const treeMap = new Map(treesData.trees.map((t) => [t.goalId, t]));

  // Add pipeline metadata to goal nodes
  for (const n of nodes) {
    if (n.type === "goal") {
      const tree = treeMap.get(n.id);
      if (tree) {
        (n as unknown as Record<string, unknown>).taskCount = tree.taskIds?.length ?? 0;
        (n as unknown as Record<string, unknown>).pipelineData = tree.pipelineData ?? null;
      }
    }
  }

  return NextResponse.json(
    { nodes, edges, treeCount: treesData.trees.length },
    { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=10" } },
  );
}
