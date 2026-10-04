import { eligible, canAccept } from './word-rules.mjs';
export { eligible } from './word-rules.mjs';
export const CATEGORIES = ['name', 'place', 'animal', 'thing'];
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const SPIN_MS = 60;
export const ROOM_TTL = 24 * 60 * 60 * 1000;
export class GameError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const check = (ok, message, status = 400) => { if (!ok) throw new GameError(message, status); };
const uid = () => crypto.randomUUID();
const cleanName = value => { check(typeof value === 'string', 'Enter your name.'); const name = value.trim().replace(/\s+/g, ' '); check(name.length >= 2 && name.length <= 24, 'Use a name between 2 and 24 characters.'); return name; };
const online = (p, now) => !p.left && now - p.seen < 30000;
export function createRoom(code, input, now = Date.now()) {
 const rounds = Number(input.rounds), seconds = Number(input.seconds);
 check(Number.isInteger(rounds) && rounds >= 1 && rounds <= 26, 'Choose 1–26 rounds.');
 check(Number.isInteger(seconds) && seconds >= 1 && seconds <= 3600, 'Enter a whole number of seconds from 1 to 3600.');
 const player = { id: uid(), token: uid() + uid(), name: cleanName(input.name), seen: now, left: false, total: 0 };
 const room = { code, created: now, expires: now + ROOM_TTL, phase: 'lobby', settings: { rounds, seconds }, players: [player], host: player.id, active: player.id, round: 0, used: [], letter: '', answers: {}, accepted: {}, submitted: [], history: [], spinAt: 0, spinOffset: 0, deadline: 0, stoppedBy: null, stoppedAt: null, selectDeadline: 0, gameId: uid(), revision: 0 };
 return { room, token: player.token };
}
export function remaining(room) { return [...ALPHABET].filter(l => !room.used.includes(l)); }
export function spinningLetter(room, now) { const letters = remaining(room); return letters[(Math.max(0, Math.floor((now - room.spinAt) / SPIN_MS)) + room.spinOffset) % letters.length]; }
function beginRound(room, now) {
 room.round++; room.phase = 'selecting'; room.letter = ''; room.answers = {}; room.accepted = {}; room.submitted = []; room.deadline = 0; room.stoppedBy = null; room.stoppedAt = null;
 const start = (room.round - 1) % room.players.length;
 room.active = Array.from({ length: room.players.length }, (_, i) => room.players[(start + i) % room.players.length]).find(p => online(p, now))?.id ?? room.host;
 room.selectDeadline = now + 45000;
}
function startSpin(room, now) { room.phase = 'spinning'; room.spinAt = now; room.spinOffset = crypto.getRandomValues(new Uint32Array(1))[0] % remaining(room).length; }
function stopSpin(room, now) { room.letter = spinningLetter(room, now); room.used.push(room.letter); room.phase = 'writing'; room.deadline = now + room.settings.seconds * 1000; }
function review(room, stoppedAt = room.deadline, stoppedBy = null) { room.phase = 'review'; room.stoppedBy = stoppedBy; room.stoppedAt = stoppedAt; room.deadline = stoppedAt; for (const p of room.players) { room.accepted[p.id] = Object.fromEntries(CATEGORIES.map(k => [k, eligible(room.answers[p.id]?.[k], room.letter)])); } }
export function tick(room, now = Date.now()) {
 check(now < room.expires, 'This room has expired. Create a new room.', 410);
 const host = room.players.find(p => p.id === room.host);
 if (!host || host.left || now - host.seen > 45000) { const replacement = room.players.find(p => online(p, now)); if (replacement) room.host = replacement.id; }
 if (room.phase === 'selecting' && now >= room.selectDeadline) startSpin(room, now);
 if (room.phase === 'spinning' && now >= room.spinAt + 20000) stopSpin(room, now);
 if (room.phase === 'writing' && now >= room.deadline) review(room);
}
export function act(room, token, input, now = Date.now()) {
 tick(room, now);
 if (input.action === 'join') {
  check(room.phase === 'lobby', 'This game has started. Ask the host to create another room.');
  check(room.players.length < 12, 'This room is full (12 players).');
  const name = cleanName(input.name);
  check(!room.players.some(p => p.name.toLowerCase() === name.toLowerCase()), 'That name is taken. Try a different name.');
  const p = { id: uid(), token: uid() + uid(), name, seen: now, left: false, total: 0 }; room.players.push(p); return p.token;
 }
 const me = room.players.find(p => p.token === token);
 check(me && !me.left, 'Your player session is no longer available. Join a new room.', 401);
 me.seen = now;
 const host = () => check(room.host === me.id, 'Only the host can do that.', 403);
 const turn = () => check(room.active === me.id, 'Wait for your turn to choose the letter.', 403);
 if (['start', 'stop', 'save', 'submit', 'judge', 'next', 'settings'].includes(input.action)) check(input.round === room.round && input.gameId === room.gameId, 'The round has changed. Please try again.', 409);
 switch (input.action) {
 case 'poll': break;
 case 'settings': {
  host();
  check(['lobby','review'].includes(room.phase), 'Change settings in the lobby or between rounds.');
  const rounds = Number(input.rounds), seconds = Number(input.seconds);
  check(Number.isInteger(rounds) && rounds >= Math.max(1, room.round) && rounds <= 26, 'Choose rounds between the current round and 26.');
  check(Number.isInteger(seconds) && seconds >= 1 && seconds <= 3600, 'Enter a whole number of seconds from 1 to 3600.');
  room.settings = { rounds, seconds };
  break;
 }
 case 'begin': host(); check(room.phase === 'lobby', 'The game has already started.'); check(room.players.filter(p => online(p, now)).length >= 2, 'You need at least two connected players.'); room.players = room.players.filter(p => online(p, now)); beginRound(room, now); break;
 case 'start': turn(); check(room.phase === 'selecting', 'The alphabet is already running.'); startSpin(room, now); break;
 case 'stop': turn(); check(room.phase === 'spinning', 'Start the alphabet first.'); stopSpin(room, now); break;
 case 'save': case 'submit': {
  check(room.phase === 'writing' && now < room.deadline, 'This round has stopped. Your last saved answers are included.', 409);
  check(!room.submitted.includes(me.id), 'Your answers are already locked.');
  check(input.answers && typeof input.answers === 'object', 'Enter your answers.');
  const current = room.answers[me.id];
  check(Number.isInteger(input.sequence) && input.sequence >= 0, 'Invalid answer update.');
  const answers = Object.fromEntries(CATEGORIES.map(k => [k, typeof input.answers[k] === 'string' ? input.answers[k].trim().slice(0, 60) : '']));
  if (input.action === 'submit') {
   check(CATEGORIES.every(k => answers[k].length > 0), 'Fill all four answers before submitting.');
   check(!current || input.sequence >= current._sequence, 'A newer answer was already saved. Please submit again.', 409);
  }
  if (!current || input.sequence >= current._sequence) room.answers[me.id] = { ...answers, _sequence: input.sequence };
  // This state change is committed with the answers in one compare-and-set.
  // No other player can save or submit once the first complete submission wins.
  if (input.action === 'submit') { room.submitted.push(me.id); review(room, now, me.id); }
  break;
 }
 case 'judge': host(); check(room.phase === 'review', 'Answers can only be reviewed after the timer.'); check(CATEGORIES.includes(input.category) && room.players.some(p => p.id === input.playerId), 'Invalid answer.'); check(typeof input.accept === 'boolean', 'Invalid review.'); if (input.accept) check(canAccept(room.answers[input.playerId]?.[input.category], room.letter), 'Only words starting with the selected letter earn points.'); room.accepted[input.playerId][input.category] = input.accept; break;
 case 'next': {
  host(); check(room.phase === 'review', 'Finish the current round first.');
  const results = room.players.map(p => { const points = CATEGORIES.reduce((sum, k) => sum + (room.accepted[p.id]?.[k] ? 10 : 0), 0); p.total += points; return { id: p.id, name: p.name, points, answers: room.answers[p.id] ?? {}, accepted: room.accepted[p.id] }; });
  room.history.push({ round: room.round, letter: room.letter, results });
  if (room.round >= room.settings.rounds) room.phase = 'finished'; else beginRound(room, now);
  break;
 }
 case 'rematch': host(); check(room.phase === 'finished', 'Finish the game first.'); room.players = room.players.filter(p => !p.left); room.phase = 'lobby'; room.round = 0; room.used = []; room.history = []; room.answers = {}; room.accepted = {}; room.submitted = []; room.stoppedBy = null; room.stoppedAt = null; room.deadline = 0; room.letter = ''; room.gameId = uid(); for (const p of room.players) p.total = 0; break;
 case 'leave': me.left = true; if (room.phase === 'lobby') room.players = room.players.filter(p => p.id !== me.id); if (room.host === me.id) room.host = room.players.find(p => !p.left)?.id ?? ''; break;
 default: throw new GameError('Unknown action.');
 }
 return token;
}
export function view(room, token, now = Date.now()) {
 const me = room.players.find(p => p.token === token);
 check(me && !me.left, 'Please join this room.', 401);
 const revealed = ['review', 'finished'].includes(room.phase);
 const { players, answers, accepted, ...rest } = room;
 return { ...rest, now, me: me.id, players: players.map(({ token: _secret, seen, ...p }) => ({ ...p, online: online({ ...p, seen }, now), submitted: room.submitted.includes(p.id) })), answers: revealed ? answers : { [me.id]: answers[me.id] ?? {} }, accepted: revealed ? accepted : {}, pendingPoints: revealed ? Object.fromEntries(players.map(p => [p.id, CATEGORIES.reduce((n, k) => n + (accepted[p.id]?.[k] ? 10 : 0), 0)])) : {} };
}
