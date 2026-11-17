// QR menu — owner admin (/menu-admin). Every write goes through the server, which
// re-checks the administrator identity; hiding controls here is never the guard.
import {BADGES, IMAGE_LIBRARY, libraryPath, libraryKey, priceText, parsePrice, itemData, categoryData, venueData} from './shared.js';
import {qrSvg, qrMatrix} from './qr.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = $('#root');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* private mode */ } },
};

const ERRORS = {
  VERSION_CONFLICT: 'تغيّرت هذه البيانات من نافذة أخرى. حمّلنا أحدث نسخة؛ أعد تعديلك من فضلك.',
  CATEGORY_NOT_EMPTY: 'لا يمكن حذف قسم فيه أصناف. انقل أصنافه إلى قسم آخر أو احذفها أولًا.',
  INVALID_NAME: 'الاسم العربي مطلوب.',
  INVALID_VENUE: 'بعض حقول معلومات النشاط أطول من المسموح أو غير صالحة.',
  INVALID_PRICE: 'السعر غير صالح. اكتب رقمًا مثل 18 أو 18.50 (حتى 10,000 ر.س).',
  INVALID_IMAGE: 'رابط الصورة يجب أن يبدأ بـ https://',
  INVALID_LINK: 'رابط الخريطة يجب أن يبدأ بـ https://',
  INVALID_PHONE: 'رقم الهاتف أو واتساب غير صالح. اكتب الأرقام مع رمز الدولة، مثل 9665XXXXXXXX.',
  INVALID_HOURS: 'حدّد وقتي الفتح والإغلاق معًا، أو اتركهما فارغين.',
  INVALID_DESCRIPTION: 'الوصف أطول من 300 حرف.',
  INVALID_BADGE: 'شارة غير معروفة.',
  INVALID_CATEGORY: 'اختر قسمًا صالحًا لهذا الصنف.',
  TOO_MANY_CATEGORIES: 'وصلت إلى الحد الأقصى لعدد الأقسام (30).',
  TOO_MANY_ITEMS: 'وصلت إلى الحد الأقصى لعدد الأصناف (300).',
  NOT_A_DEMO_VENUE: 'الاستعادة متاحة للأنشطة التجريبية فقط.',
  MENU_NOT_FOUND: 'لم نعثر على هذا النشاط.',
  NOT_FOUND: 'العنصر لم يعد موجودًا — ربما حُذف من نافذة أخرى.',
  FORBIDDEN: 'انتهت الجلسة أو لا تملك صلاحية الإدارة. سجّل الدخول مجددًا.',
  RATE_LIMITED: 'طلبات كثيرة خلال دقيقة واحدة. انتظر قليلًا ثم أعد المحاولة.',
  BODY_TOO_LARGE: 'البيانات المرسلة أكبر من المسموح.',
  NETWORK: 'تعذّر الاتصال بالخادم. تحقق من الاتصال ثم أعد المحاولة.',
  DATABASE_NOT_CONFIGURED: 'قاعدة البيانات غير مهيأة. شغّل pnpm db:setup ثم أعد تشغيل الخادم.',
  INTERNAL_ERROR: 'حدث خطأ في الخادم. إن كانت هذه أول مرة تشغّل فيها المنيو محليًا، شغّل pnpm db:setup لإنشاء جداوله.',
};
const errText = e => ERRORS[e?.message] || ERRORS.INTERNAL_ERROR;

async function api(path, {method = 'GET', body} = {}) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(path, {method, credentials: 'same-origin', signal: ctl.signal, headers: body ? {'Content-Type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
    let j = null;
    try { j = await r.json(); } catch { /* non-JSON */ }
    if (!r.ok) throw Object.assign(new Error(j?.error || 'INTERNAL_ERROR'), {status: r.status});
    return j;
  } catch (e) {
    if (e.name === 'AbortError' || e instanceof TypeError) throw Object.assign(new Error('NETWORK'), {status: 0});
    throw e;
  } finally { clearTimeout(timer); }
}

function toast(msg, kind = 'ok') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast ' + kind;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, kind === 'err' ? 6000 : 2800);
}

function confirmBox(message, {ok = 'تأكيد', danger = false} = {}) {
  return new Promise(resolve => {
    const d = $('#confirm');
    d.innerHTML = `<form method="dialog" class="confirm"><p>${message}</p><div class="dlg-actions"><button class="btn ghost" value="no">إلغاء</button><button class="btn${danger ? ' danger' : ''}" value="yes">${ok}</button></div></form>`;
    d.addEventListener('close', () => resolve(d.returnValue === 'yes'), {once: true});
    d.returnValue = '';
    d.showModal();
    $('button[value="no"]', d).focus();
  });
}

async function busy(btn, fn) {
  if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  try { return await fn(); } finally { if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); } }
}

// ── State ──
let venues = [], slug = '', M = null, tab = 'items';
const TABS = [['items', 'الأصناف'], ['info', 'معلومات النشاط'], ['qr', 'رمز QR'], ['preview', 'معاينة']];
const cur = 'ر.س';
const catItems = id => M.items.filter(i => i.category_id === id);
const menuUrlFor = base => `${(base || location.origin).replace(/\/+$/, '')}/menu/${slug}`;

function pingPreview() {
  $$('iframe.pv').forEach(f => { try { f.contentWindow.postMessage('menu:reload', location.origin); } catch { /* not loaded yet */ } });
}

