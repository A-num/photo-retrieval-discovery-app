import { getDataset } from "@/lib/store";
import { conversationRows } from "@/lib/insights";
import { ConversationsTable } from "@/components/conversations-table";
import { DatasetBanner } from "@/components/labels";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({ searchParams }: PageProps<"/conversations">) {
  const sp = await searchParams;
  const ds = await getDataset();
  const rows = conversationRows(ds);
  const initialProblem = typeof sp.problem === "string" ? sp.problem : "";

  return (
    <>
      <DatasetBanner ds={ds} />
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every analyzed conversation. Click a row to see the original text next to its analysis.
        </p>
      </header>
      <ConversationsTable
        rows={rows}
        problems={ds.problems.map((p) => ({ id: p.id, title: p.title }))}
        initialProblem={initialProblem}
      />
    </>
  );
}
