import { NextResponse } from "next/server";
import { ensureIndex, listDocs } from "@/lib/knowledge";
import { deleteUpload, getUpload } from "@/lib/uploads";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const upload = getUpload(id);
  if (!upload) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, record: upload });
}

/**
 * DELETE an uploaded doc. Sample Heliora KB files cannot be deleted.
 * Re-indexes by default so citations stop appearing.
 */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (id.startsWith("faq") || !id.startsWith("up-")) {
    // Extra guard: only allow deleting upload ids
    const upload = getUpload(id);
    if (!upload) {
      return NextResponse.json(
        { ok: false, error: "Only uploaded documents can be deleted (sample KB is read-only)." },
        { status: 400 }
      );
    }
  }

  const result = deleteUpload(id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  const url = new URL(req.url);
  const skip = url.searchParams.get("reindex") === "0";
  let index = null;
  if (!skip) {
    index = await ensureIndex({ force: true });
  }

  return NextResponse.json({
    ok: true,
    deleted: id,
    reindexed: !skip,
    index,
    docs: listDocs(),
  });
}
