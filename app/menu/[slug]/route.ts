import {menuShell} from '../../../lib/menu-shell';
export const dynamic = 'force-dynamic';
export function GET(req: Request) {
  const slug = new URL(req.url).pathname.split('/').filter(Boolean)[1] ?? '';
  return menuShell('menu', decodeURIComponent(slug).toLowerCase());
}
