import { hasClaude } from "@/lib/ai/client";
import { AskPanel } from "@/components/ask-panel";
import { DatasetBanner, EmptyDataset } from "@/components/labels";
import { getDataset } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AskPage() {
  const claude = hasClaude();
  const ds = await getDataset();
  if (ds.conversations.length === 0) {
    return (
      <>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Ask AI</h1>
        <EmptyDataset />
      </>
    );
  }

  return (
    <>
      <DatasetBanner ds={ds} />
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Ask AI</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Ask about what users remember, why retrieval fails, and what they do instead. Every answer is computed from the analyzed conversations
          {claude ? ", and you can ask follow-ups to dig deeper." : "."}
        </p>
      </header>
      <AskPanel conversationCount={ds.conversations.length} />
    </>
  );
}
