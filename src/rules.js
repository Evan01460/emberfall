// ─────────────────────────────────────────────────────────────────────────────
// PLAYER RULES — pure functions over a player record `P`. Used by the (authoritative)
// game server. No DOM, no I/O. All randomness comes from the Rng passed in.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp } from './rng.js';
import { ITEMS, RECIPES, CLASSES, HINTS, AFFIXES, NODE_TYPES, COMBAT_CLASSES, MAX_LEVEL, gradeOf, ENEMIES } from './data.js';
import { valueOf, vendorBuyPrice, vendorSellPrice } from './economy.js';
import { xpForLevel, rtStats } from './units.js';
import { GEAR_FX, FX_BY_FORM, customName, customDiff, fxStrength, enchantSlots, craftSlots, canCustomise, craftTier } from './custom.js';
import { ensureSkillState, resetForNewClass, eligibleTomes, loadoutOf, statusOf, perkOf } from './loadout.js';

export function newPlayer({ id, name, classId = 'warrior' }) {
  const P = {
    id, name, classId, level: 1, xp: 0, gilt: 150, created: Date.now(),
    items: { iron_ore: 6, coal: 4, hide: 4, herb: 4, heal_potion: 2, calm_tonic: 1 },
    gear: [], nextUid: 1, equip: { weapon: null, armor: null, charm: null },
    map: 'town', x: 26.5, y: 19.5,
    stats: { kills: 0, battles: 0, wins: 0, clashWins: 0, lowSpWins: 0, pagesFound: 0, ingots: 0, profit: 0, haggleWins: 0, masterworks: 0, crafted: 0, perfectBrews: 0, starmetalFound: 0, hollowVisits: 0, reflectionsSlain: 0, ichor: 0, gathered: 0, duelWins: 0, duelLosses: 0, distance: 0 },
    flags: {}, journal: [], rumorsHeard: 0, pendingGilt: 0, cooldowns: {}, crafted: {},
    asc: { path: null, mastery: null }, learned: [], loadout: null, quests: {}, titles: [], ways: [], qlog: [], pot: {}, flasks: [],
  };
  const starter = { warrior: 'iron_sword', mage: 'focus_rod', archer: 'short_bow', blacksmith: 'iron_mace', alchemist: 'focus_rod', merchant: 'hunting_spear' }[classId] ?? 'iron_sword';
  const w = addGear(P, { id: starter, q: 0.4 }), a = addGear(P, { id: 'leather_coat', q: 0.4 });
  P.equip.weapon = w.uid; P.equip.armor = a.uid;
  ensureSkillState(P);
  return P;
}

// ── Class helpers ───────────────────────────────────────────────────────────
export const cls = (P) => CLASSES[P.classId];
// The craft family a class works in: smiths and soulsmiths forge; alchemists and transmuters brew.
export const craftFamily = (P) => ({ blacksmith: 'blacksmith', soulsmith: 'blacksmith', alchemist: 'alchemist', transmuter: 'alchemist' }[P.classId] ?? CLASSES[P.classId]?.craftFamily ?? null);
export const isMerchant = (P) => ['merchant', 'broker', 'gilded'].includes(P.classId);
export const isTrade = (P) => cls(P).group === 'trade';

// ── Crafter trade restrictions ───────────────────────────────────────────────
// Blacksmiths and Alchemists may NOT put their own creations on the Exchange or sell them to NPCs.
// They fill other players' orders (commissions, or a Merchant's wholesale buy orders) instead.
export const isCrafter = (P) => craftFamily(P) !== null;
export const lockedStack = (P, id) => (isCrafter(P) ? Math.min(P.crafted?.[id] ?? 0, count(P, id)) : 0);
export const freeStack = (P, id) => count(P, id) - lockedStack(P, id);
export const gearLocked = (P, g) => isCrafter(P) && !!g.crafted;

// ── Inventory ───────────────────────────────────────────────────────────────
export const count = (P, id) => P.items[id] ?? 0;
export function addItem(P, id, n = 1) { P.items[id] = (P.items[id] ?? 0) + n; }
export function removeItem(P, id, n = 1) {
  if (count(P, id) < n) return false;
  P.items[id] -= n; if (P.items[id] <= 0) delete P.items[id];
  if (P.crafted && P.crafted[id] > count(P, id)) { P.crafted[id] = count(P, id); if (!P.crafted[id]) delete P.crafted[id]; }
  return true;
}
export function addGear(P, g) { const o = { uid: P.nextUid++, id: g.id, q: g.q, affix: g.affix ?? null }; if (g.crafted) o.crafted = true; if (g.fx?.length) o.fx = g.fx.map((e) => ({ ...e })); if (g.ench?.length) o.ench = g.ench.map((e) => ({ ...e })); if (g.cname) o.cname = g.cname; if (g.by) o.by = g.by; if (g.up > 0) o.up = Math.min(99, Math.floor(g.up)); P.gear.push(o); return o; }
export function gearName(g) {
  const af = g.affix && AFFIXES.find((a) => a.id === g.affix);
  return `${g.up > 0 ? `+${g.up} ` : ''}${customName(`${af ? af.name + ' ' : ''}${ITEMS[g.id].n}`, g.fx, g.cname)}`;
}
export const isEquipped = (P, uid) => Object.values(P.equip).includes(uid);
export function equip(P, uid) {
  const g = P.gear.find((x) => x.uid === uid); if (!g) return false;
  P.equip[ITEMS[g.id].slot] = uid; return true;
}
export function unequip(P, slot) { if (slot in P.equip) P.equip[slot] = null; }