async function reload() {
  M = await api(`/api/menu/admin/venues/${slug}`);
  renderTab();
  pingPreview();
}

async function mutate(btn, fn, okMsg) {
  try {
    await busy(btn, fn);
    if (okMsg) toast(okMsg);
    await reload();
    return true;
  } catch (e) {
    toast(errText(e), 'err');
    if (e.message === 'VERSION_CONFLICT' || e.message === 'NOT_FOUND') await reload().catch(() => {});
    if (e.message === 'FORBIDDEN') setTimeout(gate, 1200);
    return false;
  }
}

// ── Gate: server decides who is an admin ──
async function gate() {
  root.innerHTML = '<p class="boot" role="status">جارٍ التحقق من الصلاحية…</p>';
  let me;
  try { me = await api('/api/me'); } catch (e) { root.innerHTML = page(`<h1>تعذّر الوصول للخادم</h1><p>${errText(e)}</p><button class="btn" data-act="regate">إعادة المحاولة</button>`); return; }
  if (me.adminAvailable === false) {
    root.innerHTML = page(`<h1>لوحة الإدارة غير متاحة في هذا الرابط</h1><p>هذه نسخة عرض عامة بلا حماية هوية، لذلك أُغلقت الإدارة فيها على مستوى الخادم. جرّب المنيو العام، أو شغّل المشروع محليًا لتجربة الإدارة.</p><a class="btn" href="/menu">عرض نماذج المنيو</a>`);
    return;
  }
  if (!me.admin) {
    const ret = encodeURIComponent(location.pathname + location.search);
    root.innerHTML = page(me.signedIn
      ? `<h1>حسابك غير مخوّل بالإدارة</h1><p>سجّلت الدخول، لكن هذا الحساب ليس ضمن قائمة المسؤولين (ADMIN_EMAIL) في إعدادات الخادم.</p><a class="btn ghost" href="/signout-with-chatgpt?return_to=${ret}">تسجيل الخروج</a>`
      : `<h1>إدارة المنيو محمية</h1><p>سجّل الدخول بحساب المسؤول المعتمد لتعديل المنيو. في التشغيل المحلي يتوفر حساب الاختبار المحلي فقط على هذا الجهاز.</p><a class="btn" target="_top" href="/signin-with-chatgpt?return_to=${ret}">تسجيل الدخول</a>`);
    return;
  }
  try {
    venues = (await api('/api/menu/admin/venues')).venues;
  } catch (e) { root.innerHTML = page(`<h1>تعذّر تحميل الأنشطة</h1><p>${errText(e)}</p><button class="btn" data-act="regate">إعادة المحاولة</button>`); return; }
  if (!venues.length) { root.innerHTML = page('<h1>لا توجد أنشطة بعد</h1><p>فعّل بيانات النموذج بضبط CATALOG_SEED=demo في ‎.dev.vars ثم أعد التشغيل.</p>'); return; }
  const want = new URLSearchParams(location.search).get('venue');
  slug = venues.some(v => v.slug === want) ? want : venues[0].slug;
  const h = location.hash.slice(1);
  if (TABS.some(([k]) => k === h)) tab = h;
  await openVenue();
}
const page = inner => `<main class="gate"><a class="mark" href="/menu">منيو QR</a><section>${inner}</section></main>`;

async function openVenue() {
  root.innerHTML = '<p class="boot" role="status">جارٍ تحميل المنيو…</p>';
  try { M = await api(`/api/menu/admin/venues/${slug}`); } catch (e) { root.innerHTML = page(`<h1>تعذّر تحميل المنيو</h1><p>${errText(e)}</p><button class="btn" data-act="regate">إعادة المحاولة</button>`); return; }
  const u = new URL(location.href); u.searchParams.set('venue', slug); history.replaceState(null, '', u);
  shell();
}

function shell() {
  document.title = `إدارة المنيو | ${M.venue.name_ar}`;
  root.innerHTML = `<header class="atop"><div class="atop-in">
    <a class="mark" href="/menu" aria-label="خدمة منيو QR — الصفحة الرئيسية">منيو QR</a><span class="pill">لوحة الإدارة${M.venue.demo ? ' · بيانات تجريبية' : ''}</span>
    <label class="vsel"><span class="sr">النشاط</span><select id="venue">${venues.map(v => `<option value="${esc(v.slug)}"${v.slug === slug ? ' selected' : ''}>${esc(v.name_ar)}</option>`).join('')}</select></label>
    <span class="grow"></span>
    <a class="btn ghost sm" href="/menu/${esc(slug)}" target="_blank" rel="noopener">فتح المنيو ↗</a>
    <a class="link sm" href="/signout-with-chatgpt?return_to=%2Fmenu">خروج</a></div></header>
  <div class="alayout"><div class="apanel">
    <nav class="tabs" role="tablist" aria-label="أقسام الإدارة">${TABS.map(([k, n]) => `<button type="button" role="tab" id="t-${k}" aria-controls="p-${k}" aria-selected="${tab === k}" data-tab="${k}"${k === 'preview' ? ' class="only-sm"' : ''}>${n}</button>`).join('')}</nav>
    <div id="panel" role="tabpanel" tabindex="-1"></div></div>
    <aside class="apreview" aria-label="معاينة حية"><div class="phone"><iframe class="pv" src="/menu/${esc(slug)}?preview=1" title="معاينة المنيو كما يراه الزبون"></iframe></div><p class="hint">معاينة حيّة — تتحدّث بعد كل حفظ.</p></aside></div>
  <dialog id="itemdlg" class="adlg" aria-labelledby="itemdlg-h"></dialog><dialog id="confirm" class="adlg small"></dialog>`;
  if (tab === 'preview' && matchMedia('(min-width: 1000px)').matches) tab = 'items';
  renderTab();
}

