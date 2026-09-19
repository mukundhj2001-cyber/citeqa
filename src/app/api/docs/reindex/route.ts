import { NextResponse } from "next/server";
import { ensureIndex, listDocs, knowledgeFingerprint } from "@/lib/knowledge";

export const runtime = "nodejs";

/** Force re-chunk + local MiniLM re-embed + persist to data/index/. */
export async function POST() {
  try {
    const before = knowledgeFingerprint();
    const index = await ensureIndex({ force: true });
    return NextResponse.json({
      ok: true,
      index,
      docs: listDocs(),
      fingerprintBefore: before,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
