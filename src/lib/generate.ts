import OpenAI from "openai";
import type { ScoredChunk } from "./types";
import {
  getOllamaBaseUrl,
  getOllamaModel,
  isOllamaReachable,
  ollamaChat,
} from "./ollama";

/**
 * Cosine similarity thresholds for L2-normalized MiniLM embeddings.
 * Typical in-corpus hits land ~0.35–0.75; out-of-corpus often <0.30.
 */
const WEAK_SCORE = 0.28;
const MIN_TOP_SCORE = 0.35;

export type GenerationMode = "ollama" | "openai" | "offline" | "refuse";

export function isWeakRetrieval(hits: ScoredChunk[]): boolean {
  if (!hits.length) return true;
  if (hits[0].score < MIN_TOP_SCORE) return true;
  if (hits.every((h) => h.score < WEAK_SCORE)) return true;
  return false;
}

export function hasOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function contextBlock(hits: ScoredChunk[]): string {
  // Evidence for the model only — never shown to the customer as-is
  return hits
    .slice(0, 4)
    .map(
      (h, i) =>
        `Article ${i + 1}: "${h.docTitle}" — ${h.section}\n${h.text}`
    )
    .join("\n\n---\n\n");
}

const SYSTEM = `You are Cyberfield Support, a help-center assistant for Cyberfield Analytics customers.

Write ONLY the final reply the customer should read in the chat widget.

Hard rules:
- Answer using the provided help-center articles only. Never invent policy, prices, or features.
- Be concise and clear (2–6 short sentences or a few bullets). Support-widget tone.
- Never mention: chunks, embeddings, retrieval, search results, knowledge-base queries, scores, ranks, tools, or how you found the answer.
- Never list “top N chunks/results” or paste multiple retrieved snippets as the answer.
- Never start with “I searched…”, “Based on the search results…”, or “Here are the top…”.
- Synthesize ONE clear answer. If articles conflict, prefer the dedicated policy section (e.g. Refunds) and suggest contacting support for edge cases.
- Do not add a footnote list of [1], [2], [3]… links or URLs. The product UI already shows related articles.
- You may name an article naturally once (e.g. “According to our Pricing, Billing & Refunds guide…”).
- If the articles do not cover the question, say so briefly and suggest emailing support@cyberfield-analytics.example.`;

/**
 * Detect answers that dump retrieval/tool theater instead of helping the customer.
 */
