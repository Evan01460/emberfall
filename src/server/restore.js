// Bring a character back from the player's own copy (the "vault") into a world that has lost it — used by the browser-hosted public
// world and by the Node host on free hosting where the disk is wiped. The caller has already proved the record is genuine (passphrase
// hash for the browser-hosted world, a server HMAC signature for the Node host); this adds sanity limits and installs it.
import { newPlayer, addGear, addItem } from '../rules.js';
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

// What the market is holding for a player RIGHT NOW (their listings, the gilt escrowed in their orders and requests). The signed copy
// carries it, so if the world is ever wiped these are handed back instead of vanishing.
export function heldFor(srv, P) {
  const held = { items: [], gear: [], gilt: 0 };
  for (const mk of Object.values(srv.markets)) for (const l of mk.listings) if (l.sellerId === P.id) { if (l.q != null) held.gear.push({ id: l.itemId, q: l.q, affix: l.affix ?? null, ...(l.x ?? {}) }); else held.items.push([l.itemId, l.qty]); }
  for (const o of srv.orders) if (o.by === P.id) held.gilt += o.escrow ?? 0;
  for (const r of srv.reqs ?? []) if (r.from === P.id && (r.status === 'pending' || r.status === 'accepted')) held.gilt += r.escrow ?? 0;
  return held;
}
export function applyHeld(P, h) {
  if (!h) return; const parts = [];
  for (const g of h.gear ?? []) { addGear(P, g); parts.push('1 item'); }
  for (const [id, n] of h.items ?? []) if (n > 0) { addItem(P, id, n); parts.push(`${n} goods`); }
  if (h.gilt > 0) { P.gilt += Math.round(h.gilt); parts.push(`${Math.round(h.gilt)}g`); }
  if (parts.length) P.mail = [...(P.mail ?? []), 'The world was reset. What the market was holding for you was returned: ' + parts.join(', ') + '.'];
}
