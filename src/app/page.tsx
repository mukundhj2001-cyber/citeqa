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
            Local embeddings · Ollama-first · upload your KB
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <ChatWidget />
        <p className="mt-6 max-w-2xl text-center text-xs text-slate-500">
          Upwork/Fiverr-style portfolio demo. Retrieval uses{" "}
          <strong className="font-medium text-slate-600">local MiniLM</strong>{" "}
          embeddings over the sample Northstar docs plus anything you upload
          (Docs tab). Prefer{" "}
          <strong className="font-medium text-slate-600">Ollama</strong> for
          private answer generation; OpenAI is used only if Ollama is down and{" "}
          <code className="rounded bg-slate-200/80 px-1">OPENAI_API_KEY</code>{" "}
          is set. Without either, CiteQA quotes top snippets offline.
        </p>
      </div>
    </main>
  );
}
