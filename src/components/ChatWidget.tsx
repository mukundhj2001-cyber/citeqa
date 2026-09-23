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

function scoreBar(score: number) {
  const pct = Math.min(100, Math.round(score * 100));
  return pct;
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [showRetrieval, setShowRetrieval] = useState(true);
  const [agentMode, setAgentMode] = useState(packageId === "premium");
  const [sideTab, setSideTab] = useState<"sources" | "docs">("sources");
  const [indexInfo, setIndexInfo] = useState<string>("Indexing…");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        const mode =
          d.generationMode === "ollama"
            ? ` · Ollama (${d.ollamaModel || "local"})`
            : d.generationMode === "openai"
              ? " · OpenAI"
              : " · offline quotes";
        setIndexInfo(`${d.chunkCount} chunks · ${d.docCount} docs${mode}`);
      })
      .catch(() => setIndexInfo("Index ready on first question"));
  }, []);


  useEffect(() => {
    // Premium defaults to Agent mode; Basic/Standard force classic chat.
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
        if (data.citations?.[0]) setActiveCitation(data.citations[0]);
        else setActiveCitation(null);
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


  return (
    <div className="flex h-[min(70vh,720px)] min-h-[28rem] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
      {/* Main chat column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold backdrop-blur">
            CQ
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight">CiteQA</h1>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                {pkg.name} demo
              </span>
            </div>
            <p className="truncate text-xs text-indigo-100">
              Support answers grounded in your docs · Northstar Analytics KB
            </p>
          </div>
          <div className="hidden text-right text-[10px] text-indigo-100 sm:block">
            <div className="font-medium text-white/90">Index</div>
            <div>{indexInfo}</div>
          </div>
        </header>

        {/* Messages — flexible grow area; must keep min-h-0 so sibling composer cannot crush it */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/80 px-4 py-5 sm:px-6">
          {messages.length === 0 && (
            <EmptyState onPick={(q) => void send(q)} starters={STARTERS} />
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onCitationClick={(c) => {
                setActiveCitation(c);
              }}
              activeId={activeCitation?.chunkId}
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

        {/* Composer + agent controls — fixed height; traces scroll inside, not into messages */}
        <div className="shrink-0 border-t border-slate-100 bg-white p-4">
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about refunds, Pro plan, password reset…"
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
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Answers cite your indexed docs · weak matches refuse rather than invent policy
          </p>
          <button
            type="button"
            onClick={() => setSideTab("docs")}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-indigo-700 lg:hidden"
          >
            Manage uploads & re-index
          </button>

          {pkg.includesAgent && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Mode
              </span>
              <button
                type="button"
                onClick={() => setAgentMode(true)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  agentMode
                    ? "bg-violet-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Agent
              </button>
              <button
                type="button"
                onClick={() => setAgentMode(false)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  !agentMode
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Classic chat
              </button>
              <span className="text-[10px] text-slate-400">
                {agentMode
                  ? "Calls /api/agent · multi-step tools"
                  : "Calls /api/chat · manual actions only"}
              </span>
            </div>
          )}

          {onPackageChange && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Package
              </span>
              {(["basic", "standard", "premium"] as PackageId[]).map((id) => {
                const p = getPackage(id);
                const active = packageId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onPackageChange(id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                      active
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}

          <div
            className={`mt-3 max-h-44 overflow-y-auto ${pkg.includesAgent ? "" : "opacity-70"}`}
          >
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
        </div>
      </div>

      {/* Mobile docs drawer */}
      {sideTab === "docs" && (
        <div className="fixed inset-0 z-40 flex flex-col bg-white lg:hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Knowledge base</h2>
            <button
              type="button"
              onClick={() => setSideTab("sources")}
              className="text-xs font-medium text-indigo-600"
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <DocsPanel onIndexChange={setIndexInfo} />
          </div>
        </div>
      )}

      {/* Side panel */}
      <aside className="hidden min-h-0 w-[340px] shrink-0 flex-col border-l border-slate-200 bg-white lg:flex">
        <div className="flex border-b border-slate-100">
          <button
            type="button"
            onClick={() => setSideTab("sources")}
            className={`flex-1 px-3 py-2.5 text-xs font-semibold transition ${
              sideTab === "sources"
                ? "border-b-2 border-indigo-600 text-indigo-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Sources
          </button>
          <button
            type="button"
            onClick={() => setSideTab("docs")}
            className={`flex-1 px-3 py-2.5 text-xs font-semibold transition ${
              sideTab === "docs"
                ? "border-b-2 border-indigo-600 text-indigo-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Docs
          </button>
        </div>

        {sideTab === "docs" ? (
          <div className="min-h-0 flex-1">
            <DocsPanel onIndexChange={setIndexInfo} />
          </div>
        ) : (
          <>
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Sources & retrieval</h2>
            <button
              type="button"
              onClick={() => setShowRetrieval((v) => !v)}
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-500"
            >
              {showRetrieval ? "Hide ranks" : "Show ranks"}
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Click a citation to open the source snippet
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {activeCitation ? (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                Open source
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {activeCitation.docTitle}
              </div>
              <div className="text-xs text-slate-500">{activeCitation.section}</div>
              <p className="mt-2 text-xs leading-relaxed text-slate-700">
                {activeCitation.snippet}
              </p>
              <div className="mt-2 text-[10px] text-slate-400">
                Rank #{activeCitation.rank} · score {activeCitation.score}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
              Citations from the latest answer appear here
            </div>
          )}

          {showRetrieval && lastAssistant?.retrieval && lastAssistant.retrieval.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Top retrieved chunks
              </h3>
              <ul className="space-y-2">
                {lastAssistant.retrieval.map((r) => (
                  <li
                    key={r.id}
                    className="cursor-pointer rounded-lg border border-slate-200 p-2.5 transition hover:border-indigo-200 hover:bg-indigo-50/40"
                    onClick={() =>
                      setActiveCitation({
                        chunkId: r.id,
                        docTitle: r.docTitle,
                        section: r.section,
                        snippet: r.snippet,
                        score: r.score,
                        rank: r.rank,
                      })
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-800">
                        #{r.rank} {r.docTitle}
                      </span>
                      <span className="text-[10px] tabular-nums text-slate-500">
                        {r.score.toFixed(3)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">{r.section}</div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${scoreBar(r.score)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[11px] text-slate-600">
                      {r.snippet}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lastAssistant?.refused && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Weak retrieval — answer refused rather than inventing policy.
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
    <div className="mx-auto max-w-md py-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-xl font-bold text-indigo-700">
        CQ
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">
        Ask Northstar support docs
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        CiteQA retrieves from the knowledge base and cites every claim. Topics
        outside the corpus are refused.
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
      <p className="mt-4 text-[11px] text-slate-400">
        Try an out-of-corpus question, or open the <span className="font-medium text-slate-500">Docs</span> tab to upload your own.
      </p>
    </div>
  );
}

function Avatar({ bot }: { bot?: boolean }) {
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
        bot
          ? "bg-indigo-600 text-white"
          : "bg-slate-200 text-slate-600"
      }`}
    >
      {bot ? "CQ" : "You"}
    </div>
  );
}

function MessageBubble({
  message,
  onCitationClick,
  activeId,
}: {
  message: ChatMessage;
  onCitationClick: (c: Citation) => void;
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
        {!isUser && message.mode && (
          <div className="mt-2 text-[10px] uppercase tracking-wide opacity-60">
            {message.mode === "agent"
              ? "Agent + tools + citations"
              : message.mode === "ollama"
                ? "Ollama (local) + citations"
                : message.mode === "openai"
                  ? "OpenAI + citations"
                  : message.mode === "refuse"
                    ? "Refused · not in docs"
                    : "Offline retrieval quotes"}
          </div>
        )}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
            {message.citations.map((c) => (
              <button
                key={c.chunkId}
                type="button"
                onClick={() => onCitationClick(c)}
                className={`rounded-md border px-2 py-1 text-left text-[11px] transition ${
                  activeId === c.chunkId
                    ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300"
                }`}
              >
                <span className="font-semibold">[{c.rank}]</span> {c.docTitle}
                <span className="block truncate text-[10px] opacity-70">
                  {c.section}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderContent(text: string) {
  // Lightweight markdown-ish: **bold** and > quotes
  const parts = text.split(/(\*\*[^*]+\*\*|^> .+$)/gm);
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
