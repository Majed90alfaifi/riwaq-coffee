// Prepares the local D1 database used by `pnpm dev`.
//   node scripts/setup-local-db.mjs          apply pending migrations (safe to re-run)
//   node scripts/setup-local-db.mjs --reset  delete local data first, then migrate
// The demo catalog is seeded automatically on the first request when CATALOG_SEED=demo.
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import hosting from "../.openai/hosting.json" with { type: "json" };

const root = fileURLToPath(new URL("..", import.meta.url));
const state = root + ".wrangler/state";
const configPath = root + ".wrangler/local-db.json";

if (process.argv.includes("--reset")) {
  rmSync(state + "/v3/d1", { recursive: true, force: true });
  console.log("Local D1 data removed.");
}

mkdirSync(root + ".wrangler", { recursive: true });
// Must match the placeholder binding in vite.config.ts so dev reads the same file.
writeFileSync(configPath, JSON.stringify({
  name: "riwaq-local-db",
  compatibility_date: "2026-05-15",
  d1_databases: [{
    binding: hosting.d1,
    database_name: "site-creator-d1",
    database_id: "00000000-0000-4000-8000-000000000000",
    migrations_dir: root + "drizzle",
  }],
}, null, 2));

const result = spawnSync(process.execPath, [
  root + "node_modules/wrangler/bin/wrangler.js",
  "d1", "migrations", "apply", hosting.d1,
  "--local", "--config", configPath, "--persist-to", state,
], { stdio: "inherit", env: { ...process.env, CI: "1" } });
process.exit(result.status ?? 1);