function renderTab() {
  $$('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  const p = $('#panel');
  if (!p) return;
  p.setAttribute('aria-labelledby', 't-' + tab);
  p.id = 'panel';
  p.innerHTML = {items: itemsTab, info: infoTab, qr: qrTab, preview: previewTab}[tab]();
  if (tab === 'qr') drawQr();
  if (tab === 'info') updateContrast();
}

// ── Items tab ──
const ICON = {
  up: '<path d="M12 5l-7 7h4v7h6v-7h4z"/>', down: '<path d="M12 19l7-7h-4V5H9v7H5z"/>',
  edit: '<path d="M4 17.3V20h2.7l8-8-2.7-2.7zM19.7 7a1 1 0 0 0 0-1.4l-1.3-1.3a1 1 0 0 0-1.4 0l-1.5 1.5 2.7 2.7z"/>',
  del: '<path d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2zM9 4h6l1 1h4v2H4V5h4z"/>',
};
const ib = (name, label, attrs, disabled = false) => `<button type="button" class="ibtn" aria-label="${label}" title="${label}" ${attrs}${disabled ? ' disabled' : ''}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICON[name]}</svg></button>`;
const thumbHtml = it => it.image ? `<span class="athumb"><img src="${esc(it.image)}" alt="" loading="lazy"></span>` : `<span class="athumb none" aria-hidden="true">${esc(it.name_ar.charAt(0))}</span>`;

function itemsTab() {
  const off = M.items.filter(i => !i.available).length;
  const cats = M.categories;
  return `<div class="tabhead"><div><h1>الأقسام والأصناف</h1><p class="sub">${cats.length} قسم · ${M.items.length} صنف${off ? ` · ${off} غير متوفر` : ''}</p></div></div>
  <form class="addcat card" data-form="addcat"><label for="nc">قسم جديد</label><div class="row"><input id="nc" name="name_ar" required maxlength="40" placeholder="مثل: الفطور، العصائر، الحلويات"><input name="name_en" maxlength="40" placeholder="English name (optional)" dir="ltr" lang="en" aria-label="الاسم بالإنجليزية (اختياري)"><button class="btn" type="submit">إضافة القسم</button></div></form>
  ${cats.length ? '' : '<div class="card emptybox"><h2>المنيو فارغ</h2><p>ابدأ بإضافة قسم مثل «القهوة الساخنة»، ثم أضف إليه الأصناف. هكذا يبدو المنيو الآن للزبون: رسالة «المنيو قيد الإعداد».</p></div>'}
  ${cats.map((c, ci) => {
    const list = catItems(c.id);
    return `<section class="acat card" aria-labelledby="ac-${esc(c.id)}">
      <header class="acat-h"><div class="acat-name" id="cn-${esc(c.id)}"><h2 id="ac-${esc(c.id)}">${esc(c.name_ar)}</h2>${c.name_en ? `<span class="en" dir="ltr">${esc(c.name_en)}</span>` : ''}<span class="count">${list.length} صنف</span></div>
      <div class="tools">${ib('up', 'نقل القسم لأعلى', `data-act="cat-up" data-id="${esc(c.id)}"`, ci === 0)}${ib('down', 'نقل القسم لأسفل', `data-act="cat-down" data-id="${esc(c.id)}"`, ci === cats.length - 1)}${ib('edit', 'تعديل اسم القسم', `data-act="cat-edit" data-id="${esc(c.id)}"`)}${ib('del', 'حذف القسم', `data-act="cat-del" data-id="${esc(c.id)}"`)}</div></header>
      ${list.length ? `<ul class="arows">${list.map((it, ii) => `<li class="arow${it.available ? '' : ' off'}">${thumbHtml(it)}
        <span class="ainfo"><b>${esc(it.name_ar)}</b><span class="ameta"><span class="aprice">${priceText(it.price)} ${cur}</span>${(it.badges || []).map(k => BADGES[k] ? `<span class="tag">${esc(BADGES[k].ar)}</span>` : '').join('')}</span></span>
        <label class="switch" title="ظهور الصنف كمتاح"><input type="checkbox" data-act="avail" data-id="${esc(it.id)}"${it.available ? ' checked' : ''}><span class="track" aria-hidden="true"></span><span class="lbl">${it.available ? 'متوفر' : 'غير متوفر'}</span><span class="sr"> — ${esc(it.name_ar)}</span></label>
        <span class="tools">${ib('up', `نقل «${esc(it.name_ar)}» لأعلى`, `data-act="item-up" data-id="${esc(it.id)}"`, ii === 0)}${ib('down', `نقل «${esc(it.name_ar)}» لأسفل`, `data-act="item-down" data-id="${esc(it.id)}"`, ii === list.length - 1)}${ib('edit', `تعديل «${esc(it.name_ar)}»`, `data-act="item-edit" data-id="${esc(it.id)}"`)}</span></li>`).join('')}</ul>` : '<p class="emptyline">لا أصناف في هذا القسم بعد. سيظهر للزبون كقسم «قريبًا».</p>'}
      <button type="button" class="addbtn" data-act="item-new" data-cat="${esc(c.id)}">+ إضافة صنف إلى «${esc(c.name_ar)}»</button></section>`;
  }).join('')}`;
}

function catEditForm(c) {
  return `<form class="catedit" data-form="catedit" data-id="${esc(c.id)}"><label class="sr" for="ce-ar">اسم القسم</label><input id="ce-ar" name="name_ar" required maxlength="40" value="${esc(c.name_ar)}"><input name="name_en" maxlength="40" dir="ltr" lang="en" aria-label="الاسم بالإنجليزية" placeholder="English" value="${esc(c.name_en)}"><button class="btn sm" type="submit">حفظ</button><button class="btn ghost sm" type="button" data-act="cat-cancel">إلغاء</button></form>`;
}

async function move(kind, id, dir, btn) {
  const list = kind === 'categories' ? M.categories : catItems(M.items.find(i => i.id === id).category_id);
  const ids = list.map(x => x.id), i = ids.indexOf(id), j = i + dir;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const body = {kind, ids, ...(kind === 'items' ? {category_id: list[0].category_id} : {})};
  await mutate(btn, () => api(`/api/menu/admin/venues/${slug}/reorder`, {method: 'POST', body}));
  $(`[data-act="${kind === 'categories' ? 'cat' : 'item'}-${dir < 0 ? 'up' : 'down'}"][data-id="${id}"]`)?.focus();
}

// ── Item dialog ──
function itemDialog(item, catId) {
  const d = $('#itemdlg'), isNew = !item;
  const it = item || {name_ar: '', name_en: '', desc_ar: '', desc_en: '', price: null, image: '', badges: [], available: true, category_id: catId};
  const lib = libraryKey(it.image), ext = it.image && !lib ? it.image : '';
  const imgChoice = !it.image ? 'none' : lib || 'url';
  d.innerHTML = `<form class="iform" data-form="item" novalidate>
  <header class="dlg-h"><h2 id="itemdlg-h">${isNew ? 'صنف جديد' : 'تعديل الصنف'}</h2><button type="button" class="ibtn x" data-act="dlg-close" aria-label="إغلاق">×</button></header>
  <div class="dlg-body">
    <div class="err" role="alert" hidden></div>
    <div class="grid2"><div class="field"><label for="f-name_ar">الاسم بالعربية <span class="req">*</span></label><input id="f-name_ar" name="name_ar" required maxlength="80" value="${esc(it.name_ar)}"></div>
    <div class="field"><label for="f-name_en">الاسم بالإنجليزية <span class="opt">اختياري</span></label><input id="f-name_en" name="name_en" maxlength="80" dir="ltr" lang="en" value="${esc(it.name_en)}"></div></div>
    <div class="field"><label for="f-desc_ar">الوصف بالعربية <span class="opt">اختياري</span></label><textarea id="f-desc_ar" name="desc_ar" maxlength="300" rows="2" placeholder="المكوّنات أو طريقة التحضير، كما يقدّمها المقهى فعلًا.">${esc(it.desc_ar)}</textarea></div>
    <div class="field"><label for="f-desc_en">الوصف بالإنجليزية <span class="opt">اختياري</span></label><textarea id="f-desc_en" name="desc_en" maxlength="300" rows="2" dir="ltr" lang="en">${esc(it.desc_en)}</textarea></div>
    <div class="grid2"><div class="field"><label for="f-price">السعر <span class="req">*</span></label><div class="suffix"><input id="f-price" name="price" inputmode="decimal" required placeholder="18.00" dir="ltr" value="${it.price != null ? esc((it.price / 100).toFixed(it.price % 100 ? 2 : 0)) : ''}"><span>${cur}</span></div></div>
    <div class="field"><label for="f-cat">القسم</label><select id="f-cat" name="category_id">${M.categories.map(c => `<option value="${esc(c.id)}"${c.id === it.category_id ? ' selected' : ''}>${esc(c.name_ar)}</option>`).join('')}</select></div></div>
    <label class="switch big"><input type="checkbox" name="available"${it.available ? ' checked' : ''}><span class="track" aria-hidden="true"></span><span>متوفر الآن <small>— أطفئه عند نفاد الصنف، ويبقى ظاهرًا للزبون كـ«غير متوفر حاليًا».</small></span></label>
    <fieldset class="field"><legend>الصورة</legend><div class="imgpick">
      <label class="ip"><input type="radio" name="imgsel" value="none"${imgChoice === 'none' ? ' checked' : ''}><span class="ipbox none">بلا صورة</span></label>
      ${Object.entries(IMAGE_LIBRARY).map(([k, v]) => `<label class="ip"><input type="radio" name="imgsel" value="${k}"${imgChoice === k ? ' checked' : ''}><span class="ipbox"><img src="${libraryPath(k)}" alt=""><span>${v.ar}</span></span></label>`).join('')}
      <label class="ip"><input type="radio" name="imgsel" value="url"${imgChoice === 'url' ? ' checked' : ''}><span class="ipbox none">رابط صورة</span></label></div>
      <input name="image_url" type="url" dir="ltr" inputmode="url" placeholder="https://…/photo.jpg" value="${esc(ext)}" aria-label="رابط صورة خارجية (https)" ${imgChoice === 'url' ? '' : 'hidden'}>
      <p class="help">الصور المضمّنة رسومات توضيحية ويُكتب ذلك للزبون. لا يوجد رفع ملفات في هذا النموذج؛ للصورة الحقيقية الصق رابط https لصورة تملك حق استخدامها.</p></fieldset>
    <fieldset class="field"><legend>الشارات <span class="opt">اختياري</span></legend><div class="badgepick">${Object.entries(BADGES).map(([k, b]) => `<label class="bp"><input type="checkbox" name="badges" value="${k}"${(it.badges || []).includes(k) ? ' checked' : ''}><span>${b.ar}</span></label>`).join('')}</div>
      <p class="help">شارات مثل «نباتي» و«خالٍ من الغلوتين» معلومات غذائية يعتمد عليها الزبون؛ لا تفعّلها إلا إذا تأكّدت من صحتها.</p></fieldset>
  </div>
  <footer class="dlg-f">${isNew ? '' : `<button type="button" class="btn danger ghost" data-act="item-del" data-id="${esc(item.id)}">حذف الصنف</button>`}<span class="grow"></span><button type="button" class="btn ghost" data-act="dlg-close">إلغاء</button><button type="submit" class="btn">${isNew ? 'إضافة الصنف' : 'حفظ التعديلات'}</button></footer></form>`;
  d.dataset.id = item?.id || '';
  d.showModal();
  $('#f-name_ar', d).focus();
}

function readItemForm(f) {
  const fd = new FormData(f), sel = fd.get('imgsel');
  return {
    name_ar: fd.get('name_ar'), name_en: fd.get('name_en'), desc_ar: fd.get('desc_ar'), desc_en: fd.get('desc_en'),
    price: parsePrice(fd.get('price')), category_id: fd.get('category_id'), available: fd.get('available') === 'on',
    image: sel === 'none' ? '' : sel === 'url' ? String(fd.get('image_url') || '').trim() : libraryPath(sel),
    badges: fd.getAll('badges'),
  };
}
function formError(f, msg, field) {
  const box = $('.err', f);
  box.textContent = msg; box.hidden = false;
  $$('[aria-invalid]', f).forEach(x => x.removeAttribute('aria-invalid'));
  if (field) { const el = f.elements[field]; if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } }
}

