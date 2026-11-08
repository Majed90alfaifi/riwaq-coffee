# RIWAQ operations and recovery

Status: sandbox only. This repository deliberately does not implement a live payment, shipping, invoicing or email adapter. Do not enable real sales based on the sandbox test results.

## Source map

- `public/core.js`: shared route/cart/catalog validation and integer-halala quote calculations.
- `public/app.js`, `public/style.css`, `public/art.js`: bilingual storefront and admin UI; no inline event handlers or evaluated source.
- `server/api.mjs`: server authorization, same-origin mutations, bounded JSON, rate limits and API routing.
- `server/commerce.mjs`: server quotes, guest order tokens, idempotency, reservations and sandbox payment transitions.
- `server/backup.mjs`: protected consistent database snapshot.
- `db/schema.ts`, `drizzle/`: schema, metadata and immutable migrations. Initial migration includes stock/version/event triggers.
- `worker/index.ts`: preserve the Sites/Vinext integration and response security headers.
- `tests/commerce.test.mjs`: regression and backend acceptance tests.

## Configuration

The manifest retains the original project ID and declares D1 binding `DB`. Keep it unchanged when editing this Site. Hosted binding provisioning and schema migration are performed by Sites deployment, not ad-hoc SQL during requests.

Runtime keys are configured using Sites environment settings, outside source:

- `ADMIN_EMAIL`: verified ChatGPT email authorized for administration. Secret setting in the hosted environment.
- `ADMIN_EMAILS`: optional comma-, semicolon-, or whitespace-separated list of additional verified ChatGPT emails authorized for administration. Keep this setting secret. The existing `ADMIN_EMAIL` remains authorized; an empty/mismatched identity denies admin access. Auth headers are trusted only behind the Sites dispatch boundary; do not expose this Worker directly behind an ingress that lets clients forge them.
- `CATALOG_SEED=demo`: seeds fictional catalog data only when the product table is empty. Inserts are idempotent; existing prices and stocks are not reset on redeploy. Remove this setting when real catalog onboarding is complete.

Use `.dev.vars` for local values; it is ignored. `.env.example` contains names and dummy values only. No provider keys are currently consumed. Adding key names alone does not implement a provider.

## Local verification

Install using the Sites dependency helper. Run:

```
node --test tests/commerce.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Build using the Sites build helper. For a fresh local database, apply each pending migration once using the starter's local D1 command and `dist/server/wrangler.json`. Record local migration state; do not replay the initial SQL over existing tables. Start the managed preview with `sites-preview start` following Sites guidance. Local and hosted databases are separate.

The test harness uses Node 24's built-in `node:sqlite`; it tests SQLite constraints and business rules but is not a substitute for multi-isolate hosted load tests.

## Publishing

1. Preserve owner-private access unless the owner explicitly changes the audience.
2. Obtain a fresh Site source credential in memory; never persist or print its token.
3. Open/sync the existing repository with the Sites workflow helper.
4. Run tests, type check and build after source changes. Inspect newly generated SQL before deployment.
5. Package with the source helper and publish the exact pushed commit and its archive using the owner-private deployment tool.
6. Poll the returned deployment to a terminal result; record commit, version and deployment IDs. Verify the protected app with an authorized identity.

## Administration

Visit `/#/admin` while signed in with the authorized owner account. The server rejects unauthorized reads and writes regardless of whether a client displays admin controls. Initial access remains private to the owner. Products can be created with zero stock, edited and hidden. Stock is AVAILABLE stock after pending reservations, grouped by product and weight; grind choices share that group's stock. Price belongs to each sellable variant. Current editor applies one price to all grinds within a weight. Changing category is rejected; create a new product for a category change.

Product updates require the last version and fail with 409 on stale edits. Review reservations before an inventory count. Do not change customer/order records directly in SQL during normal operations.

Sandbox events are admin-only and explicitly simulated. A failed/cancelled/expired reservation releases stock exactly once. A paid-to-refunded event does not restock a physical return automatically. Guest cancellation requires the receipt token. Keep tokens out of URLs and logs.

## Backups and restore

The admin page offers a protected JSON snapshot download (`/api/admin/backup`). It includes customer/order data: store it in restricted encrypted storage with an approved retention policy. Data are read in one D1 batch. This is a manual export; no offsite backup schedule has been configured.

Restore a downloaded snapshot OFFLINE to a NEW SQLite database (never overwrites an existing file):

```
node scripts/restore-snapshot.mjs INPUT.json NEW_OUTPUT.sqlite
```

The script loads schema/data before installing reservation triggers, then verifies foreign keys and integrity. This prevents double stock deductions on restore. Automated tests verified orders, stock and triggers after this process. Restore must run from the repository root. The recovery database is a local file, not an in-place hosted D1 restore. Restoring production requires the hosting provider's supported import/recovery path and a separate validated recovery environment; it has not been exercised here.

Where direct authorized Cloudflare D1 access is available, consult official export/Time Travel documentation rather than guessing the managed database ID. Such access is not assumed for this Sites-managed database:
- https://developers.cloudflare.com/d1/best-practices/import-export-data/
- https://developers.cloudflare.com/d1/reference/time-travel/

## Rollback

Keep the last known GOOD repaired commit/version. The pre-repair static version contains a known DOM XSS issue; do not restore it to service. If a new release fails, retain private access and return to a verified repaired version or display maintenance. Prefer an additive migration strategy compatible with the previous repaired release. Restoring a UI version does not undo database migrations or orders. Never delete or rewrite an applied migration. Preserve backups and verify schema compatibility before a data recovery operation.

## Monitoring and pending integrations

Server errors emit structured JSON with request ID, path and generic error code, excluding customer bodies/tokens. External alerting, retention, availability monitoring and periodic offsite backups remain unconfigured. `/api/health` currently reports process readiness only, not end-to-end database/payment health.

Outbox rows are stored as `blocked_config`; no sending worker/retry delivery is implemented. Shipping and newsletter endpoints return 503. Real payment creation and webhooks return 503; sandbox transitions are not public payment webhooks. Provider-specific signature checks, amount/currency validation, event replay prevention, refunds, retry semantics and delivery polling must be implemented and tested against selected vendor sandboxes before enabling real collection.
