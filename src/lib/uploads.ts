import crypto from "crypto";
import fs from "fs";
import path from "path";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_EXTENSIONS = [".md", ".txt", ".pdf"] as const;
export type AllowedExt = (typeof ALLOWED_EXTENSIONS)[number];

export type UploadRecord = {
  id: string;
  title: string;
  filename: string;
  originalName: string;
  ext: AllowedExt;
  size: number;
  uploadedAt: string;
};

type Manifest = { version: number; docs: UploadRecord[] };

function uploadsDir(): string {
  return path.join(process.cwd(), "knowledge", "uploads");
}

function manifestPath(): string {
  return path.join(uploadsDir(), "manifest.json");
}

export function ensureUploadsDir() {
  const dir = uploadsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readManifest(): Manifest {
  ensureUploadsDir();
  const p = manifestPath();
  if (!fs.existsSync(p)) return { version: 1, docs: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Manifest;
    if (!raw || !Array.isArray(raw.docs)) return { version: 1, docs: [] };
    return { version: raw.version ?? 1, docs: raw.docs };
  } catch {
    return { version: 1, docs: [] };
  }
}

function writeManifest(m: Manifest) {
  ensureUploadsDir();
  fs.writeFileSync(manifestPath(), JSON.stringify(m, null, 2));
}

export function listUploads(): UploadRecord[] {
  return readManifest().docs.slice().sort((a, b) =>
    a.uploadedAt < b.uploadedAt ? 1 : -1
  );
}

export function getUpload(id: string): UploadRecord | undefined {
  return readManifest().docs.find((d) => d.id === id);
}

export function uploadFilePath(record: UploadRecord): string {
  return path.join(uploadsDir(), record.filename);
}

/** Extension from original filename (lowercased). */
export function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

export function isAllowedExt(ext: string): ext is AllowedExt {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

function titleFromName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (!base) return "Uploaded document";
  return base.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 120);
}

function safeStoredName(id: string, ext: AllowedExt): string {
  return `${id}${ext}`;
}

/**
 * Extract plain text from an uploaded buffer.
 * PDFs use local pdf-parse (no network). Throws with a clear message on failure.
 */
export async function extractText(
  buffer: Buffer,
  ext: AllowedExt,
  originalName: string
): Promise<string> {
  if (ext === ".md" || ext === ".txt") {
    const text = buffer.toString("utf8");
    if (!text.trim()) {
      throw new Error(`“${originalName}” is empty — nothing to index.`);
    }
    return text;
  }

  // PDF
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = (result?.text ?? "").trim();
      if (!text) {
        throw new Error(
          `Could not extract text from “${originalName}”. The PDF may be scanned/image-only or encrypted.`
        );
      }
      return text;
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } catch (err) {
    if (err instanceof Error && /Could not extract|empty|scanned/i.test(err.message)) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `PDF extraction failed for “${originalName}”: ${msg}. Try a text-based PDF or convert to .md/.txt.`
    );
  }
}

export type SaveUploadResult =
  | { ok: true; record: UploadRecord }
  | { ok: false; error: string; status: number };

/**
 * Validate + persist an upload under knowledge/uploads/ and register in manifest.
 * Does not re-index — caller should call ensureIndex({ force: true }).
 */
export async function saveUpload(
  file: { name: string; type?: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }
): Promise<SaveUploadResult> {
  const originalName = path.basename(file.name || "upload");
  const ext = extOf(originalName);

  if (!isAllowedExt(ext)) {
    return {
      ok: false,
      status: 400,
      error: `Unsupported file type “${ext || "(none)"}”. Allowed: .md, .txt, .pdf`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, status: 400, error: "File is empty." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 400,
      error: `File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit.`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 400,
      error: `File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit.`,
    };
  }

  // Validate extractability before writing
  try {
    await extractText(buffer, ext, originalName);
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: err instanceof Error ? err.message : "Failed to read file contents.",
    };
  }

  const id = `up-${crypto.randomBytes(6).toString("hex")}`;
  const filename = safeStoredName(id, ext);
  ensureUploadsDir();
  const dest = path.join(uploadsDir(), filename);
  fs.writeFileSync(dest, buffer);

  const record: UploadRecord = {
    id,
    title: titleFromName(originalName),
    filename,
    originalName,
    ext,
    size: buffer.byteLength,
    uploadedAt: new Date().toISOString(),
  };

  const manifest = readManifest();
  manifest.docs.push(record);
  writeManifest(manifest);

  return { ok: true, record };
}

export function deleteUpload(id: string): { ok: true } | { ok: false; error: string; status: number } {
  const manifest = readManifest();
  const idx = manifest.docs.findIndex((d) => d.id === id);
  if (idx < 0) {
    return { ok: false, status: 404, error: `Upload “${id}” not found.` };
  }
  const [record] = manifest.docs.splice(idx, 1);
  const full = path.join(uploadsDir(), record.filename);
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (err) {
    console.warn("CiteQA: failed to delete upload file:", err);
  }
  writeManifest(manifest);
  return { ok: true };
}

/** Fingerprint contribution for uploads (sorted by id). */
export function uploadsFingerprintParts(): string[] {
  const parts: string[] = [];
  for (const rec of listUploads().slice().sort((a, b) => a.id.localeCompare(b.id))) {
    const full = path.join(uploadsDir(), rec.filename);
    if (!fs.existsSync(full)) {
      parts.push(`upload:${rec.id}:missing`);
      continue;
    }
    const body = fs.readFileSync(full);
    const hash = crypto.createHash("sha256").update(body).digest("hex").slice(0, 16);
    parts.push(`upload:${rec.id}:${rec.size}:${hash}`);
  }
  return parts;
}

/**
 * Load upload file contents as text for indexing.
 * Re-extracts PDF text at index time (original PDF kept on disk).
 */
export async function loadUploadContents(
  record: UploadRecord
): Promise<{ id: string; title: string; filename: string; content: string } | null> {
  const full = path.join(uploadsDir(), record.filename);
  if (!fs.existsSync(full)) return null;
  const buffer = fs.readFileSync(full);
  try {
    const content = await extractText(buffer, record.ext, record.originalName);
    return {
      id: record.id,
      title: record.title,
      filename: `uploads/${record.filename}`,
      content,
    };
  } catch (err) {
    console.warn(`CiteQA: skipping upload ${record.id}:`, err);
    return null;
  }
}
