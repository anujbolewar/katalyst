"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Circle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoalNode } from "./types";
import {
  TASK_STATUS_STARTED,
  TASK_STATUS_EXECUTING,
  TASK_STATUS_COMPLETED,
  TASK_STATUS_FAILED,
} from "./types";

// ─── Status Icon ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: GoalNode["status"] }) {
  switch (status) {
    case TASK_STATUS_STARTED:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    case TASK_STATUS_EXECUTING:
      return <Loader2 className="h-4 w-4 text-[var(--info)] animate-spin" />;
    case TASK_STATUS_COMPLETED:
      return <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />;
    case TASK_STATUS_FAILED:
      return <AlertTriangle className="h-4 w-4 text-[var(--destructive)]" />;
  }
}

// ─── TreeNode ───────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: GoalNode;
  depth: number;
  defaultExpanded?: boolean;
}

function TreeNode({ node, depth, defaultExpanded = false }: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const [expanded, setExpanded] = useState(defaultExpanded || depth < 1);

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-md transition-colors",
          "hover:bg-muted/50",
          depth === 0 && "font-semibold text-sm bg-muted/30"
        )}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
        role={hasChildren ? "button" : undefined}
        tabIndex={hasChildren ? 0 : undefined}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {depth === 0 ? (
          <Target className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <StatusIcon status={node.status} />
        )}

        <span
          className={cn(
            "truncate",
            node.status === TASK_STATUS_COMPLETED && "line-through text-muted-foreground",
            node.status === TASK_STATUS_FAILED && "text-[var(--destructive)]"
          )}
        >
          {node.title}
        </span>

        {node.description && depth === 0 && (
          <span className="text-xs text-muted-foreground truncate hidden sm:inline ml-2">
            — {node.description}
          </span>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="border-l border-border ml-[1.65rem]">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── GoalTree ───────────────────────────────────────────────────────────────

interface GoalTreeProps {
  root: GoalNode;
  className?: string;
}

export function GoalTree({ root, className }: GoalTreeProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground",
        className
      )}
    >
      <div className="p-1">
        <TreeNode node={root} depth={0} defaultExpanded />
      </div>
    </div>
  );
}

// ─── GoalTreeSkeleton ───────────────────────────────────────────────────────

export function GoalTreeSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="h-5 bg-muted rounded w-1/2 animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-muted rounded animate-pulse"
          style={{
            width: `${60 + Math.random() * 30}%`,
            marginLeft: `${(i % 3) * 24}px`,
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}
