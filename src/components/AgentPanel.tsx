"use client";

import { useState } from "react";
import type { Citation } from "@/lib/types";
import type { PackageId } from "@/lib/packages";
import { getPackage } from "@/lib/packages";
import Link from "next/link";

type Props = {
  question: string;
  answer: string;
  citations: Citation[];
  refused?: boolean;
  packageId: PackageId;
};

type Flash = { ok: boolean; message: string; href?: string } | null;

export default function AgentPanel({
  question,
  answer,
  citations,
  refused,
  packageId,
}: Props) {
  const pkg = getPackage(packageId);
  const enabled = pkg.includesAgent && !refused && Boolean(question);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);

  const run = async (kind: "ticket" | "log" | "webhook") => {
    if (!enabled || busy) return;
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
        <span className="font-semibold text-slate-700">Agent actions</span> are a{" "}
        <span className="font-medium text-indigo-700">Premium</span> feature. Switch
        package above or open the Premium demo to create tickets, log to sheet, and
        call webhooks from grounded answers.
      </div>
    );
  }

  if (refused || !question) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
        Agent actions stay locked until CiteQA returns a grounded answer with
        citations — we never invent policy into tickets or webhooks.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50/60 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
            Premium · agent actions
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            Act on this grounded answer — citations travel with every action.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-[11px] font-semibold text-indigo-700 hover:underline"
        >
          View admin →
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
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
