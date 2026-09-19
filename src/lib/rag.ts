import { ensureIndex } from "./knowledge";
import { generateAnswer, isWeakRetrieval } from "./generate";
import { getStore } from "./vectorstore";
import type { ChatResponse, Citation } from "./types";

function snippetOf(text: string, max = 220): string {
  const cleaned = text.replace(/^#+\s+.+$/m, "").replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max - 1) + "…" : cleaned;
}

export async function answerQuestion(message: string): Promise<ChatResponse> {
  await ensureIndex();
  const store = getStore();
  const hits = await store.search(message, 6);
  const { answer, mode, refused } = await generateAnswer(message, hits);

  const used = refused || isWeakRetrieval(hits) ? [] : hits.slice(0, 4);

  const citations: Citation[] = used.map((h) => ({
    chunkId: h.id,
    docTitle: h.docTitle,
    section: h.section,
    snippet: snippetOf(h.text),
    score: Number(h.score.toFixed(4)),
    rank: h.rank,
  }));

  return {
    answer,
    citations,
    retrieval: hits.map((h) => ({
      id: h.id,
      docTitle: h.docTitle,
      section: h.section,
      snippet: snippetOf(h.text, 180),
      score: Number(h.score.toFixed(4)),
      rank: h.rank,
    })),
    mode,
    refused,
  };
}
