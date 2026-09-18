import { tokenize } from "./tokenizer";
import type { Chunk, DocMeta } from "./types";

export type RawDoc = DocMeta & { content: string };

/**
 * Split markdown into section-aware chunks.
 * Prefers ## / ### headings; falls back to paragraph packs.
 */
export function chunkDocument(doc: RawDoc): Chunk[] {
  const lines = doc.content.replace(/\r\n/g, "\n").split("\n");
  const sections: { section: string; body: string[] }[] = [];
  let current = "Overview";
  let body: string[] = [];

  const flush = () => {
    const text = body.join("\n").trim();
    if (text) sections.push({ section: current, body: [...body] });
    body = [];
  };

  for (const line of lines) {
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) {
      flush();
      current = h[2].trim();
      body = [line];
    } else {
      body.push(line);
    }
  }
  flush();

  const chunks: Chunk[] = [];
  let idx = 0;

  for (const sec of sections) {
    const full = sec.body.join("\n").trim();
    // Skip tiny title-only leftovers
    if (full.replace(/^#+\s+.+$/m, "").trim().length < 40) continue;

    const parts = splitLong(full, 900);
    for (const part of parts) {
      const text = part.trim();
      if (text.length < 40) continue;
      chunks.push({
        id: `${doc.id}::${idx++}`,
        docId: doc.id,
        docTitle: doc.title,
        section: sec.section,
        text,
        tokens: tokenize(text),
      });
    }
  }

  return chunks;
}

function splitLong(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const paras = text.split(/\n\n+/);
  const out: string[] = [];
  let buf = "";
  for (const p of paras) {
    if ((buf + "\n\n" + p).trim().length > maxChars && buf) {
      out.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
