"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, Citation } from "@/lib/types";
import type { PackageId } from "@/lib/packages";
import { getPackage } from "@/lib/packages";
import DocsPanel from "@/components/DocsPanel";
import AgentPanel from "@/components/AgentPanel";

const STARTERS = [
  "What’s the refund policy?",
  "I want a refund, create a ticket and notify the team",
  "What’s your HIPAA SLA?",
  "How do I reset my password?",
  "What’s on Pro?",
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ChatWidget({
  packageId = "premium",
  onPackageChange,
  compactNav = false,
}: {
  packageId?: PackageId;
  onPackageChange?: (id: PackageId) => void;
  compactNav?: boolean;
} = {}) {
  const pkg = getPackage(packageId);
  void compactNav;
  void onPackageChange;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<Citation | null>(null);
  const [agentMode, setAgentMode] = useState(packageId === "premium");
  const [sideTab, setSideTab] = useState<"articles" | "library">("articles");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (packageId === "premium") setAgentMode(true);
    else setAgentMode(false);
  }, [packageId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || loading) return;
      setError(null);
      setInput("");
      const userMsg: ChatMessage = { id: uid(), role: "user", content: message };
      setMessages((m) => [...m, userMsg]);
      setLoading(true);
      try {
        const useAgent = agentMode && pkg.includesAgent;
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
        };
        setMessages((m) => [...m, assistant]);
        if (data.citations?.[0]) setActiveArticle(data.citations[0]);
        else setActiveArticle(null);
        setSideTab("articles");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [loading, agentMode, pkg.includesAgent]
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
      ? [...messages].slice(0, messages.indexOf(lastAssistant)).reverse().find((m) => m.role === "user")
      : undefined;

  const relatedArticles: Citation[] =
    lastAssistant?.citations?.length
      ? lastAssistant.citations
      : (lastAssistant?.retrieval || []).slice(0, 5).map((r) => ({
          chunkId: r.id,
          docTitle: r.docTitle,
          section: r.section,
          snippet: r.snippet,
          score: r.score,
          rank: r.rank,
        }));

  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-white">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-indigo-500/30 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-sm font-bold backdrop-blur">
            NS
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight">
                Northstar Support
              </h1>
              {pkg.includesAgent && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAgentMode(true)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                      agentMode
                        ? "bg-white text-violet-700"
                        : "bg-white/15 text-white hover:bg-white/25"
                    }`}
                  >
                    Auto actions
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgentMode(false)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                      !agentMode
                        ? "bg-white text-indigo-700"
                        : "bg-white/15 text-white hover:bg-white/25"
                    }`}
                  >
                    Answers only
                  </button>
                </div>
              )}
            </div>
            <p className="truncate text-[11px] text-indigo-100">
              We answer from the Northstar help center
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/80 px-4 py-4 sm:px-6 lg:px-8">
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
            <div className="flex items-start gap-3">
              <Avatar bot />
              <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.2s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about refunds, billing, password reset…"
              className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => void send(input)}
              disabled={loading || !input.trim()}
              className="mb-0.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </div>
          <div className="mx-auto mt-2 flex w-full max-w-3xl items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSideTab("library")}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-700 lg:hidden"
            >
              Help library
            </button>
          </div>

          {pkg.includesAgent && (
            <div className="mx-auto mt-2 max-h-32 w-full max-w-3xl overflow-y-auto">
              <AgentPanel
                packageId={packageId}
                question={lastUser?.content ?? ""}
                answer={lastAssistant?.content ?? ""}
                citations={lastAssistant?.citations ?? []}
                refused={lastAssistant?.refused}
                toolTrace={lastAssistant?.toolTrace}
                planner={lastAssistant?.planner}
                agentMode={agentMode}
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

      <aside className="hidden min-h-0 w-[320px] shrink-0 flex-col border-l border-slate-200 bg-slate-50/50 lg:flex xl:w-[360px]">
        <div className="flex border-b border-slate-100">
          <button
            type="button"
            onClick={() => setSideTab("articles")}
            className={`flex-1 px-3 py-2.5 text-xs font-semibold transition ${
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
            className={`flex-1 px-3 py-2.5 text-xs font-semibold transition ${
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
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">
                From your help center
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Articles used for the latest answer
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {activeArticle ? (
                <div className="rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                    Opened article
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {activeArticle.docTitle}
                  </div>
                  <div className="text-xs text-slate-500">{activeArticle.section}</div>
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
                        className={`w-full rounded-lg border p-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40 ${
                          activeArticle?.chunkId === r.chunkId
                            ? "border-indigo-300 bg-indigo-50/60"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="text-[11px] font-semibold text-slate-800">
                          {r.docTitle}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          {r.section}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[11px] text-slate-600">
                          {r.snippet}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
                  Related help articles will appear here after you ask a question
                </div>
              )}

              {lastAssistant?.refused && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  This isn’t covered in the help center yet — we didn’t guess.
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
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center py-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-xl font-bold text-indigo-700">
        NS
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">
        How can we help?
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Ask about billing, plans, or getting started — we’ll pull from the
        Northstar help center.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {starters.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800"
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
        bot ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
      }`}
    >
      {bot ? "NS" : "You"}
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
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar bot={!isUser} />
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "rounded-tr-md bg-indigo-600 text-white"
            : message.refused
              ? "rounded-tl-md border border-amber-200 bg-amber-50 text-amber-950"
              : "rounded-tl-md border border-slate-200 bg-white text-slate-800"
        }`}
      >
        <div className="whitespace-pre-wrap">{renderContent(message.content)}</div>
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              From your help center
            </div>
            <div className="flex flex-wrap gap-1.5">
              {message.citations.map((c) => (
                <button
                  key={c.chunkId}
                  type="button"
                  onClick={() => onArticleClick(c)}
                  className={`rounded-md border px-2 py-1 text-left text-[11px] transition ${
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
