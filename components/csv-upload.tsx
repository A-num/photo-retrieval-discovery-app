"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImportResult {
  imported: number;
  relevant: number;
  mode: "claude" | "heuristic";
  skipped: { row: number; reason: string }[];
  missingColumns: string[];
  errors: { id: string; message: string }[];
}

export function CsvUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      setResult(body);
      setFile(null);
      if (input.current) input.current.value = "";
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm hover:file:bg-muted"
        />
        <Button size="sm" disabled={!file || busy} onClick={upload}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          {busy ? "Analyzing…" : "Upload & analyze"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="rounded-md bg-muted p-3 text-sm">
          Imported <b>{result.imported}</b> conversations; <b>{result.relevant}</b> are retrieval-related (
          {result.mode === "claude" ? "analyzed by Claude" : "analyzed with keyword rules"}). They now appear on the Dashboard, Problems and Conversations pages.
          {result.skipped.length > 0 && <div className="mt-1 text-muted-foreground">Skipped {result.skipped.length} rows with empty text.</div>}
          {result.missingColumns.length > 0 && (
            <div className="mt-1 text-muted-foreground">Missing optional columns: {result.missingColumns.join(", ")}.</div>
          )}
          {result.errors.length > 0 && (
            <div className="mt-1 text-amber-700 dark:text-amber-300">
              {result.errors.length} rows fell back to keyword analysis after a Claude error: {result.errors[0].message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DeleteImportButton({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          for (const id of ids) await fetch(`/api/import/${id}`, { method: "DELETE" });
          router.refresh();
        })
      }
    >
      <Trash2 /> Remove
    </Button>
  );
}
