"use client";

import { useState, useMemo } from "react";
import { useReferrals } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { showSuccess, showError } from "@/lib/toast";
import { apiFetch } from "@/lib/api-client";
import { generateId } from "@/lib/utils";
import type { ReferralRecord } from "@/lib/types";
import { getReferralTier, REFERRAL_TIERS } from "@/lib/types";
import {
  Users,
  Link as LinkIcon,
  CheckCheck,
  Gift,
  Copy,
  TrendingUp,
  UserPlus,
  Trophy,
  Medal,
  RefreshCw,
  Trash2,
  Share2,
} from "lucide-react";

const REFERRER_CODE_KEY = "katalyst_referrer_code";

function getOrCreateReferrerCode(): string {
  if (typeof window === "undefined") return "loading...";
  let code = localStorage.getItem(REFERRER_CODE_KEY);
  if (!code) {
    code = `ref_${generateId("").slice(0, 8)}`;
    localStorage.setItem(REFERRER_CODE_KEY, code);
  }
  return code;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => showSuccess("Copied to clipboard"),
    () => showError("Failed to copy"),
  );
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  signed_up: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  rewarded: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  expired: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
        </div>
      ))}
    </div>
  );
}

function CreateReferralDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    referrerCode: getOrCreateReferrerCode(),
    referrerName: "",
    referredEmail: "",
    source: "direct",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.referrerName || !form.referredEmail) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to create referral");
      showSuccess("Referral created");
      setOpen(false);
      setForm((f) => ({ ...f, referrerName: "", referredEmail: "", source: "direct", notes: "" }));
      onCreated();
    } catch {
      showError("Failed to create referral");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><UserPlus className="h-4 w-4 mr-2" />Add Referral</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Referral</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="referrerName">Your Name</Label>
            <Input id="referrerName" value={form.referrerName} onChange={(e) => setForm({ ...form, referrerName: e.target.value })} placeholder="Jane Smith" required />
          </div>
          <div>
            <Label htmlFor="referredEmail">Referred Email</Label>
            <Input id="referredEmail" type="email" value={form.referredEmail} onChange={(e) => setForm({ ...form, referredEmail: e.target.value })} placeholder="friend@example.com" required />
          </div>
          <div>
            <Label htmlFor="source">Source</Label>
            <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct Link</SelectItem>
                <SelectItem value="social">Social Media</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="How did you meet? Any context?" rows={2} />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">{submitting ? "Creating..." : "Add Referral"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ReferralsPage() {
  const { referrals, loading, error, update, remove, refetch } = useReferrals();
  const [copied, setCopied] = useState(false);
  const referrerCode = getOrCreateReferrerCode();

  const referralLink = typeof window !== "undefined"
    ? `${window.location.origin}?ref=${referrerCode}`
    : "...";

  const stats = useMemo(() => {
    const total = referrals.length;
    const signedUp = referrals.filter((r) => r.status === "signed_up" || r.status === "rewarded").length;
    const rewarded = referrals.filter((r) => r.status === "rewarded").length;
    const pending = referrals.filter((r) => r.status === "pending").length;
    const conversionRate = total > 0 ? Math.round((signedUp / total) * 100) : 0;
    const tier = getReferralTier(rewarded);
    return { total, signedUp, rewarded, pending, conversionRate, tier };
  }, [referrals]);

  const handleCopyLink = () => {
    copyToClipboard(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateStatus = async (id: string, status: ReferralRecord["status"]) => {
    try {
      await update(id, {
        status,
        signedUpAt: status === "signed_up" ? new Date().toISOString() : undefined,
        rewardedAt: status === "rewarded" ? new Date().toISOString() : undefined,
        rewardType: status === "rewarded" ? "standard" : undefined,
      } as Partial<ReferralRecord>);
    } catch { /* toast handled by hook */ }
  };

  const handleDelete = async (id: string) => {
    try { await remove(id); } catch { /* toast handled by hook */ }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-destructive">Failed to load referrals: {error}</p>
        <Button variant="outline" onClick={refetch}><RefreshCw className="h-4 w-4 mr-2" />Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Referral Program</h1>
          <p className="text-muted-foreground mt-1">Track referrals, share your link, and earn rewards</p>
        </div>
        <div className="flex items-center gap-2">
          <CreateReferralDialog onCreated={refetch} />
          <Button variant="outline" size="sm" onClick={refetch}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {loading ? <StatsSkeleton /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Users className="h-4 w-4" />Total Referrals</div>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><CheckCheck className="h-4 w-4" />Signed Up</div>
              <p className="text-3xl font-bold">{stats.signedUp}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><TrendingUp className="h-4 w-4" />Conversion</div>
              <p className="text-3xl font-bold">{stats.conversionRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Gift className="h-4 w-4" />Rewarded</div>
              <p className="text-3xl font-bold">{stats.rewarded}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><LinkIcon className="h-5 w-5" />Your Referral Link</CardTitle>
            <CardDescription>Share this link. When someone signs up, you earn rewards.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={referralLink} readOnly className="font-mono text-sm" />
              <Button onClick={handleCopyLink} variant={copied ? "default" : "outline"} className="shrink-0">
                {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex gap-2 mt-4">
              {["gold", "silver", "bronze", "starter"].map((t) => {
                const tier = REFERRAL_TIERS.find((x) => x.tier === t)!;
                const isCurrent = stats.tier.tier === t;
                return (
                  <Badge key={t} variant="outline" className={isCurrent ? "border-primary text-primary" : undefined}>
                    {isCurrent && <Trophy className="h-3 w-3 mr-1" />}
                    {tier.label} ({tier.minReferrals}+)
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {!loading && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Trophy className="h-5 w-5" />Your Tier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Medal className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xl font-bold">{stats.tier.label}</p>
                  <p className="text-xs text-muted-foreground">{stats.rewarded} rewarded referrals</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Next tier: {REFERRAL_TIERS.find((t) => t.minReferrals > stats.rewarded)?.label ?? "Max tier reached"}
                {(() => {
                  const next = REFERRAL_TIERS.find((t) => t.minReferrals > stats.rewarded);
                  return next ? ` (${next.minReferrals - stats.rewarded} more needed)` : "";
                })()}
              </p>
              <Separator className="my-3" />
              <p className="text-xs font-semibold mb-2">Current Rewards:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {stats.tier.rewards.map((r, i) => <li key={i} className="flex items-center gap-1"><CheckCheck className="h-3 w-3 text-emerald-400" />{r}</li>)}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="all">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
            <TabsTrigger value="signed_up">Signed Up ({stats.signedUp})</TabsTrigger>
            <TabsTrigger value="rewarded">Rewarded ({stats.rewarded})</TabsTrigger>
          </TabsList>
        </div>

        {["all", "pending", "signed_up", "rewarded"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {loading ? <TableSkeleton /> : (
              <Card>
                <ScrollArea className="h-[400px]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="p-3 font-medium">Email</th>
                        <th className="p-3 font-medium hidden sm:table-cell">Referrer</th>
                        <th className="p-3 font-medium hidden md:table-cell">Source</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium hidden lg:table-cell">Date</th>
                        <th className="p-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals
                        .filter((r) => tab === "all" || r.status === tab)
                        .map((r) => (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="p-3 text-sm">{r.referredEmail}</td>
                            <td className="p-3 text-sm hidden sm:table-cell text-muted-foreground">{r.referrerName}</td>
                            <td className="p-3 text-sm hidden md:table-cell">
                              <Badge variant="outline" className="text-xs">{r.source}</Badge>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className={`text-xs ${statusColors[r.status] ?? ""}`}>{r.status.replace("_", " ")}</Badge>
                            </td>
                            <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">
                              {new Date(r.createdAt).toLocaleDateString()}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-end gap-1">
                                {r.status === "pending" && (
                                  <Button variant="ghost" size="sm" onClick={() => handleUpdateStatus(r.id, "signed_up")} title="Mark as signed up">
                                    <CheckCheck className="h-3 w-3" />
                                  </Button>
                                )}
                                {r.status === "signed_up" && (
                                  <Button variant="ghost" size="sm" onClick={() => handleUpdateStatus(r.id, "rewarded")} title="Mark as rewarded">
                                    <Gift className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} title="Delete">
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      {referrals.filter((r) => tab === "all" || r.status === tab).length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">No referrals found</td></tr>
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Share2 className="h-5 w-5" />Growth Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <p className="font-semibold">Share in communities</p>
              <p className="text-muted-foreground">Post your referral link in relevant Slack/Discord communities, Reddit threads, and Twitter discussions about AI tooling.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Create valuable content</p>
              <p className="text-muted-foreground">Write blog posts, tutorials, or videos showing how you use Katalyst. Include your referral link naturally.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Personal outreach works</p>
              <p className="text-muted-foreground">Direct messages to peers with a genuine recommendation convert 3-5x better than broad social posts.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