// ── Progression ─────────────────────────────────────────────────────────────
export function gainXp(P, xp) {
  const ups = [];
  if (P.level >= MAX_LEVEL) return ups;
  P.xp += Math.max(0, Math.round(xp));
  while (P.level < MAX_LEVEL && P.xp >= xpForLevel(P.level)) { P.xp -= xpForLevel(P.level); P.level++; ups.push(P.level); }
  if (P.level >= MAX_LEVEL) P.xp = 0;
  return ups;
}
export const xpNeed = (P) => (P.level >= MAX_LEVEL ? 0 : xpForLevel(P.level));

// ── Crafting ────────────────────────────────────────────────────────────────
export function recipesFor(P) {
  const fam = craftFamily(P);
  return fam ? RECIPES.filter((r) => r.craft === fam && (!r.secret || P.flags[r.secret])) : [];
}
export const canCraft = (P, r) => craftFamily(P) === r.craft && P.level >= r.lvl && (!r.secret || !!P.flags[r.secret]) && Object.entries(r.in).every(([id, n]) => count(P, id) >= n);
export function consumeInputs(P, r) { for (const [id, n] of Object.entries(r.in)) removeItem(P, id, n); }

// Forging has three stages. HEAT: keep the billet in the glowing band by working the bellows.
// HAMMER: strike when the marker crosses the sweet spot. QUENCH: dunk it at the right moment; the bath decides the temper.
// Everything is re-simulated on the server from the times the client reports.
export const tri = (p) => Math.abs((((p % 2) + 2) % 2) - 1);
export const forgeHalfWidth = (P, r) => clamp(0.17 - r.diff * 0.2 + P.level * 0.006 + (perkOf(P).sweet ?? 0), 0.06, 0.3);
export const QUENCH = { water: { name: 'Water', affix: 'keen', half: 0.8, note: 'Fast and hard: +10% damage temper. Narrow window.' }, oil: { name: 'Oil', affix: 'warded', half: 1.15, note: 'Slow and forgiving: +3 defence temper (more on late-game metals).' }, brine: { name: 'Brine', affix: 'lively', half: 1.0, note: 'Salty: +150 max HP temper (more on late-game metals).' } };
export function forgeSpec(P, r, rng) {
  const strikes = r.diff > 0.3 ? 4 : 3, half = forgeHalfWidth(P, r);
  return {
    strikes, half, speed: 0.55 + r.diff * 0.9, centers: Array.from({ length: strikes }, () => rng.range(0.2, 0.8)),
    heat: { dur: 6000, center: 0.5, half: clamp(0.1 - r.diff * 0.06 + P.level * 0.0012 + (perkOf(P).sweet ?? 0) * 0.25, 0.045, 0.14), up: 0.55 + r.diff * 0.05, down: 0.40 + r.diff * 0.1, tau: 0.09, drift: 0.05 + r.diff * 0.12, dp: 2.2 + rng.range(0, 1.2), dph: rng.range(0, 6.28) },
    quench: { center: rng.range(0.3, 0.7), half: clamp(0.15 - r.diff * 0.12 + P.level * 0.004 + (perkOf(P).sweet ?? 0) * 0.5, 0.05, 0.25), speed: 0.8 + r.diff * 0.8 },
  };
}
export const markerPos = (spec, tMs) => tri((tMs / 1000) * spec.speed);
export function strikeScore(pos, center, half) {
  const e = Math.abs(pos - center);
  if (e <= half * 0.35) return 1;
  return clamp(1 - (e - half * 0.35) / (half * 2.4), 0, 1) * 0.9;
}
// Heating is a hold-to-rise gauge. The billet's heat rises while Space is held and sinks when it is released — a direct, slightly eased
// response (no floaty momentum) plus a gentle drift, as if the coals were uneven. It starts in the middle of the perfect zone and you must
// keep it there. The very same step function runs on the client (to draw it) and on the server (to score it).
export const HEAT_DT = 0.02;
export function heatStart(h) { return { pos: h.center, v: 0 }; }
export function heatStep(h, st, hold, tMs) {
  const k = 1 - Math.exp(-HEAT_DT / h.tau), want = hold ? h.up : -h.down, drift = h.drift * Math.sin((tMs / 1000) * (6.2832 / h.dp) + h.dph);
  st.v += (want - st.v) * k; st.pos += (st.v + drift) * HEAT_DT;
  if (st.pos <= 0) { st.pos = 0; st.v = Math.max(0, st.v); } if (st.pos >= 1) { st.pos = 1; st.v = Math.min(0, st.v); }
  return st;
}
export const heatBand = (h, pos) => { const d = Math.abs(pos - h.center); return d <= h.half * 0.4 ? 1 : d <= h.half ? 0.75 : d <= h.half * 1.8 ? 0.3 : 0; };
export function simHeat(h, holds, until = h.dur) {
  const hs = (Array.isArray(holds) ? holds : []).filter((p) => Array.isArray(p)).map((p) => [+p[0], +p[1]]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[1] > p[0]).sort((a, b) => a[0] - b[0]).slice(0, 200);
  const st = heatStart(h); let total = 0, steps = 0, i = 0;
  for (let t = 0; t < until; t += 20) {
    while (i < hs.length && hs[i][1] <= t) i++;
    let hold = false; for (let j = i; j < hs.length && hs[j][0] <= t; j++) if (t < hs[j][1]) { hold = true; break; }
    heatStep(h, st, hold, t); total += heatBand(h, st.pos); steps++;
  }
  return { score: steps ? total / steps : 0, pos: st.pos };
}
// Server-side validation of everything the client reported.
export function scoreForge(P, r, spec, times, elapsedMs, extra = null) {
  if (!Array.isArray(times) || times.length !== spec.strikes) return null;
  let last = 0; const scores = [];
  for (let i = 0; i < spec.strikes; i++) {
    const t = +times[i];
    if (!Number.isFinite(t) || t < last + 250 || t > elapsedMs + 400) return null;
    last = t; scores.push(strikeScore(markerPos(spec, t), spec.centers[i], spec.half));
  }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  let heat = avg, quench = avg, medium = null;
  if (extra) {
    heat = simHeat(spec.heat, extra.heat).score;
    const qt = +extra.quench; quench = Number.isFinite(qt) && qt >= 0 ? strikeScore(markerPos(spec.quench, qt), spec.quench.center, spec.quench.half * (QUENCH[extra.medium]?.half ?? 1)) : 0;
    medium = QUENCH[extra.medium] ? extra.medium : null;
  }
  const raw = 0.25 * heat + 0.5 * avg + 0.25 * quench;
  return { scores, heat, quench, medium, q: clamp(raw * (1 - r.diff * 0.22) + P.level * 0.005, 0, 1) };
}

