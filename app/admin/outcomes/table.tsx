"use client";

import { useState } from "react";

type Row = {
  attendeeId: string;
  attendeeName: string;
  attendeeEmail: string;
  school: string | null;
  currentRole: string | null;
  rating: string;
  scanNote: string;
  status: string;
  notes: string;
  role: string;
};

const STATUSES = [
  "no_follow_up",
  "contacted",
  "interviewing",
  "offered",
  "hired",
  "declined",
] as const;

export function OutcomesTable({ rows }: { rows: Row[] }) {
  const [items, setItems] = useState<Row[]>(rows);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function save(id: string, patch: Partial<Row>) {
    setItems((prev) => prev.map((r) => (r.attendeeId === id ? { ...r, ...patch } : r)));
    const next = { ...items.find((r) => r.attendeeId === id)!, ...patch };
    setBusyId(id);
    await fetch("/api/admin/outcomes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attendeeId: id,
        status: next.status,
        notes: next.notes,
        role: next.role,
      }),
    });
    setBusyId(null);
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        No verified ICP matches yet. Outcomes show up here once scans land.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <div key={r.attendeeId} className="card space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="font-semibold">{r.attendeeName}</p>
              <p className="text-xs text-muted">
                {[r.school, r.currentRole].filter(Boolean).join(" · ")} · {r.attendeeEmail}
              </p>
              <p className="mt-1 text-xs text-muted">
                Booth rating: {r.rating}
                {r.scanNote ? ` · "${r.scanNote}"` : ""}
              </p>
            </div>
            {busyId === r.attendeeId ? <span className="text-xs text-muted">saving…</span> : null}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <select
              className="input"
              value={r.status}
              onChange={(e) => save(r.attendeeId, { status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="role / req"
              value={r.role}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((row) =>
                    row.attendeeId === r.attendeeId ? { ...row, role: e.target.value } : row,
                  ),
                )
              }
              onBlur={(e) => save(r.attendeeId, { role: e.target.value })}
            />
            <input
              className="input"
              placeholder="notes"
              value={r.notes}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((row) =>
                    row.attendeeId === r.attendeeId ? { ...row, notes: e.target.value } : row,
                  ),
                )
              }
              onBlur={(e) => save(r.attendeeId, { notes: e.target.value })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
