import { NextResponse } from "next/server";
import { ensureIndex, listDocs } from "@/lib/knowledge";
import { resolveGenerationBackend } from "@/lib/generate";
import { listUploads } from "@/lib/uploads";
import { readManifest } from "@/lib/vectorstore";

export const runtime = "nodejs";

export async function GET() {
  const stats = await ensureIndex();
  const manifest = readManifest();
  const gen = await resolveGenerationBackend();
  return NextResponse.json({
    ok: true,
    ...stats,
    docs: listDocs(),
    uploadCount: listUploads().length,
    /** @deprecated use generationMode / ollama / openai */
    llm: gen.openai || gen.ollama,
    ollama: gen.ollama,
    openai: gen.openai,
    generationMode: gen.mode,
    ollamaBaseUrl: gen.ollamaBaseUrl,
    ollamaModel: gen.ollamaModel,
    indexOnDisk: Boolean(manifest),
    indexCreatedAt: manifest?.createdAt ?? null,
  });
}
