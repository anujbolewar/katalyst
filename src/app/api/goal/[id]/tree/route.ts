import { NextResponse } from "next/server";
import { getGoalTrees } from "@/lib/storage";
import { getTasks } from "@/lib/data";
import type { Task } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [treeData, tasksData] = await Promise.all([
    getGoalTrees(),
    getTasks(),
  ]);

  const treeRecord = treeData.trees.find((t) => t.goalId === id);
  if (!treeRecord) {
    return NextResponse.json({ error: "Goal tree not found" }, { status: 404 });
  }

  const taskMap = new Map<string, Task>();
  for (const task of tasksData.tasks) {
    if (!task.deletedAt) taskMap.set(task.id, task);
  }

  // Build a map of tree node (index) → task kanban status
  const childStatuses = treeRecord.rootNode.children.map((child, idx) => {
    const taskId = treeRecord.taskIds[idx];
    const task = taskId ? taskMap.get(taskId) : undefined;
    return {
      kanban: task?.kanban ?? "not-started",
      subtasksDone: task?.subtasks?.filter((s) => s.done).length ?? 0,
      subtasksTotal: task?.subtasks?.length ?? 0,
    };
  });

  // Enrich the tree with live status
  const enrichedTree = {
    id: treeRecord.rootNode.id,
    title: treeRecord.rootNode.title,
    description: treeRecord.rootNode.description,
    status: childStatuses.every((s) => s.kanban === "done") ? "completed" as const
      : childStatuses.some((s) => s.kanban === "in-progress") ? "executing" as const
      : "started" as const,
    children: treeRecord.rootNode.children.map((child, idx) => ({
      id: child.id,
      title: child.title,
      description: child.description,
      status: childStatuses[idx]?.kanban === "done" ? "completed" as const
        : childStatuses[idx]?.kanban === "in-progress" ? "executing" as const
        : "started" as const,
      children: child.children.map((leaf, leafIdx) => ({
        id: leaf.id,
        title: leaf.title,
        description: leaf.description,
        status: (taskMap.get(treeRecord.taskIds[idx])?.subtasks?.[leafIdx]?.done ?? false)
          ? "completed" as const
          : "started" as const,
        children: [],
      })),
    })),
  };

  const taskStatuses = treeRecord.taskIds.map((tid, _idx) => {
    const task = taskMap.get(tid);
    return {
      id: tid,
      title: task?.title ?? "(unknown)",
      kanban: task?.kanban ?? "not-started",
      subtasksDone: task?.subtasks?.filter((s) => s.done).length ?? 0,
      subtasksTotal: task?.subtasks?.length ?? 0,
    };
  });

  return NextResponse.json({
    goalId: treeRecord.goalId,
    goalTitle: treeRecord.goalTitle,
    taskIds: treeRecord.taskIds,
    tree: enrichedTree,
    taskStatuses,
  }, {
    headers: { "Cache-Control": "private, max-age=1, stale-while-revalidate=2" },
  });
}
