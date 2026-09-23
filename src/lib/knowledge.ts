import crypto from "crypto";
import fs from "fs";
import path from "path";
import { chunkDocument, type RawDoc } from "./chunker";
import { EMBEDDING_MODEL } from "./embeddings";
import { getStore } from "./vectorstore";
import {
  listUploads,
  loadUploadContents,
  uploadsFingerprintParts,
} from "./uploads";
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

/** Sample Cyberfield markdown docs (committed under knowledge/). */
export function loadSampleDocs(): RawDoc[] {
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
      source: "sample",
    });
  }
  return docs;
}

/** Sample KB + user uploads under knowledge/uploads/. */
export async function loadRawDocs(): Promise<RawDoc[]> {
  const samples = loadSampleDocs();
  const uploads: RawDoc[] = [];
  for (const rec of listUploads()) {
    const loaded = await loadUploadContents(rec);
    if (!loaded) continue;
    uploads.push({
      id: loaded.id,
      title: loaded.title,
      filename: loaded.filename,
      content: loaded.content,
      source: "upload",
    });
  }
  return [...samples, ...uploads];
}

export async function buildChunks(): Promise<Chunk[]> {
  const docs = await loadRawDocs();
  return docs.flatMap((d) => chunkDocument(d));
}

/** Stable fingerprint of sample KB + uploads + embedding model — invalidates stale disk indexes. */
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
  parts.push(...uploadsFingerprintParts());
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

export type IndexStats = {
  chunkCount: number;
  docCount: number;
  sampleDocCount: number;
  uploadDocCount: number;
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
  const sampleCount = loadSampleDocs().length;
  const uploadCount = listUploads().length;
  const docCount = sampleCount + uploadCount;

  const stats = (
    fromDisk: boolean,
    chunkCount: number,
    model: string
  ): IndexStats => ({
    chunkCount,
    docCount,
    sampleDocCount: sampleCount,
    uploadDocCount: uploadCount,
    backend: "semantic",
    model,
    fromDisk,
    fingerprint,
  });

  if (!opts?.force && store.isReady && store.getFingerprint() === fingerprint) {
    return stats(true, store.size, store.getModel());
  }

  if (!opts?.force && !store.isReady && store.loadFromDisk(fingerprint)) {
    return stats(true, store.size, store.getModel());
  }

  if (!indexingPromise || opts?.force) {
    indexingPromise = (async () => {
      if (opts?.force) store.clear();
      // Try disk again inside the lock (another process may have written it)
      if (!opts?.force && store.loadFromDisk(fingerprint)) {
        return stats(true, store.size, store.getModel());
      }
      const chunks = await buildChunks();
      console.log(
        `CiteQA: embedding ${chunks.length} chunks with ${EMBEDDING_MODEL} (local)…`
      );
      await store.buildAndPersist(chunks, fingerprint, opts?.onProgress);
      console.log(`CiteQA: index persisted under data/index/ (${chunks.length} vectors).`);
      return stats(false, chunks.length, EMBEDDING_MODEL);
    })().finally(() => {
      indexingPromise = null;
    });
  }

  return indexingPromise;
}

export function listDocs() {
  const samples = loadSampleDocs().map((d) => ({
    id: d.id,
    title: d.title,
    filename: d.filename,
    source: "sample" as const,
  }));
  const uploads = listUploads().map((d) => ({
    id: d.id,
    title: d.title,
    filename: `uploads/${d.filename}`,
    originalName: d.originalName,
    size: d.size,
    uploadedAt: d.uploadedAt,
    ext: d.ext,
    source: "upload" as const,
  }));
  return [...samples, ...uploads];
}
