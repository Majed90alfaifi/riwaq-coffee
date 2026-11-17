// HTML shells for the QR-menu service. Pages are rendered client-side by public/menu/*.js,
// mirroring how the RIWAQ store is served from app/route.ts.
type Page = 'landing' | 'menu' | 'admin';
const titles: Record<Page, string> = {
  landing: 'منيو QR | خدمة المنيو الرقمي',
  menu: 'المنيو',
  admin: 'إدارة المنيو',
};
export function menuShell(page: Page, slug = ''): Response {
  const fonts = '<link rel="stylesheet" href="/menu/fonts.css">';
  const css = fonts + (page === 'admin' ? '<link rel="stylesheet" href="/menu/menu.css"><link rel="stylesheet" href="/menu/admin.css">' : '<link rel="stylesheet" href="/menu/menu.css">');
  const script = page === 'admin' ? '/menu/admin.js' : '/menu/menu.js';
  const safeSlug = /^[-a-z0-9]{1,64}$/.test(slug) ? slug : '';
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#1f4d45"><title>${titles[page]}</title><meta name="description" content="منيو رقمي يُفتح بمسح رمز QR — نموذج تجريبي ببيانات افتراضية.">${page === 'admin' ? '<meta name="robots" content="noindex">' : ''}<link rel="icon" href="/menu/favicon.svg">${css}</head><body data-page="${page}" data-slug="${safeSlug}"><div id="root"><p class="boot" role="status">جارٍ تحميل المنيو…</p></div><noscript><p class="boot">يحتاج المنيو إلى تفعيل JavaScript في المتصفح.</p></noscript><script type="module" src="${script}"></script></body></html>`;
  return new Response(html, {headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'}});
}