async function saveItem(f, btn) {
  const b = readItemForm(f), id = $('#itemdlg').dataset.id;
  if (!b.name_ar?.trim()) return formError(f, 'اكتب اسم الصنف بالعربية.', 'name_ar');
  if (b.price == null) return formError(f, ERRORS.INVALID_PRICE, 'price');
  if ($('[name=imgsel]:checked', f)?.value === 'url' && !b.image) return formError(f, 'الصق رابط الصورة أو اختر «بلا صورة».', 'image_url');
  try { itemData(b); } catch (e) { return formError(f, errText(e), e.message === 'INVALID_IMAGE' ? 'image_url' : e.message === 'INVALID_DESCRIPTION' ? 'desc_ar' : 'name_ar'); }
  try {
    await busy(btn, () => id
      ? api(`/api/menu/admin/items/${id}`, {method: 'PATCH', body: {...b, version: M.items.find(i => i.id === id).version}})
      : api(`/api/menu/admin/venues/${slug}/items`, {method: 'POST', body: b}));
  } catch (e) {
    formError(f, errText(e));
    if (e.message === 'VERSION_CONFLICT' || e.message === 'NOT_FOUND') reload().catch(() => {});
    return;
  }
  $('#itemdlg').close();
  toast(id ? `حُفظ «${b.name_ar}» — التعديل ظاهر الآن في المنيو` : `أُضيف «${b.name_ar}» إلى المنيو`);
  await reload().catch(e => toast(errText(e), 'err'));
}

