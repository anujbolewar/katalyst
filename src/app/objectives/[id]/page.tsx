"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, GitGraph, ListTree, Bot, X } from "lucide-react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { GoalTree, GoalFlow } from "@/features/goal-decomposition";
import { FlowChat } from "@/components/goal-flow/flow-chat";
import type { ChangeInstruction } from "@/components/goal-flow/flow-chat";
import { FlowControls } from "@/components/goal-flow/flow-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveRunsContext } from "@/providers/active-runs-provider";
import { useFastTaskPoll } from "@/hooks/use-fast-task-poll";
import type { GoalNode } from "@/features/goal-decomposition/types";
import { TASK_STATUS_STARTED } from "@/features/goal-decomposition/types";

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

function applyDiffsToTree(tree: GoalNode, diffs: ChangeInstruction[]): GoalNode {
  const clone = JSON.parse(JSON.stringify(tree)) as GoalNode;
  const findNode = (node: GoalNode, id: string): GoalNode | null => {
    if (node.id === id) return node;
    for (const child of node.children) { const found = findNode(child, id); if (found) return found; }
    return null;
  };
  const findParent = (node: GoalNode, childId: string): GoalNode | null => {
    for (const child of node.children) {
      if (child.id === childId) return node;
      const found = findParent(child, childId); if (found) return found;
    }
    return null;
  };
  for (const diff of diffs) {
    if (diff.action === "remove") { const p = findParent(clone, diff.nodeId); if (p) p.children = p.children.filter((c) => c.id !== diff.nodeId); }
    else if (diff.action === "update") { const n = findNode(clone, diff.nodeId); if (n) { if (diff.title !== undefined) n.title = diff.title; if (diff.description !== undefined) n.description = diff.description; } }
    else if (diff.action === "add") { const p = diff.parentId ? findNode(clone, diff.parentId) : clone; if (p) p.children.push({ id: diff.nodeId, title: diff.title || "New task", description: diff.description || "", status: TASK_STATUS_STARTED, children: [] }); }
  }
  return clone;
}

function applyNodeEditToTree(tree: GoalNode, nodeId: string, changes: { title: string; description: string; status?: string }): GoalNode {
  const clone = JSON.parse(JSON.stringify(tree)) as GoalNode;
  const find = (node: GoalNode, id: string): GoalNode | null => {
    if (node.id === id) return node;
    for (const child of node.children) { const found = find(child, id); if (found) return found; }
    return null;
  };
  const n = find(clone, nodeId);
  if (n) { if (changes.title !== undefined) n.title = changes.title; if (changes.description !== undefined) n.description = changes.description; if (changes.status !== undefined) n.status = changes.status as GoalNode["status"]; }
  return clone;
}

function applyNodeDeleteToTree(tree: GoalNode, nodeId: string): GoalNode {
  const clone = JSON.parse(JSON.stringify(tree)) as GoalNode;
  const removeRecursive = (node: GoalNode): boolean => {
    if (node.id === nodeId) return true;
    for (let i = node.children.length - 1; i >= 0; i--) { if (removeRecursive(node.children[i])) node.children.splice(i, 1); }
    return false;
  };
  removeRecursive(clone);
  return clone;
}

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "flow">("flow");
  const [pendingDiffs, setPendingDiffs] = useState<ChangeInstruction[] | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { runningTaskIds } = useActiveRunsContext();

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch(`/api/goal/${id}/tree`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to load");
      setTreeData(await res.json());
      setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load goal tree"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchTree(); }, [fetchTree]);
  useFastTaskPoll(runningTaskIds.size > 0, fetchTree);

  const saveTree = useCallback(async (tree: GoalNode) => {
    const res = await fetch(`/api/goal/${id}/apply-edits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tree }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to save");
  }, [id]);

  const handleProposeChanges = useCallback((diffs: ChangeInstruction[], _explanation: string) => setPendingDiffs(diffs), []);
  const handleReject = useCallback(() => setPendingDiffs(null), []);

  const handleManualUpdate = useCallback(async (nodeId: string, changes: { title: string; description: string; status: string; nodeType: string }) => {
    if (!treeData) return;
    try { await saveTree(applyNodeEditToTree(treeData.tree, nodeId, changes)); await fetchTree(); } catch { await fetchTree(); }
  }, [treeData, saveTree, fetchTree]);

  const handleManualDelete = useCallback(async (nodeId: string) => {
    if (!treeData) return;
    try { await saveTree(applyNodeDeleteToTree(treeData.tree, nodeId)); await fetchTree(); } catch { await fetchTree(); }
  }, [treeData, saveTree, fetchTree]);

  const handleAccept = useCallback(async () => {
    if (!pendingDiffs || !treeData) return;
    setAccepting(true);
    try { await saveTree(applyDiffsToTree(treeData.tree, pendingDiffs)); setPendingDiffs(null); await fetchTree(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to accept changes"); }
    finally { setAccepting(false); }
  }, [pendingDiffs, treeData, saveTree, fetchTree]);

  if (loading) return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "Objectives", href: "/objectives" }, { label: "..." }]} />
      <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
    </div>
  );

  if (error || !treeData) return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "Objectives", href: "/objectives" }, { label: "Error" }]} />
      <Card className="border-[var(--destructive)]/30">
        <CardContent className="py-8 text-center">
          <p className="text-[var(--destructive)]">{error ?? "Goal not found"}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/objectives")}><ArrowLeft className="h-4 w-4 mr-2" />Back to Objectives</Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "Objectives", href: "/objectives" }, { label: treeData.goalTitle }]} />
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{treeData.goalTitle}</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant={viewMode === "flow" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("flow")}><GitGraph className="h-4 w-4 mr-1" />Flow</Button>
              <Button variant={viewMode === "tree" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("tree")}><ListTree className="h-4 w-4 mr-1" />Tree</Button>
              <Button variant="ghost" size="sm" onClick={() => router.push("/objectives")}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          {viewMode === "flow" ? (
            <GoalFlow root={treeData.tree} goalId={id} pendingDiffs={pendingDiffs} onManualUpdate={handleManualUpdate} onManualDelete={handleManualDelete} />
          ) : (
            <GoalTree root={pendingDiffs ? applyDiffsToTree(treeData.tree, pendingDiffs) : treeData.tree} />
          )}
          <button onClick={() => setChatOpen((o) => !o)} className="absolute bottom-3 right-3 z-30 h-10 w-10 rounded-full bg-[#00FF41] text-black flex items-center justify-center shadow-lg hover:bg-[#00DD38] transition-colors" title="AI Graph Editor">
            {chatOpen ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
          </button>
          {chatOpen && (
            <div className="absolute bottom-14 right-3 z-30 w-80 shadow-2xl animate-fade-in-up">
              <FlowChat goalId={id} currentTree={treeData.tree} onProposeChanges={handleProposeChanges} hasPendingChanges={pendingDiffs !== null && pendingDiffs.length > 0} />
            </div>
          )}
        </CardContent>
      </Card>
      <FlowControls pendingDiffs={pendingDiffs} onAccept={handleAccept} onReject={handleReject} />
      {pendingDiffs && accepting && <div className="flex items-center gap-2 text-[13px] text-[#888]"><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving changes...</div>}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Task Progress</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {treeData.taskStatuses.map((ts) => (
              <div key={ts.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="truncate mr-2">{ts.title}</span>
                <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-[var(--muted-foreground)]/20 text-[var(--muted-foreground)]">{ts.subtasksDone}/{ts.subtasksTotal} done</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
