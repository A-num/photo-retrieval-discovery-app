// Copies the local dataset (.data/store.json) into data/snapshot.json, which is committed and
// served read-only by deployed copies of the app. Re-run after analyzing new data, then commit.
//
//   npm run snapshot
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const src = path.join(process.cwd(), ".data", "store.json");
const dest = path.join(process.cwd(), "data", "snapshot.json");

const store = JSON.parse(readFileSync(src, "utf8"));
const analyzed = Object.values(store.analyses ?? {}).filter((a) => a.analyzedBy !== "heuristic").length;
writeFileSync(dest, JSON.stringify(store));
console.log(
  `Snapshot written to data/snapshot.json: ${store.conversations.length} conversations (${analyzed} analyzed), ${(JSON.stringify(store).length / 1e6).toFixed(1)} MB`,
);
