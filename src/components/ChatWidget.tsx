"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, Citation } from "@/lib/types";
import type { PackageId } from "@/lib/packages";
import { getPackage } from "@/lib/packages";
import DocsPanel from "@/components/DocsPanel";
import AgentPanel from "@/components/AgentPanel";

const STARTERS = [
  "What’s the refund policy?",
  "I want a refund — please open a ticket",
  "How do I reset my password?",
  "What’s included on Pro?",
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ChatWidget({
  packageId = "premium",
}: {
  packageId?: PackageId;
  onPackageChange?: (id: PackageId) => void;
  compactNav?: boolean;
} = {}) {
  const pkg = getPackage(packageId);
  const useAgent = pkg.includesAgent;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<Citation | null>(null);
  const [sideTab, setSideTab] = useState<"articles" | "library">("articles");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || loading) return;
      setError(null);
      setInput("");
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, userMsg]);
      setLoading(true);
      try {
        const res = await fetch(useAgent ? "/api/agent" : "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Request failed (${res.status})`);
        }
        const data = await res.json();
        const assistant: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          retrieval: data.retrieval,
          mode: data.mode,
          refused: data.refused,
          toolTrace: data.toolTrace,
          planner: data.planner,
          createdAt: new Date().toISOString(),
        };
        setMessages((m) => [...m, assistant]);
        if (data.citations?.[0]) setActiveArticle(data.citations[0]);
        else setActiveArticle(null);
        setSideTab("articles");
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "We couldn’t send that. Please try again."
        );
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [loading, useAgent]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastUser =
    lastAssistant
      ? [...messages]
          .slice(0, messages.indexOf(lastAssistant))
          .reverse()
          .find((m) => m.role === "user")
      : undefined;

  const relatedArticles: Citation[] = (
    lastAssistant?.citations?.length
      ? lastAssistant.citations
      : (lastAssistant?.retrieval || []).map((r) => ({
        chunkId: r.id,
        docTitle: r.docTitle,
        section: r.section,
        snippet: r.snippet,
        score: r.score,
        rank: r.rank,
      }))
  ).slice(0, 3);

  const hasActions =
    useAgent &&
    Boolean(lastAssistant?.toolTrace?.length || lastUser?.content);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-white">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-sm">CF</div>
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"
              aria-hidden
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold tracking-tight text-slate-900">
              Cyberfield Support
            </h1>
            <p className="truncate text-[11px] text-slate-500">
              Online · Answers from the help center
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSideTab("library")}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 lg:hidden"
          >
            Library
          </button>
        </header>

        <div
          className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/70 px-4 py-5 sm:px-6 lg:px-8"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.length === 0 && (
            <EmptyState onPick={(q) => void send(q)} starters={STARTERS} />
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onArticleClick={(c) => {
                setActiveArticle(c);
                setSideTab("articles");
              }}
              activeId={activeArticle?.chunkId}
            />
          ))}
          {loading && (
            <div className="flex items-end gap-2.5">
              <Avatar bot />
              <div className="rounded-2xl rounded-bl-md border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                <div className="flex gap-1.5" aria-label="Assistant is typing">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.2s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
                </div>
              </div>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 sm:px-6">
          <form
            className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor="support-message" className="sr-only">
              Message
            </label>
            <textarea
              id="support-message"
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message Cyberfield Support…"
              className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              disabled={loading}
              aria-label="Message Cyberfield Support"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="mb-0.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </form>

          {hasActions && (
            <div className="mx-auto mt-2 max-h-28 w-full max-w-3xl overflow-y-auto">
              <AgentPanel
                packageId={packageId}
                question={lastUser?.content ?? ""}
                answer={lastAssistant?.content ?? ""}
                citations={lastAssistant?.citations ?? []}
                refused={lastAssistant?.refused}
                toolTrace={lastAssistant?.toolTrace}
                planner={lastAssistant?.planner}
                agentMode
              />
            </div>
          )}
        </div>
      </div>

      {sideTab === "library" && (
        <div className="fixed inset-0 z-40 flex flex-col bg-white lg:hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Help library</h2>
            <button
              type="button"
              onClick={() => setSideTab("articles")}
              className="text-xs font-medium text-indigo-600"
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <DocsPanel />
          </div>
        </div>
      )}

      <aside className="hidden min-h-0 w-[320px] shrink-0 flex-col border-l border-slate-200 bg-[#fafbfc] lg:flex xl:w-[360px]">
        <div className="flex border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setSideTab("articles")}
            className={`flex-1 px-3 py-3 text-xs font-semibold transition ${
              sideTab === "articles"
                ? "border-b-2 border-indigo-600 text-indigo-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Related articles
          </button>
          <button
            type="button"
            onClick={() => setSideTab("library")}
            className={`flex-1 px-3 py-3 text-xs font-semibold transition ${
              sideTab === "library"
                ? "border-b-2 border-indigo-600 text-indigo-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Help library
          </button>
        </div>

        {sideTab === "library" ? (
          <div className="min-h-0 flex-1">
            <DocsPanel />
          </div>
        ) : (
          <>
            <div className="border-b border-slate-100 bg-white px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                From the help center
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Articles used for the latest reply
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {activeArticle ? (
                <div className="rounded-xl border border-indigo-100 bg-white p-3.5 shadow-sm">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                    Reading
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {activeArticle.docTitle}
                  </div>
                  <div className="text-xs text-slate-500">
                    {activeArticle.section}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-700">
                    {activeArticle.snippet}
                  </p>
                </div>
              ) : null}

              {relatedArticles.length > 0 ? (
                <ul className="space-y-2">
                  {relatedArticles.map((r) => (
                    <li key={r.chunkId}>
                      <button
                        type="button"
                        onClick={() => setActiveArticle(r)}
                        className={`w-full rounded-xl border p-3 text-left transition hover:border-indigo-200 hover:bg-white ${
                          activeArticle?.chunkId === r.chunkId
                            ? "border-indigo-300 bg-white shadow-sm"
                            : "border-slate-200/80 bg-white/70"
                        }`}
                      >
                        <div className="text-[12px] font-semibold text-slate-800">
                          {r.docTitle}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          {r.section}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
                          {r.snippet}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    No articles yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Ask a question and related help articles will show here.
                  </p>
                </div>
              )}

              {lastAssistant?.refused && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
                  This isn’t covered in the help center yet — we didn’t invent an
                  answer.
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function EmptyState({
  starters,
  onPick,
}: {
  starters: string[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center py-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xl font-bold text-white shadow-lg shadow-indigo-200/60">CF</div>
      <h2 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
        How can we help?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        Ask about billing, plans, or getting started. We’ll use the Cyberfield help center — and open a ticket when you need a human.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {starters.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function Avatar({ bot }: { bot?: boolean }) {
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
        bot
          ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white"
          : "bg-slate-200 text-slate-600"
      }`}
      aria-hidden
    >
      {bot ? "CF" : "You"}
    </div>
  );
}

function MessageBubble({
  message,
  onArticleClick,
  activeId,
}: {
  message: ChatMessage;
  onArticleClick: (c: Citation) => void;
  activeId?: string;
}) {
  const isUser = message.role === "user";
  const time = formatTime(message.createdAt);
  return (
    <div
      className={`mx-auto flex max-w-3xl items-end gap-2.5 ${
        isUser ? "flex-row-reverse" : ""
      }`}
    >
      <Avatar bot={!isUser} />
      <div className={`max-w-[min(85%,36rem)] ${isUser ? "items-end" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
            isUser
              ? "rounded-br-md bg-indigo-600 text-white"
              : message.refused
                ? "rounded-bl-md border border-amber-200 bg-amber-50 text-amber-950"
                : "rounded-bl-md border border-slate-200/80 bg-white text-slate-800"
          }`}
        >
          <div className="whitespace-pre-wrap">{renderContent(message.content)}</div>
          {!isUser && message.citations && message.citations.length > 0 && (
            <div
              className={`mt-3 border-t pt-2 ${
                message.refused ? "border-amber-200/80" : "border-slate-100"
              }`}
            >
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                From the help center
              </div>
              <div className="flex flex-wrap gap-1.5">
                {message.citations.slice(0, 3).map((c) => (
                  <button
                    key={c.chunkId}
                    type="button"
                    onClick={() => onArticleClick(c)}
                    className={`rounded-lg border px-2 py-1 text-left text-[11px] transition ${
                      activeId === c.chunkId
                        ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300"
                    }`}
                  >
                    <span className="font-semibold">{c.docTitle}</span>
                    <span className="block truncate text-[10px] opacity-70">
                      {c.section}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {time && (
          <div
            className={`mt-1 px-1 text-[10px] text-slate-400 ${
              isUser ? "text-right" : "text-left"
            }`}
          >
            {time}
          </div>
        )}
      </div>
    </div>
  );
}

function renderContent(text: string) {
  const cleaned = text
    .replace(/\s*\(RAG\)/gi, "")
    .replace(/\s*·\s*citations?/gi, "");
  const parts = cleaned.split(/(\*\*[^*]+\*\*|^> .+$)/gm);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("> ")) {
      return (
        <blockquote
          key={i}
          className="my-1 border-l-2 border-indigo-300 pl-2 text-slate-600"
        >
          {p.slice(2)}
        </blockquote>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
