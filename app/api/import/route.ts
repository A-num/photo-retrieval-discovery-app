import { NextResponse } from "next/server";
import { parseConversationsCsv } from "@/lib/csv";
import { analyzeConversations } from "@/lib/ai/pipeline";
import { hasClaude } from "@/lib/ai/client";
import { addImport, getDataset } from "@/lib/store";

export const maxDuration = 300;

const MAX_ROWS_CLAUDE = 200;
const MAX_ROWS_LOCAL = 5000;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a CSV file in the 'file' field." }, { status: 400 });
  }
  const batchId = `upload-${Date.now().toString(36)}`;
  const { conversations, skipped, missingColumns } = parseConversationsCsv(await file.text(), batchId);
  if (!conversations.length) {
    return NextResponse.json(
      { error: "No usable rows. The CSV needs at least a 'text' column.", skipped, missingColumns },
      { status: 400 },
    );
  }
  const limit = hasClaude() ? MAX_ROWS_CLAUDE : MAX_ROWS_LOCAL;
  if (conversations.length > limit) {
    return NextResponse.json(
      { error: `Too many rows (${conversations.length}). Limit is ${limit} per upload in this mode.` },
      { status: 400 },
    );
  }

  const ds = await getDataset();
  const result = await analyzeConversations(conversations, ds.problems);
  const relevant = result.analyses.filter((a) => a.retrievalRelevant).length;
  await addImport(
    {
      id: batchId,
      filename: file.name,
      createdAt: new Date().toISOString(),
      count: conversations.length,
      relevant,
      analyzedBy: result.mode,
    },
    conversations,
    result.analyses,
  );

  return NextResponse.json({
    batchId,
    imported: conversations.length,
    relevant,
    mode: result.mode,
    skipped,
    missingColumns,
    errors: result.errors,
  });
}
