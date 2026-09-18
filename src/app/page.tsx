import ChatWidget from "@/components/ChatWidget";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <div className="text-sm font-bold tracking-tight text-slate-900">
              CiteQA
            </div>
            <div className="text-xs text-slate-500">
              Support answers grounded in your docs
            </div>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
            Fictional KB · Northstar Analytics
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <ChatWidget />
        <p className="mt-6 max-w-2xl text-center text-xs text-slate-500">
          Upwork/Fiverr-style portfolio demo. Retrieval uses a local TF-IDF
          vector index over markdown docs. Set{" "}
          <code className="rounded bg-slate-200/80 px-1">OPENAI_API_KEY</code>{" "}
          for synthesized answers; without it, CiteQA still demos retrieval and
          quotes top snippets.
        </p>
      </div>
    </main>
  );
}
