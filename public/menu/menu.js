// QR menu — public page (/menu/<slug>) and service landing (/menu). Vanilla JS, no build step.
import {BADGES, libraryKey, priceText, openState, timeText, matches} from './shared.js';

const $ = (s, el = document) => el.querySelector(s);
const root = $('#root');
const page = document.body.dataset.page;
const slug = document.body.dataset.slug;
const params = new URLSearchParams(location.search);
const preview = params.get('preview') === '1';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
let lang = params.get('lang') === 'en' || params.get('lang') === 'ar' ? params.get('lang') : (store.get('menu-lang') === 'en' ? 'en' : 'ar');
const t = (ar, en) => (lang === 'ar' ? ar : en);
const L = (o, k) => (lang === 'en' && o[k + '_en']) || o[k + '_ar'] || '';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
const cur = () => t('ر.س', 'SAR');

const ICONS = {
  search: '<path d="M11 4a7 7 0 1 0 4.4 12.4l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"/>',
  pin: '<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>',
  phone: '<path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/>',
  chat: '<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zm0 2a7 7 0 1 1-3.6 13l-.3-.2-2.3.6.6-2.2-.2-.3A7 7 0 0 1 12 5z"/>',
  camera: '<path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm5 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM17 6.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>',
  share: '<path d="M18 16a3 3 0 0 0-2.4 1.2l-6.8-3.4a3 3 0 0 0 0-1.6l6.8-3.4A3 3 0 1 0 15 7l-6.8 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z"/>',
  menu: '<path d="M5 4h14v2H5zm0 7h14v2H5zm0 7h10v2H5z"/>',
  alert: '<path d="M12 2 1 21h22zm-1 7h2v6h-2zm0 8h2v2h-2z"/>',
};
const icon = n => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[n]}</svg>`;

// Pick readable text on the venue colour (WCAG relative luminance).
function lum(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function applyBrand(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return;
  const s = document.documentElement.style;
  s.setProperty('--brand', hex);
  s.setProperty('--on-brand', contrast(hex, '#ffffff') >= 4.5 ? '#ffffff' : '#1d1a17');
  s.setProperty('--brand-ink', contrast(hex, '#fbf7f0') >= 4.5 ? hex : '#1d1a17');
  const mix = [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.12 + 255 * 0.88));
  s.setProperty('--brand-soft', `rgb(${mix.join(',')})`);
  $('meta[name="theme-color"]')?.setAttribute('content', hex);
}

async function getJSON(url) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, {signal: ctl.signal, credentials: 'same-origin'});
    let j = null;
    try { j = await r.json(); } catch { /* non-JSON */ }
    if (!r.ok) throw Object.assign(new Error(j?.error || 'SERVER_UNAVAILABLE'), {status: r.status});
    return j;
  } catch (e) {
    if (e.name === 'AbortError' || e instanceof TypeError) throw Object.assign(new Error('NETWORK'), {status: 0});
    throw e;
  } finally { clearTimeout(timer); }
}

function setLang(next) {
  lang = next;
  store.set('menu-lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  const u = new URL(location.href);
  if (lang === 'en') u.searchParams.set('lang', 'en'); else u.searchParams.delete('lang');
  history.replaceState(null, '', u);
}

function ribbon(demo) {
  if (!demo) return '';
  return `<div class="ribbon" role="note"><b>${t('نموذج تجريبي', 'Demo')}</b> — ${t('نشاط وبيانات افتراضية، والأسعار للعرض فقط.', 'Fictional venue and data; prices are for demonstration only.')}</div>`;
}

function stateView({art = 'menu', title, body, action = ''}) {
  return `<section class="state" role="status"><div class="art">${icon(art)}</div><h2>${title}</h2><p>${body}</p>${action}</section>`;
}

function skeleton() {
  root.innerHTML = `<div class="cover"><div class="cover-in" style="min-height:96px"></div></div><div class="wrap"><div class="venue"><div class="venue-card"><div class="logo sk"></div><div><div class="sk" style="height:24px;width:60%"></div><div class="sk" style="height:16px;width:80%;margin-top:8px"></div></div></div></div>${'<div class="sk" style="height:104px;margin-top:12px"></div>'.repeat(4)}<p class="sr" role="status">${t('جارٍ تحميل المنيو…', 'Loading menu…')}</p></div>`;
}

// ── Public menu ──────────────────────────────────────────────
let data = null, query = '';

function thumb(item, cls = 'thumb') {
  const initial = esc((L(item, 'name') || '؟').trim().charAt(0));
  if (!item.image) return `<div class="${cls}"><div class="noimg" aria-hidden="true"><span>${initial}</span></div></div>`;
  return `<div class="${cls}"><img src="${esc(item.image)}" alt="" loading="lazy" decoding="async" data-fallback="${initial}"></div>`;
}
function badgeList(item) {
  const b = (item.badges || []).filter(k => BADGES[k]);
  return b.length ? `<span class="badges">${b.map(k => `<span class="badge ${BADGES[k].tone}">${esc(BADGES[k][lang])}</span>`).join('')}</span>` : '';
}
function itemCard(item) {
  const name = L(item, 'name'), desc = L(item, 'desc');
  return `<li><button type="button" class="item${item.available ? '' : ' off'}" data-item="${esc(item.id)}" aria-haspopup="dialog">
    <span><h3>${esc(name)}</h3>${desc ? `<p class="desc">${esc(desc)}</p>` : ''}
    <span class="row"><span class="price">${priceText(item.price)}<small>${cur()}</small></span>${item.available ? '' : `<span class="soldout">${t('غير متوفر حاليًا', 'Unavailable now')}</span>`}${badgeList(item)}</span></span>
    ${thumb(item)}
  </button></li>`;
}

function venueHeader(v) {
  const st = openState(v.open, v.close);
  const hours = v.open ? `${timeText(v.open, lang)} – ${timeText(v.close, lang)}` : '';
  const chips = [];
  if (st) chips.push(st.allDay ? `<span class="chip open"><span class="dot"></span>${t('مفتوح ٢٤ ساعة', 'Open 24 hours')}</span>` : `<span class="chip ${st.open ? 'open' : 'closed'}"><span class="dot"></span>${st.open ? t('مفتوح الآن', 'Open now') + ` · ${t('يغلق', 'closes')} ${timeText(v.close, lang)}` : t('مغلق الآن', 'Closed now') + ` · ${t('يفتح', 'opens')} ${timeText(v.open, lang)}`}</span>`);
  if (L(v, 'address')) chips.push(`<span class="chip">${esc(L(v, 'address'))}</span>`);
  const acts = [];
  if (v.map_url) acts.push(`<a class="act" href="${esc(v.map_url)}" target="_blank" rel="noopener">${icon('pin')}${t('الموقع', 'Location')}</a>`);
  if (v.phone) acts.push(`<a class="act" href="tel:${esc(v.phone)}">${icon('phone')}${t('اتصال', 'Call')}</a>`);
  if (v.whatsapp) acts.push(`<a class="act" href="https://wa.me/${esc(v.whatsapp)}" target="_blank" rel="noopener">${icon('chat')}${t('واتساب', 'WhatsApp')}</a>`);
  if (v.instagram) acts.push(`<a class="act" href="https://instagram.com/${esc(v.instagram)}" target="_blank" rel="noopener">${icon('camera')}${t('انستقرام', 'Instagram')}</a>`);
  acts.push(`<button type="button" class="act" data-share>${icon('share')}${t('مشاركة المنيو', 'Share menu')}</button>`);
  const about = L(v, 'about');
  const dl = [
    hours && [t('ساعات العمل', 'Hours'), `${esc(L(v, 'hours_note'))} ${hours}`.trim() + ` <small>(${t('بتوقيت السعودية', 'Saudi time')})</small>`],
    L(v, 'address') && [t('العنوان', 'Address'), esc(L(v, 'address'))],
    v.phone && [t('الهاتف', 'Phone'), `<a href="tel:${esc(v.phone)}" dir="ltr">${esc(v.phone)}</a>`],
  ].filter(Boolean);
  const logo = v.logo ? `<img src="${esc(v.logo)}" alt="">` : esc(L(v, 'name').charAt(0));
  return `<div class="cover"><div class="cover-in"><span class="cover-tag">${t('المنيو الرقمي', 'Digital menu')}</span><button type="button" class="lang" data-lang lang="${lang === 'ar' ? 'en' : 'ar'}">${lang === 'ar' ? 'English' : 'العربية'}</button></div></div>
  <div class="wrap"><header class="venue"><div class="venue-card"><div class="logo">${logo}</div><h1>${esc(L(v, 'name'))}</h1><p class="tagline">${esc(L(v, 'tagline'))}</p>
    ${chips.length ? `<div class="meta">${chips.join('')}</div>` : ''}<div class="actions">${acts.join('')}</div></div></header>
    ${about || dl.length ? `<details class="about"><summary>${t('عن المكان وساعات العمل', 'About & opening hours')}</summary>${about ? `<p>${esc(about)}</p>` : ''}${dl.length ? `<dl>${dl.map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join('')}</dl>` : ''}</details>` : ''}
  </div>`;
}

function sectionsHtml() {
  const {categories, items} = data;
  if (!categories.length) return stateView({title: t('المنيو قيد الإعداد', 'The menu is being prepared'), body: t('لم يُضف صاحب المكان أي أصناف بعد. اطلب المنيو من فريق العمل.', 'No items have been added yet. Please ask the staff for the menu.')});
  if (query) {
    const hits = items.filter(i => matches(i, query));
    if (!hits.length) return stateView({art: 'search', title: t('لا توجد نتائج', 'No results'), body: t(`لم نجد صنفًا يطابق «${esc(query)}». جرّب كلمة أخرى.`, `Nothing matches “${esc(query)}”. Try another word.`), action: `<button class="btn ghost" type="button" data-clear>${t('مسح البحث', 'Clear search')}</button>`});
    return `<section class="section" aria-labelledby="res-h"><h2 id="res-h">${t('نتائج البحث', 'Search results')} <small>${hits.length}</small></h2><ul class="items">${hits.map(itemCard).join('')}</ul></section>`;
  }
  return categories.map(c => {
    const list = items.filter(i => i.category_id === c.id);
    return `<section class="section" id="cat-${esc(c.id)}" aria-labelledby="h-${esc(c.id)}"><h2 id="h-${esc(c.id)}">${esc(L(c, 'name'))} <small>${list.length ? t(`${list.length} صنف`, `${list.length} items`) : ''}</small></h2>${list.length ? `<ul class="items">${list.map(itemCard).join('')}</ul>` : `<p class="empty-cat">${t('لا توجد أصناف في هذا القسم حاليًا — قريبًا.', 'No items in this section yet — coming soon.')}</p>`}</section>`;
  }).join('');
}

function renderMenu() {
  const v = data.venue;
  document.title = `${L(v, 'name')} | ${t('المنيو', 'Menu')}`;
  const cats = data.categories;
  const many = data.items.length > 0;
  root.innerHTML = `<a class="skip" href="#menu-list">${t('انتقل إلى الأصناف', 'Skip to menu items')}</a>${ribbon(v.demo)}${venueHeader(v)}
  ${many ? `<div class="wrap"><div class="search" role="search"><label class="sr" for="q">${t('ابحث في المنيو', 'Search the menu')}</label>${icon('search').replace('<svg', '<svg class="ico"')}<input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="${t('ابحث عن صنف… مثل: لاتيه', 'Search… e.g. latte')}" value="${esc(query)}"><button type="button" class="clear" data-clear aria-label="${t('مسح البحث', 'Clear search')}" ${query ? '' : 'hidden'}>×</button></div></div>` : ''}
  ${cats.length > 1 && many ? `<nav class="cats" aria-label="${t('أقسام المنيو', 'Menu sections')}"><div class="cats-in">${cats.map((c, i) => `<a class="cat" href="#cat-${esc(c.id)}" data-cat="${esc(c.id)}" aria-current="${i === 0}">${esc(L(c, 'name'))}</a>`).join('')}</div></nav>` : ''}
  <main id="menu-list" class="wrap" tabindex="-1">${sectionsHtml()}</main>
  <footer class="foot wrap"><p>${t('الأسعار بالريال السعودي.', 'Prices are in Saudi riyals.')} ${t('للاستفسار عن المكونات ومسببات الحساسية يُرجى سؤال فريق العمل.', 'For ingredients and allergens, please ask the staff.')}</p>${v.demo ? `<p>${t('الصور رسومات توضيحية، وليست صورًا فعلية للأصناف.', 'Images are illustrations, not photos of the actual items.')}</p>` : ''}<p>${t('منيو رقمي عبر رمز QR', 'Digital QR menu')} · <a href="/menu">${t('عن الخدمة', 'About this service')}</a></p></footer>
  <dialog class="sheet" id="sheet" aria-labelledby="sheet-title"></dialog>`;
  wireImages(root);
  wireSpy();
  if (location.hash.startsWith('#cat-') && !renderMenu.done) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  renderMenu.done = true;
}

function wireImages(el) {
  el.querySelectorAll('img[data-fallback]').forEach(img => {
    const fail = () => { img.parentElement.innerHTML = `<div class="noimg" aria-hidden="true"><span>${img.dataset.fallback}</span></div>`; };
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fail();
    else img.addEventListener('error', fail, {once: true});
  });
}

let spy, chosen = null; // chosen: {id, until} — a tapped chip wins while its scroll settles
function wireSpy() {
  spy?.disconnect();
  const nav = $('.cats');
  if (!nav) return;
  const links = [...nav.querySelectorAll('.cat')];
  const mark = id => {
    links.forEach(a => a.setAttribute('aria-current', String(a.dataset.cat === id)));
    const a = links.find(x => x.dataset.cat === id);
    if (a) {
      const box = nav.firstElementChild, ar = a.getBoundingClientRect(), br = box.getBoundingClientRect();
      if (ar.left < br.left || ar.right > br.right) box.scrollBy({left: ar.left - br.left - (br.width - ar.width) / 2, behavior: 'smooth'});
    }
  };
  // Current section = the last one whose heading has reached the sticky bar
  // (or the last section once the page is scrolled to the bottom).
  const sections = [...document.querySelectorAll('.section[id^="cat-"]')];
  let last = '', queued = false;
  const update = () => {
    queued = false;
    const line = nav.getBoundingClientRect().bottom + 24;
    nav.classList.toggle('stuck', nav.getBoundingClientRect().top <= 0);
    let id = sections[0]?.id.slice(4);
    for (const s of sections) if (s.getBoundingClientRect().top <= line) id = s.id.slice(4);
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) id = sections.at(-1)?.id.slice(4);
    if (chosen && Date.now() < chosen.until) id = chosen.id;
    if (id && id !== last) { last = id; mark(id); }
  };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, {passive: true});
  spy = {disconnect: () => removeEventListener('scroll', onScroll)};
  update();
}

function openItem(id) {
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  const dlg = $('#sheet'), name = L(item, 'name'), other = lang === 'ar' ? item.name_en : '';
  const lib = libraryKey(item.image);
  dlg.innerHTML = `<span class="grab" aria-hidden="true"></span><button type="button" class="close" data-close aria-label="${t('إغلاق', 'Close')}">×</button>
  <figure class="sheet-img" style="margin:0">${item.image ? `<img src="${esc(item.image)}" alt="${esc(name)}" data-fallback="${esc(name.charAt(0))}">${lib ? `<figcaption>${t('رسم توضيحي', 'Illustration')}</figcaption>` : ''}` : `<div class="noimg" aria-hidden="true"><span>${esc(name.charAt(0))}</span></div><figcaption>${t('لا توجد صورة لهذا الصنف', 'No photo for this item')}</figcaption>`}</figure>
  <div class="sheet-body"><h2 id="sheet-title">${esc(name)}</h2>${other ? `<p class="en" lang="en" dir="ltr">${esc(other)}</p>` : ''}
  ${L(item, 'desc') ? `<p class="desc">${esc(L(item, 'desc'))}</p>` : ''}${badgeList(item)}
  <div class="sheet-foot"><span class="price">${priceText(item.price)}<small>${cur()}</small></span>${item.available ? `<span class="chip open"><span class="dot"></span>${t('متوفر', 'Available')}</span>` : `<span class="soldout">${t('غير متوفر حاليًا', 'Unavailable now')}</span>`}</div>
  <p class="note">${t('اطلب من فريق العمل. هذا المنيو للعرض فقط ولا يستقبل طلبات.', 'Order with the staff. This menu is for browsing only and does not take orders.')}</p></div>`;
  wireImages(dlg);
  dlg.showModal();
  $('[data-close]', dlg).focus();
}

async function share() {
  const url = location.origin + location.pathname;
  try {
    if (navigator.share) { await navigator.share({title: L(data.venue, 'name'), url}); return; }
    await navigator.clipboard.writeText(url);
    flash(t('نُسخ رابط المنيو', 'Menu link copied'));
  } catch (e) {
    if (e?.name !== 'AbortError') flash(t('تعذّر النسخ — انسخ الرابط من شريط العنوان', 'Could not copy — use the address bar'));
  }
}
function flash(msg) {
  let el = $('#flash');
  if (!el) { el = document.createElement('div'); el.id = 'flash'; el.setAttribute('role', 'status'); el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1d1a17;color:#fff;padding:10px 16px;border-radius:12px;z-index:99;font-size:15px;max-width:90vw'; document.body.append(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(flash.t); flash.t = setTimeout(() => { el.hidden = true; }, 2600);
}

function errorView(e, retry) {
  if (e.status === 404) return stateView({title: t('لم نعثر على هذا المنيو', 'Menu not found'), body: t('قد يكون الرابط غير صحيح أو أن المنيو لم يعد متاحًا. تأكد من رمز QR أو اسأل فريق العمل.', 'The link may be wrong or the menu is no longer available. Check the QR code or ask the staff.'), action: `<a class="btn ghost" href="/menu">${t('عن خدمة المنيو', 'About the menu service')}</a>`});
  return stateView({art: 'alert', title: t('تعذّر تحميل المنيو', 'Could not load the menu'), body: e.message === 'NETWORK' ? t('تحقق من اتصالك بالإنترنت ثم أعد المحاولة.', 'Check your connection and try again.') : t('حدث خطأ في الخادم. أعد المحاولة بعد لحظات.', 'A server error occurred. Please try again shortly.'), action: retry ? `<button class="btn" type="button" data-retry>${t('إعادة المحاولة', 'Try again')}</button>` : ''});
}

async function loadMenu() {
  skeleton();
  try {
    data = await getJSON(`/api/menu/venues/${encodeURIComponent(slug)}`);
    applyBrand(data.venue.brand);
    renderMenu();
  } catch (e) {
    root.innerHTML = `<div class="wrap">${errorView(e, true)}</div>`;
  }
}

// ── Service landing (/menu) ──────────────────────────────────
async function loadLanding() {
  document.title = t('منيو QR | خدمة المنيو الرقمي', 'QR Menu | Digital menu service');
  const head = `<div class="ribbon" role="note"><b>${t('نموذج تجريبي', 'Demo')}</b> — ${t('خدمة منيو رقمي مستقلة عن متجر رواق. كل الأنشطة والبيانات افتراضية.', 'A digital-menu service, separate from the RIWAQ store. All venues and data are fictional.')}</div>
  <section class="land-hero"><div class="wrap"><div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">${t('للمقاهي والمطاعم', 'For cafés & restaurants')}</span><button type="button" class="lang" data-lang>${lang === 'ar' ? 'English' : 'العربية'}</button></div>
  <h1>${t('منيو رقمي يفتح بمسح رمز QR', 'A digital menu that opens with a QR scan')}</h1>
  <p>${t('زبائنك يمسحون الرمز على الطاولة فيظهر المنيو على جوالهم فورًا، بلا تطبيق. وأنت تحدّث الأصناف والأسعار من لوحة بسيطة، ويظهر التعديل مباشرة.', 'Guests scan the code on the table and the menu opens on their phone instantly, no app needed. You update items and prices from a simple dashboard and changes show up right away.')}</p></div></section>`;
  root.innerHTML = head + `<div class="wrap land"><ol class="steps">
    <li><span><b>${t('يمسح الزبون الرمز', 'Guest scans the code')}</b><span>${t('بكاميرا الجوال مباشرة.', 'With the phone camera.')}</span></span></li>
    <li><span><b>${t('يتصفح المنيو', 'Browses the menu')}</b><span>${t('أقسام وبحث وصور وأسعار واضحة، بالعربية أو الإنجليزية.', 'Sections, search, images and clear prices, in Arabic or English.')}</span></span></li>
    <li><span><b>${t('تحدّثه أنت متى شئت', 'You update it anytime')}</b><span>${t('صنف نفد؟ اجعله «غير متوفر» بلمسة.', 'Sold out? Mark it unavailable in one tap.')}</span></span></li></ol>
    <h2>${t('جرّب النماذج', 'Try the demos')}</h2><div class="venues" id="venues"><div class="sk" style="height:120px"></div><div class="sk" style="height:120px"></div></div>
    <h2>${t('لصاحب النشاط', 'For the owner')}</h2><p style="color:var(--muted);margin:6px 0 12px">${t('لوحة الإدارة تتطلب تسجيل دخول حساب مسؤول معتمد، وهي متاحة في النسخة المحلية أو المستضافة بحماية الهوية.', 'The admin panel requires an authorised administrator sign-in and is available locally or on identity-protected hosting.')}</p><a class="btn" href="/menu-admin">${t('لوحة إدارة المنيو', 'Menu admin')}</a>
    <p class="note" style="margin-top:28px"><a href="/">${t('← العودة إلى متجر رواق', '← Back to the RIWAQ store')}</a></p></div>`;
  try {
    const {venues} = await getJSON('/api/menu/venues');
    $('#venues').innerHTML = venues.length ? venues.map(v => `<article class="vcard"><div class="logo" style="background:${esc(v.brand)};color:${contrast(v.brand, '#ffffff') >= 4.5 ? '#fff' : '#1d1a17'}">${v.logo ? `<img src="${esc(v.logo)}" alt="">` : esc(L(v, 'name').charAt(0))}</div><div><h3>${esc(L(v, 'name'))}</h3><p>${esc(L(v, 'tagline'))}</p></div><div class="links"><a class="btn" href="/menu/${esc(v.slug)}">${t('افتح المنيو', 'Open menu')}</a><a class="btn ghost" href="/menu-admin?venue=${esc(v.slug)}">${t('إدارته ورمز QR', 'Manage & QR code')}</a></div></article>`).join('') : `<p class="empty-cat">${t('لا توجد أنشطة بعد.', 'No venues yet.')}</p>`;
  } catch (e) {
    $('#venues').innerHTML = errorView(e, false);
  }
}

// ── Events ───────────────────────────────────────────────────
document.addEventListener('click', e => {
  const el = e.target.closest('[data-item],[data-close],[data-lang],[data-clear],[data-retry],[data-share],.cat');
  if (!el) {
    if (e.target.matches?.('dialog.sheet')) e.target.close(); // backdrop tap
    return;
  }
  if (el.dataset.item) openItem(el.dataset.item);
  else if (el.hasAttribute('data-close')) el.closest('dialog').close();
  else if (el.hasAttribute('data-lang')) { setLang(lang === 'ar' ? 'en' : 'ar'); if (page !== 'menu') loadLanding(); else if (data) renderMenu(); else loadMenu(); }
  else if (el.hasAttribute('data-clear')) { query = ''; renderMenu(); $('#q')?.focus(); }
  else if (el.hasAttribute('data-retry')) loadMenu();
  else if (el.hasAttribute('data-share')) share();
  else if (el.classList.contains('cat')) {
    e.preventDefault();
    const target = document.getElementById('cat-' + el.dataset.cat);
    if (target) {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      chosen = {id: el.dataset.cat, until: Date.now() + 1200};
      document.querySelectorAll('.cat').forEach(a => a.setAttribute('aria-current', String(a === el)));
      target.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'start'});
      history.replaceState(null, '', '#cat-' + el.dataset.cat);
    }
  }
});
document.addEventListener('input', e => {
  if (e.target.id !== 'q') return;
  query = e.target.value;
  $('#menu-list').innerHTML = sectionsHtml();
  wireImages($('#menu-list'));
  $('.cats')?.toggleAttribute('hidden', !!query.trim());
  $('.search .clear').hidden = !query;
  if (!query.trim()) wireSpy();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && e.target.id === 'q' && query) { query = ''; renderMenu(); $('#q')?.focus(); }
});

// Preview iframe in the admin asks for a refresh after each save.
window.addEventListener('message', e => {
  if (e.origin === location.origin && e.data === 'menu:reload' && page === 'menu') {
    const y = scrollY;
    getJSON(`/api/menu/venues/${encodeURIComponent(slug)}`).then(d => { data = d; applyBrand(d.venue.brand); renderMenu(); scrollTo(0, y); }).catch(() => loadMenu());
  }
});

setLang(lang);
if (preview) document.documentElement.classList.add('preview');
if (page === 'menu') loadMenu(); else loadLanding();
