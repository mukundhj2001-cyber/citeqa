import path from "path";
import fs from "fs";

/** Local MiniLM — runs entirely on-device via Transformers.js (no cloud embedding API). */
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMS = 384;

type FeaturePipeline = (
  texts: string | string[],
  opts: { pooling: "mean"; normalize: boolean }
) => Promise<{ data: Float32Array | number[]; dims: number[] }>;

let extractorPromise: Promise<FeaturePipeline> | null = null;

function cacheDir(): string {
  return path.join(process.cwd(), ".cache", "transformers");
}

function ensureCacheDir() {
  const dir = cacheDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Lazy-load the local feature-extraction pipeline.
 * First call may download the model into `.cache/transformers/` (one-time).
 */
export async function getExtractor(): Promise<FeaturePipeline> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      ensureCacheDir();
      // Dynamic import keeps Next from bundling onnx/wasm into the client graph.
      const { pipeline, env } = await import("@xenova/transformers");
      env.cacheDir = cacheDir();
      // Prefer local cache; allow first-time download from Hugging Face.
      env.allowLocalModels = true;
      // Quiet progress in seed/scripts
      env.backends.onnx.wasm.numThreads = 1;
      const pipe = await pipeline("feature-extraction", EMBEDDING_MODEL);
      return pipe as unknown as FeaturePipeline;
    })();
  }
  return extractorPromise;
}

function toFloat32(data: Float32Array | number[], expectedLen: number): Float32Array {
  // Always copy — Transformers.js may reuse an internal buffer; returning the
  // same reference lets the next embed overwrite vectors still in use.
  const out = new Float32Array(expectedLen);
  const src = data instanceof Float32Array ? data : Float32Array.from(data);
  out.set(src.subarray(0, Math.min(src.length, expectedLen)));
  return out;
}

/** Serialize extractor calls — ONNX/wasm is not reliably re-entrant. */
let embedChain: Promise<unknown> = Promise.resolve();

function withEmbedLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = embedChain.then(fn, fn);
  embedChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Embed one string → L2-normalized Float32Array of length EMBEDDING_DIMS. */
export async function embedText(text: string): Promise<Float32Array> {
  return withEmbedLock(async () => {
    const extractor = await getExtractor();
    const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 8000);
    const output = await extractor(cleaned || " ", { pooling: "mean", normalize: true });
    return toFloat32(output.data, EMBEDDING_DIMS);
  });
}

/** Embed many texts (sequential batches to bound memory). */
export async function embedTexts(
  texts: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Float32Array[]> {
  const out: Float32Array[] = [];
  const batchSize = 8;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    // Pipeline accepts arrays; result is concatenated — embed one-by-one for simpler slicing.
    for (const t of batch) {
      out.push(await embedText(t));
      onProgress?.(out.length, texts.length);
    }
  }
  return out;
}

/** Dot product of two equal-length L2-normalized vectors = cosine similarity. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}
