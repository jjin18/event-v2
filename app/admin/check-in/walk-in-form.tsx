"use client";

import { useState } from "react";

export function WalkInForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [school, setSchool] = useState("");
  const [classYear, setClassYear] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ checkInUrl: string; qrCode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/walk-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        githubUsername: githubUsername || undefined,
        school: school || undefined,
        classYear: classYear || undefined,
        currentRole: currentRole || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const data = (await res.json()) as { checkInUrl: string; qrCode: string };
    setCreated(data);
    setName("");
    setEmail("");
    setGithubUsername("");
    setSchool("");
    setClassYear("");
    setCurrentRole("");
  }

  return (
    <form className="card space-y-3" onSubmit={submit}>
      {error ? (
        <div className="rounded-md border border-danger bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="GitHub username (optional)"
          value={githubUsername}
          onChange={(e) => setGithubUsername(e.target.value)}
        />
        <input
          className="input"
          placeholder="School / employer"
          value={school}
          onChange={(e) => setSchool(e.target.value)}
        />
        <input
          className="input"
          placeholder="Class year / role"
          value={classYear}
          onChange={(e) => setClassYear(e.target.value)}
        />
        <input
          className="input"
          placeholder="Current focus"
          value={currentRole}
          onChange={(e) => setCurrentRole(e.target.value)}
        />
      </div>

      <button className="btn-primary w-full" disabled={busy} type="submit">
        {busy ? "Registering…" : "Register walk-in (auto-checked-in)"}
      </button>

      {created ? (
        <div className="rounded-md border border-success/40 bg-success/10 p-3 text-xs">
          <p>Registered. QR code:</p>
          <p className="mt-1 font-mono">{created.qrCode}</p>
          <a className="mt-1 inline-block underline" href={created.checkInUrl} target="_blank">
            Open badge
          </a>
        </div>
      ) : null}
    </form>
  );
}
