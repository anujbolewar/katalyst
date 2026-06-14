"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Target, Loader2, ArrowRight, ChevronRight, MessageSquare, Check, Search, FileCheck, Bot, Brain, Zap, Shield, GitGraph } from "lucide-react";
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

type EffortLevel = "low" | "high";
type Step = "input" | "framing" | "clarify" | "decomposing" | "done";

const XAI_CYCLE_MESSAGES = [
  "Analyzing goal intent...",
  "Identifying domain context...",
  "Mapping technical constraints...",
  "Evaluating success factors...",
  "Scanning risk dimensions...",
  "Decomposing into hierarchical tasks...",
  "Validating task completeness...",
  "Reviewing category coverage...",
  "Checking for gaps...",
  "Finalizing task tree...",
];

export default function GoalIntakePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [goal, setGoal] = useState("");
  const [framingLogic, setFramingLogic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [extraContext, setExtraContext] = useState("");
  const [effortLevel, setEffortLevel] = useState<EffortLevel>("low");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [researcherFindings, setResearcherFindings] = useState<string[]>([]);
  const [reviewerNotes, setReviewerNotes] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [taskCount, setTaskCount] = useState<number>(0);
  const [xaiMessage, setXaiMessage] = useState("");
  const xaiIdxRef = useRef(0);
  const xaiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    return () => {
      if (xaiTimerRef.current) clearInterval(xaiTimerRef.current);
    };
  }, []);

  function startXaiCycler() {
    xaiIdxRef.current = 0;
    setXaiMessage(XAI_CYCLE_MESSAGES[0]);
    xaiTimerRef.current = setInterval(() => {
      xaiIdxRef.current = (xaiIdxRef.current + 1) % XAI_CYCLE_MESSAGES.length;
      setXaiMessage(XAI_CYCLE_MESSAGES[xaiIdxRef.current]);
    }, 2000);
  }

  function stopXaiCycler() {
    if (xaiTimerRef.current) {
      clearInterval(xaiTimerRef.current);
      xaiTimerRef.current = null;
    }
  }

  async function handleAnalyze() {
    const trimmed = goal.trim();
    if (!trimmed || trimmed.length < 3) {
      setError("Please enter a goal with at least 3 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    setStep("framing");

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
    setShowResults(false);
    setResearcherFindings([]);
    setReviewerNotes(null);
    setGoalId(null);
    setTaskCount(0);
    setRawResponse(null);
    setStep("decomposing");

    const isHigh = effortLevel === "high";

    setPipelineStages(
      isHigh
        ? [
            { icon: Search, label: "Researcher", detail: "Gathering domain context...", status: "active" },
            { icon: Bot, label: "Decomposer", detail: "Waiting...", status: "pending" },
            { icon: FileCheck, label: "Reviewer", detail: "Waiting...", status: "pending" },
          ]
        : [
            { icon: Bot, label: "Decomposer", detail: "Generating task tree...", status: "active" },
          ],
    );

    startXaiCycler();

    try {
      const answerList = questions.map((q) => ({
        id: q.id, question: q.question,
        answer: customInputs[q.id]?.trim() || answers[q.id] || q.options[0],
      }));

      const res = await fetch("/api/goal/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          answers: answerList,
          extraContext: extraContext.trim(),
          effortLevel,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const errMsg = errBody.error || "Decomposition failed";
        const err = new Error(errMsg);
        (err as unknown as Record<string, unknown>).rawResponse = errBody.rawResponse;
        throw err;
      }
      const data = await res.json();

      stopXaiCycler();
      setGoalId(data.goalId);
      setTaskCount(data.taskCount);

      // Reveal results with staged animations
      if (isHigh && data.pipeline?.researcher?.findings) {
        setPipelineStages((p) => p.map((s, i) => i === 0 ? { ...s, status: "done" as const, detail: data.pipeline.researcher.brief ?? "Research complete" } : s));
        setResearcherFindings(data.pipeline.researcher.findings);
        await delay(500);
      } else {
        setPipelineStages((p) => p.map((s, i) => i === 0 ? { ...s, status: "done" as const, detail: `Generated ${data.taskCount} tasks` } : s));
        setShowResults(true);
        setStep("done");
        return;
      }

      setPipelineStages((p) => p.map((s, i) => i === 1 ? { ...s, status: "active" as const, detail: `Generated ${data.taskCount} task categories...` } : s));
      await delay(600);
      setPipelineStages((p) => p.map((s, i) => i === 1 ? { ...s, status: "done" as const, detail: `${data.taskCount} tasks with subtasks created` } : s));

      if (data.pipeline?.reviewer) {
        setReviewerNotes(data.pipeline.reviewer.notes);
        setPipelineStages((p) => p.map((s, i) => i === 2 ? { ...s, status: "active" as const, detail: "Validating task quality..." } : s));
        await delay(500);
        setPipelineStages((p) => p.map((s, i) => i === 2 ? { ...s, status: "done" as const, detail: data.pipeline.reviewer.notes ?? "Review complete" } : s));
      }

      await delay(400);
      setShowResults(true);
      setStep("done");
    } catch (err) {
      stopXaiCycler();
      setError(err instanceof Error ? err.message : "Decomposition failed");
      if (err instanceof Error && (err as unknown as Record<string, unknown>).rawResponse) {
        setRawResponse((err as unknown as Record<string, unknown>).rawResponse as string);
      }
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
                {step === "done" && "Decomposition complete — review the results below."}
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2">
              {["Goal", "Frame", "Clarify", "Decompose"].map((label, i) => (
                <span key={label} className="flex items-center gap-1">
                  <Badge variant={["input","framing","clarify","decomposing","done"][i] === step || (["input","framing","clarify","decomposing","done"][i] === "decomposing" && step === "done") ? "default" : "outline"} className="gap-1 text-[11px]">
                    <span className={cn("h-1.5 w-1.5 rounded-full", ["input","framing","clarify","decomposing","done"][i] === step || (["input","framing","clarify","decomposing","done"][i] === "decomposing" && step === "done") ? "bg-primary-foreground" : "bg-muted-foreground")} />
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
                  {error && (
                  <>
                    <p className="text-sm font-medium text-[var(--destructive)]">{error}</p>
                    {rawResponse && (
                      <details className="mt-2">
                        <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                          Raw LLM Response
                        </summary>
                        <pre className="mt-1 text-[10px] text-muted-foreground bg-[#0A0A0A] p-2 rounded border border-[#2A2A2A] overflow-auto max-h-32 whitespace-pre-wrap">{rawResponse}</pre>
                      </details>
                    )}
                    <button onClick={() => { setStep("clarify"); setError(null); setRawResponse(null); }} className="text-xs text-muted-foreground hover:text-foreground mt-2">
                      ← Back to clarify
                    </button>
                  </>
                )}
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
                  {error && <p className="text-sm font-medium text-[var(--destructive)]">{error}</p>}
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
                      {q.reasoning && <p className="text-[11px] text-muted-foreground mt-1 italic">&ldquo;{q.reasoning}&rdquo;</p>}
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
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Any extra context about this project? (Optional)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="e.g. team size, tech stack, timeline, constraints, target users..."
                      value={extraContext}
                      onChange={(e) => setExtraContext(e.target.value)}
                      className="min-h-[80px] resize-y"
                    />
                  </CardContent>
                </Card>

                {/* Effort Level Selector */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Effort Level</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setEffortLevel("low")}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-lg border p-4 text-center transition-all",
                          effortLevel === "low"
                            ? "border-[var(--ring)] bg-[var(--accent)]"
                            : "border-border hover:bg-[var(--accent)]/50",
                        )}
                      >
                        <Zap className={cn("h-5 w-5", effortLevel === "low" ? "text-[var(--ring)]" : "text-muted-foreground")} />
                        <span className="text-sm font-medium">Low</span>
                        <span className="text-[10px] text-muted-foreground">Fast · Flat task list · No deep validation</span>
                      </button>
                      <button
                        onClick={() => setEffortLevel("high")}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-lg border p-4 text-center transition-all",
                          effortLevel === "high"
                            ? "border-[var(--ring)] bg-[var(--accent)]"
                            : "border-border hover:bg-[var(--accent)]/50",
                        )}
                      >
                        <Shield className={cn("h-5 w-5", effortLevel === "high" ? "text-[var(--ring)]" : "text-muted-foreground")} />
                        <span className="text-sm font-medium">High</span>
                        <span className="text-[10px] text-muted-foreground">Deep · Multi-agent · Reviewed</span>
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {error && <p className="text-sm font-medium text-[var(--destructive)]">{error}</p>}
                <Button onClick={handleDecompose} disabled={loading} className="w-full gap-2">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Decomposing...</> : <>Decompose Goal <ArrowRight className="h-4 w-4" /></>}
                </Button>
                <button onClick={() => { setStep("input"); setQuestions([]); setError(null); }} className="w-full text-xs text-muted-foreground hover:text-foreground">← Edit goal</button>
              </div>
            )}

            {/* ── Step: Decomposing (agent pipeline) ─────────────────────── */}
            {(step === "decomposing" || step === "done") && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="py-6 space-y-4">
                    <div className="flex items-center gap-2">
                      {step === "decomposing" && <Loader2 className="h-4 w-4 animate-spin text-[var(--info)]" />}
                      {step === "done" && <Check className="h-4 w-4 text-[var(--success)]" />}
                      <span className="text-sm font-medium">
                        {step === "decomposing" ? `Agent Pipeline${effortLevel === "high" ? ": Researcher → Decomposer → Reviewer" : ""}` : "Decomposition Complete"}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {pipelineStages.map((s, i) => (
                        <div
                          key={i}
                          style={{ animationDelay: `${i * 150}ms` }}
                          className={cn(
                            "flex items-start gap-3 rounded-md border p-3 transition-all animate-fade-in-up",
                            s.status === "active" ? "border-[var(--info)] bg-[var(--info)]/5" :
                            s.status === "done" ? "border-[var(--success)]/30 bg-[var(--success)]/5" :
                            "border-[#2A2A2A] opacity-40",
                          )}
                        >
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

                    {/* XAI Cycling message during loading */}
                    {step === "decomposing" && xaiMessage && (
                      <div className="rounded-md border border-[var(--info)]/20 bg-[var(--info)]/5 p-3 animate-fade-in-up">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Loader2 className="h-3 w-3 animate-spin text-[var(--info)]" />
                          <span className="text-[11px] font-medium text-[var(--info)]">Agent Thinking</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{xaiMessage}</p>
                      </div>
                    )}

                    {/* Researcher findings */}
                    {showResults && researcherFindings.length > 0 && (
                      <div className="rounded-md border border-[var(--info)]/20 bg-[var(--info)]/5 p-3 animate-fade-in-up">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Search className="h-3 w-3 text-[var(--info)]" />
                          <span className="text-[11px] font-medium text-[var(--info)]">Research Findings</span>
                        </div>
                        <ul className="space-y-1">
                          {researcherFindings.map((f, i) => (
                            <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5" style={{ animationDelay: `${i * 100}ms` }}>
                              <span className="text-[var(--info)] mt-1">•</span> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Reviewer notes */}
                    {showResults && reviewerNotes && (
                      <div className="rounded-md border border-[var(--success)]/20 bg-[var(--success)]/5 p-3 animate-fade-in-up">
                        <div className="flex items-center gap-1.5 mb-1">
                          <FileCheck className="h-3 w-3 text-[var(--success)]" />
                          <span className="text-[11px] font-medium text-[var(--success)]">Quality Review</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{reviewerNotes}</p>
                      </div>
                    )}

                    {/* Progress bar during loading */}
                    {step === "decomposing" && (
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full w-1/2 rounded-full bg-[var(--info)] animate-progress-indeterminate" />
                      </div>
                    )}

                    {/* View Workflow button */}
                    {showResults && goalId && (
                      <div className="animate-fade-in-up pt-2">
                        <Button
                          onClick={() => router.push(`/objectives/${goalId}`)}
                          className="w-full gap-2 bg-[var(--ring)] text-black hover:bg-[var(--ring)]/90 font-medium"
                        >
                          <GitGraph /> View Workflow Graph <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {/* Answers recap */}
                    {showResults && (
                      <div className="space-y-1.5 pt-1 animate-fade-in-up">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Your Answers</p>
                        {questions.map((q) => (
                          <div key={q.id} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                            <Check className="h-3 w-3 mt-0.5 text-[var(--success)] shrink-0" />
                            <span className="truncate"><span className="text-foreground/60">{q.question}</span>{" → "}{customInputs[q.id]?.trim() || answers[q.id] || q.options[0]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                {error && <p className="text-sm font-medium text-[var(--destructive)]">{error}</p>}
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
