export function d1Store(db: D1Database) {
 return {
  async get(code: string) { const row = await db.prepare('SELECT state FROM game_rooms WHERE code = ? AND expires > ?').bind(code, Date.now()).first<{state: string}>(); return row ? JSON.parse(row.state) : null; },
  async insert(room: any) { const result = await db.prepare('INSERT OR IGNORE INTO game_rooms (code, state, revision, expires) VALUES (?, ?, ?, ?)').bind(room.code, JSON.stringify(room), room.revision, room.expires).run(); return result.meta.changes === 1; },
  async compareAndSet(room: any, revision: number) { const result = await db.prepare('UPDATE game_rooms SET state = ?, revision = ? WHERE code = ? AND revision = ?').bind(JSON.stringify(room), room.revision, room.code, revision).run(); return result.meta.changes === 1; },
 };
}
