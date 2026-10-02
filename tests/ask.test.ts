import { describe, expect, it, vi, afterEach } from "vitest";
import { DEMO_ANALYSES, DEMO_CONVERSATIONS } from "@/data/demo-conversations";
import { DEMO_PROBLEMS } from "@/data/problem-clusters";
import type { Dataset } from "@/types";

vi.mock("@/lib/ai/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/client")>()),
  callStructured: vi.fn(),
}));

import { askLocal, askClaude } from "@/lib/ai/ask";
import { callStructured } from "@/lib/ai/client";

const ds: Dataset = { conversations: DEMO_CONVERSATIONS, analyses: DEMO_ANALYSES, problems: DEMO_PROBLEMS };
const known = new Set(DEMO_CONVERSATIONS.map((c) => c.id));

afterEach(() => vi.mocked(callStructured).mockReset());

describe("askLocal (no API key)", () => {
  it("answers what users remember with the dominant cue and real evidence", () => {
    const r = askLocal("What do users remember most often when they can't find a photo?", ds);
    expect(r.sufficientEvidence).toBe(true);
    expect(r.finding).toMatch(/context \/ event/i);
    expect(r.evidenceIds.length).toBeGreaterThan(0);
    r.evidenceIds.forEach((id) => {
      expect(known.has(id)).toBe(true);
      expect(DEMO_ANALYSES[id].rememberedCategories).toContain("Context / Event");
    });
    expect(r.sources.reduce((s, x) => s + x.count, 0)).toBe(r.evidenceCount);
  });

  it("filters to trips where the date was forgotten", () => {
    const r = askLocal("Show me examples where users remember a trip but not the date.", ds);
    expect(r.sufficientEvidence).toBe(true);
    for (const id of r.evidenceIds) {
      const c = DEMO_CONVERSATIONS.find((x) => x.id === id)!;
      expect(DEMO_ANALYSES[id].forgottenCategories).toContain("Exact date");
      expect(DEMO_ANALYSES[id].assetType === "Travel photo" || /trip|vacation|honeymoon|holiday|travel/i.test(c.text + c.title)).toBe(true);
    }
  });

  it("answers screenshot failure questions from screenshot conversations only", () => {
    const r = askLocal("What are the biggest retrieval problems involving screenshots?", ds);
    expect(r.sufficientEvidence).toBe(true);
    expect(r.finding).toMatch(/screenshot\/document retrieval/i);
    r.evidenceIds.forEach((id) => expect(["Screenshot", "Photo containing text"]).toContain(DEMO_ANALYSES[id].assetType));
  });

  it("summarizes workarounds", () => {
    const r = askLocal("What workarounds do users use?", ds);
    expect(r.finding).toMatch(/Scrolled timeline/);
  });

  it("returns every match for 'show me examples' questions", () => {
    const r = askLocal("Show me examples where users remember a trip but not the date.", ds);
    expect(r.finding).toMatch(new RegExp(`^Found ${r.evidenceCount} conversations`));
  });

  it("does not treat an incidental word match as evidence", () => {
    // "think" appears in many conversations ("I think it was 2019") but isn't the topic
    const r = askLocal("What do users think about the pricing of quantum widgets?", ds);
    expect(r.sufficientEvidence).toBe(false);
  });

  it("says so when the dataset has no evidence", () => {
    const r = askLocal("What do users say about quantum blockchain?", ds);
    expect(r.sufficientEvidence).toBe(false);
    expect(r.finding).toMatch(/doesn't contain enough evidence/);
  });
});

describe("askClaude grounding", () => {
  it("drops cited ids that are not in the dataset and flags thin evidence", async () => {
    vi.mocked(callStructured).mockResolvedValue({
      sufficientEvidence: true,
      finding: "x",
      keyPoints: [],
      supportingConversationIds: ["demo-001", "made-up-999"],
      caveats: null,
    });
    const r = await askClaude("q", ds);
    expect(r.evidenceIds).toEqual(["demo-001"]);
    expect(r.evidenceCount).toBe(1);
    expect(r.sufficientEvidence).toBe(false);
    expect(r.caveats).toMatch(/not in the dataset/);
  });
});