// ── Info tab ──
function infoTab() {
  const v = M.venue;
  const f = (name, label, {type = 'text', max = 120, en = false, hint = '', ph = '', area = false} = {}) => `<div class="field"><label for="v-${name}">${label}</label>${area
    ? `<textarea id="v-${name}" name="${name}" maxlength="${max}" rows="3"${en ? ' dir="ltr" lang="en"' : ''} placeholder="${esc(ph)}">${esc(v[name])}</textarea>`
    : `<input id="v-${name}" name="${name}" type="${type}" maxlength="${max}"${en ? ' dir="ltr" lang="en"' : ''} placeholder="${esc(ph)}" value="${esc(v[name])}">`}${hint ? `<p class="help">${hint}</p>` : ''}</div>`;
  return `<div class="tabhead"><div><h1>معلومات النشاط</h1><p class="sub">تظهر في أعلى المنيو. الحقول الفارغة لا تظهر للزبون.</p></div></div>
  <form class="card vform" data-form="venue" novalidate><div class="err" role="alert" hidden></div>
    <fieldset><legend>الاسم والهوية</legend><div class="grid2">${f('name_ar', 'اسم النشاط بالعربية <span class="req">*</span>', {max: 60})}${f('name_en', 'الاسم بالإنجليزية', {max: 60, en: true})}${f('tagline_ar', 'سطر تعريفي', {ph: 'مثل: قهوة مختصة وحلويات بيتية'})}${f('tagline_en', 'Tagline (English)', {en: true})}</div>
    <div class="grid2"><div class="field"><label for="v-brand">لون الهوية</label><div class="colorrow"><input id="v-brand" name="brand" type="color" value="${esc(v.brand || '#1f4d45')}"><output id="contrast" class="help"></output></div></div>
    ${f('logo', 'رابط الشعار <span class="opt">اختياري</span>', {type: 'url', max: 1000, en: true, ph: 'https://…/logo.png', hint: 'بدونه يظهر الحرف الأول من الاسم. لا يوجد رفع ملفات في هذا النموذج.'})}</div></fieldset>
    <fieldset><legend>نبذة</legend><div class="grid2">${f('about_ar', 'نبذة بالعربية', {max: 500, area: true})}${f('about_en', 'About (English)', {max: 500, area: true, en: true})}</div></fieldset>
    <fieldset><legend>الموقع والتواصل</legend><div class="grid2">${f('address_ar', 'العنوان', {max: 160, ph: 'الحي، المدينة'})}${f('address_en', 'Address (English)', {max: 160, en: true})}
      ${f('map_url', 'رابط الخريطة', {type: 'url', max: 500, en: true, ph: 'https://maps.app.goo.gl/…', hint: 'يظهر زر «الموقع» عند إضافته.'})}${f('phone', 'رقم الهاتف', {type: 'tel', max: 20, en: true, ph: '+9661XXXXXXXX'})}
      ${f('whatsapp', 'واتساب', {type: 'tel', max: 20, en: true, ph: '9665XXXXXXXX', hint: 'بالأرقام مع رمز الدولة دون +.'})}${f('instagram', 'حساب انستقرام', {max: 31, en: true, ph: 'username'})}</div></fieldset>
    <fieldset><legend>ساعات العمل <span class="opt">بتوقيت السعودية</span></legend><div class="grid3"><div class="field"><label for="v-open">يفتح</label><input id="v-open" name="open" type="time" value="${esc(v.open)}"></div><div class="field"><label for="v-close">يغلق</label><input id="v-close" name="close" type="time" value="${esc(v.close)}"></div>${f('hours_note_ar', 'ملاحظة', {max: 80, ph: 'يوميًا / عدا الجمعة'})}</div>
      <p class="help">يحسب المنيو حالة «مفتوح الآن / مغلق الآن» من هذين الوقتين. اتركهما فارغين لإخفاء الحالة. الإغلاق بعد منتصف الليل مدعوم.</p>${f('hours_note_en', 'Hours note (English)', {max: 80, en: true})}</fieldset>
    <div class="savebar"><button class="btn" type="submit">حفظ المعلومات</button></div>
  </form>
  ${v.demo ? `<section class="card danger-zone"><h2>بيانات النموذج</h2><p>أعد هذا النشاط التجريبي إلى أصنافه ومعلوماته الأصلية. يُحذف كل ما أضفته أو عدّلته فيه.</p><button type="button" class="btn danger ghost" data-act="reset">استعادة النموذج الأصلي</button></section>` : ''}`;
}

