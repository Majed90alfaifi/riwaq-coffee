import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './db.mjs';
import {handle} from '../server/api.mjs';
import {parsePrice, priceText, openState, matches, venueData, itemData} from '../public/menu/shared.js';
import {qrMatrix, qrSvg} from '../public/menu/qr.js';

const ORIGIN = 'https://riwaq.test';
function setup(extra = {}) {
  const db = database();
  const env = {DB: db, CATALOG_SEED: 'demo', ADMIN_EMAIL: 'admin@example.test', ...extra};
  const call = async (path, {method = 'GET', data, admin = false, origin = ORIGIN} = {}) => {
    const r = await handle(new Request(ORIGIN + path, {method, headers: {...(data ? {'content-type': 'application/json', origin} : {}), ...(admin ? {'oai-authenticated-user-id': 'owner-1', 'oai-authenticated-user-email': 'admin@example.test'} : {})}, body: data ? JSON.stringify(data) : undefined}), env);
    return {status: r.status, body: await r.json()};
  };
  return {db, env, call};
}
const A = {admin: true};

test('MENU-01: public menu is seeded once, ordered, and hides admin-only fields', async () => {
  const {call, db} = setup();
  const r = await call('/api/menu/venues/bait-alhail');
  assert.equal(r.status, 200);
  assert.equal(r.body.venue.name_ar, 'بيت الهيل');
  assert.equal(r.body.venue.demo, true);
  assert.equal(r.body.venue.version, undefined);
  assert.deepEqual(r.body.categories.map(c => c.id), ['bh-hot', 'bh-cold', 'bh-bakery', 'bh-sweets', 'bh-seasonal']);
  assert.ok(r.body.items.every(i => i.version === undefined && Number.isSafeInteger(i.price)));
  assert.equal(r.body.items.find(i => i.id === 'bh-lemon-mint').available, false);
  // Deleting demo content must not be undone by the next request's seed check.
  db.sql.exec("DELETE FROM menu_items WHERE id='bh-cookie'");
  assert.ok(!(await call('/api/menu/venues/bait-alhail')).body.items.some(i => i.id === 'bh-cookie'));
  assert.equal((await call('/api/menu/venues/no-such-place')).status, 404);
  assert.equal((await call('/api/menu/venues/sunbula')).body.categories.length, 0);
  // Store catalog untouched by the menu service.
  assert.equal((await call('/api/catalog')).status, 200);
});

test('MENU-02: admin routes require the trusted admin identity and are closed on the public demo', async () => {
  const {call} = setup();
  assert.equal((await call('/api/menu/admin/venues')).status, 403);
  assert.equal((await call('/api/menu/admin/venues/bait-alhail/categories', {method: 'POST', data: {name_ar: 'فطور'}})).status, 403);
  assert.equal((await call('/api/menu/admin/venues/bait-alhail/categories', {method: 'POST', data: {name_ar: 'فطور'}, admin: true, origin: 'https://evil.test'})).status, 403);
  assert.equal((await call('/api/menu/admin/venues', A)).status, 200);
  const pub = setup({PUBLIC_DEMO: '1'});
  assert.equal((await pub.call('/api/menu/admin/venues', A)).status, 403);
  assert.equal((await pub.call('/api/menu/venues/bait-alhail')).status, 200);
});

test('MENU-03: owner adds a category and item, edits the price, and the public menu reflects it', async () => {
  const {call, db} = setup();
  const c = await call('/api/menu/admin/venues/bait-alhail/categories', {method: 'POST', data: {name_ar: 'الفطور', name_en: 'Breakfast'}, ...A});
  assert.equal(c.status, 201);
  const it = await call('/api/menu/admin/venues/bait-alhail/items', {method: 'POST', data: {category_id: c.body.id, name_ar: 'فول بالزيت', price: 1500, badges: ['new'], image: '/menu/img/sandwich.svg'}, ...A});
  assert.equal(it.status, 201);
  let admin = (await call('/api/menu/admin/venues/bait-alhail', A)).body;
  const row = admin.items.find(i => i.id === it.body.id);
  assert.equal((await call(`/api/menu/admin/items/${row.id}`, {method: 'PATCH', data: {version: row.version, price: 1750}, ...A})).status, 200);
  const pub = (await call('/api/menu/venues/bait-alhail')).body;
  const shown = pub.items.find(i => i.id === it.body.id);
  assert.equal(shown.price, 1750);
  assert.equal(shown.name_ar, 'فول بالزيت');
  assert.deepEqual(shown.badges, ['new']);
  assert.equal(pub.categories.at(-1).name_en, 'Breakfast');
  const log = db.sql.prepare("SELECT action,details FROM audit WHERE action LIKE 'menu_%' ORDER BY rowid").all();
  assert.deepEqual(log.map(x => x.action), ['menu_create_category', 'menu_create_item', 'menu_update_item']);
  assert.match(log[2].details, /"price_from":1500,"price_to":1750/);
});

