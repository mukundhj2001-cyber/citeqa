import crypto from "crypto";
import fs from "fs";
import path from "path";
import { chunkDocument, type RawDoc } from "./chunker";
import { EMBEDDING_MODEL } from "./embeddings";
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

/** Stable fingerprint of KB files + embedding model — used to decide if disk index is fresh. */
export function knowledgeFingerprint(): string {
  const dir = knowledgeDir();
  const parts: string[] = [EMBEDDING_MODEL];
  for (const filename of Object.keys(DOC_META).sort()) {
    const full = path.join(dir, filename);
    if (!fs.existsSync(full)) {
      parts.push(`${filename}:missing`);
      continue;
    }
    const st = fs.statSync(full);
    const body = fs.readFileSync(full);
    const hash = crypto.createHash("sha256").update(body).digest("hex").slice(0, 16);
    parts.push(`${filename}:${st.size}:${hash}`);
  }
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

export type IndexStats = {
  chunkCount: number;
  docCount: number;
  backend: "semantic";
  model: string;
  fromDisk: boolean;
  fingerprint: string;
};

let indexingPromise: Promise<IndexStats> | null = null;

/**
 * Ensure the semantic index is loaded (from disk if fresh) or built and persisted.
 * Concurrent callers share one in-flight build.
 */
export async function ensureIndex(opts?: {
  force?: boolean;
  onProgress?: (done: number, total: number) => void;
}): Promise<IndexStats> {
  const store = getStore();
  const fingerprint = knowledgeFingerprint();
  const docs = loadRawDocs();

  if (!opts?.force && store.isReady && store.getFingerprint() === fingerprint) {
    return {
      chunkCount: store.size,
      docCount: docs.length,
      backend: "semantic",
      model: store.getModel(),
      fromDisk: true,
      fingerprint,
    };
  }

  if (!opts?.force && !store.isReady && store.loadFromDisk(fingerprint)) {
    return {
      chunkCount: store.size,
      docCount: docs.length,
      backend: "semantic",
      model: store.getModel(),
      fromDisk: true,
      fingerprint,
    };
  }

  if (!indexingPromise || opts?.force) {
    indexingPromise = (async () => {
      if (opts?.force) store.clear();
      // Try disk again inside the lock (another process may have written it)
      if (!opts?.force && store.loadFromDisk(fingerprint)) {
        return {
          chunkCount: store.size,
          docCount: docs.length,
          backend: "semantic" as const,
          model: store.getModel(),
          fromDisk: true,
          fingerprint,
        };
      }
      const chunks = buildChunks();
      console.log(
        `CiteQA: embedding ${chunks.length} chunks with ${EMBEDDING_MODEL} (local)…`
      );
      await store.buildAndPersist(chunks, fingerprint, opts?.onProgress);
      console.log(`CiteQA: index persisted under data/index/ (${chunks.length} vectors).`);
      return {
        chunkCount: chunks.length,
        docCount: docs.length,
        backend: "semantic" as const,
        model: EMBEDDING_MODEL,
        fromDisk: false,
        fingerprint,
      };
    })().finally(() => {
      indexingPromise = null;
    });
  }

  return indexingPromise;
}

export function listDocs() {
  return loadRawDocs().map((d) => ({
    id: d.id,
    title: d.title,
    filename: d.filename,
  }));
}
