import Link from "next/link";

import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <p className="text-sm font-mono">event-v2 / admin</p>
          <nav className="flex gap-4 text-sm text-muted">
            <Link href="/admin">Overview</Link>
            <Link href="/admin/applications">Applications</Link>
            <Link href="/admin/scans">Scans</Link>
            <Link href="/admin/packet">Post-event packet</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
