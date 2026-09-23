"use client";

import { useState } from "react";
import ChatWidget from "@/components/ChatWidget";
import type { PackageId } from "@/lib/packages";
import { getPackage } from "@/lib/packages";

export default function DemoPage() {
  const [packageId, setPackageId] = useState<PackageId>("premium");
  const pkg = getPackage(packageId);

  return (
    <main className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-1.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold text-slate-800">
            Northstar Support
          </span>
          <span className="hidden truncate text-[11px] text-slate-400 sm:inline">
            Answers from your help center
            {pkg.includesAgent ? " · can open tickets for you" : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:inline">
            Plan
          </span>
          {(["basic", "standard", "premium"] as PackageId[]).map((id) => {
            const p = getPackage(id);
            const active = packageId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPackageId(id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
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

      <div className="flex min-h-0 flex-1 flex-col">
        <ChatWidget packageId={packageId} onPackageChange={setPackageId} />
      </div>
    </main>
  );
}