function updateContrast() {
  const inp = $('#v-brand'), out = $('#contrast');
  if (!inp || !out) return;
  const hex = inp.value, lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const r = Math.max(ratio(hex, '#ffffff'), ratio(hex, '#1d1a17'));
  out.textContent = ratio(hex, '#fbf7f0') >= 4.5 ? 'لون واضح للنصوص والأزرار.' : r >= 4.5 ? 'لون فاتح: سيُستخدم نص داكن فوقه تلقائيًا للحفاظ على الوضوح.' : 'تباين ضعيف — اختر لونًا أغمق أو أفتح.';
}

async function saveVenue(f, btn) {
  const fd = new FormData(f), b = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  try { venueData(b); } catch (e) {
    const map = {INVALID_NAME: 'name_ar', INVALID_PHONE: b.phone && !/^\+?\d{6,15}$/.test(b.phone.replace(/[\s-]/g, '')) ? 'phone' : 'whatsapp', INVALID_HOURS: 'open', INVALID_LINK: 'map_url', INVALID_IMAGE: 'logo'};
    return formError(f, e.message === 'INVALID_NAME' ? 'اسم النشاط بالعربية مطلوب (حرفان على الأقل).' : errText(e), map[e.message]);
  }
  try {
    await busy(btn, () => api(`/api/menu/admin/venues/${slug}`, {method: 'PATCH', body: {version: M.venue.version, data: b}}));
  } catch (e) {
    formError(f, errText(e));
    if (e.message === 'VERSION_CONFLICT') reload().catch(() => {});
    return;
  }
  toast('حُفظت معلومات النشاط — ظاهرة الآن في المنيو');
  venues = venues.map(v => v.slug === slug ? {...v, name_ar: b.name_ar} : v);
  const opt = $(`#venue option[value="${slug}"]`); if (opt) opt.textContent = b.name_ar;
  await reload().catch(e => toast(errText(e), 'err'));
}

