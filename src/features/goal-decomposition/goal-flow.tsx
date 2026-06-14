"use client";

import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  BackgroundVariant,
  MarkerType,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Pencil, Trash2, X, Check, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoalNode } from "./types";
import {
  TASK_STATUS_EXECUTING,
} from "./types";

// ─── Constants ─────────────────────────────────────────────────────────────

const NODE_W = 220;
const NODE_H = 96;

type NodeType = "goal" | "milestone" | "task";

const TYPE_COLORS: Record<NodeType, string> = {
  goal: "#00FF41",
  milestone: "#3B82F6",
  task: "#A855F7",
};

const TYPE_LABELS: Record<NodeType, string> = {
  goal: "GOAL",
  milestone: "MILESTONE",
  task: "TASK",
};

function getNodeType(depth: number): NodeType {
  if (depth === 0) return "goal";
  if (depth === 1) return "milestone";
  return "task";
}

const STATUS_LABELS: Record<string, string> = {
  started: "todo",
  executing: "in-progress",
  completed: "done",
  failed: "blocked",
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  started: { bg: "#6B728022", text: "#9CA3AF", border: "#6B7280" },
  executing: { bg: "#3B82F622", text: "#60A5FA", border: "#3B82F6" },
  completed: { bg: "#00FF4122", text: "#00FF41", border: "#00FF41" },
  failed: { bg: "#DC262622", text: "#F87171", border: "#DC2626" },
};

// ─── Tree Layout (manual — spreads children horizontally) ──────────────────

const H_GAP = 60;   // horizontal gap between sibling subtrees
const V_GAP = 100;  // vertical gap between parent and child

function treeLayout(root: GoalNode): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const subtreeWidths = new Map<string, number>();

  // Pass 1: compute subtree width for each node
  function measureWidth(node: GoalNode): number {
    if (node.children.length === 0) {
      subtreeWidths.set(node.id, NODE_W);
      return NODE_W;
    }
    const total = node.children.reduce((sum, c) => sum + measureWidth(c) + H_GAP, 0) - H_GAP;
    const width = Math.max(NODE_W, total);
    subtreeWidths.set(node.id, width);
    return width;
  }
  measureWidth(root);

  // Pass 2: position nodes, siblings centered under parent
  function position(node: GoalNode, x: number, y: number, depth: number) {
    const nodeType = getNodeType(depth);
    nodes.push({
      id: node.id, type: "goalNode", position: { x, y },
      data: { title: node.title, description: node.description, status: node.status, nodeType },
    });

    if (node.children.length === 0) return;

    const childY = y + NODE_H + V_GAP;
    let cursor = x - (subtreeWidths.get(node.id)! / 2);

    for (const child of node.children) {
      const childW = subtreeWidths.get(child.id)!;
      const childX = cursor + childW / 2;
      cursor += childW + H_GAP;

      edges.push({
        id: `${node.id}->${child.id}`, source: node.id, target: child.id,
        type: "smoothstep",
        animated: child.status === TASK_STATUS_EXECUTING || node.status === TASK_STATUS_EXECUTING,
        style: { stroke: "#3A3A3A", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#555555", width: 12, height: 12 },
      });

      position(child, childX, childY, depth + 1);
    }
  }

  position(root, 0, 0, 0);
  return { nodes, edges };
}

// ─── Custom Node ───────────────────────────────────────────────────────────

interface GoalNodeData {
  title: string;
  description?: string;
  status: GoalNode["status"];
  nodeType: NodeType;
  pendingChange?: "update" | "add" | "remove";
}

interface GoalNodeCardCallbacks {
  onEdit: () => void;
  onAiEdit: () => void;
  onDelete: () => void;
  isAiEditing: boolean;
  aiEditInput: string;
  onAiEditInputChange: (val: string) => void;
  onAiEditSubmit: () => void;
  onAiEditCancel: () => void;
  aiEditLoading: boolean;
}

