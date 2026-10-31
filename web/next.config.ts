import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite loads its WASM build from its own package at runtime, and argon2 is a native addon:
  // both have to stay real node_modules instead of being bundled.
  serverExternalPackages: ["@electric-sql/pglite", "@node-rs/argon2"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
