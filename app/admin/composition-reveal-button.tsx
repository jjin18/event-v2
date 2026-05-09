"use client";

import { useState } from "react";

export function CompositionRevealButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    if (!confirm("Send composition reveal to every confirmed attendee?")) return;
    setBusy(true);
    const res = await fetch("/api/admin/composition-reveal", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setResult(`error: ${await res.text()}`);
      return;
    }
    const data = (await res.json()) as { sent: number; failed: number; confirmed: number };
    setResult(`Sent ${data.sent} of ${data.confirmed} (${data.failed} failed).`);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button className="btn-secondary" disabled={busy} onClick={send}>
        {busy ? "Sending…" : "Send composition reveal"}
      </button>
      {result ? <p className="text-xs text-muted">{result}</p> : null}
    </div>
  );
}