test('MENU-04: availability toggle keeps other fields; stale versions are rejected', async () => {
  const {call} = setup();
  let a = (await call('/api/menu/admin/venues/bait-alhail', A)).body, latte = a.items.find(i => i.id === 'bh-latte');
  assert.equal((await call('/api/menu/admin/items/bh-latte', {method: 'PATCH', data: {version: latte.version, available: false}, ...A})).status, 200);
  const pub = (await call('/api/menu/venues/bait-alhail')).body.items.find(i => i.id === 'bh-latte');
  assert.equal(pub.available, false);
  assert.equal(pub.price, latte.price);
  assert.equal(pub.desc_ar, latte.desc_ar);
  assert.deepEqual(pub.badges, latte.badges);
  const stale = await call('/api/menu/admin/items/bh-latte', {method: 'PATCH', data: {version: latte.version, price: 1}, ...A});
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error, 'VERSION_CONFLICT');
  const venueStale = await call('/api/menu/admin/venues/bait-alhail', {method: 'PATCH', data: {version: a.venue.version + 5, data: {...a.venue, name_ar: 'اسم'}}, ...A});
  assert.equal(venueStale.status, 409);
});

test('MENU-05: categories reorder exactly-once and cannot be deleted while holding items', async () => {
  const {call} = setup();
  let a = (await call('/api/menu/admin/venues/bait-alhail', A)).body;
  const ids = a.categories.map(c => c.id);
  assert.equal((await call('/api/menu/admin/venues/bait-alhail/reorder', {method: 'POST', data: {kind: 'categories', ids: ids.slice(1)}, ...A})).status, 409);
  const flipped = [ids[1], ids[0], ...ids.slice(2)];
  assert.equal((await call('/api/menu/admin/venues/bait-alhail/reorder', {method: 'POST', data: {kind: 'categories', ids: flipped}, ...A})).status, 200);
  assert.deepEqual((await call('/api/menu/venues/bait-alhail')).body.categories.map(c => c.id), flipped);
  const hot = a.categories.find(c => c.id === 'bh-hot');
  const full = await call('/api/menu/admin/categories/bh-hot', {method: 'DELETE', data: {version: hot.version}, ...A});
  assert.equal(full.status, 409);
  assert.equal(full.body.error, 'CATEGORY_NOT_EMPTY');
  const seasonal = a.categories.find(c => c.id === 'bh-seasonal');
  assert.equal((await call('/api/menu/admin/categories/bh-seasonal', {method: 'DELETE', data: {version: seasonal.version}, ...A})).status, 200);
  assert.ok(!(await call('/api/menu/venues/bait-alhail')).body.categories.some(c => c.id === 'bh-seasonal'));
  // Items can't be moved into another venue's category.
  const latte = a.items.find(i => i.id === 'bh-latte');
  const sun = await call('/api/menu/admin/venues/sunbula/categories', {method: 'POST', data: {name_ar: 'خبز'}, ...A});
  assert.equal((await call('/api/menu/admin/items/bh-latte', {method: 'PATCH', data: {version: latte.version, category_id: sun.body.id}, ...A})).body.error, 'INVALID_CATEGORY');
});

test('MENU-06: input validation rejects bad prices, links, images and badges', async () => {
  const {call} = setup();
  const add = data => call('/api/menu/admin/venues/bait-alhail/items', {method: 'POST', data: {category_id: 'bh-hot', name_ar: 'صنف', price: 1000, ...data}, ...A});
  assert.equal((await add({price: 10.5})).body.error, 'INVALID_PRICE');
  assert.equal((await add({price: -1})).body.error, 'INVALID_PRICE');
  assert.equal((await add({image: 'http://example.com/a.jpg'})).body.error, 'INVALID_IMAGE');
  assert.equal((await add({image: 'javascript:alert(1)'})).body.error, 'INVALID_IMAGE');
  assert.equal((await add({badges: ['healthy']})).body.error, 'INVALID_BADGE');
  assert.equal((await add({name_ar: ''})).body.error, 'INVALID_NAME');
  assert.equal((await add({category_id: 'nope-nope'})).body.error, 'INVALID_CATEGORY');
  assert.equal((await add({image: 'https://images.example.com/latte.jpg'})).status, 201);
  assert.throws(() => venueData({name_ar: 'مقهى', map_url: 'javascript:alert(1)'}), /INVALID_LINK/);
  assert.throws(() => venueData({name_ar: 'مقهى', open: '07:00'}), /INVALID_HOURS/);
  assert.throws(() => venueData({name_ar: 'مقهى', whatsapp: '+966 5x'}), /INVALID_PHONE/);
  assert.equal(venueData({name_ar: 'مقهى', demo: true, brand: 'red'}).demo, undefined);
  assert.equal(itemData({name_ar: '  لاتيه   بارد ', badges: ['new', 'new']}).name_ar, 'لاتيه بارد');
});

