"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";

type Step = "auth" | "details" | "verify_email" | "submitting" | "submitted";

export default function ApplyPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [step, setStep] = useState<Step>("auth");

  const [school, setSchool] = useState("");
  const [classYear, setClassYear] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [claimsText, setClaimsText] = useState("");
  const [verifyEmail, setVerifyEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isLoaded) return <main className="p-8 text-muted">Loading…</main>;

  const githubAccount = user?.externalAccounts.find((a) => a.provider === "oauth_github");

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Apply to attend</h1>
      <p className="mt-2 text-muted">
        We verify every applicant against GitHub plus an institutional email. Auto-approval for
        strong signals; otherwise we review within 48 hours.
      </p>

      {error ? (
        <div className="mt-6 rounded-md border border-danger bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <SignedOut>
        <div className="card mt-8 space-y-4">
          <p className="text-sm">Step 1 — Connect your GitHub account.</p>
          <SignInButton mode="modal" forceRedirectUrl="/apply">
            <button className="btn-primary">Sign in with GitHub</button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {step === "auth" && (
          <div className="card mt-8 space-y-3">
            <p className="text-sm">
              Connected as <span className="font-mono">{githubAccount?.username ?? user?.id}</span>
              .
            </p>
            <button className="btn-primary" onClick={() => setStep("details")}>
              Continue
            </button>
          </div>
        )}

        {step === "details" && (
          <form
            className="card mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              setStep("verify_email");
            }}
          >
            <Field label="School or employer">
              <input
                className="input"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                required
              />
            </Field>
            <Field label="Class year or role title">
              <input
                className="input"
                value={classYear}
                onChange={(e) => setClassYear(e.target.value)}
                placeholder="e.g. 2027 or Junior SWE"
                required
              />
            </Field>
            <Field label="Current focus">
              <input
                className="input"
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value)}
                placeholder="e.g. ML researcher, full-stack engineer"
                required
              />
            </Field>
            <Field label="What are you hoping to get from this event?">
              <textarea
                className="input min-h-[120px]"
                value={claimsText}
                onChange={(e) => setClaimsText(e.target.value)}
                required
                minLength={40}
              />
            </Field>
            <button className="btn-primary w-full" type="submit">
              Continue
            </button>
          </form>
        )}

        {step === "verify_email" && (
          <div className="card mt-8 space-y-4">
            <Field label="Institutional email (.edu or company)">
              <input
                className="input"
                type="email"
                value={verifyEmail}
                onChange={(e) => setVerifyEmail(e.target.value)}
              />
            </Field>
            <button
              className="btn-secondary"
              type="button"
              onClick={async () => {
                setError(null);
                const res = await fetch("/api/verify-email/start", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: verifyEmail }),
                });
                if (!res.ok) {
                  setError(await res.text());
                }
              }}
            >
              Send code
            </button>

            <Field label="Verification code (check your inbox)">
              <input
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
              />
            </Field>

            <button
              className="btn-primary w-full"
              type="button"
              onClick={async () => {
                setError(null);
                setStep("submitting");
                const res = await fetch("/api/apply", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    school,
                    classYear,
                    currentRole,
                    claimsText,
                    verifyEmail,
                    verificationCode: code,
                  }),
                });
                if (!res.ok) {
                  setError(await res.text());
                  setStep("verify_email");
                  return;
                }
                setStep("submitted");
                setTimeout(() => router.push("/apply/done"), 800);
              }}
            >
              Submit application
            </button>
          </div>
        )}

        {step === "submitting" && (
          <div className="card mt-8 text-sm text-muted">Submitting…</div>
        )}
        {step === "submitted" && (
          <div className="card mt-8 text-sm">
            Thanks. You&apos;ll hear back within 48 hours.
          </div>
        )}
      </SignedIn>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}
