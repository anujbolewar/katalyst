import { NextResponse } from "next/server";
import { getReferrals, mutateReferrals, mutateActivityLog } from "@/lib/data";
import type { ReferralRecord, ActivityEvent } from "@/lib/types";
import { referralCreateSchema, referralUpdateSchema, validateBody, DEFAULT_LIMIT } from "@/lib/validations";
import { generateId } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const referrerCode = searchParams.get("referrerCode");
  const data = await getReferrals();

  const total = data.referrals.length;
  let referrals = data.referrals;

  if (status) {
    referrals = referrals.filter((r) => r.status === status);
  }
  if (referrerCode) {
    referrals = referrals.filter((r) => r.referrerCode === referrerCode);
  }

  referrals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const totalFiltered = referrals.length;
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10) || 50) : DEFAULT_LIMIT;
  const offset = Math.max(0, parseInt(offsetParam ?? "0", 10));
  referrals = referrals.slice(offset, offset + limit);

  const rewarded = data.referrals.filter((r) => r.status === "rewarded").length;
  const signedUp = data.referrals.filter((r) => r.status === "signed_up" || r.status === "rewarded").length;

  return NextResponse.json(
    {
      data: referrals, referrals,
      meta: { total, filtered: totalFiltered, returned: referrals.length, limit, offset },
      stats: { total, signedUp, rewarded, pending: total - signedUp },
    },
    { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=5" } },
  );
}

export async function POST(request: Request) {
  const validation = await validateBody(request, referralCreateSchema);
  if (!validation.success) return validation.error;
  const body = validation.data;

  const newReferral = await mutateReferrals(async (data) => {
    const referral: ReferralRecord = {
      id: generateId("ref"),
      referrerCode: body.referrerCode,
      referrerName: body.referrerName,
      referredEmail: body.referredEmail,
      status: "pending",
      signedUpAt: null,
      rewardedAt: null,
      rewardType: null,
      source: body.source,
      notes: body.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.referrals.push(referral);
    return referral;
  });

  await mutateActivityLog(async (logData) => {
    const event: ActivityEvent = {
      id: generateId("evt"),
      type: "task_created",
      actor: "marketer",
      taskId: null,
      summary: `New referral from ${body.referrerName}: ${body.referredEmail}`,
      details: `Source: ${body.source}. Code: ${body.referrerCode}`,
      timestamp: new Date().toISOString(),
    };
    logData.events.push(event);
  });

  return NextResponse.json(newReferral, { status: 201 });
}

export async function PUT(request: Request) {
  const validation = await validateBody(request, referralUpdateSchema);
  if (!validation.success) return validation.error;
  const body = validation.data;

  const result = await mutateReferrals(async (data) => {
    const idx = data.referrals.findIndex((r) => r.id === body.id);
    if (idx === -1) return null;

    const oldReferral = data.referrals[idx];
    const wasSigningUp = oldReferral.status === "pending" && body.status === "signed_up";
    const wasRewarded = body.status === "rewarded" && oldReferral.status !== "rewarded";

    data.referrals[idx] = {
      ...oldReferral,
      ...body,
      signedUpAt: body.signedUpAt ?? (wasSigningUp ? new Date().toISOString() : oldReferral.signedUpAt),
      rewardedAt: body.rewardedAt ?? (wasRewarded ? new Date().toISOString() : oldReferral.rewardedAt),
      updatedAt: new Date().toISOString(),
    };

    return { referral: data.referrals[idx], wasSigningUp, wasRewarded, oldReferral };
  });

  if (!result) {
    return NextResponse.json({ error: "Referral not found" }, { status: 404 });
  }

  if (result.wasSigningUp || result.wasRewarded) {
    await mutateActivityLog(async (logData) => {
      const summary = result.wasRewarded
        ? `Referral rewarded: ${result.referral.referredEmail} (${result.referral.rewardType ?? "credit"})`
        : `Referral signed up: ${result.referral.referredEmail} via ${result.referral.referrerName}`;
      const event: ActivityEvent = {
        id: generateId("evt"),
        type: "task_completed",
        actor: "system",
        taskId: null,
        summary,
        details: `Referrer: ${result.referral.referrerName}, Code: ${result.referral.referrerCode}`,
        timestamp: new Date().toISOString(),
      };
      logData.events.push(event);
    });
  }

  return NextResponse.json(result.referral);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const removed = await mutateReferrals(async (data) => {
    const idx = data.referrals.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const item = data.referrals[idx];
    data.referrals.splice(idx, 1);
    return item;
  });

  if (!removed) {
    return NextResponse.json({ error: "Referral not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
