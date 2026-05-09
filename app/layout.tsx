import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";

// Skip static pre-rendering of every page. ClerkProvider in the root layout
// needs NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY at render time, so prerendering at
// build time fails when the key isn't in the build env. The set of pages
// that need to be reachable without auth (e.g. /apply/done) is small and
// they don't benefit from static generation.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "event-v2",
  description: "Verified hackathon attendance with contingent sponsor measurement",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-bg text-fg">{children}</body>
      </html>
    </ClerkProvider>
  );
}
