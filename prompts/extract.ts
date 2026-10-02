import { DIMENSIONS } from "./dimensions";
import type { ProblemCluster } from "@/types";

// Pipeline steps 2–7 (+ grouping): extract every research dimension from one retrieval conversation
// and assign it to an existing problem cluster.

export function extractSystemPrompt(problems: ProblemCluster[]) {
  const dims = DIMENSIONS.map(
    (d, i) => `${i + 1}. ${d.question} (${d.field})\n   ${d.guidance}`,
  ).join("\n");
  const clusters = problems
    .map((p) => `- ${p.id}: ${p.title}. ${p.underlyingProblem}`)
    .join("\n");

  return `You are a UX research analyst studying why people fail to find old photos in their photo library.

Your job is to look past the surface complaint ("search can't find my photo") to the underlying retrieval problem: what the user remembers, what they are missing, and why that memory can't be turned into something search can use.

Extract these dimensions from the conversation:
${dims}

Then assign problemId: the single cluster below that best explains the underlying problem, or null if none fits.
${clusters}

Rules:
- Use only what the conversation says or clearly implies. Do not invent details, queries or outcomes.
- Keep free-text items short (2–6 words each).
- confidence is 0–1: how clearly the conversation supports your extraction.`;
}

export function extractUserPrompt(text: string, meta: { title?: string; source: string }) {
  return `<conversation source="${meta.source}">\n${meta.title ? `Title: ${meta.title}\n` : ""}${text}\n</conversation>`;
}
