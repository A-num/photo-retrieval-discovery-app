import { describe, expect, it } from "vitest";
import { FAILURE_TYPES, MEMORY_CUES } from "@/types";
import { dashboardStats, summarizeProblem, conversationRows } from "@/lib/insights";
import { fixture as ds } from "./fixtures";

describe("insights", () => {
  it("computes dashboard metrics", () => {
    const s = dashboardStats(ds);
    expect(s.totalConversations).toBe(8);
    expect(s.relevantConversations).toBe(7);
    expect(s.problemClusters).toBe(4); // clusters with at least one conversation
    expect(s.opportunityAreas).toBe(1); // only event-not-metadata has ≥ 3
    expect(s.remembered[0]).toEqual({ label: "Context / Event", count: 4 });
    // every memory cue and failure type appears in the chart data, even at zero
    expect(s.remembered.map((r) => r.label).sort()).toEqual([...MEMORY_CUES].sort());
    expect(s.failures.map((r) => r.label).sort()).toEqual([...FAILURE_TYPES].sort());
  });

  it("summarizes a problem with evidence drawn only from its members", () => {
    const p = summarizeProblem(ds, "event-not-metadata")!;
    expect(p.evidenceCount).toBe(3);
    expect(p.evidenceIds.sort()).toEqual(["t-01", "t-02", "t-03"]);
    expect(p.topRemembered[0]).toEqual({ label: "Context / Event", count: 3 });
    expect(p.exampleSearches).toEqual(["rome", "vacation sister", "wedding"]);
    expect(p.sources.map((s) => s.label).sort()).toEqual(["App Store", "Google Photos Community", "Reddit"]);
  });

  it("returns null for unknown problems", () => {
    expect(summarizeProblem(ds, "nope")).toBeNull();
  });

  it("handles an empty dataset", () => {
    const empty = { ...ds, conversations: [], analyses: {} };
    const s = dashboardStats(empty);
    expect(s.totalConversations).toBe(0);
    expect(s.problemClusters).toBe(0);
    expect(conversationRows(empty)).toEqual([]);
  });
});
