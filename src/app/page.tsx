import Link from "next/link";

const BENEFITS = [
  {
    title: "Answers from your help center",
    body: "Customers get clear guidance drawn from Cyberfield’s published articles — not guesses.",
  },
  {
    title: "Articles beside every reply",
    body: "Related help articles appear next to the conversation so agents and customers stay aligned.",
  },
  {
    title: "Hand off when it matters",
    body: "Open a ticket, notify the team, and keep a clean activity trail in Operations.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Ask in plain language",
    body: "Billing, plans, password resets — the assistant understands everyday support questions.",
  },
  {
    n: "2",
    title: "Get a grounded reply",
    body: "Every answer points back to help-center articles. If it isn’t covered, we say so.",
  },
  {
    n: "3",
    title: "Escalate to people",
    body: "When a customer needs a human, tickets and notifications land in Operations.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-indigo-50/80 via-white to-white">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-violet-200/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Cyberfield Analytics
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Support that knows your{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              help center
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Cyberfield Support is the help assistant for your customers — answers
            from your docs, related articles in view, and a smooth handoff to your
            team when needed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-300/30 transition hover:bg-indigo-500"
            >
              Open Help chat
            </Link>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40"
            >
              Open Operations
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">
          Why teams use it
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-base font-semibold text-slate-900">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {b.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-slate-50/80">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            How a conversation works
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-12 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="text-xl font-bold text-white">
              Ready for your customers
            </h2>
            <p className="mt-1 text-sm text-indigo-100">
              Open the Help chat and ask about refunds, Pro plans, or password resets.
            </p>
          </div>
          <Link
            href="/demo"
            className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-700 shadow-lg transition hover:bg-indigo-50"
          >
            Open Help chat
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        Cyberfield Support · Help center assistant
        <span className="mx-2 text-slate-300">·</span>
        <span className="text-slate-400">Powered by CiteQA</span>
      </footer>
    </main>
  );
}
