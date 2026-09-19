import { NextResponse } from "next/server";
import { ensureIndex, listDocs } from "@/lib/knowledge";
import { saveUpload } from "@/lib/uploads";

export const runtime = "nodejs";

/**
 * POST multipart/form-data with field "file".
 * Validates type/size, extracts PDF text locally, saves under knowledge/uploads/,
 * then force-rebuilds the local MiniLM index (privacy: no cloud embeddings).
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart form data with a file field." },
      { status: 400 }
    );
  }

  const entry = form.get("file");
  if (!entry || typeof entry === "string") {
    return NextResponse.json(
      { ok: false, error: "Missing file. Attach a .md, .txt, or .pdf as form field “file”." },
      { status: 400 }
    );
  }

  const result = await saveUpload(entry);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  const reindex = form.get("reindex");
  const shouldReindex = reindex === null || reindex === "1" || reindex === "true";

  let index = null;
  if (shouldReindex) {
    try {
      index = await ensureIndex({ force: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        {
          ok: false,
          error: `File saved but re-index failed: ${msg}`,
          record: result.record,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    record: result.record,
    reindexed: shouldReindex,
    index,
    docs: listDocs(),
  });
}
