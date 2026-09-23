"use client";

import { useState } from "react";
import type { Citation } from "@/lib/types";
import type { PackageId } from "@/lib/packages";
import { getPackage } from "@/lib/packages";
import type { ToolTraceEntry } from "@/lib/action-types";
import Link from "next/link";

type Props = {
  question: string;
  answer: string;
  citations: Citation[];
  refused?: boolean;
  packageId: PackageId;
  /** When agent mode produced a tool trace for the last turn */
  toolTrace?: ToolTraceEntry[];
  planner?: string;
  agentMode?: boolean;
};

type Flash = { ok: boolean; message: string; href?: string } | null;

function summarizeResult(entry: ToolTraceEntry): string {
  const r = entry.result as Record<string, unknown> | null;
  if (!r) return entry.ok ? "ok" : "failed";
  if (typeof r.error === "string") return r.error;
  if (entry.name === "search_docs") {
    const chunks = Array.isArray(r.chunks) ? r.chunks.length : 0;
    return r.weak ? `weak · ${chunks} chunks` : `top ${r.topScore} · ${chunks} chunks`;
  }
  if (entry.name === "create_ticket" || entry.name === "escalate_ticket") {
    return String(r.ticketId ?? "ticket");
  }
  if (entry.name === "notify_team") {
    return r.simulated ? "simulated" : String(r.result ?? "ok");
  }
  if (entry.name === "record_knowledge_gap") {
    return String(r.topic ?? r.gapId ?? "logged");
  }
  if (entry.name === "log_crm_note") return "logged";
  return entry.ok ? "ok" : "failed";
}

export default function AgentPanel({
  question,
  answer,
  citations,
  refused,
  packageId,
  toolTrace,
  planner,
  agentMode,
}: Props) {
  const pkg = getPackage(packageId);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [showManual, setShowManual] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  const manualEnabled = pkg.includesAgent && !refused && Boolean(question);

  const run = async (kind: "ticket" | "log" | "webhook") => {
    if (!manualEnabled || busy) return;
    setFlash(null);
    setBusy(kind);
    try {
      const path =
        kind === "ticket"
          ? "/api/actions/ticket"
          : kind === "log"
            ? "/api/actions/log"
            : "/api/actions/webhook";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          answer,
          citations,
          subject: `Support: ${question.slice(0, 80)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || data.detail || `Action failed (${res.status})`);
      }
      if (kind === "ticket") {
        setFlash({
          ok: true,
          message: `Ticket ${data.ticket?.id} created`,
          href: "/admin#tickets",
        });
      } else if (kind === "log") {
        setFlash({
          ok: true,
          message: "Logged to action sheet (CSV)",
          href: "/admin#actions",
        });
      } else {
        setFlash({
          ok: true,
          message: data.simulated
            ? "Webhook simulated (set WEBHOOK_URL) · logged locally"
            : `Webhook ${data.result}: ${data.detail}`,
          href: "/admin#actions",
        });
      }
    } catch (e) {
      setFlash({
        ok: false,
        message: e instanceof Error ? e.message : "Action failed",
      });
    } finally {
      setBusy(null);
    }
  };

  if (!pkg.includesAgent) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">Tool-calling agent</span> is a{" "}
        <span className="font-medium text-indigo-700">Premium</span> feature. Switch
        package above or open the Premium demo for autonomous multi-step tools +
        admin audit trail.
      </div>
    );
  }

  const hasTrace = Boolean(toolTrace && toolTrace.length > 0);

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50/60 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
            Premium · {agentMode ? "agent mode" : "manual tools"}
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            {agentMode
              ? "Autonomous tool loop — search, ticket, notify, gaps. Trace below."
              : "Manual actions on a grounded answer (citations travel with every action)."}
          </p>
        </div>
        <Link
          href="/admin"
          className="text-[11px] font-semibold text-indigo-700 hover:underline"
        >
          View admin →
        </Link>
      </div>

      {/* Tool trace panel — collapsed by default so chat viewport stays tall */}
      {hasTrace && (
        <div className="mt-3 rounded-lg border border-violet-200/80 bg-white/90 p-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowTrace((v) => !v)}
              className="flex items-center gap-2 text-left"
            >
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-violet-700">
                Tool trace · {toolTrace!.length} step{toolTrace!.length === 1 ? "" : "s"}
              </h3>
              <span className="text-[10px] font-semibold text-indigo-600">
                {showTrace ? "Hide" : "Show"}
              </span>
            </button>
            {planner && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800">
                planner: {planner}
              </span>
            )}
          </div>
          {!showTrace && (
            <p className="mt-1.5 truncate text-[11px] text-slate-500">
              {toolTrace!.map((t) => t.name).join(" → ")}
            </p>
          )}
          {showTrace && (
            <ol className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
              {toolTrace!.map((t, i) => (
                <li
                  key={`${t.name}-${i}`}
                  className="flex items-start gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-[11px]"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <code className="font-semibold text-slate-800">{t.name}</code>
                      <span
                        className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
                          t.ok
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {t.ok ? "ok" : "err"}
                      </span>
                      {typeof t.ms === "number" && (
                        <span className="text-[10px] text-slate-400">{t.ms}ms</span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-slate-500">
                      {summarizeResult(t)}
                    </div>
                    {Object.keys(t.args || {}).length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[10px] text-indigo-600">
                          args
                        </summary>
                        <pre className="mt-1 max-h-20 overflow-auto rounded bg-slate-900/90 p-1.5 text-[9px] text-slate-100">
                          {JSON.stringify(t.args, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {!hasTrace && agentMode && !question && (
        <p className="mt-3 text-xs text-slate-500">
          Ask something like “I want a refund, create a ticket and notify the team”
          — the agent will call tools and show the trace here.
        </p>
      )}

      {/* Manual tools (secondary) */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="text-[11px] font-semibold text-violet-700 hover:underline"
        >
          {showManual ? "Hide manual tools" : "Show manual tools (optional)"}
        </button>
        {showManual && (
          <div className="mt-2">
            {!manualEnabled ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                Manual actions stay locked until CiteQA returns a grounded answer
                with citations.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void run("ticket")}
                  className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-600 disabled:opacity-40"
                >
                  {busy === "ticket" ? "Creating…" : "Create support ticket"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void run("log")}
                  className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-800 transition hover:bg-violet-50 disabled:opacity-40"
                >
                  {busy === "log" ? "Logging…" : "Log to sheet"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void run("webhook")}
                  className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-800 transition hover:bg-violet-50 disabled:opacity-40"
                >
                  {busy === "webhook" ? "Sending…" : "Send webhook"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {flash && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            flash.ok
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {flash.message}
          {flash.href && (
            <>
              {" · "}
              <Link href={flash.href} className="font-semibold underline">
                open in admin
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
