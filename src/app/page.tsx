import Link from "next/link";
import { PACKAGES } from "@/lib/packages";

const STEPS = [
  {
    n: "01",
    title: "Connect your help docs",
    body: "Ship with a sample help center, or upload your own articles anytime.",
  },
  {
    n: "02",
    title: "Customers get clear answers",
    body: "Every reply points back to the help articles it used — no invented policy.",
  },
  {
    n: "03",
    title: "Escalate when needed",
    body: "Premium can open tickets, notify your team, and keep a clean activity trail.",
  },
];

const FEATURES = [
  {
    title: "Answers from your docs",
    body: "The assistant stays inside your help center so customers get trustworthy guidance.",
  },
  {
    title: "Articles you can open",
    body: "Related help articles appear beside the chat — titles and short excerpts, ready to share.",
  },
  {
    title: "Honest when unsure",
    body: "If it isn’t in your docs, the bot says so instead of guessing.",
  },
  {
    title: "Upload & refresh",
    body: "Add .md / .txt / .pdf articles and refresh the library in one click.",
  },
  {
    title: "Quality before you ship",
    body: "Run built-in checks so support answers stay consistent.",
  },
  {
    title: "Actions for your team",
    body: "Premium opens tickets, escalates, and notifies ops — with a clear actions-taken summary.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-indigo-50 via-white to-slate-50">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Support chat for your help center
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Support answers{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              grounded in your docs
            </span>
            — then act on them.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            CiteQA is a help-center assistant that answers from your documentation,
            shows the articles it used, and on Premium can open tickets or notify
            your team.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-300/40 transition hover:bg-indigo-500"
            >
              Open support chat
            </Link>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50"
            >
              Operations
            </Link>
            <a
              href="#packages"
              className="rounded-xl px-5 py-3 text-sm font-semibold text-indigo-700 hover:underline"
            >
              See plans ↓
            </a>
          </div>
          <p className="mt-6 text-xs text-slate-500">
            Private by default · works with your existing help articles
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">
          How it works
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">
          A support experience your customers will recognize in under a minute.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="text-xs font-bold tracking-widest text-indigo-500">
                {s.n}
              </div>
              <h3 className="mt-2 text-base font-semibold text-slate-900">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Built for customer support
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
              >
                <h3 className="text-sm font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="packages" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">
          Basic · Standard · Premium
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">
          Choose the plan that matches how hands-on you want the assistant to be.
          The live chat defaults to{" "}
          <strong className="font-semibold text-violet-700">Premium</strong>.
        </p>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PACKAGES.map((p) => (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                p.highlight
                  ? "border-violet-400 ring-2 ring-violet-200"
                  : "border-slate-200"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Recommended
                </span>
              )}
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {p.priceLabel}
              </div>
              <h3 className="mt-1 text-xl font-bold text-slate-900">{p.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{p.tagline}</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 text-emerald-500">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/demo"
                className={`mt-6 block rounded-xl py-2.5 text-center text-sm font-semibold transition ${
                  p.highlight
                    ? "bg-violet-600 text-white hover:bg-violet-500"
                    : "border border-slate-200 bg-slate-50 text-slate-800 hover:border-indigo-300 hover:bg-indigo-50"
                }`}
              >
                {p.highlight ? "Try Premium chat" : `Preview ${p.name}`}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-12 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="text-xl font-bold text-white">
              See it as your customers would
            </h2>
            <p className="mt-1 text-sm text-indigo-100">
              Open the support chat, ask about a refund, and watch a ticket get created.
            </p>
          </div>
          <Link
            href="/demo"
            className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-700 shadow-lg transition hover:bg-indigo-50"
          >
            Open support chat
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        CiteQA · Northstar Analytics sample help center
      </footer>
    </main>
  );
}