// ── QR tab ──
const isLocalHost = h => /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.endsWith('.local') || h.endsWith('.localhost');
function qrTab() {
  const base = store.get('menu-public-base') || '';
  return `<div class="tabhead"><div><h1>رمز QR</h1><p class="sub">اطبعه على بطاقة الطاولة أو الواجهة. يفتح المنيو العام مباشرة.</p></div></div>
  <div class="qrgrid"><section class="card qrcard" id="qrcard"><div class="qrname">${esc(M.venue.name_ar)}</div><div class="qrbox" id="qrbox"></div><div class="qrcta">امسح الرمز لعرض المنيو</div><div class="qrurl" id="qrurl" dir="ltr"></div></section>
  <section class="card qrside"><div id="qrwarn"></div>
    <div class="field"><label>رابط المنيو</label><div class="copyrow"><input id="qrlink" readonly dir="ltr"><button type="button" class="btn sm" data-act="copy">نسخ</button></div></div>
    <div class="btnrow"><a class="btn ghost sm" id="qropen" target="_blank" rel="noopener">فتح الرابط ↗</a><button type="button" class="btn ghost sm" data-act="dl-svg">تنزيل SVG</button><button type="button" class="btn ghost sm" data-act="dl-png">تنزيل PNG</button><button type="button" class="btn ghost sm" data-act="print">طباعة بطاقة الطاولة</button></div>
    <form class="field" data-form="qrbase"><label for="qrbase">الرابط العام بعد النشر <span class="opt">اختياري</span></label><div class="copyrow"><input id="qrbase" name="base" type="url" dir="ltr" placeholder="https://menu.example.com" value="${esc(base)}"><button class="btn ghost sm" type="submit">توليد</button></div>
      <p class="help">إذا نشرت المشروع على نطاق عام، اكتب عنوانه هنا ليُولَّد الرمز له. يُحفظ في هذا المتصفح فقط، ولا نتحقق من أن الرابط منشور فعلًا — جرّبه بمسح الرمز قبل الطباعة.</p>${base ? '<button type="button" class="link" data-act="qrbase-clear">العودة لرابط هذا الخادم</button>' : ''}</form>
  </section></div>`;
}
function currentQrUrl() { return menuUrlFor(store.get('menu-public-base') || ''); }
function drawQr() {
  const url = currentQrUrl(), host = new URL(url).hostname;
  $('#qrbox').innerHTML = qrSvg(url, {title: `رمز QR لمنيو ${M.venue.name_ar}`, dark: '#111'});
  $('#qrurl').textContent = url.replace(/^https?:\/\//, '');
  $('#qrlink').value = url;
  $('#qropen').href = url;
  const local = isLocalHost(host);
  $('#qrwarn').innerHTML = local
    ? `<div class="warn" role="note"><b>هذا رابط محلي (${esc(host)})</b> يعمل على هذا الجهاز فقط؛ إذا مسحه جوال آخر فلن يفتح. لتجربته من الجوال: انشر المشروع للحصول على رابط عام ثابت، ثم اكتب الرابط العام في الأسفل وأعد توليد الرمز.</div>`
    : store.get('menu-public-base')
      ? `<div class="info" role="note">الرمز مولَّد لرابط كتبته يدويًا (<span dir="ltr">${esc(host)}</span>). تأكد أن المشروع منشور عليه.</div>`
      : `<div class="info" role="note">الرمز يشير إلى عنوان هذا الخادم (<span dir="ltr">${esc(host)}</span>). يبقى صالحًا طالما بقي العنوان ومعرّف المنيو «${esc(slug)}» دون تغيير.</div>`;
}
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function downloadPng() {
  const {size, modules} = qrMatrix(currentQrUrl(), 'M'), scale = 16, margin = 4, n = (size + margin * 2) * scale;
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, n, n); g.fillStyle = '#111';
  modules.forEach((row, y) => row.forEach((on, x) => { if (on) g.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale); }));
  c.toBlob(b => b ? download(`qr-${slug}.png`, b) : toast('تعذّر إنشاء الصورة', 'err'), 'image/png');
}

function previewTab() {
  return `<div class="tabhead"><div><h1>معاينة</h1><p class="sub">المنيو كما يراه الزبون بعد مسح الرمز.</p></div><a class="btn ghost sm" href="/menu/${esc(slug)}" target="_blank" rel="noopener">فتح في نافذة ↗</a></div><div class="phone inline"><iframe class="pv" src="/menu/${esc(slug)}?preview=1" title="معاينة المنيو"></iframe></div>`;
}

