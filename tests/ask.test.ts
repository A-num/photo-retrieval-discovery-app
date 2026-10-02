import { describe, expect, it, vi, beforeEach } from "vitest";
import { fixture as ds } from "./fixtures";

// A stand-in for the SDK's tool runner: it plays back scripted assistant turns and,
// like the real runner, executes the requested tools so their side effects (trace) happen.
const script: { name: string; input: unknown }[][] = [];
vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    beta = {
      messages: {
        toolRunner: (params: { tools: { name: string; run: (i: unknown) => Promise<string> }[] }) =>
          (async function* () {
            for (const turn of script) {
              const content = turn.map((t, i) => ({ type: "tool_use", id: `tu_${i}`, name: t.name, input: t.input }));
              yield { stop_reason: "tool_use", content };
              for (const t of turn) await params.tools.find((tool) => tool.name === t.name)?.run(t.input);
            }
          })(),
      },
    };
  }
  return { default: FakeAnthropic };
});

import { askLocal } from "@/lib/ai/ask";
import { askAgent, groundAnswer, type SubmittedAnswer } from "@/lib/ai/research-agent";

const A = ds.analyses;
const submit = (over: Partial<SubmittedAnswer> = {}): SubmittedAnswer => ({
  answer: "Screenshots fail because search can't read their text.",
  keyNumbers: [{ label: "Screenshot conversations", value: "2" }],
  basedOnConversations: 3,
  citedConversationIds: ["t-04"],
  confidence: "medium",
  insufficientEvidence: false,
  ...over,
});

describe("askLocal (no API key)", () => {
  it("answers briefly with key numbers instead of a quote dump", () => {
    const r = askLocal("What do users remember most often when they can't find a photo?", ds);
    expect(r.sufficientEvidence).toBe(true);
    expect(r.answer).toMatch(/context \/ event/i);
    expect(r.answer.split(/(?<=\.)\s/).length).toBeLessThanOrEqual(3);
    expect(r.keyNumbers[0]).toEqual({ label: "Context / Event", value: "4 (57%)" });
    expect(r.basedOn).toBe(7);
    r.evidenceIds.forEach((id) => expect(A[id].rememberedCategories).toContain("Context / Event"));
    expect(r.steps.length).toBeGreaterThan(0);
  });

  it("filters to trips where the date was forgotten", () => {
    const r = askLocal("Show me examples where users remember a trip but not the date.", ds);
    expect(r.evidenceIds.sort()).toEqual(["t-01", "t-02"]);
    expect(r.answer).toMatch(/^Found 2 conversations/);
  });

  it("answers screenshot questions from screenshot conversations only", () => {
    const r = askLocal("What are the biggest retrieval problems involving screenshots?", ds);
    expect(r.answer).toMatch(/screenshot\/document retrieval/i);
    r.evidenceIds.forEach((id) => expect(["Screenshot", "Photo containing text"]).toContain(A[id].assetType));
  });

  it("treats 'X and Y' topics as both groups, not their intersection", () => {
    const r = askLocal("Why does search fail for screenshots and receipts?", ds);
    expect(r.sufficientEvidence).toBe(true);
    expect(r.basedOn).toBe(3); // 2 screenshots + 1 receipt
    expect(r.answer).toMatch(/about screenshots or receipts/);
  });

  it("doesn't read everyday words as topics", () => {
    const r = askLocal("What do people do when search doesn't work?", ds);
    expect(r.answer).not.toMatch(/about (work|people)/);
    expect(r.basedOn).toBe(7);
  });

  it("summarizes workarounds", () => {
    expect(askLocal("What workarounds do users use?", ds).answer).toMatch(/Scrolled timeline/);
  });

  it("does not treat an incidental word match as evidence", () => {
    // "think" appears in conversations ("I think it was 2019") but isn't the topic
    expect(askLocal("What do users think about the pricing of quantum widgets?", ds).sufficientEvidence).toBe(false);
  });

  it("says so when the dataset has no evidence", () => {
    const r = askLocal("What do users say about quantum blockchain?", ds);
    expect(r.sufficientEvidence).toBe(false);
    expect(r.answer).toMatch(/doesn't contain enough evidence/);
  });
});

describe("groundAnswer", () => {
  it("keeps only citations the agent actually retrieved", () => {
    const r = groundAnswer(submit({ citedConversationIds: ["t-04", "t-05", "made-up-1"] }), { steps: [], seenIds: new Set(["t-04"]) }, ds);
    expect(r.evidenceIds).toEqual(["t-04"]);
    expect(r.caveats).toMatch(/2 cited conversation\(s\) couldn't be verified/);
    expect(r.sources).toEqual([{ label: "Reddit", count: 1 }]);
  });

  it("marks thin evidence as insufficient and low confidence", () => {
    const r = groundAnswer(submit({ basedOnConversations: 2, confidence: "high" }), { steps: [], seenIds: new Set() }, ds);
    expect(r.sufficientEvidence).toBe(false);
    expect(r.confidence).toBe("low");
  });
});

describe("askAgent", () => {
  beforeEach(() => {
    script.length = 0;
  });

  it("runs tools, records the steps, and returns the grounded submitted answer", async () => {
    script.push(
      [{ name: "count_conversations", input: { groupBy: "failure", filters: { assetType: "Screenshot" } } }],
      [{ name: "search_conversations", input: { query: "screenshot", filters: { assetType: "Screenshot" } } }],
      [{ name: "submit_answer", input: submit({ citedConversationIds: ["t-04", "t-01"] }) }],
    );
    const r = await askAgent("Why does search fail for screenshots?", ds);
    expect(r.mode).toBe("claude");
    expect(r.answer).toMatch(/can't read their text/);
    expect(r.evidenceIds).toEqual(["t-04"]); // t-01 was never retrieved by a tool
    expect(r.steps).toEqual([
      "Counted failure across 2 conversations (assetType=Screenshot)",
      'Read 2 of 2 matching conversations for "screenshot" (assetType=Screenshot)',
    ]);
  });

  it("rejects a malformed submission", async () => {
    script.push([{ name: "submit_answer", input: { answer: 42 } }]);
    await expect(askAgent("q", ds)).rejects.toThrow(/malformed/);
  });
});
