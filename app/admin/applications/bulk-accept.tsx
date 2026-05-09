"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function BulkAccept() {
  const router = useRouter();
  const [threshold, setThreshold] = useState(70);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function run(dryRun: boolean) {
    setBusy(true);
    const res = await fetch("/api/admin/applications/bulk-accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold, dryRun }),
    });
    if (!res.ok) {
      setBusy(false);
      alert(`Bulk accept failed: ${await res.text()}`);
      return;
    }
    const data = (await res.json()) as { count?: number; accepted?: number };
    setBusy(false);
    if (dryRun) {
      const count = data.count ?? 0;
      if (count === 0) {
        alert(`No pending applications above ${threshold}.`);
        return;
      }
      if (confirm(`${count} pending applications above ${threshold}. Accept all?`)) {
        run(false);
      }
    } else {
      alert(`Accepted ${data.accepted ?? 0} applications.`);
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="flex items-end gap-2">
      <label className="text-xs uppercase tracking-wide text-muted">
        Threshold
        <input
          type="number"
          min={0}
          max={100}
          className="input ml-2 w-20"
          value={threshold}
          onChange={(e) => setThreshold(parseInt(e.target.value || "0", 10))}
        />
      </label>
      <button className="btn-secondary" disabled={busy} onClick={() => run(true)}>
        {busy ? "Working…" : "Bulk accept"}
      </button>
    </div>
  );
}
