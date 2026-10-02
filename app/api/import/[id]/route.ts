import { NextResponse } from "next/server";
import { deleteImport } from "@/lib/store";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/import/[id]">) {
  const { id } = await ctx.params;
  await deleteImport(id);
  return NextResponse.json({ ok: true });
}
