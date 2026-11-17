import {menuShell} from '../../lib/menu-shell';
export const dynamic = 'force-dynamic';
export function GET() { return menuShell('admin'); }