function GoalNodeCard({ data, selected }: NodeProps) {
  const d = (data as unknown as GoalNodeData) ?? ({} as GoalNodeData);
  const cbs = (data as unknown as { callbacks?: GoalNodeCardCallbacks }).callbacks;
  const nodeType = (d.nodeType as NodeType | undefined) ?? "task";
  const color = TYPE_COLORS[nodeType] ?? TYPE_COLORS.task;
  const statusInfo = STATUS_COLORS[d.status ?? "started"] ?? STATUS_COLORS.started;
  const title = d.title ?? "Untitled";
  const description = d.description;

  // Local input state for AI edit (managed locally so keystrokes don't re-render parent)
  const [localAiInput, setLocalAiInput] = useState(cbs?.aiEditInput ?? "");
  useEffect(() => {
    if (cbs?.isAiEditing) {
      setLocalAiInput(cbs.aiEditInput ?? "");
    }
  }, [cbs?.isAiEditing, cbs?.aiEditInput]);

  const pendingBorder = d.pendingChange === "update"
    ? "border-[#F59E0B] shadow-[0_0_0_2px_#F59E0B22]"
    : d.pendingChange === "add"
      ? "border-[#00FF41] border-dashed shadow-[0_0_0_2px_#00FF4122]"
      : d.pendingChange === "remove"
        ? "border-[#DC2626] opacity-50 line-through"
        : "";

  return (
    <div
      className={cn(
        "group rounded-lg border p-3 transition-all duration-150 relative",
        selected ? "border-[#00FF41] shadow-[0_0_0_2px_#00FF4122]" : "border-[#2A2A2A] hover:border-[#00FF41]",
        pendingBorder,
      )}
      style={{ width: NODE_W, minHeight: 80, background: "#1A1A1A" }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color, border: "none", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: "none", width: 8, height: 8 }} />

      {/* Hover action bar */}
      {cbs && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); cbs.onEdit(); }}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#2A2A2A] text-[#888] hover:text-white transition-colors"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); cbs.onAiEdit(); }}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#2A2A2A] text-[#888] hover:text-[#A855F7] transition-colors"
            title="AI Edit"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); cbs.onDelete(); }}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#2A2A2A] text-[#888] hover:text-[#F87171] transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Type badge */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
          {TYPE_LABELS[nodeType] ?? "TASK"}
        </span>
      </div>

      {/* Title */}
      <p className="text-[13px] font-medium text-white leading-tight truncate">
        {title}
      </p>

      {/* Description */}
      {description && (
        <p className="text-[11px] text-[#888888] mt-0.5 line-clamp-2 leading-snug">
          {description}
        </p>
      )}

      {/* AI Edit inline input */}
      {cbs?.isAiEditing && (
        <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <input
            value={localAiInput}
            onChange={(e) => {
              setLocalAiInput(e.target.value);
              cbs.onAiEditInputChange(e.target.value);
            }}
            placeholder="Ask AI to change this task..."
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded px-2 py-1 text-[11px] text-white placeholder-[#555] focus:outline-none focus:border-[#A855F7]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") cbs.onAiEditSubmit();
              if (e.key === "Escape") cbs.onAiEditCancel();
            }}
          />
          <div className="flex gap-1">
            <button
              onClick={cbs.onAiEditSubmit}
              disabled={cbs.aiEditLoading || !localAiInput.trim()}
              className="h-6 w-6 flex items-center justify-center rounded bg-[#A855F722] hover:bg-[#A855F733] text-[#A855F7] disabled:opacity-40 transition-colors"
            >
              {cbs.aiEditLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </button>
            <button
              onClick={cbs.onAiEditCancel}
              className="h-6 w-6 flex items-center justify-center rounded bg-[#2A2A2A] hover:bg-[#333] text-[#888] transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Status pill */}
      <div
        className="mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border"
        style={{ backgroundColor: statusInfo.bg, color: statusInfo.text, borderColor: statusInfo.border }}
      >
        {STATUS_LABELS[d.status ?? "started"] ?? "todo"}
      </div>
    </div>
  );
}

// ─── Edit Drawer ───────────────────────────────────────────────────────────

