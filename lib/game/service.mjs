import { createRoom, act, view, GameError, ROOM_TTL } from './engine.mjs';
export async function handleGame(store, input, token = '') {
 if (!input || typeof input !== 'object') throw new GameError('Invalid request.');
 if (input.action === 'create') {
  const custom = String(input.customCode ?? '').trim().toUpperCase();
  if (custom && !/^[A-Z0-9]{6}$/.test(custom)) throw new GameError('Use exactly six letters or digits for your room code.');
  for (let i = 0; i < 8; i++) {
   const bytes = crypto.getRandomValues(new Uint8Array(6));
   const code = custom || [...bytes].map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 31]).join('');
   const { room, token: fresh } = createRoom(code, input);
   if (await store.insert(room)) return { room: view(room, fresh), token: fresh };
   if (custom) throw new GameError('That room code is already in use. Choose another.', 409);
  }
  throw new GameError('Could not create a room. Please retry.', 503);
 }
 const code = String(input.code ?? '').toUpperCase();
 if (!/^[A-Z0-9]{6}$/.test(code)) throw new GameError('Enter a valid six-character room code.');
 for (let attempt = 0; attempt < 12; attempt++) {
  const room = await store.get(code);
  if (!room) throw new GameError('Room not found or expired. Check the code.', 404);
  const before = JSON.stringify(room), revision = room.revision;
  // Throttle persisted presence updates but never skip phase/deadline processing.
  const oldSeen = room.players.find(p => p.token === token)?.seen;
  const nextToken = act(room, token, input);
  if (input.action === 'poll' && oldSeen && Date.now() - oldSeen < 10000) room.players.find(p => p.token === token).seen = oldSeen;
  if (before === JSON.stringify(room)) return { room: view(room, nextToken) };
  room.revision = revision + 1;
  if (await store.compareAndSet(room, revision)) return { room: input.action === 'leave' ? null : view(room, nextToken), ...(input.action === 'join' ? { token: nextToken } : {}) };
 }
 throw new GameError('The room is busy. Please try again.', 409);
}