export function finishForge(P, r, q, rng, extra = {}) {
  const it = ITEMS[r.out], soul = P.classId === 'soulsmith', st = statusOf(P), pk = perkOf(P);
  if (soul) q = Math.max(q, 0.45);
  if (st?.forgeQ) q = Math.min(1, q + st.forgeQ);
  if (it.k === 'gear') q = Math.min(1, q + ({ weapon: pk.weaponQ, armor: pk.armorQ, charm: pk.charmQ }[it.slot] ?? 0));
  const grade = gradeOf(q);
  const out = { grade, q, items: [], levelUps: [] };
  if (it.k === 'gear') {
    let affix = soul || st?.affix ? rng.pick(AFFIXES).id : null;
    if (!affix && extra.temper && q >= 0.55) affix = extra.temper;                 // chosen with the quench bath
    if (!affix && rng.chance(pk.affix ?? 0)) affix = rng.pick(AFFIXES).id;
    if (!affix && q >= 0.85 && pk.affixMaster) affix = rng.pick(AFFIXES).id;
    const g = addGear(P, { id: r.out, q, affix, crafted: true, by: P.name });
    if (extra.custom) {                                                            // attach the requested effects (weak work loses some)
      const str = fxStrength(q, P); out.fxApplied = []; out.fxLost = [];
      for (const id of extra.custom.effects) { const fx = GEAR_FX[id]; if (q >= 0.3 + 0.06 * fx.tier) { (g.fx ??= []).push({ id, k: str }); out.fxApplied.push(fx.name); } else out.fxLost.push(fx.name); }
      if (extra.custom.name) g.cname = String(extra.custom.name).replace(/[^\w \-'.]/g, '').trim().slice(0, 24) || undefined; if (!g.cname) delete g.cname; if (!g.fx?.length) delete g.fx;
      P.stats.customs = (P.stats.customs ?? 0) + 1;
    }
    out.gear = g; out.items.push(gearName(g));
    if (q >= 0.85) P.stats.masterworks++;
  } else {
    const n = r.qty + (q >= 0.85 ? 1 : 0) + ((soul || st?.forgeQ) && q >= 0.6 && it.k === 'inter' ? 1 : 0);
    addItem(P, r.out, n); (P.crafted ??= {})[r.out] = (P.crafted[r.out] ?? 0) + n;
    out.items.push(`${n}× ${it.n}`);
    if (r.out.endsWith('ingot')) P.stats.ingots += n;
  }
  P.stats.crafted++;
  out.levelUps = gainXp(P, 8 + r.diff * 40 + q * 12);
  return out;
}

// Alchemy: reagents, a stirring rhythm, then press-your-luck catalysts. Stirring sets PURITY, which sets potion potency.
export const REAGENTS = { herb: { name: 'Marrow Herb', instab: -0.04, note: 'steadies the brew' }, ink: { name: 'Wraith Ink', purity: 0.08, note: 'cleaner potion' }, ghostbloom: { name: 'Ghostbloom', bottles: 1, note: 'one extra bottle' }, echo_shard: { name: 'Echo Shard', instab: -0.07, purity: 0.1, note: 'steadier and cleaner' } };
export const STIR = { beats: 6, interval: 850, window: 260 };
export function brewStart(P, r, extras = []) {
  const st = statusOf(P), pk = perkOf(P), trans = P.classId === 'transmuter' ? 0.04 : 0;
  const b = { potency: 1, instab: clamp(r.risk - P.level * 0.006 - trans - (pk.risk ?? 0), 0.03, 0.4), burst: false, purity: 0, stirred: false, extras: [], bonusPurity: 0 };
  for (const id of [...new Set(extras)].slice(0, 2)) { const rg = REAGENTS[id]; if (!rg || count(P, id) < 1) continue; removeItem(P, id, 1); b.extras.push(id); b.instab = clamp(b.instab + (rg.instab ?? 0), 0.02, 0.5); b.bonusPurity += rg.purity ?? 0; b.potency += rg.bottles ?? 0; }
  if (st?.noBurst) b.instab = 0;
  return b;
}
export function stirScore(taps) {
  const ts = (Array.isArray(taps) ? taps : []).map(Number).filter((x) => Number.isFinite(x) && x >= 0).slice(0, 40).sort((a, b) => a - b); let total = 0;
  for (let k = 1; k <= STIR.beats; k++) { const beat = k * STIR.interval; let best = 0; for (const t of ts) { const d = Math.abs(t - beat); if (d <= STIR.window) best = Math.max(best, 1 - d / STIR.window); } total += best; }
  return total / STIR.beats;
}
export function brewStir(P, b, taps) { if (b.stirred) return b; b.stirred = true; b.purity = clamp(stirScore(taps) + b.bonusPurity, 0, 1); b.instab = clamp(b.instab - b.purity * 0.05, 0.01, 0.9); return b; }
export function brewAdd(P, b, rng) {
  const st = statusOf(P);
  b.instab += clamp(0.13 - P.level * 0.004, 0.07, 0.13);
  if (!st?.noBurst && rng.chance(clamp(b.instab, 0, 0.95))) { b.burst = true; return b; }
  b.potency++; return b;
}
export function finishBrew(P, r, b, rng = null) {
  const out = { items: [], levelUps: [], burst: b.burst, purity: b.purity };
  if (!b.burst && r.custom) {
    const st = statusOf(P), pk = perkOf(P), n = Math.max(1, Math.min(5, b.potency) + (st?.bottles ?? 0) + (rng && rng.chance(pk.bottle ?? 0) ? 1 : 0)), q = 0.8 + 0.7 * (b.purity ?? 0.4), k = fxStrength(clamp(q - 0.3, 0, 1), P);
    const fl = addFlask(P, { form: r.custom.form, name: r.custom.name || flaskTitle(r.custom.form, r.custom.effects), fx: r.custom.effects.map((id) => ({ id, k })), n }); fl.q = clamp((b.purity ?? 0.4), 0, 1);
    out.items.push(`${n}× ${fl.name}`); out.flask = fl; P.stats.crafted++; P.stats.customs = (P.stats.customs ?? 0) + 1;
    out.levelUps = gainXp(P, 14 + n * 6 + r.custom.effects.length * 8); return out;
  }
  if (!b.burst) {
    const st = statusOf(P), pk = perkOf(P);
    let n = Math.min(5, b.potency) + (P.classId === 'transmuter' ? 1 : 0) + (st?.bottles ?? 0) + (rng && rng.chance(pk.bottle ?? 0) ? 1 : 0);
    const q = 0.8 + 0.7 * (b.purity ?? 0.4);                                       // potency multiplier of this batch
    const c0 = count(P, r.out); P.pot ??= {}; const old = P.pot[r.out] ?? 1;
    P.pot[r.out] = Math.round(((old * c0 + q * n) / (c0 + n)) * 1000) / 1000;
    addItem(P, r.out, n); (P.crafted ??= {})[r.out] = (P.crafted[r.out] ?? 0) + n; out.items.push(`${n}× ${ITEMS[r.out].n}`); out.potency = q;
    P.stats.crafted++;
    if (b.potency >= 5) P.stats.perfectBrews++;
    out.levelUps = gainXp(P, 8 + n * 5 + Math.round((b.purity ?? 0) * 8));
  } else out.levelUps = gainXp(P, 4);
  return out;
}

// ── Gathering ───────────────────────────────────────────────────────────────
export function gatherYield(P, nodeType, rng) {
  const nt = NODE_TYPES[nodeType], mult = cls(P).gather?.[nt.item] ?? 1;
  const found = {};
  const q = Math.max(1, Math.round(rng.int(nt.qty[0], nt.qty[1]) * mult));
  found[nt.item] = q;
  for (const [id, p, a, b] of nt.bonus ?? []) if (rng.chance(p)) found[id] = (found[id] ?? 0) + rng.int(a, b);
  for (const [id, n] of Object.entries(found)) { addItem(P, id, n); if (id === 'torn_page') P.stats.pagesFound += n; }
  P.stats.gathered++;
  const ups = gainXp(P, isTrade(P) ? 3 : 1);
  return { found, levelUps: ups };
}

// ── Vendor (NPC) ────────────────────────────────────────────────────────────
export function buyFromVendor(P, itemId, qty = 1) {
  const p = vendorSellPrice(itemId); if (!p) return { ok: false, msg: 'Not sold here.' };
  qty = clamp(Math.floor(qty) || 1, 1, 99);
  if (P.gilt < p * qty) return { ok: false, msg: 'Not enough gilt.' };
  P.gilt -= p * qty; addItem(P, itemId, qty);
  return { ok: true, msg: `Bought ${qty}× ${ITEMS[itemId].n} for ${p * qty}g.` };
}
export function sellToVendor(P, { itemId, uid, qty = 1, mult = 1 }) {
  const it = ITEMS[itemId]; if (!it) return { ok: false, msg: 'Unknown item.' };
  if (it.k === 'gear') {
    const g = P.gear.find((x) => x.uid === uid); if (!g || isEquipped(P, uid)) return { ok: false, msg: 'Unequip it first.' };
    if (gearLocked(P, g)) return { ok: false, msg: 'Crafters cannot sell their own creations to the vendor — sell to a Merchant or fill an order.' };
    const p = Math.round(vendorBuyPrice(itemId, g.q) * mult); P.gear.splice(P.gear.indexOf(g), 1); P.gilt += p;
    return { ok: true, msg: `Sold ${gearName(g)} for ${p}g.` };
  }
  qty = clamp(Math.floor(qty) || 1, 1, 9999);
  if (qty > freeStack(P, itemId)) return { ok: false, msg: lockedStack(P, itemId) ? 'Your own creations cannot be sold to the vendor — sell to a Merchant or fill an order.' : 'Not enough items.' };
  if (!removeItem(P, itemId, qty)) return { ok: false, msg: 'Not enough items.' };
  const p = Math.round(vendorBuyPrice(itemId) * mult) * qty; P.gilt += p;
  return { ok: true, msg: `Sold ${qty}× ${it.n} for ${p}g.` };
}

// ── Market listing fees ─────────────────────────────────────────────────────
export function feeRate(P) {
  if (P.classId === 'broker') return 0.02;
  if (P.classId === 'merchant') return Math.max(0.025, 0.06 - 0.004 * P.level);
  return 0.06;
}

// ── Haggling (dice duel vs. a walk-in customer) ─────────────────────────────
export function haggleStart(market, cust, q) {
  return { base: valueOf(market, cust.itemId, q), mult: 0.85, ceil: cust.ceil, round: 0, maxRounds: 4, over: false, walked: false };
}
export function haggleRound(P, cust, h, stance, rng) {
  const bonus = isMerchant(P) ? Math.floor(P.level / 3) + 1 : 0;
  const dice = stance === 'press' ? 2 : 1;
  const roll = () => { let t = 0; for (let i = 0; i < dice; i++) t += rng.int(1, 6); return t + bonus; };
  let pr = roll();
  if (P.classId === 'broker') pr = Math.max(pr, roll());
  const cr = rng.int(1, 6) * (stance === 'press' ? 2 : 1) + Math.floor(cust.resolve / 2) + (stance === 'press' ? 1 : 0);
  const win = pr > cr ? 1 : pr < cr ? -1 : 0;
  const step = stance === 'press' ? (win > 0 ? 0.14 : win < 0 ? -0.1 : 0) : (win > 0 ? 0.06 : win < 0 ? -0.03 : 0);
  h.mult = clamp(h.mult + step, 0.3, h.ceil);
  h.round++;
  if (h.mult <= 0.6) { h.walked = true; h.over = true; }
  if (h.round >= h.maxRounds) h.over = true;
  if (win > 0 && h.mult >= h.ceil) h.over = true;
  return { pr, cr, win, step };
}

// ── Consumables (used in real time on hotkeys 5 / 6) ────────────────────────
export const ITEM_USE = {
  heal_potion: { hp: 45 }, ghost_elixir: { hp: 120 }, frost_elixir: { hp: 220 },
  calm_tonic: { mp: 30 }, clarity_draught: { mp: 60 }, lantern_salve: { mp: 40 },
  // percentage potions (the long climb): heal a share of your maximum, whatever your level
  greater_tonic: { pct: 0.25 }, superior_elixir: { pct: 0.35 }, grand_elixir: { pct: 0.45 }, supreme_elixir: { pct: 0.55 }, mana_surge: { mpPct: 0.3 }, grand_mana: { mpPct: 0.5 },
};
export const quickHeal = (P) => ['supreme_elixir', 'grand_elixir', 'superior_elixir', 'frost_elixir', 'ghost_elixir', 'greater_tonic', 'heal_potion'].find((id) => count(P, id) > 0) ?? null;
export const quickMana = (P) => ['grand_mana', 'clarity_draught', 'mana_surge', 'lantern_salve', 'calm_tonic'].find((id) => count(P, id) > 0) ?? null;

// ── Kill rewards (per player) ───────────────────────────────────────────────
export function applyKill(P, { rewards, lowHp }) {
  P.stats.kills++; P.stats.wins++; if (lowHp) P.stats.lowSpWins++;
  P.gilt += rewards.gold;
  for (const [id, n] of Object.entries(rewards.drops)) addItem(P, id, n);
  P.stats.pagesFound += rewards.pages; P.stats.ichor += rewards.ichor; P.stats.reflectionsSlain += rewards.reflections;
  return gainXp(P, rewards.xp);
}

// ── Hidden content ──────────────────────────────────────────────────────────
export function checkHints(P) {
  const fresh = [];
  for (const h of HINTS) if (!P.journal.includes(h.id) && h.cond(P)) { P.journal.push(h.id); fresh.push(h); }
  return fresh;
}

const fromCombat = (P) => COMBAT_CLASSES.includes(P.classId);
export const HIDDEN = {
  archivist: {
    kind: 'class', name: 'Archivist', point: 'archive.lectern',
    available: (P) => fromCombat(P) && count(P, 'torn_page') >= 3,
    title: 'The Cracked Lectern',
    text: 'Three torn pages tremble in your satchel. Beneath the silt, a lectern lifts its cracked face to you. It does not ask you to read. It asks you to be read.',
    label: 'Lay the pages upon the lectern', cost: { items: { torn_page: 3 } },
    result: 'The ink crawls up your arms. Dice, you realise — a hundred small dice, rattling behind your eyes. You are an Archivist now.',
  },
  desperado: {
    kind: 'class', name: 'Desperado', point: 'town.stranger',
    available: (P) => fromCombat(P) && P.stats.lowSpWins >= 5,
    title: 'The Corner Table',
    text: 'The stranger shuffles a deck that has no faces. "I watched you win with your composure in ruins. Most people fold. Sit. Learn to love the bottom."',
    label: 'Sit and pay the buy-in (150g)', cost: { gilt: 150 },
    result: 'He flips a coin and it never lands. You feel your nerves unclench. At rock bottom, you are most dangerous. You are a Desperado now.',
  },
  broker: {
    kind: 'class', name: 'Broker', point: 'town.broker_figure',
    available: (P) => P.classId === 'merchant' && P.stats.profit >= 500 && P.stats.haggleWins >= 5,
    title: 'The Veiled Broker',
    text: 'A figure in a veil of fine silver mesh sets a ledger before you. Every line is your own trade, in your own hand. "Tomorrow is a rumor," they say. "I can sell you the rumor."',
    label: "Buy the Broker's ledger (400g)", cost: { gilt: 400 },
    result: 'The market stops being noise. Arrows of demand bloom in the margins. You are a Broker now.',
  },
  soulsmith: {
    kind: 'class', name: 'Soulsmith', point: 'quarry.coldforge',
    available: (P) => P.classId === 'blacksmith' && !!P.flags.coldForge && count(P, 'starmetal') >= 1,
    title: 'The Cold Forge',
    text: 'The Cold Forge wants no coal. You press the starmetal shard into its throat and the anvil begins to sing a note you have heard in every blade you ever made.',
    label: 'Feed the forge a Starmetal Shard', cost: { items: { starmetal: 1 } },
    result: 'Metal remembers. From now on, what you forge carries a Resonance. You are a Soulsmith now.',
  },
  transmuter: {
    kind: 'class', name: 'Transmuter', point: 'town.brewmaster',
    available: (P) => P.classId === 'alchemist' && P.stats.perfectBrews >= 1 && count(P, 'hollow_ichor') >= 1,
    title: 'The Old Brewmaster',
    text: 'The old brewmaster sniffs the ichor in your satchel and laughs until he coughs. "That is not a potion ingredient. That is a potion\'s *opinion*. Give it here, and I will teach the cauldron to listen."',
    label: 'Hand over the Shadowfell Ichor', cost: { items: { hollow_ichor: 1 } },
    result: 'The cauldron hums a note you can steer. Bursts become rarer; bottles multiply. You are a Transmuter now.',
  },
};

export const hiddenForPoint = (pointId) => Object.entries(HIDDEN).filter(([, h]) => h.point === pointId).map(([id, h]) => ({ id, ...h }));
export function hiddenVisible(P, pointId) {
  return hiddenForPoint(pointId).some((h) => h.available(P));
}
export function unlockHidden(P, id) {
  const h = HIDDEN[id];
  if (!h || !h.available(P)) return { ok: false, msg: 'Nothing happens.' };
  const c = h.cost ?? {};
  if (c.gilt && P.gilt < c.gilt) return { ok: false, msg: `You need ${c.gilt}g.` };
  if (c.gilt) P.gilt -= c.gilt;
  for (const [i, n] of Object.entries(c.items ?? {})) removeItem(P, i, n);
  P.classId = id; resetForNewClass(P);   // evolution: the hidden class replaces your class
  return { ok: true, msg: h.result, name: h.name };
}

export function unitPreview(P) {
  const st = rtStats(P), cls = CLASSES[P.classId];
  return { ...st, skills: loadoutOf(P) };
}

// ── Skill tomes ─────────────────────────────────────────────────────────────
// Enemies list the tome skills they can drop; only skills your class can use and you do not know yet may drop.
export function rollTome(P, enemyKey, boss, rng) {
  const pool = ENEMIES_TOMES[enemyKey]; if (!pool) return null;
  const ok = eligibleTomes(P, pool).filter((id) => !count(P, `tome_${id}`));
  if (!ok.length) return null;
  return rng.chance(boss ? 0.45 : 0.045) ? rng.pick(ok) : null;
}
export const ENEMIES_TOMES = {};
for (const [k, e] of Object.entries(ENEMIES)) if (e.tomes) ENEMIES_TOMES[k] = e.tomes;

// How strong a potion is for this drinker (crafted potion quality will feed into this).
export const potionPotency = (P, id) => P.pot?.[id] ?? 1;

// ── Custom crafting ─────────────────────────────────────────────────────────
// Smith: validate a custom forge request for recipe r. Returns {ok,msg,ids,cost}.
export function customForgeCheck(P, r, ids) {
  if (craftFamily(P) !== 'blacksmith') return { ok: false, msg: 'Only Blacksmiths forge custom gear.' };
  const it = ITEMS[r.out]; if (it.k !== 'gear') return { ok: false, msg: 'Only gear can carry effects.' };
  const have = (id) => count(P, id) - Object.entries(r.in).reduce((n, [i, c]) => n + (i === id ? c : 0), 0);
  return checkGearFx(P, ids, have, it.slot);
}
function checkGearFx(P, ids, have, slot) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((id) => GEAR_FX[id]);
  if (!canCustomise(P)) return { ok: false, msg: 'You are not skilled enough to forge custom gear yet (level 5).' };
  const max = craftSlots(P); if (list.length > max) return { ok: false, msg: `You can attach at most ${max} effect${max === 1 ? '' : 's'} (level and mastery decide).` };
  const cost = {};
  for (const id of list) {
    const fx = GEAR_FX[id];
    if (fx.tier > tierOf(P)) return { ok: false, msg: `${fx.name} needs more skill (tier ${fx.tier}).` };
    if (!fx.slots.includes(slot)) return { ok: false, msg: `${fx.name} cannot go on ${slot}s.` };
    for (const [item, n] of Object.entries(fx.cost)) cost[item] = (cost[item] ?? 0) + n;
  }
  for (const [item, n] of Object.entries(cost)) if (have(item) < n) return { ok: false, msg: 'You lack the materials for those effects.' };
  return { ok: true, ids: list, cost };
}
const tierOf = (P) => craftTier(P);
export const forgeCustomDiff = (ids) => customDiff(ids, GEAR_FX);

// Alchemist: validate a custom brew (draught | flask | essence).
export function customBrewCheck(P, form, ids) {
  if (craftFamily(P) !== 'alchemist') return { ok: false, msg: 'Only Alchemists brew custom potions.' };
  const base = { herb: 2 }; const have = (id) => count(P, id) - (base[id] ?? 0);
  if (count(P, 'herb') < 2) return { ok: false, msg: 'A custom brew needs 2 Marrow Herbs as its base.' };
  return checkCustomForm(P, form, ids, have);
}
function checkCustomForm(P, form, ids, have) {
  const table = FX_BY_FORM[form]; if (!table) return { ok: false, msg: 'Unknown form.' };
  const list = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((id) => table[id]);
  if (!canCustomise(P)) return { ok: false, msg: 'You are not skilled enough to brew custom potions yet (level 5).' };
  if (!list.length) return { ok: false, msg: 'Pick at least one effect.' };
  const max = form === 'essence' ? Math.max(1, Math.ceil(craftSlots(P) / 2)) : craftSlots(P);
  if (list.length > max) return { ok: false, msg: `You can combine at most ${max} effect${max === 1 ? '' : 's'} in a ${form}.` };
  const cost = {};
  for (const id of list) { const fx = table[id]; if (fx.tier > tierOf(P)) return { ok: false, msg: `${fx.name} needs more skill (tier ${fx.tier}).` }; for (const [item, n] of Object.entries(fx.cost)) cost[item] = (cost[item] ?? 0) + n; }
  for (const [item, n] of Object.entries(cost)) if (have(item) < n) return { ok: false, msg: 'You lack the materials for those effects.' };
  return { ok: true, ids: list, cost };
}
export function addFlask(P, f) {
  P.flasks ??= [];
  // identical batches stack
  const same = P.flasks.find((x) => x.form === f.form && x.name === f.name && x.by === (f.by ?? P.name) && JSON.stringify(x.fx) === JSON.stringify(f.fx));
  if (same) { same.n += f.n; return same; }
  const o = { uid: P.nextUid++, form: f.form, name: f.name, fx: f.fx, n: f.n, crafted: true, by: f.by ?? P.name }; P.flasks.push(o); return o;
}
export function flaskTitle(form, ids) { const t = FX_BY_FORM[form]; return `${ids.slice(0, 2).map((i) => t[i]?.name ?? i).join(' & ')} ${form === 'draught' ? 'Draught' : form === 'flask' ? 'Flask' : 'Essence'}`; }

// Apply an essence to a piece of gear (Blacksmith only, at a forge). Returns {ok,msg,destroyed}.
export function enchantGear(P, gearUid, flaskUid, rng) {
  if (craftFamily(P) !== 'blacksmith') return { ok: false, msg: 'Only Blacksmiths can pour essences into gear.' };
  const g = P.gear.find((x) => x.uid === gearUid), fl = (P.flasks ?? []).find((x) => x.uid === flaskUid);
  if (!g || !fl || fl.form !== 'essence' || fl.n < 1) return { ok: false, msg: 'You need a piece of gear and an Essence.' };
  const used = (g.ench ?? []).length, slots = enchantSlots(P), want = fl.fx.filter((e) => !(g.fx ?? []).some((x) => x.id === e.id) && !(g.ench ?? []).some((x) => x.id === e.id));
  if (!want.length) return { ok: false, msg: 'That gear already carries those effects.' };
  if (used + want.length > slots) return { ok: false, msg: `Your enchant capacity is ${slots} (you have used ${used}). A higher level or mastery gives more.` };
  const slot = ITEMS[g.id].slot; for (const e of want) if (!GEAR_FX[e.id].slots.includes(slot)) return { ok: false, msg: `${GEAR_FX[e.id].name} does not belong on ${slot}s.` };
  const tier = Math.max(...want.map((e) => GEAR_FX[e.id].tier)), chance = clamp(0.62 + P.level * 0.012 - (tier - 1) * 0.06 + (fl.q ?? 0.5) * 0.15, 0.3, 0.97);
  fl.n--; if (fl.n <= 0) P.flasks.splice(P.flasks.indexOf(fl), 1);
  if (!rng.chance(chance)) return { ok: true, destroyed: true, msg: 'The essence flares and burns out. The gear is unharmed.' };
  (g.ench ??= []).push(...want.map((e) => ({ id: e.id, k: e.k }))); g.crafted = true;
  return { ok: true, msg: `${gearName(g)} is enchanted: ${want.map((e) => GEAR_FX[e.id].name).join(', ')}.`, gear: g };
}

export const customTier = (form, id) => FX_BY_FORM[form]?.[id]?.tier ?? 1;

// ── Titles: feats a player can show off beside their name ────────────────────────────────────────────────────────────────────────────
// Earned automatically when the test passes (checked after every change); the player chooses which one to wear (P.title).
export const TITLES = [
  { name: 'Seasoned', rar: 'common', desc: 'Reach level 10.', test: (P) => P.level >= 10 }, { name: 'Veteran', rar: 'rare', desc: 'Reach level 20.', test: (P) => P.level >= 20 }, { name: 'Champion', rar: 'epic', desc: 'Reach level 30.', test: (P) => P.level >= 30 },
  { name: 'Ascended', rar: 'common', desc: 'Choose an Ascension path (level 8).', test: (P) => !!P.asc?.path }, { name: 'Masterful', rar: 'rare', desc: 'Earn a Mastery (level 20).', test: (P) => !!P.asc?.mastery },
  { name: 'Slayer', rar: 'common', desc: 'Fell 500 enemies.', test: (P) => P.stats.kills >= 500 }, { name: 'Exterminator', rar: 'rare', desc: 'Fell 5,000 enemies.', test: (P) => P.stats.kills >= 5000 },
  { name: 'Edge-Walker', rar: 'rare', desc: 'Win 25 fights while under 25% health.', test: (P) => P.stats.lowSpWins >= 25 },
  { name: 'Master Craftsman', rar: 'rare', desc: 'Forge 10 masterworks (85%+ quality).', test: (P) => P.stats.masterworks >= 10 }, { name: 'Perfect Brewer', rar: 'rare', desc: 'Brew 10 perfect batches.', test: (P) => P.stats.perfectBrews >= 10 },
  { name: 'Prolific', rar: 'common', desc: 'Craft 100 items.', test: (P) => P.stats.crafted >= 100 },
  { name: 'Haggler', rar: 'common', desc: 'Win 15 haggle rolls.', test: (P) => P.stats.haggleWins >= 15 }, { name: 'Tycoon', rar: 'rare', desc: 'Make 5,000g market profit.', test: (P) => P.stats.profit >= 5000 },
  { name: 'Wealthy', rar: 'common', desc: 'Hold 5,000 gilt.', test: (P) => P.gilt >= 5000 }, { name: 'Magnate', rar: 'epic', desc: 'Hold 50,000 gilt.', test: (P) => P.gilt >= 50000 },
  { name: 'Shadow-Walker', rar: 'rare', desc: 'Enter the Shadowfell 5 times.', test: (P) => P.stats.hollowVisits >= 5 }, { name: 'Reflection-Breaker', rar: 'epic', desc: 'Slay a Reflection in the Shadowfell.', test: (P) => P.stats.reflectionsSlain >= 1 },
  { name: 'Duelist', rar: 'common', desc: 'Win 5 duels.', test: (P) => P.stats.duelWins >= 5 }, { name: 'Wayfarer', rar: 'common', desc: 'Walk 3,000 tiles.', test: (P) => P.stats.distance >= 3000 }, { name: 'Globetrotter', rar: 'rare', desc: 'Walk 20,000 tiles.', test: (P) => P.stats.distance >= 20000 },
  { name: 'Page-Turner', rar: 'rare', desc: 'Find 10 Torn Pages.', test: (P) => P.stats.pagesFound >= 10 }, { name: 'Starfinder', rar: 'epic', desc: 'Find 5 Starmetal Shards.', test: (P) => P.stats.starmetalFound >= 5 },
  // quest and raid titles: also derived from saved progress, so anyone who did these before titles existed still gets them
  { name: 'Vault Delver', rar: 'rare', desc: 'Open the Sunken Vault (The Weeping Wall).', test: (P) => !!P.quests?.vault?.done }, { name: 'Ringer', rar: 'rare', desc: 'Ring the Silent Bell.', test: (P) => !!P.quests?.bell?.done },
  { name: 'Tyrant-Slayer', rar: 'epic', desc: 'Defeat the Ember Tyrant.', test: (P) => (P.stats.raids ?? 0) >= 1 }, { name: 'Tempered', rar: 'common', desc: 'Upgrade a piece of gear to +10.', test: (P) => (P.stats.maxUp ?? 0) >= 10 }, { name: 'Edge-Master', rar: 'rare', desc: 'Upgrade a piece of gear to +30.', test: (P) => (P.stats.maxUp ?? 0) >= 30 }, { name: 'Legendary Temperer', rar: 'epic', desc: 'Upgrade a piece of gear to +60.', test: (P) => (P.stats.maxUp ?? 0) >= 60 }, { name: 'Ninety-Nine', rar: 'legendary', desc: 'Upgrade a piece of gear to +99.', test: (P) => (P.stats.maxUp ?? 0) >= 99 }, { name: 'Pathfinder', rar: 'rare', desc: 'Master 3 regions (complete every goal in them).', test: (P) => Object.keys(P.adv?.mastered ?? {}).length >= 3 }, { name: 'Cartographer', rar: 'epic', desc: 'Master 12 regions.', test: (P) => Object.keys(P.adv?.mastered ?? {}).length >= 12 }, { name: 'World-Walker', rar: 'legendary', desc: 'Master 30 regions.', test: (P) => Object.keys(P.adv?.mastered ?? {}).length >= 30 }, { name: 'Spire-Walker', rar: 'rare', desc: 'Reach floor 25 of the Endless Spire.', test: (P) => (P.stats.spire ?? 0) >= 25 }, { name: 'Spire-Warden', rar: 'epic', desc: 'Reach floor 70 of the Endless Spire.', test: (P) => (P.stats.spire ?? 0) >= 70 }, { name: 'Spire-Crowned', rar: 'legendary', desc: 'Reach the summit — floor 120 of the Endless Spire.', test: (P) => (P.stats.spire ?? 0) >= 120 }, { name: 'Voidbreaker', rar: 'epic', desc: 'Clear the Citadel of the Void Emperor.', test: (P) => (P.stats.rc?.void_citadel ?? 0) >= 1 }, { name: 'Wyrmslayer', rar: 'legendary', desc: 'Clear the Wyrmcrown Sanctum.', test: (P) => (P.stats.rc?.wyrmcrown ?? 0) >= 1 }, { name: 'Titan-Breaker', rar: 'epic', desc: 'Break the Obsidian Titan with your guild.', test: (P) => (P.stats.graids ?? 0) >= 1 },
];
export const titleInfo = (name) => TITLES.find((t) => t.name === name) ?? (CLASSES[Object.keys(CLASSES).find((k) => CLASSES[k].name === name)]?.mythic ? { name, rar: 'legendary', desc: `Claim the mythic class ${name}.` } : (name.startsWith('The ') ? { name, rar: 'epic', desc: `Awaken the hidden class ${name.slice(4)}.` } : { name, rar: 'epic', desc: 'A rare honour.' }));
export function earnTitles(P) {
  P.titles ??= []; const out = [];
  for (const t of TITLES) if (t.test && !P.titles.includes(t.name) && t.test(P)) { P.titles.push(t.name); out.push(t); }
  const c = CLASSES[P.classId]; if (c?.hidden && !c.mythic) { const n = `The ${c.name}`; if (!P.titles.includes(n)) { P.titles.push(n); out.push({ name: n, rar: 'epic' }); } }
  if (c?.mythic && !P.titles.includes(c.name)) { P.titles.push(c.name); out.push({ name: c.name, rar: 'legendary' }); }
  return out;
}
export function setTitle(P, name) { if (!name) { P.title = null; return true; } if (!(P.titles ?? []).includes(name)) return false; P.title = name; return true; }
