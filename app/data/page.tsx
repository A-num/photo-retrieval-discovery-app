import { getImports, getSettings } from "@/lib/store";
import { DEMO_ANALYSES, DEMO_CONVERSATIONS } from "@/data/demo-conversations";
import { DemoToggle } from "@/components/demo-toggle";
import { countBy } from "@/lib/insights";
import { hasClaude, MODEL } from "@/lib/ai/client";
import { EXPECTED_COLUMNS } from "@/lib/csv";
import { CsvUpload, DeleteImportButton } from "@/components/csv-upload";
import { SectionTitle, SyntheticBadge } from "@/components/labels";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const imports = await getImports();
  const { includeDemo } = await getSettings();
  const demo = DEMO_CONVERSATIONS;
  const demoSources = countBy(demo.map((c) => c.source));
  const demoRelevant = demo.filter((c) => DEMO_ANALYSES[c.id]?.retrievalRelevant).length;
  const realCount = imports.reduce((n, b) => n + b.count, 0);
  // The analyze script saves large files in batches; show one row per file.
  const groups = Object.values(
    imports.reduce<Record<string, { name: string; ids: string[]; count: number; relevant: number; createdAt: string; modes: string[] }>>((acc, b) => {
      const name = b.filename.replace(/ \(rows [^)]*\)$/, "");
      const g = (acc[name] ??= { name, ids: [], count: 0, relevant: 0, createdAt: b.createdAt, modes: [] });
      g.ids.push(b.id);
      g.count += b.count;
      g.relevant += b.relevant;
      if (!g.modes.includes(b.analyzedBy)) g.modes.push(b.analyzedBy);
      return acc;
    }, {}),
  );
  const claude = hasClaude();

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Analysis mode:{" "}
          {claude ? (
            <span className="font-medium text-foreground">Claude ({MODEL})</span>
          ) : (
            <span className="font-medium text-foreground">Local keyword analysis (no ANTHROPIC_API_KEY set)</span>
          )}
        </p>
      </header>

      <section className="mb-6 rounded-xl border bg-background p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Demo dataset</h2>
          <SyntheticBadge />
        </div>
        <p className="mt-1 text-sm font-medium">DEMO DATA: synthetic research conversations</p>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Written for this prototype to cover travel, restaurants, family, medical, screenshots, documents, receipts, events, school, work, people and places.
          They are not real users and have no source links. Analyses are pre-computed so the app works without an API key.
        </p>
        <div className="mt-4 rounded-lg border bg-muted/40 p-3">
          <DemoToggle includeDemo={includeDemo} realCount={realCount} />
        </div>
        <div className="mt-4 flex flex-wrap gap-8">
          <div>
            <div className="text-3xl font-semibold tabular-nums">{demo.length}</div>
            <div className="text-xs text-muted-foreground">conversations ({demoRelevant} retrieval-related)</div>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Sources</div>
            <ul className="text-sm">
              {demoSources.map((s) => (
                <li key={s.label} className="flex justify-between gap-6">
                  <span>{s.label}</span>
                  <span className="text-muted-foreground tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-xl border bg-background p-5">
        <SectionTitle>Collect real data</SectionTitle>
        <p className="mb-3 text-sm text-muted-foreground">
          Run these in a terminal from the project folder. Each writes a CSV to <code className="rounded bg-muted px-1 text-xs">data/real/</code> that you upload below. Setup
          steps for each source are in <code className="rounded bg-muted px-1 text-xs">data/sources/README.md</code>.
        </p>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["App Store", "npm run collect:appstore", "Apple's public reviews feed. No setup."],
            ["Google Photos Community", "npm run collect:community", "Fetches the threads listed in data/sources/community-urls.txt."],
            ["Reddit", "npm run collect:reddit", "Official API. Needs a free Reddit app ID and secret in .env.local."],
            ["Play Store", "manual", "No public API. Copy reviews into data/sources/play-store-template.csv."],
          ].map(([name, cmd, note]) => (
            <li key={name} className="rounded-lg border p-3">
              <div className="font-medium">{name}</div>
              <code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs">{cmd}</code>
              <div className="mt-1 text-xs text-muted-foreground">{note}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6 rounded-xl border bg-background p-5">
        <SectionTitle>Upload CSV</SectionTitle>
        <p className="mb-3 text-sm text-muted-foreground">
          Expected columns: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{EXPECTED_COLUMNS.join(", ")}</code>. Only{" "}
          <code className="rounded bg-muted px-1 text-xs">text</code> is required. Uploaded rows go through the same pipeline: screening, extraction, then
          grouping into problems. {claude ? "Up to 200 rows per upload with Claude." : "Without an API key, rows are analyzed with keyword rules (lower confidence)."}{" "}
          <a href="/sample-conversations.csv" download className="underline underline-offset-2">
            Download a sample CSV
          </a>
          .
        </p>
        <CsvUpload />
      </section>

      <section className="rounded-xl border bg-background p-5">
        <SectionTitle>Uploaded datasets</SectionTitle>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No uploads yet.</p>
        ) : (
          <ul className="divide-y">
            {groups.map((g) => (
              <li key={g.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <div className="font-medium">{g.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(g.createdAt).toLocaleString()} · {g.count} conversations · {g.relevant} retrieval-related · analyzed by{" "}
                    {g.modes.map((m) => (m === "claude" ? "Claude" : "keyword rules")).join(" + ")}
                  </div>
                </div>
                <DeleteImportButton ids={g.ids} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
