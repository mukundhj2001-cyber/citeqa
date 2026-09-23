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
  toolTrace?: ToolTraceEntry[];
  planner?: string;
  agentMode?: boolean;
};

type Flash = { ok: boolean; message: string; href?: string } | null;

const ACTION_LABELS: Record<string, string> = {
  search_docs: "Looked up help articles",
  create_ticket: "Opened a support ticket",
  escalate_ticket: "Escalated to the team",
  notify_team: "Notified the team",
  record_knowledge_gap: "Logged a knowledge gap",
  log_crm_note: "Added a CRM note",
};

function actionLabel(name: string): string {
  return ACTION_LABELS[name] || name.replace(/_/g, " ");
}

function summarizeResult(entry: ToolTraceEntry): string {
  const r = entry.result as Record<string, unknown> | null;
  if (!r) return entry.ok ? "Done" : "Couldn’t complete";
  if (typeof r.error === "string") return r.error;
  if (entry.name === "search_docs") {
    const n = Array.isArray(r.chunks) ? r.chunks.length : 0;
    return r.weak ? "Limited match in help center" : `Found ${n} related section${n === 1 ? "" : "s"}`;
  }
  if (entry.name === "create_ticket" || entry.name === "escalate_ticket") {
    return r.ticketId ? `Ticket ${r.ticketId}` : "Ticket updated";
  }
  if (entry.name === "notify_team") {
    return r.simulated ? "Team notified" : String(r.result ?? "Sent");
  }
  if (entry.name === "record_knowledge_gap") {
    return String(r.topic ?? "Logged for the docs team");
  }
  if (entry.name === "log_crm_note") return "Note saved";
  return entry.ok ? "Done" : "Couldn’t complete";
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
  void planner;
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
          message: "Saved to the activity log",
          href: "/admin#actions",
        });
      } else {
        setFlash({
          ok: true,
          message: data.simulated
            ? "Team notification recorded"
            : `Notification sent`,
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
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500">
        Ticket creation and team notifications are available on the{" "}
        <span className="font-semibold text-indigo-700">Premium</span> plan.
      </div>
    );
  }

  const hasTrace = Boolean(toolTrace && toolTrace.length > 0);

  return (
    <div className="rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50/60 px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
            {agentMode ? "Assistant actions" : "Quick actions"}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-600">
            {agentMode
              ? "Can look up docs, open tickets, and notify your team."
              : "Run a follow-up action on the latest answer."}
          </p>
        </div>
        <Link
          href="/admin"
          className="text-[11px] font-semibold text-indigo-700 hover:underline"
        >
          Operations →
        </Link>
      </div>

      {hasTrace && (
        <div className="mt-2 rounded-lg border border-violet-200/80 bg-white/90 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowTrace((v) => !v)}
              className="flex items-center gap-2 text-left"
            >
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-violet-700">
                Actions taken · {toolTrace!.length}
              </h3>
              <span className="text-[10px] font-semibold text-indigo-600">
                {showTrace ? "Hide" : "Show"}
              </span>
            </button>
          </div>
          {!showTrace && (
            <p className="mt-1 truncate text-[11px] text-slate-500">
              {toolTrace!.map((t) => actionLabel(t.name)).join(" → ")}
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
                    <div className="font-semibold text-slate-800">
                      {actionLabel(t.name)}
                    </div>
                    <div className="mt-0.5 truncate text-slate-500">
                      {summarizeResult(t)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {!hasTrace && agentMode && !question && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          Try: “I want a refund, create a ticket and notify the team”
        </p>
      )}

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="text-[11px] font-semibold text-violet-700 hover:underline"
        >
          {showManual ? "Hide more actions" : "More actions"}
        </button>
        {showManual && (
          <div className="mt-2">
            {!manualEnabled ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                Actions unlock after a grounded help-center answer.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void run("ticket")}
                  className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-600 disabled:opacity-40"
                >
                  {busy === "ticket" ? "Creating…" : "Create ticket"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void run("log")}
                  className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-800 transition hover:bg-violet-50 disabled:opacity-40"
                >
                  {busy === "log" ? "Saving…" : "Log activity"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void run("webhook")}
                  className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-800 transition hover:bg-violet-50 disabled:opacity-40"
                >
                  {busy === "webhook" ? "Sending…" : "Notify team"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {flash && (
        <div
          className={`mt-2 rounded-lg px-3 py-2 text-xs ${
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
                view in operations
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
