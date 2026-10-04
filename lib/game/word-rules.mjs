// No dictionary: regional, familiar and uncommon names are equally eligible.
// A–Z matching ignores case, accents and common Latin letter variants.
export function answerStatus(word, letter) {
 if (typeof word !== 'string') return 'empty';
 const text = word.trim().normalize('NFKC');
 if (!text) return 'empty';
 if (!/^[\p{L}][\p{L}\p{M}\p{N}\s.'’‘ʼ‐‑–—-]*$/u.test(text)) return 'invalid';
 if ([...text].filter(c => /\p{L}/u.test(c)).length < 3) return 'invalid';
 const first = [...text][0];
 if (!/\p{Script=Latin}/u.test(first)) return 'needs-review';
 const variants = { 'ø':'o', 'ł':'l', 'đ':'d', 'ð':'d', 'þ':'t', 'æ':'a', 'œ':'o', 'ß':'s' };
 const folded = first.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
 const initial = (variants[folded] ?? folded)[0].toUpperCase();
 return initial === String(letter).toUpperCase() ? 'match' : 'wrong-letter';
}
export const eligible = (word, letter) => answerStatus(word, letter) === 'match';
export const canAccept = (word, letter) => ['match', 'needs-review'].includes(answerStatus(word, letter));

// Tied last-place players lose unless everyone has the same score.
export function isLosingPlayer(room) {
 if (room?.phase !== 'finished') return false;
 const me = room.players.find(p => p.id === room.me);
 if (!me) return false;
 return me.total === Math.min(...room.players.map(p => p.total))
  && room.players.some(p => p.total > me.total);
}
