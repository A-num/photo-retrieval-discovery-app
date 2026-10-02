import { describe, expect, it } from "vitest";
import {
  applyFilters,
  countConversations,
  datasetOverview,
  describeFilters,
  getConversations,
  searchConversations,
} from "@/lib/ai/research-tools";
import { fixture as ds } from "./fixtures";

describe("research tools", () => {
  it("overview reports size, sources and cluster sizes", () => {
    const o = datasetOverview(ds);
    expect(o.totalConversations).toBe(8);
    expect(o.retrievalRelated).toBe(7);
    expect(o.problemClusters[0]).toMatchObject({ id: "event-not-metadata", conversations: 3 });
    expect(o.note).toMatch(/analyzed by an LLM/);
  });

  it("filters combine with AND and skip non-retrieval by default", () => {
    expect(applyFilters(ds).length).toBe(7);
    expect(applyFilters(ds, { includeNonRetrieval: true }).length).toBe(8);
    expect(applyFilters(ds, { assetType: "Screenshot" }).map((r) => r.c.id)).toEqual(["t-04", "t-05"]);
    expect(applyFilters(ds, { assetType: "Screenshot", workaround: "Gave up" }).map((r) => r.c.id)).toEqual(["t-04"]);
    expect(applyFilters(ds, { keyword: "BOARDING" }).map((r) => r.c.id)).toEqual(["t-05"]);
    expect(applyFilters(ds, { source: "app store" }).length).toBe(3);
  });

  it("counts by a field with percentages of the matching set", () => {
    const r = countConversations(ds, "failure", { failure: "Screenshot/document retrieval" });
    expect(r.matchingConversations).toBe(3);
    expect(r.counts[0]).toEqual({ label: "Screenshot/document retrieval", count: 3, percentOfMatching: 100 });
    expect(countConversations(ds, "problem").counts[0].label).toBe("Users remember the event, but not the metadata");
  });

  it("search ranks by query hits and returns excerpts with analysis", () => {
    const r = searchConversations(ds, "screenshot recipe", {}, 5);
    expect(r.results[0].id).toBe("t-04"); // matches both words
    expect(r.results.map((x) => x.id)).toContain("t-05");
    expect(r.results[0]).toMatchObject({ failures: ["Screenshot/document retrieval", "Query mismatch"] });
    expect(searchConversations(ds, "zzzz").matchingConversations).toBe(0);
  });

  it("gets full conversations and flags unknown ids", () => {
    const [a, b] = getConversations(ds, ["t-01", "nope"]);
    expect(a).toMatchObject({ id: "t-01", text: expect.stringContaining("Rome") });
    expect(b).toEqual({ id: "nope", error: "not found" });
  });

  it("describes filters in plain language", () => {
    expect(describeFilters()).toBe("all retrieval conversations");
    expect(describeFilters({ assetType: "Screenshot", maxRating: 2 })).toBe("assetType=Screenshot, maxRating=2");
  });
});
