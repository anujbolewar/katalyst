import { generateId } from "@/lib/utils";
import type { Task, Subtask, Importance } from "@/lib/types";
import type { GoalNode } from "./types";

/**
 * Auto-assign a suitable agent based on keywords in the task title and description.
 */
function pickAgent(title: string, description?: string): string {
  const text = `${title.toLowerCase()} ${(description ?? "").toLowerCase()}`;

  if (/market|seo|copy|campaign|social|ad|brand|blog|content|launch|growth|sales|landing|pricing|monet|messag/.test(text)) return "marketer";
  if (/research|analy|competitor|validat|discover|interview|survey|audit|study/.test(text)) return "researcher";
  if (/strateg|plan|priorit|financ|legal|compliance|business|roadmap|okr|kpi/.test(text)) return "business-analyst";
  return "developer";
}

/**
 * Converts a hierarchical GoalNode tree from LLM decomposition
 * into a flat array of Task objects ready for the Kanban board.
 *
 * Strategy:
 * - Root node → becomes a "not-started" parent task with description
 * - Depth-1 children → become individual tasks, each with their own subtasks
 * - Depth-2 children → become subtasks of their parent task
 * - Leaf nodes at depth 2 → become individual subtask entries
 */

export function adaptGoalTreeToTasks(root: GoalNode): Task[] {
  const tasks: Task[] = [];
  const now = new Date().toISOString();

  // Depth-1 children are the top-level task categories
  for (const branch of root.children) {
    const subtasks: Subtask[] = [];

    // Depth-2 children become subtasks of this branch
    const leafNotes: string[] = [];
    for (const leaf of branch.children) {
      subtasks.push({
        id: generateId("sub"),
        title: leaf.title,
        done: false,
      });
      if (leaf.description) {
        leafNotes.push(`${leaf.title}: ${leaf.description}`);
      }
    }

    // If no children, the branch itself is a leaf — make it a subtask
    if (subtasks.length === 0) {
      subtasks.push({
        id: generateId("sub"),
        title: branch.title,
        done: false,
      });
    }

    const importance: Importance = "important";
    const task: Task = {
      id: generateId("task"),
      title: branch.title,
      description: branch.description ?? `Decomposed from goal: ${root.title}`,
      importance,
      urgency: "not-urgent",
      kanban: "not-started",
      projectId: null,
      milestoneId: null,
      assignedTo: pickAgent(branch.title, branch.description),
      collaborators: [],
      dailyActions: [],
      subtasks,
      blockedBy: [],
      estimatedMinutes: null,
      actualMinutes: null,
      acceptanceCriteria: [],
      comments: [],
      tags: ["goal-decomposition"],
      notes: leafNotes.length > 0
        ? `Auto-generated from goal decomposition.\nGoal: ${root.title}\n\nSubtasks:\n${leafNotes.map((n) => `- ${n}`).join("\n")}`
        : `Auto-generated from goal decomposition.\nGoal: ${root.title}`,
      dueDate: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      deletedAt: null,
    };

    tasks.push(task);
  }

  return tasks;
}
