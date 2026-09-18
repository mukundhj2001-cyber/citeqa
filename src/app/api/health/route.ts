import { NextResponse } from "next/server";
import { ensureIndex, listDocs } from "@/lib/knowledge";
import { hasOpenAI } from "@/lib/generate";

export const runtime = "nodejs";

export async function GET() {
  const stats = ensureIndex();
  return NextResponse.json({
    ok: true,
    ...stats,
    docs: listDocs(),
    llm: hasOpenAI(),
  });
}
