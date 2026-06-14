"use client";

import { Check, X } from "lucide-react";
import type { ChangeInstruction } from "./flow-chat";

interface FlowControlsProps {
  pendingDiffs: ChangeInstruction[] | null;
  onAccept: () => void;
  onReject: () => void;
}

export function FlowControls({ pendingDiffs, onAccept, onReject }: FlowControlsProps) {
  if (!pendingDiffs || pendingDiffs.length === 0) return null;

  const counts = {
    update: pendingDiffs.filter((d) => d.action === "update").length,
    add: pendingDiffs.filter((d) => d.action === "add").length,
    remove: pendingDiffs.filter((d) => d.action === "remove").length,
  };

  const parts: string[] = [];
  if (counts.update) parts.push(`${counts.update} updated`);
  if (counts.add) parts.push(`${counts.add} added`);
  if (counts.remove) parts.push(`${counts.remove} removed`);

  return (
    <div className="flex items-center justify-between rounded-lg border border-[#F59E0B66] bg-[#F59E0B0D] px-4 py-2.5">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="h-2 w-2 rounded-full bg-[#F59E0B] animate-pulse" />
        <span className="text-[#F59E0B] font-medium">Pending Changes</span>
        <span className="text-[#888]">— {parts.join(", ")}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onAccept}
          className="flex items-center gap-1.5 rounded-md bg-[#00FF41] px-3 py-1.5 text-[12px] font-medium text-black hover:bg-[#00DD38] transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
          Accept
        </button>
        <button
          onClick={onReject}
          className="flex items-center gap-1.5 rounded-md bg-[#DC262622] border border-[#DC262644] px-3 py-1.5 text-[12px] font-medium text-[#F87171] hover:bg-[#DC262633] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </button>
      </div>
    </div>
  );
}
