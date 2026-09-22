"use client";

import { useState } from "react";
import ChatWidget from "@/components/ChatWidget";
import type { PackageId } from "@/lib/packages";
import { getPackage } from "@/lib/packages";

export default function DemoPage() {
  const [packageId, setPackageId] = useState<PackageId>("premium");
  const pkg = getPackage(packageId);

  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-slate-900">
                Live workspace
              </h1>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                {pkg.name} demo
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Chat + citations + retrieval
              {pkg.includesAgent ? " + agent actions" : ""} · switch package to
              preview tiers
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["basic", "standard", "premium"] as PackageId[]).map((id) => {
              const p = getPackage(id);
              const active = packageId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPackageId(id)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 py-6 sm:px-6">
        <ChatWidget
          packageId={packageId}
          onPackageChange={setPackageId}
        />
        <p className="mt-5 max-w-2xl text-center text-xs text-slate-500">
          Try “How do refunds work?” then use Premium actions to create a ticket
          or log to sheet — check{" "}
          <a href="/admin" className="font-medium text-indigo-600 hover:underline">
            /admin
          </a>{" "}
          for the audit trail. Embeddings stay local; generation prefers Ollama.
        </p>
      </div>
    </main>
  );
}
