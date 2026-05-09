"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RecomputeButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function recompute(force: boolean) {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/admin/matches/recompute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    setBusy(false);
    if (!res.ok) {
      setResult(`error: ${await res.text()}`);
      return;
    }
    const data = (await res.json()) as { computed: number; cached: number; failed: number };
    setResult(`Computed ${data.computed}, kept ${data.cached} cached, ${data.failed} failed.`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => recompute(false)}>
          {busy ? "Computing…" : "Compute pending"}
        </button>
        <button
          className="btn-secondary"
          disabled={busy}
          onClick={() => {
            if (confirm("Recompute every match (drops the cache)?")) recompute(true);
          }}
        >
          Force recompute all
        </button>
      </div>
      {result ? <p className="text-xs text-muted">{result}</p> : null}
    </div>
  );
}
