import { NextResponse } from "next/server";
import { ensureIndex, listDocs } from "@/lib/knowledge";
import { hasOpenAI } from "@/lib/generate";
import { readManifest } from "@/lib/vectorstore";

export const runtime = "nodejs";

export async function GET() {
  const stats = await ensureIndex();
  const manifest = readManifest();
  return NextResponse.json({
    ok: true,
    ...stats,
    docs: listDocs(),
    llm: hasOpenAI(),
    indexOnDisk: Boolean(manifest),
    indexCreatedAt: manifest?.createdAt ?? null,
  });
}
