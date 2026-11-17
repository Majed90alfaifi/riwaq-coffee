// QR-menu service API. Independent of the RIWAQ store tables; shares only the
// request plumbing (origin check, body limits, rate limiting) and the admin guard.
import {HttpError, now, uuid} from './commerce.mjs';
import {venueData, categoryData, itemData, LIMITS} from '../public/menu/shared.js';
import {seedMenuDemo, resetDemoVenue, DEMO_VENUES} from './menu-seed.mjs';

const ID = '[-a-z0-9]{3,64}';
const re = s => new RegExp('^' + s.replaceAll(':id', `(${ID})`) + '$');
const ROUTES = {
  venue: re('/api/menu/venues/:id'),
  aVenue: re('/api/menu/admin/venues/:id'),
  aCategories: re('/api/menu/admin/venues/:id/categories'),
  aItems: re('/api/menu/admin/venues/:id/items'),
  aReorder: re('/api/menu/admin/venues/:id/reorder'),
  aReset: re('/api/menu/admin/venues/:id/reset-demo'),
  aCategory: re('/api/menu/admin/categories/:id'),
  aItem: re('/api/menu/admin/items/:id'),
};

// Domain validation lives in shared.js and throws plain Errors; map them to 400s.
function valid(fn, b) {
  try { return fn(b); } catch (e) { throw new HttpError(e.message || 'INVALID_INPUT', 400); }
}
const parse = s => { try { return JSON.parse(s); } catch { return {}; } };

async function venueBySlug(db, slug) {
  const v = await db.prepare('SELECT * FROM menu_venues WHERE slug=?').bind(slug).first();
  if (!v) throw new HttpError('MENU_NOT_FOUND', 404);
  return v;
}

async function fullMenu(db, v, admin = false) {
  const [c, i] = await Promise.all([
    db.prepare('SELECT * FROM menu_categories WHERE venue_id=? ORDER BY position, id').bind(v.id).all(),
    db.prepare('SELECT * FROM menu_items WHERE venue_id=? ORDER BY position, id').bind(v.id).all(),
  ]);
  const {demo, ...data} = parse(v.data);
  return {
    venue: {slug: v.slug, demo: !!demo, updated_at: v.updated_at, ...data, ...(admin ? {version: v.version} : {})},
    categories: c.results.map(x => ({id: x.id, ...parse(x.data), position: x.position, ...(admin ? {version: x.version} : {})})),
    items: i.results.map(x => ({id: x.id, category_id: x.category_id, ...parse(x.data), price: x.price, available: !!x.available, position: x.position, ...(admin ? {version: x.version} : {})})),
  };
}

const audit = (db, actor, action, target, details = {}) =>
  db.prepare('INSERT INTO audit (id,actor,action,target,details,created_at) VALUES (?,?,?,?,?,?)').bind(uuid(), actor, action, target, JSON.stringify(details), now());

function version(b) {
  if (!Number.isInteger(b?.version) || b.version < 1) throw new HttpError('VERSION_REQUIRED');
  return b.version;
}
// Optimistic update: one statement that only applies when the stored version matches.
async function guarded(db, table, id, setSql, args, ver) {
  const r = await db.prepare(`UPDATE ${table} SET ${setSql}, version=version+1 WHERE id=? AND version=?`).bind(...args, id, ver).run();
  if (!r.meta?.changes) {
    const exists = await db.prepare(`SELECT 1 AS x FROM ${table} WHERE id=?`).bind(id).first();
    throw new HttpError(exists ? 'VERSION_CONFLICT' : 'NOT_FOUND', exists ? 409 : 404);
  }
}
const touch = (db, venueId) => db.prepare('UPDATE menu_venues SET updated_at=? WHERE id=?').bind(now(), venueId).run();

async function ownedCategory(db, venueId, id) {
  const c = await db.prepare('SELECT * FROM menu_categories WHERE id=? AND venue_id=?').bind(id, venueId).first();
  if (!c) throw new HttpError('INVALID_CATEGORY');
  return c;
}

function itemFields(b) {
  const data = valid(itemData, b);
  if (!Number.isSafeInteger(b.price) || b.price < 0 || b.price > LIMITS.price) throw new HttpError('INVALID_PRICE');
  return {data, price: b.price, available: b.available === false ? 0 : 1};
}

