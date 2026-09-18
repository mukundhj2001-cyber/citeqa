import { tokenize } from "./tokenizer";
import type { Chunk, ScoredChunk } from "./types";

/**
 * In-memory TF-IDF index with cosine similarity.
 * Local, deterministic, no paid infra — good enough for a portfolio RAG demo.
 */
export class VectorStore {
  private chunks: Chunk[] = [];
  private idf = new Map<string, number>();
  private vectors: Map<string, Map<string, number>> = new Map();
  private norms = new Map<string, number>();
  private ready = false;

  index(chunks: Chunk[]) {
    this.chunks = chunks;
    const df = new Map<string, number>();
    const N = chunks.length || 1;

    for (const c of chunks) {
      const uniq = new Set(c.tokens);
      for (const t of uniq) df.set(t, (df.get(t) ?? 0) + 1);
    }

    this.idf = new Map();
    for (const [t, d] of df) {
      this.idf.set(t, Math.log((N + 1) / (d + 1)) + 1);
    }

    this.vectors = new Map();
    this.norms = new Map();
    for (const c of chunks) {
      const tf = new Map<string, number>();
      for (const t of c.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      const vec = new Map<string, number>();
      let normSq = 0;
      const len = c.tokens.length || 1;
      for (const [t, count] of tf) {
        const w = (count / len) * (this.idf.get(t) ?? 0);
        if (w > 0) {
          vec.set(t, w);
          normSq += w * w;
        }
      }
      this.vectors.set(c.id, vec);
      this.norms.set(c.id, Math.sqrt(normSq) || 1e-9);
    }
    this.ready = true;
  }

  get isReady() {
    return this.ready && this.chunks.length > 0;
  }

  get size() {
    return this.chunks.length;
  }

  getChunk(id: string) {
    return this.chunks.find((c) => c.id === id);
  }

  getAllChunks() {
    return this.chunks;
  }

  search(query: string, topK = 5): ScoredChunk[] {
    if (!this.ready) return [];
    const qTokens = tokenize(query);
    if (!qTokens.length) return [];

    const qtf = new Map<string, number>();
    for (const t of qTokens) qtf.set(t, (qtf.get(t) ?? 0) + 1);
    const qvec = new Map<string, number>();
    let qNormSq = 0;
    const qlen = qTokens.length;
    for (const [t, count] of qtf) {
      const w = (count / qlen) * (this.idf.get(t) ?? 0);
      if (w > 0) {
        qvec.set(t, w);
        qNormSq += w * w;
      }
    }
    const qNorm = Math.sqrt(qNormSq) || 1e-9;

    const scored: ScoredChunk[] = [];
    for (const c of this.chunks) {
      const vec = this.vectors.get(c.id)!;
      let dot = 0;
      for (const [t, qw] of qvec) {
        const dw = vec.get(t);
        if (dw) dot += qw * dw;
      }
      const score = dot / (qNorm * (this.norms.get(c.id) ?? 1e-9));
      // Prefer chunks whose section heading closely matches the query
      const sectionHay = c.section.toLowerCase();
      const titleHay = c.docTitle.toLowerCase();
      let boost = 0;
      for (const t of new Set(qTokens)) {
        if (sectionHay === t || sectionHay.split(/\s+/).includes(t)) boost += 0.22;
        else if (sectionHay.includes(t)) boost += 0.08;
        else if (titleHay.includes(t)) boost += 0.02;
      }
      // Prefer denser content matches in body for short queries
      const bodyHits = c.tokens.filter((tok) => qTokens.includes(tok)).length;
      boost += Math.min(0.15, bodyHits * 0.02);
      const finalScore = score + boost;
      if (finalScore > 0.01) {
        scored.push({ ...c, score: finalScore, rank: 0 });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((c, i) => ({ ...c, rank: i + 1 }));
  }
}

/** Singleton used by API routes (module-level cache across hot reloads in dev). */
const globalForStore = globalThis as unknown as { __citeqaStore?: VectorStore };

export function getStore(): VectorStore {
  if (!globalForStore.__citeqaStore) {
    globalForStore.__citeqaStore = new VectorStore();
  }
  return globalForStore.__citeqaStore;
}
