// Shared by the QR-menu public page, the menu admin and the server (server/menu.mjs).
// Pure functions only — no DOM, no network.

// Optional item badges. They are owner-declared labels; the menu never invents them.
export const BADGES = {
  popular: {ar: 'الأكثر طلبًا', en: 'Most ordered', tone: 'gold'},
  new: {ar: 'جديد', en: 'New', tone: 'green'},
  signature: {ar: 'توقيع المقهى', en: 'House signature', tone: 'brand'},
  vegetarian: {ar: 'نباتي', en: 'Vegetarian', tone: 'leaf'},
  vegan: {ar: 'نباتي صرف', en: 'Vegan', tone: 'leaf'},
  spicy: {ar: 'حار', en: 'Spicy', tone: 'red'},
  gluten_free: {ar: 'خالٍ من الغلوتين', en: 'Gluten-free', tone: 'plain'},
  dairy_free: {ar: 'خالٍ من الألبان', en: 'Dairy-free', tone: 'plain'},
  nut_free: {ar: 'خالٍ من المكسرات', en: 'Nut-free', tone: 'plain'},
  decaf: {ar: 'منزوع الكافيين', en: 'Decaf', tone: 'plain'},
};

// Bundled illustrations (local files, so they work under the site's CSP and offline).
// They are drawings, not photos of a real venue's food — the UI labels them as such.
export const IMAGE_LIBRARY = {
  espresso: {ar: 'إسبريسو', en: 'Espresso'},
  latte: {ar: 'لاتيه', en: 'Latte'},
  iced: {ar: 'مشروب مثلج', en: 'Iced drink'},
  filter: {ar: 'قهوة مقطرة', en: 'Pour-over'},
  dallah: {ar: 'دلة قهوة', en: 'Dallah'},
  tea: {ar: 'شاي', en: 'Tea'},
  croissant: {ar: 'كرواسون', en: 'Croissant'},
  sandwich: {ar: 'ساندويتش', en: 'Sandwich'},
  cake: {ar: 'كيك', en: 'Cake'},
  cookie: {ar: 'كوكيز', en: 'Cookie'},
};
export const libraryPath = key => `/menu/img/${key}.svg`;
export function libraryKey(image) {
  const m = /^\/menu\/img\/([a-z]+)\.svg$/.exec(image || '');
  return m && IMAGE_LIBRARY[m[1]] ? m[1] : null;
}

export const LIMITS = {categories: 30, items: 300, price: 1000000};

// Halalas (integer) → "18" / "18.50"
// Western digits in both languages, as on most Saudi menus and receipts.
export function priceText(halalas) {
  if (!Number.isSafeInteger(halalas) || halalas < 0) return '';
  const whole = halalas % 100 === 0;
  return (halalas / 100).toLocaleString('en-US', {minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2});
}
// "18.5" / "18,50" / "١٨" → 1850 halalas, or null when invalid.
export function parsePrice(input) {
  if (typeof input === 'number') input = String(input);
  if (typeof input !== 'string') return null;
  const s = input.trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٫,]/g, '.');
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  const v = Number(w) * 100 + Number((f + '00').slice(0, 2));
  return v <= LIMITS.price ? v : null;
}

const str = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
const clean = v => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const cleanMultiline = v => (typeof v === 'string' ? v.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : '');

