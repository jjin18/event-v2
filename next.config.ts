import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Ship the SQL migration files in the runtime bundle so /api/setup can
  // read them at request time. Without this they'd be excluded from
  // standalone builds.
  outputFileTracingIncludes: {
    "/api/setup": ["./db/migrations/**/*.sql"],
  },
};

export default nextConfig;
