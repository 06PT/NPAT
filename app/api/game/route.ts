import { env } from 'cloudflare:workers';
import { handleGame } from '@/lib/game/service.mjs';
import { d1Store } from '@/lib/game/d1-store';
export async function POST(request: Request) {
 const headers = { 'Cache-Control': 'no-store' };
 try {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Cross-site requests are not allowed.' }, { status: 403, headers });
  const raw = await request.text();
  if (raw.length > 8192) return Response.json({ error: 'Request too large.' }, { status: 413, headers });
  const input = JSON.parse(raw);
  const db = (env as unknown as {DB: D1Database}).DB;
  if (['create', 'join'].includes(input.action)) {
   const key = `${request.headers.get('cf-connecting-ip') ?? 'unknown'}:${Math.floor(Date.now()/60000)}`;
   const rate = await db.prepare('INSERT INTO game_rates (key, count, expires) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(key, Date.now()+120000).first<{count: number}>();
   if ((rate?.count ?? 0) > 30) return Response.json({error: 'Too many attempts. Try again in a minute.'}, {status: 429, headers});
   await db.batch([db.prepare('DELETE FROM game_rooms WHERE expires < ?').bind(Date.now()), db.prepare('DELETE FROM game_rates WHERE expires < ?').bind(Date.now())]);
  }
  return Response.json(await handleGame(d1Store(db), input, request.headers.get('x-player-token') ?? ''), { headers });
 } catch (error: any) {
  if (!error.status) console.error('Game request failed', error);
  return Response.json({ error: error.status ? error.message : 'The game service is unavailable. Your inputs are still here; please retry.' }, { status: error.status ?? 503, headers });
 }
}
