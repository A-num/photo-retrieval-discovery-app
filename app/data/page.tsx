import { getFullDataset, getImports, isAnalyzed, isReadOnly } from "@/lib/store";
import { EXPECTED_COLUMNS } from "@/lib/csv";
import { CsvUpload, DeleteImportButton } from "@/components/csv-upload";
import { SectionTitle } from "@/components/labels";

export const dynamic = "force-dynamic";

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  "App Store": "Public reviews of the Google Photos iOS app (US, UK, Canada, Australia, India, Ireland, New Zealand)",
  "Google Photos Community": "Help threads from the official Google Photos Community forum",
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}

export default async function DataPage() {
  const [ds, imports] = await Promise.all([getFullDataset(), getImports()]);
  const readOnly = isReadOnly();
  const analyzed = ds.conversations.filter((c) => isAnalyzed(ds.analyses[c.id]));
  const retrieval = analyzed.filter((c) => ds.analyses[c.id].retrievalRelevant);

  const sources = [...new Set(ds.conversations.map((c) => c.source))].map((source) => {
    const all = ds.conversations.filter((c) => c.source === source);
    const years = all.map((c) => c.date?.slice(0, 4)).filter((y): y is string => !!y).sort();
    return {
      source,
      description: SOURCE_DESCRIPTIONS[source] ?? "Imported conversations",
      collected: all.length,
      analyzed: all.filter((c) => isAnalyzed(ds.analyses[c.id])).length,
      period: years.length ? `${years[0]}–${years[years.length - 1]}` : "—",
    };
  });

  // Large files are stored in several batches; show one row per imported file.
  const fileOf = new Map(imports.map((b) => [b.id, b.filename.replace(/ \(rows [^)]*\)$/, "")]));
  const files = [...new Set(fileOf.values())].map((name) => {
    const ids = imports.filter((b) => fileOf.get(b.id) === name).map((b) => b.id);
    const convs = ds.conversations.filter((c) => ids.includes(c.dataset));
    return {
      name,
      ids,
      createdAt: imports.find((b) => b.id === ids[0])!.createdAt,
      count: convs.length,
      analyzed: convs.filter((c) => isAnalyzed(ds.analyses[c.id])).length,
    };
  });

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">Where the research conversations come from, and how much of the dataset has been analyzed.</p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Conversations collected" value={ds.conversations.length} />
        <Stat label="Analyzed" value={analyzed.length} />
        <Stat label="About photo retrieval" value={retrieval.length} />
        <Stat label="Awaiting analysis" value={ds.conversations.length - analyzed.length} />
      </section>

      <section className="mb-6 rounded-xl border bg-background p-5">
        <SectionTitle>Sources</SectionTitle>
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No conversations yet. Import a file below to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 text-right font-medium">Collected</th>
                  <th className="py-2 pr-4 text-right font-medium">Analyzed</th>
                  <th className="py-2 font-medium">Period</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source} className="border-b last:border-b-0">
                    <td className="py-3 pr-4">
                      <div className="font-medium">{s.source}</div>
                      <div className="text-xs text-muted-foreground">{s.description}</div>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">{s.collected.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{s.analyzed.toLocaleString()}</td>
                    <td className="py-3 whitespace-nowrap tabular-nums">{s.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Each conversation is screened for whether it&apos;s about finding a photo, then analyzed for what the user remembered and forgot, how they searched, why it failed,
          and what they did instead. Only analyzed conversations appear in insights.
        </p>
      </section>

      {!readOnly && (
      <section className="mb-6 rounded-xl border bg-background p-5">
        <SectionTitle>Import conversations</SectionTitle>
        <p className="mb-3 text-sm text-muted-foreground">
          Upload a CSV with the columns <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{EXPECTED_COLUMNS.join(", ")}</code>. Only{" "}
          <code className="rounded bg-muted px-1 text-xs">text</code> is required.
        </p>
        <CsvUpload />
      </section>
      )}

      <section className="rounded-xl border bg-background p-5">
        <SectionTitle>Imports</SectionTitle>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No imports yet.</p>
        ) : (
          <ul className="divide-y">
            {files.map((f) => (
              <li key={f.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Imported {new Date(f.createdAt).toLocaleDateString()} · {f.count.toLocaleString()} conversations · {f.analyzed.toLocaleString()} analyzed
                  </div>
                </div>
                {!readOnly && <DeleteImportButton ids={f.ids} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
