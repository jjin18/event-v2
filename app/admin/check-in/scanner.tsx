"use client";

import { useEffect, useRef, useState } from "react";

type LookupResult = {
  attendeeId: string;
  name: string;
  email: string;
  school: string | null;
  classYear: string | null;
  alreadyCheckedIn: boolean;
};

export function CheckInScanner() {
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [last, setLast] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<unknown>(null);

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      const id = "checkin-qr-region";
      const scanner = new Html5Qrcode(id);
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          async (decoded) => {
            if (cancelled) return;
            await scanner.stop();
            await submit(decoded);
          },
          () => {},
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current as { stop: () => Promise<void> } | null;
      s?.stop?.().catch(() => {});
    };
  }, [scanning]);

  async function submit(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);
    const res = await fetch("/api/admin/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrCode: trimmed }),
    });
    if (!res.ok) {
      setError(await res.text());
      setScanning(false);
      return;
    }
    setLast((await res.json()) as LookupResult);
    setManualCode("");
    setScanning(false);
  }

  return (
    <div className="card space-y-4">
      {error ? (
        <div className="rounded-md border border-danger bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {!scanning ? (
        <div className="space-y-3">
          <button className="btn-primary w-full" onClick={() => setScanning(true)}>
            Scan attendee QR
          </button>
          <div className="flex gap-2">
            <input
              className="input font-mono"
              placeholder="paste QR code"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <button
              className="btn-secondary"
              disabled={!manualCode}
              onClick={() => submit(manualCode)}
            >
              Check in
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div id="checkin-qr-region" className="aspect-square w-full rounded-md border border-border" />
          <button className="btn-secondary mt-3 w-full" onClick={() => setScanning(false)}>
            Cancel
          </button>
        </div>
      )}

      {last ? (
        <div className="rounded-md border border-success/40 bg-success/10 p-3 text-sm">
          <p className="font-semibold">{last.name}</p>
          <p className="text-xs text-muted">
            {[last.school, last.classYear].filter(Boolean).join(" · ")} · {last.email}
          </p>
          <p className="mt-1 text-xs text-success">
            {last.alreadyCheckedIn ? "Already checked in earlier." : "Checked in just now."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
