import { NextResponse } from "next/server";
import { listDocs } from "@/lib/knowledge";
import { listUploads, MAX_UPLOAD_BYTES, ALLOWED_EXTENSIONS } from "@/lib/uploads";
import { readManifest } from "@/lib/vectorstore";

export const runtime = "nodejs";

/** List sample KB + uploaded docs. */
export async function GET() {
  const docs = listDocs();
  const manifest = readManifest();
  return NextResponse.json({
    ok: true,
    docs,
    uploads: listUploads(),
    limits: {
      maxBytes: MAX_UPLOAD_BYTES,
      allowedExtensions: ALLOWED_EXTENSIONS,
    },
    indexOnDisk: Boolean(manifest),
    indexFingerprint: manifest?.fingerprint ?? null,
  });
}