test('MENU-07: demo reset restores the original venue', async () => {
  const {call} = setup();
  const a = (await call('/api/menu/admin/venues/bait-alhail', A)).body;
  await call('/api/menu/admin/venues/bait-alhail', {method: 'PATCH', data: {version: a.venue.version, data: {...a.venue, name_ar: 'اسم مؤقت'}}, ...A});
  assert.equal((await call('/api/menu/venues/bait-alhail')).body.venue.name_ar, 'اسم مؤقت');
  assert.equal((await call('/api/menu/admin/venues/bait-alhail/reset-demo', {method: 'POST', data: {}, ...A})).status, 200);
  const pub = (await call('/api/menu/venues/bait-alhail')).body;
  assert.equal(pub.venue.name_ar, 'بيت الهيل');
  assert.equal(pub.items.length, 18);
});

test('MENU-08: price parsing, opening hours across midnight and Arabic-aware search', () => {
  assert.equal(parsePrice('18'), 1800);
  assert.equal(parsePrice('18.5'), 1850);
  assert.equal(parsePrice('١٨٫٧٥'), 1875);
  assert.equal(parsePrice('18,50'), 1850);
  for (const bad of ['', 'abc', '1.234', '-3', '100001']) assert.equal(parsePrice(bad), null);
  assert.equal(priceText(1850), '18.50');
  assert.equal(priceText(2500), '25');
  const at = h => new Date(Date.UTC(2026, 0, 1, (h - 3 + 24) % 24, 0)); // Riyadh hour → UTC
  assert.equal(openState('07:00', '01:00', at(8)).open, true);
  assert.equal(openState('07:00', '01:00', at(0)).open, true);
  assert.equal(openState('07:00', '01:00', at(3)).open, false);
  assert.equal(openState('', '', at(3)), null);
  const item = {name_ar: 'لاتيه الهيل', name_en: 'Cardamom latte', desc_ar: 'إسبريسو وحليب', desc_en: ''};
  assert.ok(matches(item, 'لاتية'));
  assert.ok(matches(item, 'اسبريسو'));
  assert.ok(matches(item, 'CARDAMOM'));
  assert.ok(!matches(item, 'شاي'));
});

test('MENU-09: QR encoder produces a valid symbol structure and safe SVG', () => {
  const q = qrMatrix('http://localhost:5173/menu/bait-alhail', 'M');
  assert.equal(q.size, q.version * 4 + 17);
  // Finder pattern corners: dark outer ring, light separator.
  for (const [x, y] of [[0, 0], [q.size - 1, 0], [0, q.size - 1]]) assert.equal(q.modules[y][x], true);
  assert.equal(q.modules[7][7], false);
  assert.equal(q.modules[q.size - 8][8], true); // always-dark module
  assert.deepEqual(qrMatrix('same text').modules, qrMatrix('same text').modules);
  assert.throws(() => qrMatrix('x'.repeat(3000), 'H'), /QR_DATA_TOO_LONG/);
  const svg = qrSvg('https://a.test/menu/x', {title: '<script>"'});
  assert.ok(!svg.includes('<script>'));
  assert.match(svg, /^<svg [^>]*viewBox="0 0 \d+ \d+"/);
});

test('MENU-10: backups include menu tables and older snapshots without them still restore', async () => {
  const fs = await import('node:fs');
  const {DatabaseSync} = await import('node:sqlite');
  const {exportSnapshot} = await import('../server/backup.mjs');
  const {restoreSnapshot} = await import('../scripts/restore-snapshot.mjs');
  const {call, db} = setup();
  await call('/api/menu/venues/bait-alhail');
  const snap = await exportSnapshot(db);
  assert.equal(snap.tables.menu_items.length, 18);
  const legacy = {...snap, tables: Object.fromEntries(Object.entries(snap.tables).filter(([k]) => !k.startsWith('menu_')))};
  for (const [s, n] of [[snap, 18], [legacy, 0]]) {
    const out = `${process.env.TEMP || process.env.TMPDIR || '/tmp'}/menu-restore-${crypto.randomUUID()}.sqlite`;
    let restored;
    try {
      restoreSnapshot(s, out);
      restored = new DatabaseSync(out);
      assert.equal(restored.prepare('SELECT COUNT(*) n FROM menu_items').get().n, n);
    } finally { restored?.close(); fs.rmSync(out, {force: true}); }
  }
});
