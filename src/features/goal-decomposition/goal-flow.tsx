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
import { Pencil, Trash2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoalNode } from "./types";
import {
  TASK_STATUS_STARTED,
  TASK_STATUS_EXECUTING,
  TASK_STATUS_COMPLETED,
  TASK_STATUS_FAILED,
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
}

function GoalNodeCard({ data, selected }: NodeProps) {
  const d = data as unknown as GoalNodeData;
  const color = TYPE_COLORS[d.nodeType];
  const status = STATUS_COLORS[d.status] ?? STATUS_COLORS.started;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all duration-150",
        selected ? "border-[#00FF41] shadow-[0_0_0_2px_#00FF4122]" : "border-[#2A2A2A] hover:border-[#00FF41]",
      )}
      style={{ width: NODE_W, minHeight: 80, background: "#1A1A1A" }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color, border: "none", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: "none", width: 8, height: 8 }} />

      {/* Type badge */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
          {TYPE_LABELS[d.nodeType]}
        </span>
      </div>

      {/* Title */}
      <p className="text-[13px] font-medium text-white leading-tight truncate">
        {d.title}
      </p>

      {/* Description */}
      {d.description && (
        <p className="text-[11px] text-[#888888] mt-0.5 line-clamp-2 leading-snug">
          {d.description}
        </p>
      )}

      {/* Status pill */}
      <div
        className="mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border"
        style={{ backgroundColor: status.bg, color: status.text, borderColor: status.border }}
      >
        {STATUS_LABELS[d.status]}
      </div>
    </div>
  );
}

// ─── Floating Menu ─────────────────────────────────────────────────────────

interface MenuState {
  x: number;
  y: number;
  nodeId: string;
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
  className?: string;
}

function GoalFlowInner({ root, className }: GoalFlowProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => treeLayout(root), [root]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { fitView } = useReactFlow();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [drawer, setDrawer] = useState<{ nodeId: string; title: string; description: string; status: string; nodeType: NodeType } | null>(null);
  const nodeTypes = useMemo(() => ({ goalNode: GoalNodeCard }), []);
  const flowRef = useRef<HTMLDivElement>(null);

  // Fit view on load
  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
    return () => clearTimeout(timer);
  }, [fitView]);

  // Close menu on outside click or Escape
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-menu]")) setMenu(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, [menu]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const pos = (node as unknown as { positionAbsolute?: { x: number; y: number } }).positionAbsolute;
    setMenu({
      x: (pos?.x ?? node.position.x) + NODE_W,
      y: (pos?.y ?? node.position.y),
      nodeId: node.id,
    });
  }, []);

  const handleEdit = useCallback(() => {
    if (!menu) return;
    const node = nodes.find((n) => n.id === menu.nodeId);
    if (!node) return;
    const d = node.data as unknown as GoalNodeData;
    setDrawer({ nodeId: menu.nodeId, title: d.title, description: d.description ?? "", status: d.status, nodeType: d.nodeType });
    setMenu(null);
  }, [menu, nodes]);

  const handleDelete = useCallback(() => {
    if (!menu) return;
    setNodes((nds) => nds.filter((n) => n.id !== menu.nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== menu.nodeId && e.target !== menu.nodeId));
    setMenu(null);
  }, [menu, setNodes, setEdges]);

  const handleSaveDrawer = useCallback((data: { title: string; description: string; status: string; nodeType: NodeType }) => {
    if (!drawer) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === drawer.nodeId
          ? { ...n, data: { ...n.data, title: data.title, description: data.description, status: data.status, nodeType: data.nodeType } }
          : n,
      ),
    );
    setDrawer(null);
  }, [drawer, setNodes]);

  return (
    <div ref={flowRef} className={cn("w-full", className)} style={{ height: 600 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
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

      {/* Floating menu */}
      {menu && (
        <div
          data-menu
          className="absolute z-40 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-xl py-1 min-w-[120px]"
          style={{ left: menu.x + 8, top: menu.y }}
        >
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-[#888888] hover:text-white hover:bg-[#222222] transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-[#DC2626] hover:bg-[#222222] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

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
