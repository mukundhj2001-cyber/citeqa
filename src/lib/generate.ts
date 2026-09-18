import OpenAI from "openai";
import type { ScoredChunk } from "./types";

const WEAK_SCORE = 0.12;
const MIN_TOP_SCORE = 0.18;

export function isWeakRetrieval(hits: ScoredChunk[]): boolean {
  if (!hits.length) return true;
  if (hits[0].score < MIN_TOP_SCORE) return true;
  // All hits weak
  if (hits.every((h) => h.score < WEAK_SCORE)) return true;
  return false;
}

export function hasOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function contextBlock(hits: ScoredChunk[]): string {
  return hits
    .map(
      (h, i) =>
        `[${i + 1}] Doc: "${h.docTitle}" | Section: "${h.section}"\n${h.text}`
    )
    .join("\n\n---\n\n");
}

const SYSTEM = `You are CiteQA, a customer-support assistant for Northstar Analytics.
Answer ONLY using the provided context excerpts from the knowledge base.
Rules:
- If the context does not contain enough information, say you don't have that in the docs and suggest a related topic or contacting support. Do NOT invent policies, prices, or features.
- Be concise and helpful (support-widget tone).
- When you use a fact, cite it inline like [1], [2] matching the context numbering.
- Never mention that you are an AI model unless asked.`;

export async function generateAnswer(
  question: string,
  hits: ScoredChunk[]
): Promise<{ answer: string; mode: "llm" | "offline" | "refuse"; refused: boolean }> {
  if (isWeakRetrieval(hits)) {
    return {
      answer:
        "I couldn't find that in the Northstar Analytics docs. I only answer from the indexed help center (FAQ, pricing & billing, onboarding, troubleshooting).\n\nTry asking about refunds, Pro plan features, password reset, or getting started — or email support@northstar-analytics.example.",
      mode: "refuse",
      refused: true,
    };
  }

  if (hasOpenAI()) {
    try {
      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL || undefined,
      });
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const completion = await client.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Context:\n${contextBlock(hits)}\n\nQuestion: ${question}`,
          },
        ],
      });
      const answer =
        completion.choices[0]?.message?.content?.trim() ||
        offlineCompose(question, hits);
      return { answer, mode: "llm", refused: false };
    } catch (err) {
      console.error("OpenAI generation failed, falling back to offline:", err);
      return { answer: offlineCompose(question, hits), mode: "offline", refused: false };
    }
  }

  return { answer: offlineCompose(question, hits), mode: "offline", refused: false };
}

/** Offline-friendly answer: grounded quotes from top chunks, no invention. */
function offlineCompose(question: string, hits: ScoredChunk[]): string {
  const top = hits.slice(0, 3);
  const lines: string[] = [
    `Based on the Northstar Analytics docs (retrieval-only mode — set OPENAI_API_KEY for a synthesized answer):`,
    "",
  ];
  top.forEach((h, i) => {
    const snippet = h.text
      .replace(/^#+\s+.+$/m, "")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 320);
    lines.push(`**[${i + 1}] ${h.docTitle} — ${h.section}**`);
    lines.push(`> ${snippet}${snippet.length >= 320 ? "…" : ""}`);
    lines.push("");
  });
  lines.push(
    `_Question received: “${question.trim()}”. Open a citation for the full source section._`
  );
  return lines.join("\n");
}
