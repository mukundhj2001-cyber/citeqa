/**
 * Local Ollama client (privacy-first answer generation).
 * Uses Ollama's OpenAI-compatible chat API at {base}/v1/chat/completions.
 */

const DEFAULT_BASE = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.2";
const HEALTH_TIMEOUT_MS = 1500;
const GENERATE_TIMEOUT_MS = 90_000;

export function getOllamaBaseUrl(): string {
  const raw = process.env.OLLAMA_BASE_URL?.trim();
  if (!raw) return DEFAULT_BASE;
  return raw.replace(/\/+$/, "");
}

export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL;
}

/** Quick reachability probe — does not throw. */
export async function isOllamaReachable(): Promise<boolean> {
  const base = getOllamaBaseUrl();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/tags`, {
      method: "GET",
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Chat completion via Ollama OpenAI-compatible endpoint.
 * Throws on network / non-OK / empty response so callers can fall back.
 */
export async function ollamaChat(
  messages: OllamaChatMessage[],
  opts?: { model?: string; temperature?: number }
): Promise<string> {
  const base = getOllamaBaseUrl();
  const model = opts?.model || getOllamaModel();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GENERATE_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        temperature: opts?.temperature ?? 0.2,
        messages,
        stream: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Ollama chat failed (${res.status}): ${body.slice(0, 200) || res.statusText}`
      );
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Ollama returned empty content");
    return content;
  } finally {
    clearTimeout(timer);
  }
}
