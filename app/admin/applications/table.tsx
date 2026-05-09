"use client";

import { useState, useTransition } from "react";

type Row = {
  id: string;
  name: string;
  email: string;
  school: string | null;
  classYear: string | null;
  githubUsername: string | null;
  confidenceScore: number;
  applicationStatus: string;
  claimsText: string;
};

export function ApplicationsTable({ rows }: { rows: Row[] }) {
  const [items, setItems] = useState(rows);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(id: string, decision: "accepted" | "rejected") {
    setBusyId(id);
    const res = await fetch(`/api/admin/applications/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setBusyId(null);
    if (!res.ok) return;
    startTransition(() => {
      setItems((prev) =>
        prev.map((r) => (r.id === id ? { ...r, applicationStatus: decision } : r)),
      );
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-card text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3 text-left">Applicant</th>
            <th className="px-4 py-3 text-left">School</th>
            <th className="px-4 py-3 text-left">GitHub</th>
            <th className="px-4 py-3 text-right">Confidence</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="px-4 py-3">
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted">{r.email}</p>
                <p className="mt-2 max-w-md text-xs text-muted">{r.claimsText}</p>
              </td>
              <td className="px-4 py-3">
                {r.school}
                {r.classYear ? <span className="text-muted"> · {r.classYear}</span> : null}
              </td>
              <td className="px-4 py-3 font-mono text-xs">{r.githubUsername ?? "—"}</td>
              <td className="px-4 py-3 text-right font-mono">{r.confidenceScore}</td>
              <td className="px-4 py-3">
                <StatusPill status={r.applicationStatus} />
              </td>
              <td className="px-4 py-3 text-right">
                {r.applicationStatus === "pending" ? (
                  <div className="flex justify-end gap-2">
                    <button
                      className="btn-secondary"
                      disabled={busyId === r.id || pending}
                      onClick={() => decide(r.id, "accepted")}
                    >
                      Accept
                    </button>
                    <button
                      className="btn-danger"
                      disabled={busyId === r.id || pending}
                      onClick={() => decide(r.id, "rejected")}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const style =
    {
      accepted: "bg-success/20 text-success",
      auto_approved: "bg-success/20 text-success",
      pending: "bg-warning/20 text-warning",
      rejected: "bg-danger/20 text-danger",
      waitlisted: "bg-muted/20 text-muted",
    }[status] ?? "bg-muted/20 text-muted";
  return <span className={`rounded px-2 py-0.5 text-xs ${style}`}>{status}</span>;
}