// Called by server/api.mjs after the shared origin / rate-limit checks.
export async function handleMenu(req, env, db, {admin, body, json}) {
  const path = new URL(req.url).pathname, method = req.method;
  if ((env.CATALOG_SEED || '') === 'demo') await seedMenuDemo(db);
  let m;

  // ── Public, read-only ──
  if (path === '/api/menu/venues' && method === 'GET') {
    const r = await db.prepare('SELECT slug,data FROM menu_venues ORDER BY created_at, slug').all();
    return json({venues: r.results.map(v => { const d = parse(v.data); return {slug: v.slug, name_ar: d.name_ar, name_en: d.name_en, tagline_ar: d.tagline_ar, tagline_en: d.tagline_en, brand: d.brand, logo: d.logo, demo: !!d.demo}; })});
  }
  if ((m = path.match(ROUTES.venue)) && method === 'GET') return json(await fullMenu(db, await venueBySlug(db, m[1])));

  if (!path.startsWith('/api/menu/admin/')) throw new HttpError('NOT_FOUND', 404);

  // ── Admin: same server-side guard as the store admin ──
  const actor = admin(req, env);

  if (path === '/api/menu/admin/venues' && method === 'GET') {
    const r = await db.prepare('SELECT slug,data FROM menu_venues ORDER BY created_at, slug').all();
    return json({venues: r.results.map(v => { const d = parse(v.data); return {slug: v.slug, name_ar: d.name_ar, name_en: d.name_en, demo: !!d.demo}; })});
  }
  if ((m = path.match(ROUTES.aVenue))) {
    const v = await venueBySlug(db, m[1]);
    if (method === 'GET') return json(await fullMenu(db, v, true));
    if (method === 'PATCH') {
      const b = await body(req), ver = version(b), data = valid(venueData, b.data);
      data.demo = !!parse(v.data).demo; // not editable from the client
      await guarded(db, 'menu_venues', v.id, 'data=?, updated_at=?', [JSON.stringify(data), now()], ver);
      await audit(db, actor, 'menu_update_venue', v.slug).run();
      return json(await fullMenu(db, await venueBySlug(db, v.slug), true));
    }
  }
  if ((m = path.match(ROUTES.aCategories)) && method === 'POST') {
    const v = await venueBySlug(db, m[1]), data = valid(categoryData, await body(req));
    const n = await db.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(position),-1) AS p FROM menu_categories WHERE venue_id=?').bind(v.id).first();
    if (n.n >= LIMITS.categories) throw new HttpError('TOO_MANY_CATEGORIES', 409);
    const id = uuid();
    await db.batch([
      db.prepare('INSERT INTO menu_categories (id,venue_id,data,position,version) VALUES (?,?,?,?,1)').bind(id, v.id, JSON.stringify(data), n.p + 1),
      db.prepare('UPDATE menu_venues SET updated_at=? WHERE id=?').bind(now(), v.id),
      audit(db, actor, 'menu_create_category', id, {venue: v.slug, name: data.name_ar}),
    ]);
    return json({ok: true, id}, 201);
  }
  if ((m = path.match(ROUTES.aCategory))) {
    const c = await db.prepare('SELECT * FROM menu_categories WHERE id=?').bind(m[1]).first();
    if (!c) throw new HttpError('NOT_FOUND', 404);
    const b = await body(req), ver = version(b);
    if (method === 'PATCH') {
      const data = valid(categoryData, b);
      await guarded(db, 'menu_categories', c.id, 'data=?', [JSON.stringify(data)], ver);
      await touch(db, c.venue_id);
      await audit(db, actor, 'menu_update_category', c.id, {name: data.name_ar}).run();
      return json({ok: true});
    }
    if (method === 'DELETE') {
      const n = await db.prepare('SELECT COUNT(*) AS n FROM menu_items WHERE category_id=?').bind(c.id).first();
      if (n.n) throw new HttpError('CATEGORY_NOT_EMPTY', 409);
      const r = await db.prepare('DELETE FROM menu_categories WHERE id=? AND version=?').bind(c.id, ver).run();
      if (!r.meta?.changes) throw new HttpError('VERSION_CONFLICT', 409);
      await touch(db, c.venue_id);
      await audit(db, actor, 'menu_delete_category', c.id, {name: parse(c.data).name_ar}).run();
      return json({ok: true});
    }
  }
  if ((m = path.match(ROUTES.aItems)) && method === 'POST') {
    const v = await venueBySlug(db, m[1]), b = await body(req), f = itemFields(b);
    await ownedCategory(db, v.id, b.category_id);
    const n = await db.prepare('SELECT COUNT(*) AS n FROM menu_items WHERE venue_id=?').bind(v.id).first();
    if (n.n >= LIMITS.items) throw new HttpError('TOO_MANY_ITEMS', 409);
    const p = await db.prepare('SELECT COALESCE(MAX(position),-1) AS p FROM menu_items WHERE category_id=?').bind(b.category_id).first();
    const id = uuid();
    await db.batch([
      db.prepare('INSERT INTO menu_items (id,venue_id,category_id,data,price,available,position,version,updated_at) VALUES (?,?,?,?,?,?,?,1,?)').bind(id, v.id, b.category_id, JSON.stringify(f.data), f.price, f.available, p.p + 1, now()),
      db.prepare('UPDATE menu_venues SET updated_at=? WHERE id=?').bind(now(), v.id),
      audit(db, actor, 'menu_create_item', id, {venue: v.slug, name: f.data.name_ar, price: f.price}),
    ]);
    return json({ok: true, id}, 201);
  }
  if ((m = path.match(ROUTES.aItem))) {
    const it = await db.prepare('SELECT * FROM menu_items WHERE id=?').bind(m[1]).first();
    if (!it) throw new HttpError('NOT_FOUND', 404);
    const b = await body(req), ver = version(b);
    if (method === 'PATCH') {
      // Partial update: unspecified fields keep their stored values (e.g. the availability toggle).
      const merged = {...parse(it.data), price: it.price, available: !!it.available, category_id: it.category_id, ...b};
      const f = itemFields(merged);
      let position = it.position;
      if (merged.category_id !== it.category_id) {
        await ownedCategory(db, it.venue_id, merged.category_id);
        position = (await db.prepare('SELECT COALESCE(MAX(position),-1) AS p FROM menu_items WHERE category_id=?').bind(merged.category_id).first()).p + 1;
      }
      await guarded(db, 'menu_items', it.id, 'data=?, price=?, available=?, category_id=?, position=?, updated_at=?', [JSON.stringify(f.data), f.price, f.available, merged.category_id, position, now()], ver);
      await touch(db, it.venue_id);
      await audit(db, actor, 'menu_update_item', it.id, {name: f.data.name_ar, ...(f.price !== it.price ? {price_from: it.price, price_to: f.price} : {}), ...(f.available !== it.available ? {available: !!f.available} : {})}).run();
      return json({ok: true});
    }
    if (method === 'DELETE') {
      const r = await db.prepare('DELETE FROM menu_items WHERE id=? AND version=?').bind(it.id, ver).run();
      if (!r.meta?.changes) throw new HttpError('VERSION_CONFLICT', 409);
      await touch(db, it.venue_id);
      await audit(db, actor, 'menu_delete_item', it.id, {name: parse(it.data).name_ar}).run();
      return json({ok: true});
    }
  }
  if ((m = path.match(ROUTES.aReorder)) && method === 'POST') {
    const v = await venueBySlug(db, m[1]), b = await body(req);
    if (!Array.isArray(b.ids) || b.ids.length > LIMITS.items || b.ids.some(x => typeof x !== 'string')) throw new HttpError('INVALID_ORDER');
    let rows;
    if (b.kind === 'categories') rows = (await db.prepare('SELECT id FROM menu_categories WHERE venue_id=?').bind(v.id).all()).results;
    else if (b.kind === 'items') { await ownedCategory(db, v.id, b.category_id); rows = (await db.prepare('SELECT id FROM menu_items WHERE category_id=?').bind(b.category_id).all()).results; }
    else throw new HttpError('INVALID_ORDER');
    // The client must send exactly the current set; anything else means it is out of date.
    const have = new Set(rows.map(r => r.id));
    if (new Set(b.ids).size !== b.ids.length || b.ids.length !== have.size || b.ids.some(id => !have.has(id))) throw new HttpError('VERSION_CONFLICT', 409);
    const table = b.kind === 'categories' ? 'menu_categories' : 'menu_items';
    await db.batch([
      ...b.ids.map((id, i) => db.prepare(`UPDATE ${table} SET position=? WHERE id=?`).bind(i, id)),
      db.prepare('UPDATE menu_venues SET updated_at=? WHERE id=?').bind(now(), v.id),
      audit(db, actor, 'menu_reorder_' + b.kind, v.slug),
    ]);
    return json({ok: true});
  }
  if ((m = path.match(ROUTES.aReset)) && method === 'POST') {
    const v = await venueBySlug(db, m[1]);
    if (!parse(v.data).demo || !DEMO_VENUES.some(x => x.slug === v.slug)) throw new HttpError('NOT_A_DEMO_VENUE', 409);
    await resetDemoVenue(db, v.slug);
    await audit(db, actor, 'menu_reset_demo', v.slug).run();
    return json(await fullMenu(db, await venueBySlug(db, v.slug), true));
  }
  throw new HttpError('NOT_FOUND', 404);
}
