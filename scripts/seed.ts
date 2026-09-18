import { ensureIndex, listDocs } from "../src/lib/knowledge";

const stats = ensureIndex();
console.log("CiteQA index seeded.");
console.log(`Docs: ${stats.docCount}, chunks: ${stats.chunkCount}`);
console.log(
  "Documents:",
  listDocs()
    .map((d) => d.title)
    .join(", ")
);
