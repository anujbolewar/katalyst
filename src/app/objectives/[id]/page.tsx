"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, GitGraph, ListTree } from "lucide-react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { GoalTree, GoalFlow } from "@/features/goal-decomposition";
import { FlowChat } from "@/components/flow-chat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveRunsContext } from "@/providers/active-runs-provider";
import { useFastTaskPoll } from "@/hooks/use-fast-task-poll";
import type { GoalNode } from "@/features/goal-decomposition/types";
import { TASK_STATUS_STARTED, TASK_STATUS_EXECUTING, TASK_STATUS_COMPLETED } from "@/features/goal-decomposition/types";

interface TreeData {
  goalId: string;
  goalTitle: string;
  taskIds: string[];
  tree: GoalNode;
  taskStatuses: {
    id: string;
    title: string;
    kanban: string;
    subtasksDone: number;
    subtasksTotal: number;
  }[];
}

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "flow">("flow");

  const { runningTaskIds } = useActiveRunsContext();

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch(`/api/goal/${id}/tree`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to load");
      const data = await res.json();
      setTreeData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load goal tree");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // Poll every 3s when any task is running
  useFastTaskPoll(
    runningTaskIds.size > 0,
    fetchTree,
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav items={[{ label: "Objectives", href: "/objectives" }, { label: "..." }]} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !treeData) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav items={[{ label: "Objectives", href: "/objectives" }, { label: "Error" }]} />
        <Card className="border-[var(--destructive)]/30">
          <CardContent className="py-8 text-center">
            <p className="text-[var(--destructive)]">{error ?? "Goal not found"}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/objectives")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Objectives
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[
        { label: "Objectives", href: "/objectives" },
        { label: treeData.goalTitle },
      ]} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{treeData.goalTitle}</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant={viewMode === "flow" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("flow")}
              >
                <GitGraph className="h-4 w-4 mr-1" />
                Flow
              </Button>
              <Button
                variant={viewMode === "tree" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("tree")}
              >
                <ListTree className="h-4 w-4 mr-1" />
                Tree
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.push("/objectives")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "flow" ? (
            <GoalFlow root={treeData.tree} />
          ) : (
            <GoalTree root={treeData.tree} />
          )}
        </CardContent>
      </Card>

      {/* Task status summary bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {treeData.taskStatuses.map((ts) => (
              <div
                key={ts.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="truncate mr-2">{ts.title}</span>
                <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-[var(--muted-foreground)]/20 text-[var(--muted-foreground)]">
                  {ts.subtasksDone}/{ts.subtasksTotal} done
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <FlowChat
        goalId={id}
        currentTree={treeData.tree}
        onAcceptChanges={(newTree) => {
          setTreeData({ ...treeData, tree: newTree as GoalNode });
        }}
      />
    </div>
  );
}
