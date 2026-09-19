/**
 * Rebuild the local semantic index from knowledge/*.md + knowledge/uploads/
 * and persist under data/index/.
 * Downloads Xenova/all-MiniLM-L6-v2 into .cache/transformers/ on first run (local only).
 */
import { ensureIndex, listDocs } from "../src/lib/knowledge";

async function main() {
  console.log("CiteQA seed — local MiniLM embeddings (no cloud embedding API)…");
  const stats = await ensureIndex({
    force: true,
    onProgress: (done, total) => {
      if (done === total || done % 5 === 0) {
        process.stdout.write(`\r  embedded ${done}/${total}`);
      }
    },
  });
  process.stdout.write("\n");
  console.log("CiteQA index seeded.");
  console.log(
    `Docs: ${stats.docCount} (sample ${stats.sampleDocCount}, uploads ${stats.uploadDocCount}), chunks: ${stats.chunkCount}, backend: ${stats.backend}`
  );
  console.log(`Model: ${stats.model}`);
  console.log(`Fingerprint: ${stats.fingerprint}`);
  console.log(`Persisted: data/index/{manifest.json,chunks.json,vectors.bin}`);
  console.log(
    "Documents:",
    listDocs()
      .map((d) => `${d.title}${d.source === "upload" ? " [upload]" : ""}`)
      .join(", ")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
