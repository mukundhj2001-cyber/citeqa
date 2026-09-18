import fs from "fs";
import path from "path";
import { chunkDocument, type RawDoc } from "./chunker";
import { getStore } from "./vectorstore";
import type { Chunk } from "./types";

const DOC_META: Record<string, { id: string; title: string }> = {
  "faq.md": { id: "faq", title: "Help Center & FAQ" },
  "pricing-billing.md": { id: "pricing-billing", title: "Pricing, Billing & Refunds" },
  "onboarding.md": { id: "onboarding", title: "Getting Started & Onboarding" },
  "troubleshooting.md": { id: "troubleshooting", title: "Troubleshooting & Account Access" },
};

function knowledgeDir(): string {
  // Statically scoped so Next/Turbopack only traces the knowledge folder
  return path.join(process.cwd(), "knowledge");
}

export function loadRawDocs(): RawDoc[] {
  const dir = knowledgeDir();
  const files = Object.keys(DOC_META);
  const docs: RawDoc[] = [];
  for (const filename of files) {
    const full = path.join(/*turbopackIgnore: true*/ dir, filename);
    if (!fs.existsSync(full)) continue;
    const meta = DOC_META[filename];
    docs.push({
      id: meta.id,
      title: meta.title,
      filename,
      content: fs.readFileSync(full, "utf8"),
    });
  }
  return docs;
}

export function buildChunks(): Chunk[] {
  const docs = loadRawDocs();
  return docs.flatMap((d) => chunkDocument(d));
}

export function ensureIndex(): { chunkCount: number; docCount: number } {
  const store = getStore();
  if (store.isReady) {
    return { chunkCount: store.size, docCount: loadRawDocs().length };
  }
  const chunks = buildChunks();
  store.index(chunks);
  return { chunkCount: chunks.length, docCount: loadRawDocs().length };
}

export function listDocs() {
  return loadRawDocs().map((d) => ({
    id: d.id,
    title: d.title,
    filename: d.filename,
  }));
}
