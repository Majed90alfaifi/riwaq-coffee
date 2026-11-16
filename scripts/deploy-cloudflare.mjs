// Public demo deployment to Cloudflare Workers + D1.
//   1. node node_modules/wrangler/bin/wrangler.js login   (once)
//   2. node scripts/deploy-cloudflare.mjs                  (every release)
// Creates the D1 database on first run, applies drizzle/ migrations, builds with the
// real database id and PUBLIC_DEMO=1 (admin disabled, identity headers stripped), deploys.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const wranglerBin = root + "node_modules/wrangler/bin/wrangler.js";
const DB_NAME = "riwaq-coffee-db";

function run(args, { capture = false, env = {} } = {}) {
  const r = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) {
    if (capture) process.stderr.write((r.stdout || "") + (r.stderr || ""));
    throw new Error(`Command failed: ${args.slice(1).join(" ")}`);
  }
  return r.stdout || "";
}
const wrangler = (args, opts) => run([wranglerBin, ...args], opts);

console.log("1/5 Checking Cloudflare login...");
const who = wrangler(["whoami"], { capture: true });
if (/not authenticated/i.test(who)) {
  console.error("Not logged in. Run: node node_modules/wrangler/bin/wrangler.js login");
  process.exit(1);
}

console.log(`2/5 Finding or creating D1 database "${DB_NAME}"...`);
const list = () => JSON.parse(wrangler(["d1", "list", "--json"], { capture: true }));
let db = list().find((d) => d.name === DB_NAME);
if (!db) {
  wrangler(["d1", "create", DB_NAME]);
  db = list().find((d) => d.name === DB_NAME);
}
if (!db?.uuid) throw new Error("Could not determine the D1 database id.");
console.log(`   database id: ${db.uuid}`);

console.log("3/5 Applying migrations to the remote database...");
mkdirSync(root + ".wrangler", { recursive: true });
const migrateConfig = root + ".wrangler/remote-db.json";
writeFileSync(migrateConfig, JSON.stringify({
  name: "riwaq-coffee",
  compatibility_date: "2026-05-15",
  d1_databases: [{ binding: "DB", database_name: DB_NAME, database_id: db.uuid, migrations_dir: root + "drizzle" }],
}, null, 2));
wrangler(["d1", "migrations", "apply", "DB", "--remote", "--config", migrateConfig], { env: { CI: "1" } });

console.log("4/5 Building the production bundle...");
run([root + "scripts/run-framework.mjs", "build"], { env: { RIWAQ_D1_ID: db.uuid } });

console.log("5/5 Deploying the Worker...");
wrangler(["deploy", "--config", root + "dist/server/wrangler.json"]);
console.log("\nDone. The URL printed above (https://riwaq-coffee.<your-subdomain>.workers.dev) is your public demo link.");