export function safeImage(v) {
  if (!v) return '';
  if (typeof v !== 'string' || v.length > 1000) throw new Error('INVALID_IMAGE');
  if (libraryKey(v)) return v;
  let u;
  try { u = new URL(v); } catch { throw new Error('INVALID_IMAGE'); }
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('INVALID_IMAGE');
  return u.href;
}
function safeLink(v) {
  if (!v) return '';
  let u;
  try { u = new URL(v); } catch { throw new Error('INVALID_LINK'); }
  if (u.protocol !== 'https:' || u.username || u.password || v.length > 500) throw new Error('INVALID_LINK');
  return u.href;
}
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Validates the editable venue profile. Unknown keys are dropped.
export function venueData(b) {
  if (!b || typeof b !== 'object') throw new Error('INVALID_VENUE');
  if (!str(b.name_ar, 2, 60)) throw new Error('INVALID_NAME');
  const d = {name_ar: clean(b.name_ar)};
  for (const [k, max] of [['name_en', 60], ['tagline_ar', 120], ['tagline_en', 120], ['address_ar', 160], ['address_en', 160], ['hours_note_ar', 80], ['hours_note_en', 80]]) {
    if (b[k] != null && b[k] !== '' && !str(b[k], 0, max)) throw new Error('INVALID_VENUE');
    d[k] = clean(b[k]);
  }
  for (const k of ['about_ar', 'about_en']) {
    if (b[k] != null && b[k] !== '' && !str(b[k], 0, 500)) throw new Error('INVALID_VENUE');
    d[k] = cleanMultiline(b[k]);
  }
  const phone = clean(b.phone).replace(/[\s-]/g, '');
  if (phone && !/^\+?\d{6,15}$/.test(phone)) throw new Error('INVALID_PHONE');
  d.phone = phone;
  const wa = clean(b.whatsapp).replace(/[\s+-]/g, '');
  if (wa && !/^\d{8,15}$/.test(wa)) throw new Error('INVALID_PHONE');
  d.whatsapp = wa;
  const ig = clean(b.instagram).replace(/^@/, '');
  if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) throw new Error('INVALID_VENUE');
  d.instagram = ig;
  d.map_url = safeLink(clean(b.map_url));
  d.open = TIME.test(b.open || '') ? b.open : '';
  d.close = TIME.test(b.close || '') ? b.close : '';
  if (!!d.open !== !!d.close) throw new Error('INVALID_HOURS');
  d.brand = /^#[0-9a-fA-F]{6}$/.test(b.brand || '') ? b.brand.toLowerCase() : '#1f4d45';
  d.logo = safeImage(clean(b.logo));
  return d;
}

export function categoryData(b) {
  if (!b || !str(b.name_ar, 1, 40)) throw new Error('INVALID_NAME');
  if (b.name_en && !str(b.name_en, 0, 40)) throw new Error('INVALID_NAME');
  return {name_ar: clean(b.name_ar), name_en: clean(b.name_en)};
}

export function itemData(b) {
  if (!b || !str(b.name_ar, 1, 80)) throw new Error('INVALID_NAME');
  if (b.name_en && !str(b.name_en, 0, 80)) throw new Error('INVALID_NAME');
  for (const k of ['desc_ar', 'desc_en']) if (b[k] && !str(b[k], 0, 300)) throw new Error('INVALID_DESCRIPTION');
  const badges = Array.isArray(b.badges) ? [...new Set(b.badges)] : [];
  if (badges.some(x => !Object.hasOwn(BADGES, x))) throw new Error('INVALID_BADGE');
  return {name_ar: clean(b.name_ar), name_en: clean(b.name_en), desc_ar: cleanMultiline(b.desc_ar), desc_en: cleanMultiline(b.desc_en), image: safeImage(clean(b.image)), badges};
}

// Opening status in the venue's local time (Saudi Arabia, UTC+3, no DST).
export function openState(open, close, date = new Date()) {
  if (!TIME.test(open || '') || !TIME.test(close || '')) return null;
  const mins = s => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const local = (date.getUTCHours() * 60 + date.getUTCMinutes() + 180) % 1440;
  const o = mins(open), c = mins(close);
  if (o === c) return {open: true, allDay: true};
  const isOpen = o < c ? local >= o && local < c : local >= o || local < c;
  return {open: isOpen, allDay: false};
}

export function timeText(hhmm, lang = 'ar') {
  if (!TIME.test(hhmm || '')) return '';
  let h = Number(hhmm.slice(0, 2)), m = hhmm.slice(3);
  const pm = h >= 12;
  h = h % 12 || 12;
  return lang === 'ar' ? `${h}:${m} ${pm ? 'م' : 'ص'}` : `${h}:${m} ${pm ? 'PM' : 'AM'}`;
}

// Arabic-aware search normalisation: strips diacritics and unifies alef/ya/ta-marbuta forms.
export function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[ً-ٰٟـ̀-ͯ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').trim();
}
export function matches(item, q) {
  const n = normalize(q);
  if (!n) return true;
  return n.split(/\s+/).every(w => normalize([item.name_ar, item.name_en, item.desc_ar, item.desc_en].join(' ')).includes(w));
}
