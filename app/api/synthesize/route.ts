import { NextResponse } from "next/server";
import { hasClaude } from "@/lib/ai/client";
import { synthesizeProblems } from "@/lib/ai/synthesize";
import { getDataset, saveProblems } from "@/lib/store";

export const maxDuration = 300;

/** Regenerate problem statements & opportunity areas with Claude. */
export async function POST() {
  if (!hasClaude()) {
    return NextResponse.json(
      { error: "Set ANTHROPIC_API_KEY to regenerate insights with Claude." },
      { status: 400 },
    );
  }
  try {
    const problems = await synthesizeProblems(await getDataset());
    await saveProblems(problems);
    return NextResponse.json({ ok: true, count: problems.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

/** Discard regenerated insights and go back to the starting hypotheses. */
export async function DELETE() {
  await saveProblems(undefined);
  return NextResponse.json({ ok: true });
}