interface EditDrawerProps {
  open: boolean;
  nodeId: string;
  initialTitle: string;
  initialDescription: string;
  initialStatus: string;
  initialType: NodeType;
  onSave: (data: { title: string; description: string; status: string; nodeType: NodeType }) => void;
  onClose: () => void;
}

function EditDrawer({ open, nodeId, initialTitle, initialDescription, initialStatus, initialType, onSave, onClose }: EditDrawerProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [status, setStatus] = useState(initialStatus);
  const [nodeType, setNodeType] = useState<NodeType>(initialType);

  useEffect(() => {
    setTitle(initialTitle);
    setDescription(initialDescription);
    setStatus(initialStatus);
    setNodeType(initialType);
  }, [initialTitle, initialDescription, initialStatus, initialType, nodeId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-80 h-full bg-[#111111] border-l border-[#2A2A2A] p-5 overflow-y-auto animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-white">Edit Node</h3>
          <button onClick={onClose} className="text-[#888888] hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-[#888888] uppercase tracking-wider block mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-md px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#00FF41] placeholder-[#555]"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#888888] uppercase tracking-wider block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-md px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#00FF41] placeholder-[#555] resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#888888] uppercase tracking-wider block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-md px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#00FF41]"
            >
              <option value="started">Todo</option>
              <option value="executing">In Progress</option>
              <option value="completed">Done</option>
              <option value="failed">Blocked</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#888888] uppercase tracking-wider block mb-1">Type</label>
            <select
              value={nodeType}
              onChange={(e) => setNodeType(e.target.value as NodeType)}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-md px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#00FF41]"
            >
              <option value="goal">Goal</option>
              <option value="milestone">Milestone</option>
              <option value="task">Task</option>
            </select>
          </div>

          <button
            onClick={() => onSave({ title: title.trim() || initialTitle, description: description.trim(), status, nodeType })}
            className="w-full flex items-center justify-center gap-2 bg-white text-black rounded-md py-2 text-[13px] font-medium hover:bg-[#E0E0E0] transition-colors"
          >
            <Check className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

interface GoalFlowProps {
  root: GoalNode;
  goalId: string;
  className?: string;
  pendingDiffs?: ChangeInstruction[] | null;
  onManualUpdate?: (nodeId: string, changes: { title: string; description: string; status: string; nodeType: NodeType }) => Promise<void>;
  onManualDelete?: (nodeId: string) => Promise<void>;
}

interface ChangeInstruction {
  action: "update" | "add" | "remove";
  nodeId: string;
  parentId?: string;
  title?: string;
  description?: string;
}

function GoalFlowInner({ root, goalId, className, pendingDiffs, onManualUpdate, onManualDelete }: GoalFlowProps) {
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => treeLayout(root), [root]);
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);
  const { fitView } = useReactFlow();
  const [drawer, setDrawer] = useState<{ nodeId: string; title: string; description: string; status: string; nodeType: NodeType } | null>(null);
  const nodeTypes = useMemo(() => ({ goalNode: GoalNodeCard }), []);
  const flowRef = useRef<HTMLDivElement>(null);

  const snapshotRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const prevDiffsRef = useRef<ChangeInstruction[] | null | undefined>(undefined);

  // AI Edit state
  const [aiEditTarget, setAiEditTarget] = useState<string | null>(null);
  const [aiEditInput, setAiEditInput] = useState("");
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const aiEditInputRef = useRef(aiEditInput);
  useEffect(() => { aiEditInputRef.current = aiEditInput; }, [aiEditInput]);

  // Sync nodes/edges when root prop changes (e.g., after DB save)
  const prevRootRef = useRef(root);
  useEffect(() => {
    if (prevRootRef.current !== root) {
      prevRootRef.current = root;
      const { nodes: newNodes, edges: newEdges } = treeLayout(root);
      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [root, setNodes, setEdges]);

  // Fit view on load
  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
    return () => clearTimeout(timer);
  }, [fitView]);

  // Pending diffs: apply visual indicators without full re-render
  useEffect(() => {
    const prev = prevDiffsRef.current;
    prevDiffsRef.current = pendingDiffs;

    const hasDiffs = pendingDiffs && pendingDiffs.length > 0;
    const hadDiffs = prev && prev.length > 0;

    if (hasDiffs && !hadDiffs) {
      const changedIds = new Set(pendingDiffs.map((d) => d.nodeId));
      const removeIds = new Set(pendingDiffs.filter((d) => d.action === "remove").map((d) => d.nodeId));
      const addDiffs = pendingDiffs.filter((d) => d.action === "add");

      setNodes((nds) => {
        snapshotRef.current = {
          nodes: nds.map((n) => ({ ...n, data: { ...(n.data as Record<string, unknown>) } })),
          edges: edges.map((e) => ({ ...e })),
        };

        const updated = nds.map((n) => {
          if (removeIds.has(n.id)) {
            return { ...n, data: { ...n.data, pendingChange: "remove" as const } };
          }
          if (changedIds.has(n.id)) {
            const diff = pendingDiffs.find((d) => d.nodeId === n.id);
            return {
              ...n,
              data: {
                ...n.data,
                ...(diff?.title ? { title: diff.title } : {}),
                ...(diff?.description !== undefined ? { description: diff.description } : {}),
                pendingChange: "update" as const,
              },
            };
          }
          return n;
        });

        for (const diff of addDiffs) {
          const parentNode = nds.find((n) => n.id === diff.parentId);
          if (parentNode) {
            updated.push({
              id: diff.nodeId,
              type: "goalNode",
              position: { x: parentNode.position.x, y: parentNode.position.y + NODE_H + V_GAP },
              data: {
                title: diff.title || "New node",
                description: diff.description || "",
                status: "started" as const,
                nodeType: "task" as NodeType,
                pendingChange: "add" as const,
              },
            });
          }
        }

        return updated;
      });

      setEdges((eds) => {
        const updated = [...eds];
        for (const diff of addDiffs) {
          if (diff.parentId) {
            updated.push({
              id: `${diff.parentId}->${diff.nodeId}`,
              source: diff.parentId,
              target: diff.nodeId,
              type: "smoothstep",
              animated: true,
              style: { stroke: "#00FF41", strokeWidth: 2, strokeDasharray: "5 5" },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#00FF41", width: 12, height: 12 },
            });
          }
        }
        return updated;
      });
    } else if (!hasDiffs && hadDiffs && snapshotRef.current) {
      setNodes(snapshotRef.current.nodes);
      setEdges(snapshotRef.current.edges);
      snapshotRef.current = null;
    }
  }, [pendingDiffs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdit = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const d = node.data as unknown as GoalNodeData;
    setDrawer({ nodeId, title: d.title, description: d.description ?? "", status: d.status, nodeType: d.nodeType });
  }, [nodes]);

  const handleDelete = useCallback((nodeId: string) => {
    // Build adjacency from current edges to find all descendants
    const descendantIds = new Set<string>();
    const stack = [nodeId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      descendantIds.add(current);
      for (const e of edges) {
        if (e.source === current && !descendantIds.has(e.target)) {
          stack.push(e.target);
        }
      }
    }

    setNodes((nds) => nds.filter((n) => !descendantIds.has(n.id)));
    setEdges((eds) => eds.filter((e) => !descendantIds.has(e.source) && !descendantIds.has(e.target)));

    if (onManualDelete) {
      onManualDelete(nodeId).catch(() => {});
    }
  }, [setNodes, setEdges, edges, onManualDelete]);

  const handleSaveDrawer = useCallback((data: { title: string; description: string; status: string; nodeType: NodeType }) => {
    if (!drawer) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === drawer.nodeId
          ? { ...n, data: { ...n.data, title: data.title, description: data.description, status: data.status, nodeType: data.nodeType } }
          : n,
      ),
    );
    if (onManualUpdate) {
      onManualUpdate(drawer.nodeId, data).catch(() => {});
    }
    setDrawer(null);
  }, [drawer, setNodes, onManualUpdate]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    handleEdit(node.id);
  }, [handleEdit]);

  const handleAiEditOpen = useCallback((nodeId: string) => {
    setAiEditTarget(nodeId);
    setAiEditInput("");
  }, []);

  const handleAiEditCancel = useCallback(() => {
    setAiEditTarget(null);
    setAiEditInput("");
  }, []);

  const handleAiEditSubmit = useCallback(async () => {
    if (!aiEditTarget || !aiEditInputRef.current.trim()) return;
    const nodeId = aiEditTarget;
    const instruction = aiEditInputRef.current.trim();
    setAiEditLoading(true);

    try {
      const res = await fetch(`/api/goal/${goalId}/chat-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tree: root, message: `Change the node with id "${nodeId}": ${instruction}` }),
      });

      const data = await res.json();
      if (!res.ok || !data.diffs) throw new Error(data.error || "Failed");

      const diff = (data.diffs as ChangeInstruction[]).find((d) => d.nodeId === nodeId);
      if (diff && diff.action === "update") {
        setNodes((nds) => {
          const node = nds.find((n) => n.id === nodeId);
          const d = node?.data as unknown as GoalNodeData | undefined;
          if (onManualUpdate) {
            onManualUpdate(nodeId, {
              title: diff.title ?? d?.title ?? "",
              description: diff.description ?? d?.description ?? "",
              status: d?.status ?? "started",
              nodeType: d?.nodeType ?? "task",
            }).catch(() => {});
          }
          return nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    ...(diff.title ? { title: diff.title } : {}),
                    ...(diff.description !== undefined ? { description: diff.description } : {}),
                  },
                }
              : n,
          );
        });
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setAiEditLoading(false);
      setAiEditTarget(null);
      setAiEditInput("");
    }
  }, [aiEditTarget, goalId, root, setNodes, onManualUpdate]);

  // Inject callbacks into node data so GoalNodeCard can use them
  const augmentedNodes = useMemo(() => {
    return nodes.map((n) => {
      const nodeId = n.id;
      return {
        ...n,
        data: {
          ...n.data,
          callbacks: {
            onEdit: () => handleEdit(nodeId),
            onAiEdit: () => handleAiEditOpen(nodeId),
            onDelete: () => handleDelete(nodeId),
            isAiEditing: aiEditTarget === nodeId,
            aiEditInput: aiEditInputRef.current,
            onAiEditInputChange: setAiEditInput,
            onAiEditSubmit: handleAiEditSubmit,
            onAiEditCancel: handleAiEditCancel,
            aiEditLoading,
          } satisfies GoalNodeCardCallbacks,
        },
      };
    });
  }, [nodes, handleEdit, handleAiEditOpen, handleDelete, aiEditTarget, handleAiEditSubmit, handleAiEditCancel, aiEditLoading]);

  return (
    <div ref={flowRef} className={cn("w-full", className)} style={{ height: 600 }}>
      <ReactFlow
        nodes={augmentedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2, minZoom: 0.15, duration: 500 }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
        minZoom={0.15}
        maxZoom={1.2}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
          style: { stroke: "#3A3A3A", strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#3A3A3A", width: 12, height: 12 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1F1F1F" />
        <Controls className="[&>button]:!bg-[#1A1A1A] [&>button]:!border-[#2A2A2A] [&>button]:!text-[#888888] [&>button:hover]:!bg-[#222222] [&>button:hover]:!text-white [&>svg]:!fill-[#888888]" />
        <MiniMap
          nodeColor="var(--card)"
          maskColor="rgba(0,0,0,0.7)"
          className="!bg-[#0A0A0A] !border-[#2A2A2A]"
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Edit drawer */}
      {drawer && (
        <EditDrawer
          open={true}
          nodeId={drawer.nodeId}
          initialTitle={drawer.title}
          initialDescription={drawer.description}
          initialStatus={drawer.status}
          initialType={drawer.nodeType}
          onSave={handleSaveDrawer}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}

export function GoalFlow(props: GoalFlowProps) {
  return (
    <ReactFlowProvider>
      <GoalFlowInner {...props} />
    </ReactFlowProvider>
  );
}
