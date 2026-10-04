import { describe, expect, it, beforeAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { addImport, deleteImport, getDataset, getFullDataset, getImports, saveProblems, updateAnalyses, ReadOnlyError } from "@/lib/store";
import { heuristicAnalyze } from "@/lib/ai/heuristic";
import { dashboardStats } from "@/lib/insights";

beforeAll(() => {
  process.env.DISCOVERY_STORE_PATH = path.join(mkdtempSync(path.join(tmpdir(), "discovery-")), "store.json");
});

describe("store", () => {
  it("starts empty: no bundled or demo conversations", async () => {
    const ds = await getDataset();
    expect(ds.conversations).toEqual([]);
    expect(ds.problems.length).toBeGreaterThan(0); // problem hypotheses are still available to sort into
  });

  it("keeps keyword-only analyses out of insights until properly analyzed, and removes imports", async () => {
    const conv = {
      id: "up-1",
      source: "Uploaded",
      text: "Can't find the screenshot of my ticket, searched 'ticket' and nothing.",
      dataset: "batch-1",
    };
    await addImport(
      { id: "batch-1", filename: "x.csv", createdAt: new Date().toISOString(), count: 1, relevant: 1, analyzedBy: "heuristic" },
      [conv],
      [heuristicAnalyze(conv)],
    );

    // Collected, but awaiting a full analysis: not part of insights yet.
    expect((await getFullDataset()).conversations.map((c) => c.id)).toEqual(["up-1"]);
    expect((await getDataset()).conversations).toEqual([]);

    // Once analyzed, it shows up everywhere.
    await updateAnalyses([{ ...heuristicAnalyze(conv), analyzedBy: "claude" }]);
    const ds = await getDataset();
    expect(ds.conversations.map((c) => c.id)).toEqual(["up-1"]);
    expect(ds.analyses["up-1"].problemId).toBe("screenshot-buried");
    expect(ds.analyses["up-1"].opportunityArea).toBe("Screenshots as searchable knowledge");
    expect(dashboardStats(ds).totalConversations).toBe(1);
    expect((await getImports())[0].analyzedBy).toBe("claude");

    await deleteImport("batch-1");
    expect((await getFullDataset()).conversations).toEqual([]);
    expect(await getImports()).toEqual([]);
  });

  it("rejects analyses for unknown conversations", async () => {
    await expect(updateAnalyses([{ ...heuristicAnalyze({ id: "nope", source: "x", text: "", dataset: "b" }) }])).rejects.toThrow(/Unknown conversation/);
  });

  it("serves the committed snapshot read-only and refuses every write", async () => {
    process.env.DISCOVERY_READ_ONLY = "true";
    try {
      const ds = await getDataset();
      expect(ds.conversations.length).toBeGreaterThan(0);
      const conv = { id: "ro-1", source: "x", text: "can't find my photo", dataset: "b" };
      await expect(
        addImport({ id: "b", filename: "x.csv", createdAt: "", count: 1, relevant: 0, analyzedBy: "heuristic" }, [conv], [heuristicAnalyze(conv)]),
      ).rejects.toBeInstanceOf(ReadOnlyError);
      await expect(deleteImport("anything")).rejects.toBeInstanceOf(ReadOnlyError);
      await expect(saveProblems(undefined)).rejects.toBeInstanceOf(ReadOnlyError);
    } finally {
      delete process.env.DISCOVERY_READ_ONLY;
    }
  });
});
