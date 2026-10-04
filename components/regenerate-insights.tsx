"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RegenerateInsights({ enabled, regenerated }: { enabled: boolean; regenerated: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function run(method: "POST" | "DELETE") {
    setError(null);
    const res = await fetch("/api/synthesize", { method });
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (!enabled) {
    return null;
  }
  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      {regenerated && (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run("DELETE")}>
          Reset
        </Button>
      )}
      <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(() => run("POST"))}>
        <RefreshCw className={pending ? "animate-spin" : ""} />
        {pending ? "Refreshing…" : "Refresh insights"}
      </Button>
    </div>
  );
}
