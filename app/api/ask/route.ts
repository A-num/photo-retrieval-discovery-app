import { NextResponse } from "next/server";
import { ask } from "@/lib/ai/ask";
import { getDataset } from "@/lib/store";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  if (question.length > 1000) {
    return NextResponse.json({ error: "Question is too long (max 1000 characters)." }, { status: 400 });
  }
  const ds = await getDataset();
  const answer = await ask(question, ds);
  const byId = new Map(ds.conversations.map((c) => [c.id, c]));
  const evidence = answer.evidenceIds.map((id) => byId.get(id)).filter(Boolean);
  return NextResponse.json({ ...answer, evidence });
}
