import { NextResponse } from "next/server";
import { ask } from "@/lib/ai/ask";
import { getDataset } from "@/lib/store";
import type { AskTurn, EvidenceSnippet } from "@/types";

export const maxDuration = 300;

const MAX_HISTORY = 6;

function parseHistory(raw: unknown): AskTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (t): t is AskTurn =>
        !!t && typeof t === "object" && typeof (t as AskTurn).question === "string" && typeof (t as AskTurn).answer === "string",
    )
    .slice(-MAX_HISTORY)
    .map((t) => ({ question: t.question.slice(0, 1000), answer: t.answer.slice(0, 2000) }));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { question?: unknown; history?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  if (question.length > 1000) {
    return NextResponse.json({ error: "Question is too long (max 1000 characters)." }, { status: 400 });
  }

  const ds = await getDataset();
  const answer = await ask(question, ds, parseHistory(body?.history));
  const byId = new Map(ds.conversations.map((c) => [c.id, c]));
  const evidence: EvidenceSnippet[] = answer.evidenceIds.flatMap((id) => {
    const c = byId.get(id);
    if (!c) return [];
    const excerpt = c.text.length > 220 ? `${c.text.slice(0, 220).trimEnd()}…` : c.text;
    return [{ id, source: c.source, date: c.date, rating: c.rating, title: c.title, excerpt, sourceUrl: c.sourceUrl }];
  });
  return NextResponse.json({ ...answer, evidence });
}