// ── Events ──
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act],[data-tab]');
  if (!el) { if (e.target.matches?.('dialog.adlg')) e.target.close(); return; }
  if (el.dataset.tab) { tab = el.dataset.tab; history.replaceState(null, '', '#' + tab); renderTab(); $('#panel').focus({preventScroll: true}); return; }
  const id = el.dataset.id, act = el.dataset.act;
  if (act === 'regate') return gate();
  if (act === 'avail') return; // handled on change
  if (act === 'cat-up' || act === 'cat-down') return move('categories', id, act === 'cat-up' ? -1 : 1, el);
  if (act === 'item-up' || act === 'item-down') return move('items', id, act === 'item-up' ? -1 : 1, el);
  if (act === 'cat-edit') { const c = M.categories.find(x => x.id === id); $('#cn-' + CSS.escape(id)).innerHTML = catEditForm(c); $('#ce-ar').focus(); return; }
  if (act === 'cat-cancel') return renderTab();
  if (act === 'cat-del') {
    const c = M.categories.find(x => x.id === id), n = catItems(id).length;
    if (n) return toast(`«${c.name_ar}» فيه ${n} صنف. ${ERRORS.CATEGORY_NOT_EMPTY}`, 'err');
    if (await confirmBox(`حذف القسم «${esc(c.name_ar)}» من المنيو؟`, {ok: 'حذف القسم', danger: true})) await mutate(el, () => api(`/api/menu/admin/categories/${id}`, {method: 'DELETE', body: {version: c.version}}), 'حُذف القسم');
    return;
  }
  if (act === 'item-new') return M.categories.length ? itemDialog(null, el.dataset.cat) : toast('أضف قسمًا أولًا', 'err');
  if (act === 'item-edit') return itemDialog(M.items.find(i => i.id === id));
  if (act === 'dlg-close') return el.closest('dialog').close();
  if (act === 'item-del') {
    const it = M.items.find(i => i.id === id);
    $('#itemdlg').close();
    if (await confirmBox(`حذف «${esc(it.name_ar)}» نهائيًا من المنيو؟ إن كان نافدًا مؤقتًا فالأفضل جعله «غير متوفر».`, {ok: 'حذف الصنف', danger: true})) await mutate(null, () => api(`/api/menu/admin/items/${id}`, {method: 'DELETE', body: {version: it.version}}), 'حُذف الصنف');
    return;
  }
  if (act === 'reset') {
    if (await confirmBox('استعادة النموذج الأصلي؟ سيُحذف كل ما أضفته أو عدّلته في هذا النشاط.', {ok: 'استعادة', danger: true})) {
      try { M = await busy(el, () => api(`/api/menu/admin/venues/${slug}/reset-demo`, {method: 'POST', body: {}})); toast('استُعيدت بيانات النموذج'); renderTab(); pingPreview(); } catch (err) { toast(errText(err), 'err'); }
    }
    return;
  }
  if (act === 'copy') { try { await navigator.clipboard.writeText(currentQrUrl()); toast('نُسخ رابط المنيو'); } catch { $('#qrlink').select(); toast('حدّدنا الرابط — انسخه يدويًا', 'err'); } return; }
  if (act === 'dl-svg') return download(`qr-${slug}.svg`, new Blob([qrSvg(currentQrUrl(), {dark: '#111'})], {type: 'image/svg+xml'}));
  if (act === 'dl-png') return downloadPng();
  if (act === 'print') return window.print();
  if (act === 'qrbase-clear') { store.set('menu-public-base', ''); renderTab(); }
});

document.addEventListener('change', async e => {
  if (e.target.id === 'venue') { slug = e.target.value; await openVenue(); return; }
  if (e.target.dataset?.act === 'avail') {
    const it = M.items.find(i => i.id === e.target.dataset.id), on = e.target.checked;
    e.target.disabled = true;
    const ok = await mutate(null, () => api(`/api/menu/admin/items/${it.id}`, {method: 'PATCH', body: {version: it.version, available: on}}), on ? `«${it.name_ar}» متوفر الآن` : `«${it.name_ar}» يظهر الآن «غير متوفر»`);
    if (!ok) e.target.checked = !on;
    $(`[data-act="avail"][data-id="${it.id}"]`)?.focus();
    return;
  }
  if (e.target.name === 'imgsel') { const u = $('[name=image_url]'); u.hidden = e.target.value !== 'url'; if (!u.hidden) u.focus(); }
});
document.addEventListener('input', e => { if (e.target.id === 'v-brand') updateContrast(); });

document.addEventListener('submit', async e => {
  const f = e.target, kind = f.dataset.form;
  if (!kind) return;
  e.preventDefault();
  const btn = e.submitter || $('[type=submit]', f);
  if (kind === 'item') return saveItem(f, btn);
  if (kind === 'venue') return saveVenue(f, btn);
  if (kind === 'addcat') {
    const b = Object.fromEntries(new FormData(f));
    try { categoryData(b); } catch { toast('اكتب اسم القسم بالعربية.', 'err'); f.elements.name_ar.focus(); return; }
    if (await mutate(btn, () => api(`/api/menu/admin/venues/${slug}/categories`, {method: 'POST', body: b}), `أُضيف قسم «${b.name_ar}»`)) $('#nc')?.focus();
    return;
  }
  if (kind === 'catedit') {
    const c = M.categories.find(x => x.id === f.dataset.id), b = Object.fromEntries(new FormData(f));
    try { categoryData(b); } catch { toast('اسم القسم مطلوب.', 'err'); return; }
    await mutate(btn, () => api(`/api/menu/admin/categories/${c.id}`, {method: 'PATCH', body: {...b, version: c.version}}), 'حُفظ اسم القسم');
    return;
  }
  if (kind === 'qrbase') {
    const v = String(new FormData(f).get('base') || '').trim();
    let u;
    try { u = new URL(v); if (u.protocol !== 'https:') throw 0; } catch { toast('اكتب رابطًا كاملًا يبدأ بـ https://', 'err'); return; }
    store.set('menu-public-base', u.origin);
    renderTab();
    toast('وُلِّد الرمز للرابط العام — جرّبه بالمسح قبل الطباعة');
  }
});

root.insertAdjacentHTML('afterend', '<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>');
gate();
// Back/forward between tabs.
addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (M && TABS.some(([k]) => k === h) && h !== tab) { tab = h; renderTab(); }
});