export function looksLikeChunkDump(text: string): boolean {
  const t = text.toLowerCase();
  if (/top\s+\d+\s+chunks?/.test(t)) return true;
  if (/here are the (top\s+)?(\d+\s+)?(chunks?|results|excerpts)/.test(t))
    return true;
  if (/i searched (the )?(cyberfield|knowledge|docs|help)/.test(t)) return true;
  if (/knowledge base with the query/.test(t)) return true;
  if (/based on (the )?(search|retrieval) results/.test(t) && (text.match(/\[\d+\]/g)?.length ?? 0) >= 3)
    return true;
  if (/chunk\s*#?\s*\d+/i.test(text) && (text.match(/chunk/gi)?.length ?? 0) >= 2)
    return true;
  if (
    (text.match(/^\s*\d+\.\s+/gm)?.length ?? 0) >= 5 &&
    /(snippet|score|rank|chunk|section:)/i.test(text)
  )
    return true;
  // Long laundry list of numbered source blocks
  if ((text.match(/\[\d+\]/g)?.length ?? 0) >= 5) return true;
  return false;
}

/**
 * Light cleanup of leftover retrieval theater in an otherwise usable answer.
 */
export function sanitizeCustomerAnswer(text: string): string {
  let out = text.trim();
  // Drop trailing "Sources:" / numbered URL / [n] Doc: footers
  out = out.replace(
    /\n+(?:Sources?|References?|Citations?)\s*:?\s*\n(?:\s*[-*]?\s*\[\d+\][^\n]*\n?)+\s*$/i,
    ""
  );
  out = out.replace(/\n+(?:\[\d+\][^\n]*\n){3,}\s*$/g, "");
  // Strip leading search-meta sentences if somehow present
  out = out.replace(
    /^(?:I searched[^\n]*\n+|Based on (?:the )?search results[^\n]*\n+|Here are the top[^\n]*\n+)/i,
    ""
  );
  out = out.replace(/\s*\(RAG\)/gi, "");
  return out.trim();
}

export async function resolveGenerationBackend(): Promise<{
  mode: "ollama" | "openai" | "offline";
  ollama: boolean;
  openai: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
}> {
  const ollama = await isOllamaReachable();
  const openai = hasOpenAI();
  let mode: "ollama" | "openai" | "offline" = "offline";
  if (ollama) mode = "ollama";
  else if (openai) mode = "openai";
  return {
    mode,
    ollama,
    openai,
    ollamaBaseUrl: getOllamaBaseUrl(),
    ollamaModel: getOllamaModel(),
  };
}

export async function generateAnswer(
  question: string,
  hits: ScoredChunk[]
): Promise<{ answer: string; mode: GenerationMode; refused: boolean }> {
  if (isWeakRetrieval(hits)) {
    return {
      answer:
        "I couldn’t find that in the Cyberfield help center. I can help with billing, refunds, plans, password resets, and getting started.\n\nTry rephrasing, or email support@cyberfield-analytics.example and we’ll take it from there.",
      mode: "refuse",
      refused: true,
    };
  }

  const userContent = `Help-center articles (internal evidence — do not list these as “chunks” or search results in your reply):\n${contextBlock(hits)}\n\nCustomer question: ${question}\n\nWrite the customer-facing answer only.`;

  if (await isOllamaReachable()) {
    try {
      let answer = await ollamaChat(
        [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        { temperature: 0.2 }
      );
      answer = sanitizeCustomerAnswer(answer);
      if (looksLikeChunkDump(answer)) {
        return {
          answer: offlineCompose(question, hits),
          mode: "offline",
          refused: false,
        };
      }
      return { answer, mode: "ollama", refused: false };
    } catch (err) {
      console.error("Ollama generation failed, trying next backend:", err);
    }
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
          { role: "user", content: userContent },
        ],
      });
      let answer =
        completion.choices[0]?.message?.content?.trim() ||
        offlineCompose(question, hits);
      answer = sanitizeCustomerAnswer(answer);
      if (looksLikeChunkDump(answer)) {
        answer = offlineCompose(question, hits);
      }
      return { answer, mode: "openai", refused: false };
    } catch (err) {
      console.error("OpenAI generation failed, falling back to offline:", err);
      return {
        answer: offlineCompose(question, hits),
        mode: "offline",
        refused: false,
      };
    }
  }

  return {
    answer: offlineCompose(question, hits),
    mode: "offline",
    refused: false,
  };
}

/** Offline customer answer — short synthesis, never a chunk catalog. */
function offlineCompose(question: string, hits: ScoredChunk[]): string {
  const q = question.toLowerCase();
  const refundHit =
    hits.find(
      (h) =>
        /refund/i.test(h.section) ||
        /refund/i.test(h.docTitle) ||
        /refund/i.test(h.text)
    ) || null;

  if (/refund|money[- ]?back/.test(q) && refundHit) {
    return [
      "Here’s how refunds work at Cyberfield:",
      "",
      "• **Monthly plans:** full refund within **14 days** of the first paid charge if you’ve used 10% or less of your monthly event quota.",
      "• **Annual plans:** prorated refund within **30 days** of purchase. After that, annual plans aren’t refundable except where required by law.",
      "• **How to request:** email billing@cyberfield-analytics.example with your workspace ID and reason. Refunds usually post in 5–7 business days to the original payment method.",
      "",
      "You can cancel anytime under Billing → Cancel subscription; access continues through the paid period.",
      "",
      "If your case is outside these windows, contact billing and we’ll help you sort it out.",
    ].join("\n");
  }

  // Generic: lead with the best section, trimmed — not a multi-chunk dump
  const primary = hits[0];
  const cleaned = primary.text
    .replace(/^#+\s+.+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 520);
  const titleHint =
    primary.docTitle && primary.section
      ? `From **${primary.docTitle}** (${primary.section}):`
      : "From our help center:";

  return [
    titleHint,
    "",
    cleaned + (primary.text.length > 520 ? "…" : ""),
    "",
    "If you need something more specific, ask a follow-up or email support@cyberfield-analytics.example.",
  ].join("\n");
}
