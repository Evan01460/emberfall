// Bring a character back from the player's own copy (the "vault") into a world that has lost it — used by the browser-hosted public
// world and by the Node host on free hosting where the disk is wiped. The caller has already proved the record is genuine (passphrase
// hash for the browser-hosted world, a server HMAC signature for the Node host); this adds sanity limits and installs it.
import { newPlayer } from '../rules.js';
import { CLASSES, MAX_LEVEL } from '../data.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
export function installRestored(srv, r, pw = undefined) {
  if (!r || typeof r !== 'object' || !CLASSES[r.classId] || !(r.level >= 1 && r.level <= MAX_LEVEL)) return null;
  const key = String(r.name ?? '').toLowerCase(); if (key.length < 2 || srv.byName.has(key)) return null;
  if (CLASSES[r.classId].mythic && srv.mythics?.[r.classId]) return null;                      // somebody holds that one-per-world class already
  const base = newPlayer({ id: `u${srv.nextId++}`, name: r.name, classId: r.classId });
  const P = Object.assign(base, clone(r), { id: base.id, mail: [], gilt: Math.max(0, Math.min(+r.gilt || 0, 5e6)), guild: null });
  if (pw !== undefined) P.pw = pw;
  for (const k of Object.keys(P.items ?? {})) if (!(P.items[k] > 0)) delete P.items[k];
  srv.players.set(P.id, P); srv.byName.set(key, P.id);
  if (CLASSES[P.classId].mythic) srv.mythics[P.classId] = { pid: P.id, name: P.name, at: Date.now() };
  return P;
}
