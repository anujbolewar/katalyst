"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target, Loader2, ArrowRight, ChevronRight, Sparkles, MessageSquare, Check, Search, FileCheck, Bot, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { ErrorBoundary } from "@/components/error-boundary";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  question: string;
  reasoning?: string;
  options: string[];
}

interface PipelineStage {
  icon: React.ElementType;
  label: string;
  detail: string;
  status: "pending" | "active" | "done";
}

type Step = "input" | "framing" | "clarify" | "decomposing";

export default function GoalIntakePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [goal, setGoal] = useState("");
  const [framingLogic, setFramingLogic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [researcherFindings, setResearcherFindings] = useState<string[]>([]);
  const [reviewerNotes, setReviewerNotes] = useState<string | null>(null);

  async function handleAnalyze() {
    const trimmed = goal.trim();
    if (!trimmed || trimmed.length < 3) {
      setError("Please enter a goal with at least 3 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    setStep("framing");

    // Simulate agent pipeline during framing
    setPipelineStages([
      { icon: Bot, label: "Framer Agent", detail: "Analyzing goal intent...", status: "active" },
      { icon: Search, label: "Researcher Agent", detail: "Waiting...", status: "pending" },
      { icon: FileCheck, label: "Reviewer Agent", detail: "Waiting...", status: "pending" },
    ]);

    try {
      await delay(800);
      setPipelineStages((p) => p.map((s, i) => i === 0 ? { ...s, detail: "Identifying key dimensions to clarify..." } : s));
      await delay(600);

      const res = await fetch("/api/goal/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: trimmed }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");

      const data = await res.json();
      setFramingLogic(data.framingLogic ?? "");

      // Mark framer done
      setPipelineStages((p) => p.map((s, i) => i === 0 ? { ...s, status: "done" as const, detail: data.framingLogic ?? "Questions framed" } : s));

      await delay(400);
      setPipelineStages((p) => p.map((s, i) => i === 1 ? { ...s, status: "done" as const, detail: "Context gathered from goal analysis" } : s));
      await delay(300);
      setPipelineStages((p) => p.map((s, i) => i === 2 ? { ...s, status: "done" as const, detail: "Questions validated for coverage" } : s));

      setQuestions(data.questions);
      const defaults: Record<string, string> = {};
      for (const q of data.questions) defaults[q.id] = q.options[0] ?? "";
      setAnswers(defaults);
      await delay(600);
      setStep("clarify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze goal");
      setStep("input");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecompose() {
    setLoading(true);
    setError(null);
    setStep("decomposing");

    setPipelineStages([
      { icon: Search, label: "Researcher", detail: "Gathering domain context...", status: "active" },
      { icon: Bot, label: "Decomposer", detail: "Waiting...", status: "pending" },
      { icon: FileCheck, label: "Reviewer", detail: "Waiting...", status: "pending" },
    ]);

    try {
      const answerList = questions.map((q) => ({
        id: q.id, question: q.question,
        answer: customInputs[q.id]?.trim() || answers[q.id] || q.options[0],
      }));

      await delay(500);
      setPipelineStages((p) => p.map((s, i) => i === 0 ? { ...s, detail: "Analyzing domain and constraints..." } : s));

      const res = await fetch("/api/goal/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), answers: answerList }),
      });

      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Decomposition failed");
      const data = await res.json();

      // Show researcher findings
      if (data.pipeline?.researcher?.findings) {
        setResearcherFindings(data.pipeline.researcher.findings);
        setPipelineStages((p) => p.map((s, i) => i === 0 ? { ...s, status: "done" as const, detail: data.pipeline.researcher.brief ?? "Research complete" } : s));
      }
      await delay(400);

      // Show decomposer stage
      setPipelineStages((p) => p.map((s, i) => i === 1 ? { ...s, status: "active" as const, detail: `Generated ${data.taskCount} task categories...` } : s));
      await delay(600);
      setPipelineStages((p) => p.map((s, i) => i === 1 ? { ...s, status: "done" as const, detail: `${data.taskCount} tasks with subtasks created` } : s));

      // Show reviewer stage
      if (data.pipeline?.reviewer) {
        setReviewerNotes(data.pipeline.reviewer.notes);
        setPipelineStages((p) => p.map((s, i) => i === 2 ? { ...s, status: "active" as const, detail: "Validating task quality..." } : s));
        await delay(500);
        setPipelineStages((p) => p.map((s, i) => i === 2 ? { ...s, status: "done" as const, detail: data.pipeline.reviewer.notes ?? "Review complete" } : s));
      }

      await delay(400);
      router.push(`/objectives/${data.goalId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decomposition failed");
      setStep("clarify");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "Goal Intake" }]} />
      <ErrorBoundary fallbackMessage="Decomposition failed. Try again.">
        <div className="flex flex-col items-center justify-center py-12 md:py-16">
          <div className="max-w-xl w-full space-y-6">
            <div className="text-center space-y-2">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Target className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Goal Intake</h1>
              <p className="text-muted-foreground">
                {step === "input" && "Describe your goal — agents will ask clarifying questions."}
                {step === "framing" && "Framer Agent is analyzing your goal..."}
                {step === "clarify" && "Answer these questions to refine your task breakdown."}
                {step === "decomposing" && "Multi-agent pipeline: Researcher → Decomposer → Reviewer"}
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2">
              {["Goal", "Frame", "Clarify", "Decompose"].map((label, i) => (
                <span key={label} className="flex items-center gap-1">
                  <Badge variant={["input","framing","clarify","decomposing"][i] === step ? "default" : "outline"} className="gap-1 text-[11px]">
                    <span className={cn("h-1.5 w-1.5 rounded-full", ["input","framing","clarify","decomposing"][i] === step ? "bg-primary-foreground" : "bg-muted-foreground")} />
                    {label}
                  </Badge>
                  {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </span>
              ))}
            </div>

            {/* ── Step: Input ──────────────────────────────────────────── */}
            {step === "input" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">What do you want to achieve?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="e.g. Build a SaaS product for task management"
                    value={goal} onChange={(e) => { setGoal(e.target.value); if (error) setError(null); }}
                    className="min-h-[100px] resize-y" disabled={loading} autoFocus
                  />
                  {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
                  <Button onClick={handleAnalyze} disabled={loading || !goal.trim()} className="w-full gap-2">
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : <><MessageSquare className="h-4 w-4" /> Analyze & Refine</>}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ── Step: Framing (agent pipeline) ────────────────────────── */}
            {step === "framing" && (
              <Card>
                <CardContent className="py-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--info)]" />
                    <span className="text-sm font-medium">Agent Pipeline</span>
                  </div>
                  <div className="space-y-3">
                    {pipelineStages.map((s, i) => (
                      <div key={i} className={cn("flex items-start gap-3 rounded-md border p-3 transition-all", s.status === "active" ? "border-[var(--info)] bg-[var(--info)]/5" : s.status === "done" ? "border-[var(--success)]/30 bg-[var(--success)]/5" : "border-[#2A2A2A] opacity-40")}>
                        <div className={cn("mt-0.5 rounded-full p-1.5", s.status === "active" ? "bg-[var(--info)]/10" : s.status === "done" ? "bg-[var(--success)]/10" : "bg-[#1A1A1A]")}>
                          {s.status === "active" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--info)]" /> :
                           s.status === "done" ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> :
                           <s.icon className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-medium", s.status === "active" ? "text-[var(--info)]" : s.status === "done" ? "text-[var(--success)]" : "text-muted-foreground")}>{s.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{s.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
                </CardContent>
              </Card>
            )}

            {/* ── Step: Clarifying Questions ────────────────────────────── */}
            {step === "clarify" && (
              <div className="space-y-4">
                <Card className="border-[var(--border)] bg-[var(--secondary)]">
                  <CardContent className="py-3 px-4 flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground truncate">{goal}</p>
                  </CardContent>
                </Card>
                {framingLogic && (
                  <Card className="border-[var(--info)]/30 bg-[var(--info)]/5">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Brain className="h-3.5 w-3.5 text-[var(--info)]" />
                        <span className="text-[11px] font-medium text-[var(--info)]">Framer Agent</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{framingLogic}</p>
                    </CardContent>
                  </Card>
                )}
                {questions.map((q, idx) => (
                  <Card key={q.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs">{idx + 1}</span>
                        {q.question}
                      </CardTitle>
                      {q.reasoning && <p className="text-[11px] text-muted-foreground mt-1 italic">"{q.reasoning}"</p>}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {q.options.map((opt) => (
                        <label key={opt} className={cn("flex items-center gap-3 rounded-md border border-border px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--accent)]", answers[q.id] === opt && !customInputs[q.id] && "border-[var(--ring)] bg-[var(--accent)]")}>
                          <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt && !customInputs[q.id]} onChange={() => { setAnswers((p) => ({ ...p, [q.id]: opt })); setCustomInputs((p) => { const n = { ...p }; delete n[q.id]; return n; }); }} className="h-4 w-4 shrink-0 accent-[var(--ring)]" />
                          <span className="text-sm">{opt}</span>
                          {answers[q.id] === opt && !customInputs[q.id] && <Check className="h-4 w-4 ml-auto text-[var(--ring)] shrink-0" />}
                        </label>
                      ))}
                      <label className={cn("flex items-center gap-3 rounded-md border border-border px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--accent)]", customInputs[q.id] !== undefined && "border-[var(--ring)] bg-[var(--accent)]")}>
                        <input type="radio" name={q.id} checked={customInputs[q.id] !== undefined} onChange={() => { setCustomInputs((p) => ({ ...p, [q.id]: p[q.id] ?? "" })); setAnswers((p) => ({ ...p, [q.id]: "" })); }} className="h-4 w-4 shrink-0 accent-[var(--ring)]" />
                        <span className="text-sm text-muted-foreground">Other (custom)</span>
                      </label>
                      {customInputs[q.id] !== undefined && <Input placeholder="Type your custom answer..." value={customInputs[q.id]} onChange={(e) => setCustomInputs((p) => ({ ...p, [q.id]: e.target.value }))} className="ml-7 mt-1" autoFocus />}
                    </CardContent>
                  </Card>
                ))}
                {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
                <Button onClick={handleDecompose} disabled={loading} className="w-full gap-2">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Decomposing...</> : <>Decompose Goal <ArrowRight className="h-4 w-4" /></>}
                </Button>
                <button onClick={() => { setStep("input"); setQuestions([]); setError(null); }} className="w-full text-xs text-muted-foreground hover:text-foreground">← Edit goal</button>
              </div>
            )}

            {/* ── Step: Decomposing (agent pipeline) ─────────────────────── */}
            {step === "decomposing" && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="py-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--info)]" />
                      <span className="text-sm font-medium">Agent Pipeline: Researcher → Decomposer → Reviewer</span>
                    </div>
                    <div className="space-y-3">
                      {pipelineStages.map((s, i) => (
                        <div key={i} className={cn("flex items-start gap-3 rounded-md border p-3 transition-all", s.status === "active" ? "border-[var(--info)] bg-[var(--info)]/5" : s.status === "done" ? "border-[var(--success)]/30 bg-[var(--success)]/5" : "border-[#2A2A2A] opacity-40")}>
                          <div className={cn("mt-0.5 rounded-full p-1.5", s.status === "active" ? "bg-[var(--info)]/10" : s.status === "done" ? "bg-[var(--success)]/10" : "bg-[#1A1A1A]")}>
                            {s.status === "active" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--info)]" /> : s.status === "done" ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <s.icon className="h-3.5 w-3.5 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-xs font-medium", s.status === "active" ? "text-[var(--info)]" : s.status === "done" ? "text-[var(--success)]" : "text-muted-foreground")}>{s.label}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{s.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Researcher findings */}
                    {researcherFindings.length > 0 && (
                      <div className="rounded-md border border-[var(--info)]/20 bg-[var(--info)]/5 p-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Search className="h-3 w-3 text-[var(--info)]" />
                          <span className="text-[11px] font-medium text-[var(--info)]">Research Findings</span>
                        </div>
                        <ul className="space-y-1">
                          {researcherFindings.map((f, i) => (
                            <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                              <span className="text-[var(--info)] mt-1">•</span> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Reviewer notes */}
                    {reviewerNotes && (
                      <div className="rounded-md border border-[var(--success)]/20 bg-[var(--success)]/5 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <FileCheck className="h-3 w-3 text-[var(--success)]" />
                          <span className="text-[11px] font-medium text-[var(--success)]">Quality Review</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{reviewerNotes}</p>
                      </div>
                    )}

                    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-1/2 rounded-full bg-[var(--info)] animate-progress-indeterminate" />
                    </div>

                    {/* Answers recap */}
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Your Answers</p>
                      {questions.map((q) => (
                        <div key={q.id} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                          <Check className="h-3 w-3 mt-0.5 text-[var(--success)] shrink-0" />
                          <span className="truncate"><span className="text-foreground/60">{q.question}</span>{" → "}{customInputs[q.id]?.trim() || answers[q.id] || q.options[0]}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
