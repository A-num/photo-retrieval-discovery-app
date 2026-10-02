import { describe, expect, it, beforeAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { addImport, deleteImport, getDataset, getImports } from "@/lib/store";
import { heuristicAnalyze } from "@/lib/ai/heuristic";
import { dashboardStats } from "@/lib/insights";

beforeAll(() => {
  process.env.DISCOVERY_STORE_PATH = path.join(mkdtempSync(path.join(tmpdir(), "discovery-")), "store.json");
});

describe("store", () => {
  it("merges uploads into the dataset and removes them again", async () => {
    const base = await getDataset();
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

    const ds = await getDataset();
    expect(ds.conversations).toHaveLength(base.conversations.length + 1);
    expect(ds.analyses["up-1"].problemId).toBe("screenshot-buried");
    expect(ds.analyses["up-1"].opportunityArea).toBe("Screenshots as searchable knowledge");
    expect(dashboardStats(ds).uploadedCount).toBe(1);
    expect(await getImports()).toHaveLength(1);

    await deleteImport("batch-1");
    const after = await getDataset();
    expect(after.conversations).toHaveLength(base.conversations.length);
    expect(after.analyses["up-1"]).toBeUndefined();
  });
});
