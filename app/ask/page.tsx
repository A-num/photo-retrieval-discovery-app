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
          {claude
            ? "A research analyst for Google Photos retrieval. It queries the collected conversations, does the counting, and answers briefly. Ask follow-ups to dig deeper."
            : "No ANTHROPIC_API_KEY is set, so questions are answered with fixed rules over the analysis. Set a key for the AI analyst, which handles open-ended questions and follow-ups."}
        </p>
      </header>
      <AskPanel conversationCount={ds.conversations.length} />
    </>
  );
}
