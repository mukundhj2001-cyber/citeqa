"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DocRow = {
  id: string;
  title: string;
  filename: string;
  source: "sample" | "upload";
  originalName?: string;
  size?: number;
  uploadedAt?: string;
  ext?: string;
};

type IndexInfo = {
  chunkCount?: number;
  docCount?: number;
  sampleDocCount?: number;
  uploadDocCount?: number;
  fingerprint?: string;
  fromDisk?: boolean;
};

function formatBytes(n?: number) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

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

export default function DocsPanel({
  onIndexChange,
}: {
  onIndexChange?: (info: string) => void;
}) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [busy, setBusy] = useState<"upload" | "reindex" | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [index, setIndex] = useState<IndexInfo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/docs");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to list docs");
    setDocs(data.docs || []);
    return data;
  }, []);

  useEffect(() => {
    refresh().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load docs")
    );
  }, [refresh]);

  const applyIndex = (idx: IndexInfo | null | undefined) => {
    if (!idx) return;
    setIndex(idx);
    onIndexChange?.(
      `${idx.docCount ?? "?"} articles` +
        (idx.uploadDocCount ? ` · ${idx.uploadDocCount} uploaded` : "")
    );
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length || busy) return;
    setError(null);
    setSuccess(null);
    setBusy("upload");
    try {
      for (const file of list) {
        const form = new FormData();
        form.append("file", file);
        form.append("reindex", "1");
        const res = await fetch("/api/docs/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || `Upload failed (${res.status})`);
        }
        applyIndex(data.index);
        setDocs(data.docs || []);
        setSuccess(`Added “${data.record?.originalName || file.name}” to the help library.`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const reindex = async () => {
    if (busy) return;
    setError(null);
    setSuccess(null);
    setBusy("reindex");
    try {
      const res = await fetch("/api/docs/reindex", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Re-index failed");
      applyIndex(data.index);
      setDocs(data.docs || []);
      setSuccess(
        `Help library updated · ${data.index?.docCount ?? "?"} articles ready.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-index failed");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string, label: string) => {
    if (busy) return;
    if (!confirm(`Remove uploaded doc “${label}” and re-index?`)) return;
    setError(null);
    setSuccess(null);
    setBusy(id);
    try {
      const res = await fetch(`/api/docs/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Delete failed");
      applyIndex(data.index);
      setDocs(data.docs || []);
      setSuccess(`Removed “${label}” and refreshed the index.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  const samples = docs.filter((d) => d.source === "sample");
  const uploads = docs.filter((d) => d.source === "upload");
  const disabled = Boolean(busy);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Help library</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Upload articles (.md / .txt / .pdf)
            </p>
          </div>
          <button
            type="button"
            onClick={() => void reindex()}
            disabled={disabled}
            className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-40"
          >
            {busy === "reindex" ? "Updating…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
          }}
          className={`rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
            dragOver
              ? "border-indigo-400 bg-indigo-50"
              : "border-slate-200 bg-slate-50/80 hover:border-indigo-300 hover:bg-indigo-50/40"
          }`}
        >
          <div className="text-sm font-medium text-slate-800">
            {busy === "upload" ? "Uploading & indexing…" : "Drop docs here"}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Markdown, plain text, or PDF · max 5 MB
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
          >
            Choose files
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf"
            multiple
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              if (e.target.files?.length) void uploadFiles(e.target.files);
            }}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {success}
          </div>
        )}

        {index && (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">Library</span>
            {" · "}
            {index.docCount ?? "?"} articles ready
          </div>
        )}

        {/* Uploads */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your uploads ({uploads.length})
          </h3>
          {uploads.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-500">
              No uploads yet — add a doc to answer questions only it covers
            </div>
          ) : (
            <ul className="space-y-2">
              {uploads.map((d) => (
                <li
                  key={d.id}
                  className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-100 text-[10px] font-bold uppercase text-violet-700">
                    {(d.ext || ".md").replace(".", "")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-800">
                      {d.title}
                    </div>
                    <div className="truncate text-[10px] text-slate-500">
                      {d.originalName || d.filename}
                      {d.size != null ? ` · ${formatBytes(d.size)}` : ""}
                      {d.uploadedAt ? ` · ${formatWhen(d.uploadedAt)}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void remove(d.id, d.originalName || d.title)}
                    className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    {busy === d.id ? "…" : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Sample KB */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sample Heliora KB ({samples.length})
          </h3>
          <ul className="space-y-1.5">
            {samples.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-indigo-100 text-[9px] font-bold text-indigo-700">
                  MD
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-slate-700">
                    {d.title}
                  </div>
                  <div className="truncate text-[10px] text-slate-400">{d.filename}</div>
                </div>
                <span className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                  Built-in
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
