"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";

type AttendeeView = {
  attendeeId: string;
  name: string;
  school: string | null;
  classYear: string | null;
  currentRole: string | null;
  matchStatus: "match" | "partial" | "no_match" | "needs_review";
  matchReasoning: string;
  alreadyScanned: boolean;
};

type Step = "ready" | "scanning" | "rating" | "saving";

export default function ScanPage() {
  const { user, isLoaded } = useUser();
  const [step, setStep] = useState<Step>("ready");
  const [attendee, setAttendee] = useState<AttendeeView | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Array<{ name: string; rating: string; at: string }>>([]);
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef<unknown>(null);

  useEffect(() => {
    if (step !== "scanning") return;
    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      const id = "qr-region";
      const scanner = new Html5Qrcode(id);
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          async (decoded) => {
            if (cancelled) return;
            await scanner.stop();
            await handleCode(decoded);
          },
          () => {},
        );
      } catch (err) {
        setError(`Camera failed: ${err instanceof Error ? err.message : String(err)}`);
        setStep("ready");
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current as { stop: () => Promise<void> } | null;
      s?.stop?.().catch(() => {});
    };
  }, [step]);

  async function handleCode(qrCode: string) {
    setError(null);
    setStep("rating");
    const res = await fetch("/api/scans/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrCode }),
    });
    if (!res.ok) {
      setError(await res.text());
      setStep("ready");
      return;
    }
    setAttendee((await res.json()) as AttendeeView);
  }

  async function recordRating(rating: "strong_fit" | "some_interest" | "not_a_match") {
    if (!attendee) return;
    setStep("saving");
    const res = await fetch("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendeeId: attendee.attendeeId, rating, note }),
    });
    if (!res.ok) {
      setError(await res.text());
      setStep("rating");
      return;
    }
    setRecent((r) => [
      { name: attendee.name, rating, at: new Date().toLocaleTimeString() },
      ...r,
    ].slice(0, 10));
    setAttendee(null);
    setNote("");
    setStep("ready");
  }

  if (!isLoaded) return <main className="p-8 text-muted">Loading…</main>;

  if (!user) {
    return (
      <main className="p-8">
        <p>Sign in with the magic link sent to your sponsor email.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide text-muted">Booth scanner</p>
        <p className="text-sm font-mono">{user.primaryEmailAddress?.emailAddress}</p>
      </header>

      {error ? (
        <div className="mb-4 rounded-md border border-danger bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {step === "ready" && (
        <div className="space-y-4">
          <button className="btn-primary w-full text-base" onClick={() => setStep("scanning")}>
            Scan attendee badge
          </button>
          <div className="card space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted">Manual entry (fallback)</p>
            <input
              className="input font-mono"
              placeholder="paste QR code here"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <button
              className="btn-secondary w-full"
              disabled={!manualCode}
              onClick={() => handleCode(manualCode.trim())}
            >
              Look up
            </button>
          </div>
          <RecentList items={recent} />
        </div>
      )}

      {step === "scanning" && (
        <div>
          <div id="qr-region" className="aspect-square w-full rounded-md border border-border" />
          <button className="btn-secondary mt-4 w-full" onClick={() => setStep("ready")}>
            Cancel
          </button>
        </div>
      )}

      {step === "rating" && attendee && (
        <div className="card space-y-4">
          <div>
            <p className="text-lg font-semibold">{attendee.name}</p>
            <p className="text-sm text-muted">
              {[attendee.school, attendee.classYear, attendee.currentRole]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <MatchBadge status={attendee.matchStatus} reasoning={attendee.matchReasoning} />
          {attendee.alreadyScanned ? (
            <p className="text-sm text-warning">This attendee was already scanned at your booth.</p>
          ) : null}
          <input
            className="input"
            maxLength={100}
            placeholder="optional note (100 chars)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="grid grid-cols-3 gap-2">
            <button className="btn-primary" onClick={() => recordRating("strong_fit")}>
              Strong fit
            </button>
            <button className="btn-secondary" onClick={() => recordRating("some_interest")}>
              Some interest
            </button>
            <button className="btn-secondary" onClick={() => recordRating("not_a_match")}>
              Not a match
            </button>
          </div>
          <button
            className="text-xs text-muted underline"
            onClick={() => {
              setAttendee(null);
              setStep("ready");
            }}
          >
            cancel scan
          </button>
        </div>
      )}

      {step === "saving" && <div className="text-sm text-muted">Saving…</div>}
    </main>
  );
}

function MatchBadge({
  status,
  reasoning,
}: {
  status: AttendeeView["matchStatus"];
  reasoning: string;
}) {
  const style = {
    match: "bg-success/20 text-success border-success/40",
    partial: "bg-warning/20 text-warning border-warning/40",
    no_match: "bg-danger/20 text-danger border-danger/40",
    needs_review: "bg-muted/20 text-muted border-muted/40",
  }[status];
  const label = {
    match: "ICP match",
    partial: "Partial match",
    no_match: "Not a match",
    needs_review: "Needs review",
  }[status];
  return (
    <div className={`rounded-md border p-3 ${style}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm">{reasoning}</p>
    </div>
  );
}

function RecentList({ items }: { items: Array<{ name: string; rating: string; at: string }> }) {
  if (items.length === 0) return null;
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-muted">Recent scans</p>
      <ul className="mt-2 space-y-1 text-sm">
        {items.map((i, idx) => (
          <li key={idx} className="flex justify-between">
            <span>{i.name}</span>
            <span className="text-muted">
              {i.rating} · {i.at}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
