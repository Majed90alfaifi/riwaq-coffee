import {now} from './commerce.mjs';
// QR-menu tables are optional on restore so snapshots taken before the menu service still restore.
export const MENU_TABLES=['menu_venues','menu_categories','menu_items'];
export const TABLES=['products','inventory','variants','customers','orders','order_lines','payment_events','audit','outbox',...MENU_TABLES];
export async function exportSnapshot(db){const results=await db.batch(TABLES.map(t=>db.prepare('SELECT * FROM '+t)));return {format:'riwaq-v1',created_at:now(),tables:Object.fromEntries(TABLES.map((t,i)=>[t,results[i].results]))}}
