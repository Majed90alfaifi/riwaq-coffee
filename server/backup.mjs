import {now} from './commerce.mjs';
export const TABLES=['products','inventory','variants','customers','orders','order_lines','payment_events','audit','outbox'];
export async function exportSnapshot(db){const results=await db.batch(TABLES.map(t=>db.prepare('SELECT * FROM '+t)));return {format:'riwaq-v1',created_at:now(),tables:Object.fromEntries(TABLES.map((t,i)=>[t,results[i].results]))}}
