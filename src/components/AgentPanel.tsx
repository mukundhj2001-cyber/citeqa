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
    return r.weak
      ? "Limited match in help center"
      : `Found ${n} related section${n === 1 ? "" : "s"}`;
  }
  if (entry.name === "create_ticket" || entry.name === "escalate_ticket") {
    return r.ticketId ? `Ticket ${r.ticketId}` : "Ticket updated";
  }
  if (entry.name === "notify_team") return "Team notified";
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
}: Props) {
  const pkg = getPackage(packageId);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [showManual, setShowManual] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  if (!pkg.includesAgent) return null;

  const hasTrace = Boolean(toolTrace && toolTrace.length > 0);
  const manualEnabled = !refused && Boolean(question);

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
          message: "Saved to activity log",
          href: "/admin#actions",
        });
      } else {
        setFlash({
          ok: true,
          message: "Team notified",
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

  // Stay quiet until there’s something useful to show
  if (!hasTrace && !showManual && !flash) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowManual(true)}
          className="text-[11px] font-medium text-slate-400 hover:text-indigo-600"
        >
          More actions
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      {hasTrace && (
        <div>
          <button
            type="button"
            onClick={() => setShowTrace((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-[11px] font-semibold text-slate-700">
              Actions taken · {toolTrace!.length}
            </span>
            <span className="text-[10px] font-semibold text-indigo-600">
              {showTrace ? "Hide" : "Show"}
            </span>
          </button>
          {!showTrace && (
            <p className="mt-1 truncate text-[11px] text-slate-500">
              {toolTrace!.map((t) => actionLabel(t.name)).join(" → ")}
            </p>
          )}
          {showTrace && (
            <ol className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">
              {toolTrace!.map((t, i) => (
                <li
                  key={`${t.name}-${i}`}
                  className="flex items-start gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px]"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
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

      <div className={`${hasTrace ? "mt-2 border-t border-slate-100 pt-2" : ""}`}>
        {!showManual ? (
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="text-[11px] font-medium text-slate-500 hover:text-indigo-600"
          >
            More actions
          </button>
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600">
                Quick actions
              </span>
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="text-[10px] text-slate-400 hover:text-slate-600"
              >
                Hide
              </button>
            </div>
            {!manualEnabled ? (
              <p className="text-[11px] text-slate-500">
                Actions unlock after a help-center answer.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void run("ticket")}
                  className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                >
                  {busy === "ticket" ? "Creating…" : "Create ticket"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void run("webhook")}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  {busy === "webhook" ? "Sending…" : "Notify team"}
                </button>
                <Link
                  href="/admin"
                  className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:underline"
                >
                  Operations →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {flash && (
        <div
          className={`mt-2 rounded-lg px-2.5 py-1.5 text-[11px] ${
            flash.ok
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          {flash.message}
          {flash.href && (
            <>
              {" · "}
              <Link href={flash.href} className="font-semibold underline">
                view
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
