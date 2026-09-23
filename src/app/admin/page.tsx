"use client";

import { useCallback, useEffect, useState } from "react";
import DocsPanel from "@/components/DocsPanel";
import type { Ticket, ActionLogEntry } from "@/lib/action-types";

type EvalSummary = {
  ok: boolean;
  passed: number;
  failed: number;
  total: number;
  ranAt?: string;
  results?: {
    id: string;
    pass: boolean;
    mode: string;
    refused: boolean;
    topLabel: string;
    reasons: string[];
  }[];
};

type Tab = "docs" | "tickets" | "actions" | "eval";

function formatWhen(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("tickets");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [logs, setLogs] = useState<ActionLogEntry[]>([]);
  const [evalSummary, setEvalSummary] = useState<EvalSummary | null>(null);
  const [evalBusy, setEvalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateOk, setGateOk] = useState(true);
  const [password, setPassword] = useState("");
  const [needsGate, setNeedsGate] = useState(false);

  useEffect(() => {
    const required =
      typeof window !== "undefined"
        ? sessionStorage.getItem("citeqa_admin_ok")
        : null;
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        if (d.adminPasswordRequired && required !== "1") {
          setNeedsGate(true);
          setGateOk(false);
        }
      })
      .catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [tRes, lRes, eRes] = await Promise.all([
        fetch("/api/tickets"),
        fetch("/api/actions/log"),
        fetch("/api/eval"),
      ]);
      const t = await tRes.json();
      const l = await lRes.json();
      const e = await eRes.json();
      if (t.ok) setTickets(t.tickets || []);
      if (l.ok) setLogs(l.entries || []);
      if (e.ok && e.last) setEvalSummary(e.last as EvalSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load operations data");
    }
  }, []);

  useEffect(() => {
    if (gateOk) void refresh();
  }, [gateOk, refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (hash === "tickets") setTab("tickets");
    if (hash === "actions") setTab("actions");
    if (hash === "docs") setTab("docs");
    if (hash === "eval") setTab("eval");
  }, []);

  const runEval = async () => {
    setEvalBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/eval", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Quality check failed");
      setEvalSummary(data.summary);
      setTab("eval");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quality check failed");
    } finally {
      setEvalBusy(false);
    }
  };

  const tryUnlock = async () => {
    const res = await fetch("/api/admin/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res?.ok) {
      sessionStorage.setItem("citeqa_admin_ok", "1");
      setGateOk(true);
      setNeedsGate(false);
      return;
    }
    if (!needsGate) {
      setGateOk(true);
      return;
    }
    setError("Incorrect password");
  };

  if (!gateOk) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">Operations access</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter the operations password to continue.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void tryUnlock();
            }}
            className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Password"
            aria-label="Operations password"
          />
          <button
            type="button"
            onClick={() => void tryUnlock()}
            className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white"
          >
            Continue
          </button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      </main>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "tickets", label: "Tickets" },
    { id: "actions", label: "Activity" },
    { id: "docs", label: "Knowledge" },
    { id: "eval", label: "Quality" },
  ];

  return (
    <main className="flex flex-1 flex-col bg-slate-50/50">
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Operations
            </h1>
            <p className="text-sm text-slate-500">
              Tickets, activity, knowledge library, and quality checks
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                if (typeof window !== "undefined") {
                  window.history.replaceState(
                    null,
                    "",
                    `#${t.id === "actions" ? "actions" : t.id}`
                  );
                }
              }}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                tab === t.id
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
              {t.id === "tickets" ? ` (${tickets.length})` : ""}
              {t.id === "actions" ? ` (${logs.length})` : ""}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5">
          {tab === "docs" && (
            <div className="h-[min(640px,70vh)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <DocsPanel />
            </div>
          )}

          {tab === "tickets" && (
            <div id="tickets" className="space-y-3">
              {tickets.length === 0 ? (
                <Empty
                  title="No tickets yet"
                  body="When customers ask for help that needs a human, tickets created from Help chat appear here."
                />
              ) : (
                tickets.map((t) => (
                  <article
                    key={t.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-slate-400">{t.id}</div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {t.subject}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            t.status === "escalated"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {t.status}
                        </span>
                        {t.priority === "high" && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                            high
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatWhen(t.createdAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {t.body.slice(0, 600)}
                      {t.body.length > 600 ? "…" : ""}
                    </p>
                    {t.citations?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {t.citations.map((c, i) => (
                          <span
                            key={i}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-700"
                          >
                            {c.docTitle} · {c.section}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          )}

          {tab === "actions" && (
            <div
              id="actions"
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              {logs.length === 0 ? (
                <div className="p-4">
                  <Empty
                    title="No activity yet"
                    body="Tickets, notifications, and other assistant actions will be listed here."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">When</th>
                        <th className="px-3 py-2.5 font-semibold">Action</th>
                        <th className="px-3 py-2.5 font-semibold">Result</th>
                        <th className="px-3 py-2.5 font-semibold">Question</th>
                        <th className="px-3 py-2.5 font-semibold">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((row, i) => (
                        <tr
                          key={`${row.timestamp}-${i}`}
                          className="border-b border-slate-50 align-top hover:bg-slate-50/80"
                        >
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">
                            {formatWhen(row.timestamp)}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800">
                            {row.action}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                row.result === "ok" ||
                                row.result === "pass" ||
                                row.result === "simulated"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-800"
                              }`}
                            >
                              {row.result}
                            </span>
                          </td>
                          <td className="max-w-[200px] truncate px-3 py-2.5 text-slate-600">
                            {row.question}
                          </td>
                          <td className="max-w-[240px] truncate px-3 py-2.5 text-slate-500">
                            {row.detail}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "eval" && (
            <div id="eval" className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">
                  Quality checks
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Run a fixed set of support questions to confirm answers stay
                  grounded in the help center.
                </p>
                <button
                  type="button"
                  disabled={evalBusy}
                  onClick={() => void runEval()}
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                >
                  {evalBusy ? "Running…" : "Run quality check"}
                </button>
              </div>

              {evalSummary ? (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                        evalSummary.ok
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {evalSummary.ok ? "Healthy" : "Needs attention"}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">
                      {evalSummary.passed}/{evalSummary.total} passed
                      {evalSummary.failed
                        ? ` · ${evalSummary.failed} failed`
                        : ""}
                    </span>
                    {evalSummary.ranAt && (
                      <span className="text-xs text-slate-400">
                        {formatWhen(evalSummary.ranAt)}
                      </span>
                    )}
                  </div>
                  <ul className="mt-4 space-y-2">
                    {(evalSummary.results || []).map((r) => (
                      <li
                        key={r.id}
                        className="rounded-lg border border-slate-100 px-3 py-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`font-bold ${
                              r.pass ? "text-emerald-700" : "text-red-700"
                            }`}
                          >
                            {r.pass ? "Pass" : "Fail"}
                          </span>
                          <span className="font-medium text-slate-700">
                            {r.id}
                          </span>
                        </div>
                        <div className="mt-0.5 text-slate-500">{r.topLabel}</div>
                        {r.reasons?.map((x, i) => (
                          <div key={i} className="text-slate-500">
                            → {x}
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Empty
                  title="No quality results yet"
                  body="Run a quality check to confirm the assistant is answering from the help center."
                />
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center shadow-sm">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
        {body}
      </p>
    </div>
  );
}
