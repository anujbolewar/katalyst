"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GoalNode } from "@/features/goal-decomposition/types";

export interface ChangeInstruction {
  action: "update" | "add" | "remove";
  nodeId: string;
  parentId?: string;
  title?: string;
  description?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  diffs?: ChangeInstruction[];
}

interface FlowChatProps {
  goalId: string;
  currentTree: GoalNode;
  onProposeChanges: (diffs: ChangeInstruction[], explanation: string) => void;
  hasPendingChanges: boolean;
}

export function FlowChat({ goalId, currentTree, onProposeChanges, hasPendingChanges }: FlowChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || hasPendingChanges) return;

    setInput("");
    setError(null);
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`/api/goal/${goalId}/chat-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tree: currentTree, message: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${data.error || "Failed to process request"}` },
        ]);
        setError(data.error || "Failed");
        return;
      }

      const diffs = data.diffs as ChangeInstruction[];
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.explanation,
        diffs,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      onProposeChanges(diffs, data.explanation);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [input, loading, hasPendingChanges, goalId, currentTree, onProposeChanges]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex flex-col h-[500px] bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2A2A2A] bg-[#111111]">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[#00FF41]" />
          <span className="text-[13px] font-medium text-white">AI Graph Editor</span>
        </div>
        <span className="text-[11px] text-[#666]">
          Describe changes to the goal tree
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-[13px] text-[#555] text-center px-4">
            <div>
              <Bot className="h-6 w-6 mx-auto mb-2 text-[#333]" />
              <p>Ask me to modify the goal tree.</p>
              <p className="text-[12px] mt-1 text-[#444]">
                e.g. &ldquo;Rename the market research task to competitor analysis&rdquo;
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="shrink-0 mt-1">
                <div className="h-6 w-6 rounded-full bg-[#00FF4122] flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-[#00FF41]" />
                </div>
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#00FF41] text-black"
                  : "bg-[#1A1A1A] border border-[#2A2A2A] text-[#CCCCCC]"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.diffs && msg.diffs.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#2A2A2A]">
                  <p className="text-[11px] text-[#888] mb-1">
                    {msg.diffs.length} change{msg.diffs.length > 1 ? "s" : ""} proposed:
                  </p>
                  <ul className="text-[11px] space-y-0.5">
                    {msg.diffs.map((d, j) => (
                      <li key={j} className="text-[#888]">
                        <span className="text-[#00FF41] font-medium">
                          {d.action}
                        </span>
                        {" — "}
                        {d.title || d.nodeId}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="shrink-0 mt-1">
                <div className="h-6 w-6 rounded-full bg-[#2A2A2A] flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-[#888]" />
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 justify-start">
            <div className="shrink-0 mt-1">
              <div className="h-6 w-6 rounded-full bg-[#00FF4122] flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-[#00FF41]" />
              </div>
            </div>
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#00FF41]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="px-4 py-1.5 text-[11px] text-[#F87171] bg-[#DC262611] border-t border-[#DC262633]">
          {error}
        </div>
      )}

      <div className="px-3 py-2.5 border-t border-[#2A2A2A] bg-[#111111]">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasPendingChanges
                ? "Accept or reject pending changes first..."
                : "Describe the change you want..."
            }
            disabled={loading || hasPendingChanges}
            className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md px-3 py-2 text-[13px] text-white placeholder-[#555] focus:outline-none focus:border-[#00FF41] disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSend}
            disabled={!input.trim() || loading || hasPendingChanges}
            className="shrink-0 h-9 w-9 text-[#888] hover:text-[#00FF41] hover:bg-[#1A1A1A]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
