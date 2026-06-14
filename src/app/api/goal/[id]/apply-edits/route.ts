import { NextResponse } from "next/server";
import { mutateGoalTrees } from "@/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { tree?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.tree) {
    return NextResponse.json({ error: "tree required" }, { status: 400 });
  }

  let saved = false;
  await mutateGoalTrees(async (trees) => {
    const idx = trees.trees.findIndex((t) => t.goalId === id);
    if (idx >= 0) {
      trees.trees[idx].rootNode = body.tree as never;
      trees.trees[idx].updatedAt = new Date().toISOString();
      saved = true;
    }
  });

  if (!saved) {
    return NextResponse.json({ error: "Goal tree not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
