import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";

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
