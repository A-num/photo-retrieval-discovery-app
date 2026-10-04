import { NextResponse } from "next/server";
import { deleteImport, isReadOnly } from "@/lib/store";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/import/[id]">) {
  if (isReadOnly()) return NextResponse.json({ error: "This copy of the app is read-only." }, { status: 403 });
  const { id } = await ctx.params;
  await deleteImport(id);
  return NextResponse.json({ ok: true });
}
