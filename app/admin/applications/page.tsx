import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { attendees } from "@/db/schema";
import { ApplicationsTable } from "./table";
import { BulkAccept } from "./bulk-accept";

export default async function ApplicationsPage() {
  const eventId = process.env.M1_EVENT_ID;
  if (!eventId) return <p className="text-muted">No active event.</p>;

  const rows = await db.query.attendees.findMany({
    where: eq(attendees.eventId, eventId),
    orderBy: [desc(attendees.confidenceScore), desc(attendees.createdAt)],
  });

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Applications</h1>
          <p className="text-sm text-muted">
            Auto-approved at confidence ≥ 70. Borderline applications need manual review.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <a className="btn-secondary" href="/api/admin/export/attendees">
            Export CSV
          </a>
          <BulkAccept />
        </div>
      </header>
      <ApplicationsTable
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name || "(no name)",
          email: r.email,
          school: r.school,
          classYear: r.classYear,
          githubUsername: r.githubUsername,
          confidenceScore: r.confidenceScore,
          applicationStatus: r.applicationStatus,
          claimsText: r.claimsText,
        }))}
      />
    </div>
  );
}
