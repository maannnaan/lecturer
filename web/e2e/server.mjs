// Starts the app for the end-to-end tests: a fresh embedded database filled with the demo data,
// then the production server (build first with `npm run build`). The database is seeded before
// the server starts because only one process may open it at a time.
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const port = process.env.PORT ?? "3124";
const env = { ...process.env, PGLITE_DIR: ".data/e2e" };

rmSync(".data/e2e", { recursive: true, force: true });
execSync("npx tsx scripts/seed-demo.ts", { env, stdio: "inherit" });

const server = spawn("npx", ["next", "start", "-p", port], { env, stdio: "inherit", shell: true });
const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
