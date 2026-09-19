import fs from "fs";
import path from "path";
import {
  EMBEDDING_DIMS,
  EMBEDDING_MODEL,
  cosineSimilarity,
  embedText,
  embedTexts,
} from "./embeddings";
import type { Chunk, ScoredChunk } from "./types";

const INDEX_VERSION = 1;

type Manifest = {
  version: number;
  model: string;
  dims: number;
  chunkCount: number;
  fingerprint: string;
  createdAt: string;
};

function indexDir(): string {
  return path.join(process.cwd(), "data", "index");
}

function manifestPath() {
  return path.join(indexDir(), "manifest.json");
}
function chunksPath() {
  return path.join(indexDir(), "chunks.json");
}
function vectorsPath() {
  return path.join(indexDir(), "vectors.bin");
}

/**
 * Persistent local vector store: MiniLM embeddings on disk + in-memory search.
 * No cloud embedding API; vectors survive server restarts.
 */
export class VectorStore {
  private chunks: Chunk[] = [];
  /** Row-major: chunk i occupies [i*dims, (i+1)*dims) */
  private matrix: Float32Array | null = null;
  private dims = EMBEDDING_DIMS;
  private model = EMBEDDING_MODEL;
  private fingerprint = "";
  private ready = false;

  get isReady() {
    return this.ready && this.chunks.length > 0 && this.matrix !== null;
  }

  get size() {
    return this.chunks.length;
  }

  get backend() {
    return "semantic" as const;
  }

  getModel() {
    return this.model;
  }

  getFingerprint() {
    return this.fingerprint;
  }

  getChunk(id: string) {
    return this.chunks.find((c) => c.id === id);
  }

  getAllChunks() {
    return this.chunks;
  }

  /** Load index from data/index if present and fingerprint matches. */
  loadFromDisk(expectedFingerprint: string): boolean {
    try {
      const mPath = manifestPath();
      const cPath = chunksPath();
      const vPath = vectorsPath();
      if (![mPath, cPath, vPath].every((p) => fs.existsSync(p))) return false;

      const manifest = JSON.parse(fs.readFileSync(mPath, "utf8")) as Manifest;
      if (manifest.version !== INDEX_VERSION) return false;
      if (manifest.model !== EMBEDDING_MODEL) return false;
      if (manifest.dims !== EMBEDDING_DIMS) return false;
      if (manifest.fingerprint !== expectedFingerprint) return false;

      const chunks = JSON.parse(fs.readFileSync(cPath, "utf8")) as Chunk[];
      if (chunks.length !== manifest.chunkCount) return false;

      const buf = fs.readFileSync(vPath);
      const expectedBytes = chunks.length * EMBEDDING_DIMS * 4;
      if (buf.byteLength !== expectedBytes) return false;

      // Copy into a fresh Float32Array (Buffer may be pooled / not aligned).
      const matrix = new Float32Array(chunks.length * EMBEDDING_DIMS);
      matrix.set(new Float32Array(buf.buffer, buf.byteOffset, matrix.length));

      this.chunks = chunks;
      this.matrix = matrix;
      this.dims = EMBEDDING_DIMS;
      this.model = EMBEDDING_MODEL;
      this.fingerprint = expectedFingerprint;
      this.ready = true;
      return true;
    } catch (err) {
      console.warn("CiteQA: failed to load vector index from disk:", err);
      return false;
    }
  }

  /** Embed chunks, store in memory, and persist to data/index. */
  async buildAndPersist(
    chunks: Chunk[],
    fingerprint: string,
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    const texts = chunks.map((c) => {
      // Section + title help semantic match for short queries like "What's on Pro?"
      return `${c.docTitle}\n${c.section}\n${c.text}`;
    });
    const vectors = await embedTexts(texts, onProgress);
    const matrix = new Float32Array(chunks.length * EMBEDDING_DIMS);
    for (let i = 0; i < vectors.length; i++) {
      matrix.set(vectors[i], i * EMBEDDING_DIMS);
    }

    this.chunks = chunks;
    this.matrix = matrix;
    this.dims = EMBEDDING_DIMS;
    this.model = EMBEDDING_MODEL;
    this.fingerprint = fingerprint;
    this.ready = true;

    this.saveToDisk();
  }

  saveToDisk() {
    if (!this.matrix || !this.chunks.length) return;
    const dir = indexDir();
    fs.mkdirSync(dir, { recursive: true });

    const manifest: Manifest = {
      version: INDEX_VERSION,
      model: this.model,
      dims: this.dims,
      chunkCount: this.chunks.length,
      fingerprint: this.fingerprint,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(chunksPath(), JSON.stringify(this.chunks, null, 2));
    // Write raw Float32 little-endian bytes
    fs.writeFileSync(vectorsPath(), Buffer.from(this.matrix.buffer, this.matrix.byteOffset, this.matrix.byteLength));
  }

  /** Semantic search via cosine similarity on L2-normalized embeddings. */
  async search(query: string, topK = 5): Promise<ScoredChunk[]> {
    if (!this.ready || !this.matrix) return [];
    const q = await embedText(query);
    const scored: ScoredChunk[] = [];
    const n = this.chunks.length;
    const dims = this.dims;

    for (let i = 0; i < n; i++) {
      const offset = i * dims;
      const row = this.matrix.subarray(offset, offset + dims);
      const score = cosineSimilarity(q, row);
      scored.push({ ...this.chunks[i], score, rank: 0 });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((c, i) => ({ ...c, rank: i + 1 }));
  }

  clear() {
    this.chunks = [];
    this.matrix = null;
    this.fingerprint = "";
    this.ready = false;
  }
}

const globalForStore = globalThis as unknown as { __citeqaStore?: VectorStore };

export function getStore(): VectorStore {
  if (!globalForStore.__citeqaStore) {
    globalForStore.__citeqaStore = new VectorStore();
  }
  return globalForStore.__citeqaStore;
}

export function indexExistsOnDisk(): boolean {
  return [manifestPath(), chunksPath(), vectorsPath()].every((p) => fs.existsSync(p));
}

export function readManifest(): Manifest | null {
  try {
    if (!fs.existsSync(manifestPath())) return null;
    return JSON.parse(fs.readFileSync(manifestPath(), "utf8")) as Manifest;
  } catch {
    return null;
  }
}
