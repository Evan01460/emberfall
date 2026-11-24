// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// GEAR UPGRADES (server). A Blacksmith tempers a piece of gear one step at a time (+0 → +99, see src/upgrade.js for the odds and costs).
//
//   • A smith can upgrade their own gear at any forge ("Anvil upgrades").
//   • Anybody else asks a smith: they hand over the piece, the materials for the step and a fee. All of it is held (the gear and materials
//     in the job, the fee in escrow) until the smith has done the work, or the job is rejected / cancelled / expires, when everything goes
//     back. The smith can ask for a different fee (counter-offer) before accepting.
//   • The work is a minigame (heat, folding, rune engraving, quench, polish). The server makes the spec, the client plays it and reports
//     what it did, and the server re-scores that and rolls the dice. The score raises the odds; it can never guarantee success.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { ITEMS } from '../data.js';
import { perkOf, masteryOf, isMythic } from '../loadout.js';
import * as R from '../rules.js';
import { MAX_UP, upLevel, upMult, baseChance, upgradeMats, suggestedFee, smithNeedLevel, dropChance, dropAmount, finalChance, maxJump, upgradeSpec, QUICK_SCORE, tierOfGear, critSteps, critChances } from '../upgrade.js';

export const UPG = { expireMs: 72 * 3600000, maxOut: 4, maxIn: 20, ticketMs: 10 * 60000 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fin = (v) => Number.isFinite(+v);

export const gearView = (g) => ({ uid: g.uid ?? null, id: g.id, q: g.q, affix: g.affix ?? null, fx: g.fx ?? null, ench: g.ench ?? null, cname: g.cname ?? null, by: g.by ?? null, up: upLevel(g) });

// the smith's own skill adds to the odds
export function smithBonus(P, slot) {
  const pk = perkOf(P) ?? {};
  return 0.0015 * P.level + (slot === 'weapon' ? pk.weaponQ ?? 0 : ['head', 'chest', 'legs', 'feet'].includes(slot) ? pk.armorQ ?? 0 : slot === 'charm' || slot === 'ring' ? pk.charmQ ?? 0 : 0) * 0.5 + (['soulsmith', 'titan_forgemaster'].includes(P.classId) ? 0.05 : 0);
}
const densify = (pts, step) => { const out = []; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)); for (let k = 0; k <= n; k++) out.push([ax + (bx - ax) * (k / n), ay + (by - ay) * (k / n)]); } return out; };
export function scoreRune(rune, samples) {
  if (!Array.isArray(samples) || samples.length < 5) return 0;
  const path = densify(rune.pts, 0.02), S = samples.slice(0, 600).map((p) => [clamp(+p?.[0], -0.3, 1.3), clamp(+p?.[1], -0.3, 1.3)]).filter((p) => fin(p[0]) && fin(p[1]));
  if (S.length < 5) return 0;
  const near = (a, list, r) => list.some((b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= r);
  const coverage = path.filter((q) => near(q, S, rune.tol * 1.2)).length / path.length, accuracy = S.filter((s) => near(s, path, rune.tol * 1.8)).length / S.length;
  return clamp(coverage * 0.75 + accuracy * 0.25, 0, 1);
}
// Re-score everything the client reported against the spec the server made.
export function scoreUpgrade(spec, d, elapsedMs) {
  const out = { heat: 0, fold: 0, rune: 0, quench: 0, polish: 0 }; if (!d || typeof d !== 'object') return { ...out, score: 0 };
  out.heat = R.simHeat(spec.heat, d.heat).score;
  if (Array.isArray(d.folds) && d.folds.length === spec.folds.length) {
    let sum = 0, n = 0;
    spec.folds.forEach((f, r) => { const times = Array.isArray(d.folds[r]) ? d.folds[r] : []; let last = 0; for (let i = 0; i < f.strikes; i++) { n++; const t = +times[i]; if (!fin(t) || t < last + 250 || t > 14000 || t > elapsedMs + 1500) continue; last = t; sum += R.strikeScore(R.markerPos(f, t), f.centers[i], f.half); } });
    out.fold = n ? sum / n : 0;
  }
  out.rune = scoreRune(spec.rune, d.rune);
  { const qt = +d.quench; out.quench = fin(qt) && qt >= 0 && qt <= elapsedMs + 1500 ? R.strikeScore(R.markerPos(spec.quench, qt), spec.quench.center, spec.quench.half * (R.QUENCH[d.medium]?.half ?? 1)) : 0; }
  if (Array.isArray(d.polish)) {
    const ts = d.polish.map(Number).filter(fin).slice(0, 40); let ok = 0; for (let i = 1; i < ts.length; i++) { const dt = ts[i] - ts[i - 1]; if (dt >= spec.polish.lo && dt <= spec.polish.hi) ok++; }
    out.polish = clamp((ok / Math.max(1, spec.polish.need - 1)) * Math.min(1, ts.length / spec.polish.need), 0, 1);
  }
  out.score = clamp(0.2 * out.heat + 0.3 * out.fold + 0.25 * out.rune + 0.15 * out.quench + 0.1 * out.polish, 0, 1);
  return out;
}

export const upgradeMethods = {
  initUpgrades(state) { this.upg = Array.isArray(state?.upg) ? state.upg : []; this.nextUpg = state?.nextUpg ?? 1 + this.upg.reduce((n, j) => Math.max(n, j.id), 0); },

  // ── what a step would cost, and the odds ──
  stepInfo(P, g) {
    const L = upLevel(g), mats = L >= MAX_UP ? [] : Object.entries(upgradeMats(g.id, L)).map(([id, n]) => ({ id, n, have: R.count(P, id) }));
    const it = ITEMS[g.id];
    return { uid: g.uid ?? null, id: g.id, up: L, maxed: L >= MAX_UP, mats, chance: baseChance(L), needLvl: smithNeedLevel(g.id, L), fee: suggestedFee(g.id, L), multNow: upMult(L), multNext: upMult(L + 1), drop: dropChance(L), dropN: dropAmount(L), slot: it?.slot ?? null, tier: tierOfGear(g.id).name };
  },
  on_upgrade_info(S, m) { const g = S.P.gear.find((x) => x.uid === +m.uid); if (!g) return; S.conn.send({ t: 'upgrade.info', info: this.stepInfo(S.P, g), smith: R.craftFamily(S.P) === 'blacksmith', myLvl: S.P.level, bonus: smithBonus(S.P, ITEMS[g.id]?.slot), crit: critChances(1, S.P.level, !!(masteryOf(S.P) || isMythic(S.P)), upLevel(g)) }); },

  // ── a smith upgrades their own gear ──
  on_upgrade_start(S, m) {
    const P = S.P; if (S.dead || S.ticket || S.upTicket) return this.toast(S, 'Finish what you are doing first.', 'bad');
    if (R.craftFamily(P) !== 'blacksmith') return this.toast(S, 'Only a Blacksmith can upgrade gear. Ask one — Character → Trading.', 'bad');
    if (!this.stationFor(S, 'blacksmith')) return this.toast(S, 'Stand at a forge or anvil to upgrade.', 'bad');
    const g = P.gear.find((x) => x.uid === +m.uid); if (!g) return; const L = upLevel(g); if (L >= MAX_UP) return this.toast(S, 'It cannot be tempered any further.', 'bad');
    if (P.level < smithNeedLevel(g.id, L)) return this.toast(S, `Tempering this takes smith level ${smithNeedLevel(g.id, L)}.`, 'bad');
    const need = upgradeMats(g.id, L); for (const [id, n] of Object.entries(need)) if (R.count(P, id) < n) return this.toast(S, `You need ${n}× ${ITEMS[id]?.n ?? id} (you have ${R.count(P, id)}).`, 'bad');
    for (const [id, n] of Object.entries(need)) R.removeItem(P, id, n);
    this.beginUpgrade(S, { self: true, gear: g, L, mats: need, slot: ITEMS[g.id]?.slot }, !!m.quick); this.touch(S);
  },

  // start the minigame (or resolve at once for a quick forge)
  beginUpgrade(S, job, quick) {
    const nw = this.now(), spec = upgradeSpec(job.L, S.P.level, this.rng, job.gear.id);
    { const st = this.stationFor(S, 'blacksmith'); if (st) this.emit(S.map, { t: 'work', k: 'blacksmith', x: st.x, y: st.y, ms: 6000 }); }
    S.upTicket = { job, spec, startAt: nw, expires: nw + UPG.ticketMs };
    if (quick) return this.finishUpgrade(S, null, true);
    S.conn.send({ t: 'upgrade.ticket', spec, L: job.L, gear: gearView(job.gear), chance: baseChance(job.L), bonus: smithBonus(S.P, job.slot), reach: maxJump(S.P.level, !!(masteryOf(S.P) || isMythic(S.P))), crit: critChances(1, S.P.level, !!(masteryOf(S.P) || isMythic(S.P)), job.L), mats: job.mats, self: !!job.self, jobId: job.jobId ?? null, owner: job.ownerName ?? null });
  },
  on_upgrade_finish(S, m) { if (!S.upTicket) return; this.finishUpgrade(S, m?.data ?? null, !!m?.quick); },
  on_upgrade_cancel(S) { this.dropUpTicket(S, 'You stepped away from the anvil.'); },

  finishUpgrade(S, data, quick) {
    const t = S.upTicket; if (!t) return; S.upTicket = null; const { job, spec } = t, P = S.P, L = job.L, g = job.gear, slot = job.slot;
    const parts = quick ? { heat: 0, fold: 0, rune: 0, quench: 0, polish: 0, score: QUICK_SCORE } : scoreUpgrade(spec, data, this.now() - t.startAt);
    const bonus = smithBonus(P, slot), chance = finalChance(L, parts.score, bonus), roll = this.rng.range(0, 1), ok = roll < chance;
    let to = L, dropped = 0, steps = 0;
    if (ok) { steps = quick ? 1 : critSteps(this.rng, parts.score, P.level, !!(masteryOf(P) || isMythic(P)), L); to = L + steps; } else if (this.rng.chance(dropChance(L))) { dropped = Math.min(L, dropAmount(L)); to = L - dropped; }
    if (to > 0) g.up = to; else delete g.up;
    P.stats.upgrades = (P.stats.upgrades ?? 0) + 1; if (ok) { P.stats.upgradeWins = (P.stats.upgradeWins ?? 0) + 1; P.stats.maxUp = Math.max(P.stats.maxUp ?? 0, to); }
    let fee = 0, owner = P;
    if (!job.self) {   // a job for someone else: the fee is the smith's, the piece goes home
      const J = this.upg.find((x) => x.id === job.jobId); owner = this.players.get(J.from) ?? P; fee = J.escrow; P.gilt += fee; P.stats.profit = (P.stats.profit ?? 0) + fee; J.escrow = 0;
      J.status = 'done'; J.finished = this.now(); J.result = { ok, from: L, to, chance, dropped, score: parts.score, steps }; J.gear = { ...g }; const back = R.addGear(owner, { ...g, crafted: g.crafted });
      this.say(J.from, ok ? `${P.name} tempered your ${ITEMS[g.id].n} to +${to}${steps > 1 ? ` — a ${steps === 2 ? 'double' : 'TRIPLE'} step!` : ''}!` : `${P.name}'s attempt on your ${ITEMS[g.id].n} failed${dropped ? ` and it fell back to +${to}` : ''}. It is back in your bag.`, ok ? 'secret' : 'bad');
      this.touch(this.sessions.get(J.from) ?? { dirtyMe: true }); const os = this.sessions.get(J.from); if (os) { this.recalc(os); this.afterChange(os); } void back; this.pushUpgsFor(J);
    } else { this.recalc(S); }
    const name = R.gearName({ ...g, up: to });
    if (ok && (steps > 1 || to % 10 === 0 || to >= 90)) this.systemChat(` ${P.name} tempered ${job.self ? 'their' : `${owner.name}'s`} ${ITEMS[g.id].n} to +${to}!`);
    S.conn.send({ t: 'upgrade.result', ok, from: L, to, steps, chance, roll, parts, dropped, quick: !!quick, name, gear: gearView({ ...g, up: to }), fee, self: !!job.self, owner: owner.name });
    this.afterChange(S); this.touch(S);
  },
  // give back what an unfinished attempt was holding (materials for a self-upgrade; for a job they stay in the job)
  dropUpTicket(S, why) {
    const t = S.upTicket; if (!t) return; S.upTicket = null;
    if (t.job.self) { for (const [id, n] of Object.entries(t.job.mats)) R.addItem(S.P, id, n); if (why) this.toast(S, `${why} Your materials were returned.`); this.touch(S); } else if (why) this.toast(S, why);
    S.conn.send({ t: 'upgrade.cancelled' });
  },

  // ── requests: ask a smith ──
  upgView(j, P) {
    const mine = j.from === P.id ? 'from' : 'to', cr = this.players.get(j.to), L = upLevel(j.gear);
    const v = { id: j.id, mine, other: mine === 'from' ? j.toName : j.fromName, gear: gearView(j.gear), L, mats: Object.entries(j.mats).map(([id, n]) => ({ id, n })), price: j.price, status: j.status, left: Math.max(0, j.expires - this.now()), offer: j.offer ? { price: j.offer.price, byMe: j.offer.by === mine } : null, chance: baseChance(L), needLvl: smithNeedLevel(j.gear.id, L), result: j.result ?? null, created: j.created };
    if (mine === 'to') { v.canDo = !!cr && R.craftFamily(cr) === 'blacksmith' && cr.level >= v.needLvl; v.bonus = cr ? smithBonus(cr, ITEMS[j.gear.id]?.slot) : 0; v.reach = cr ? maxJump(cr.level, !!(masteryOf(cr) || isMythic(cr))) : 1; }
    return v;
  },
  pushUpgs(S) { if (S) S.conn.send({ t: 'upgs', list: this.upg.filter((j) => (j.from === S.id || j.to === S.id) && (j.status === 'pending' || j.status === 'accepted' || (j.status === 'done' && this.now() - (j.finished ?? 0) < 6 * 3600000))).map((j) => this.upgView(j, S.P)) }); },
  pushUpgsFor(j) { for (const id of [j.from, j.to]) this.pushUpgs(this.sessions.get(id)); },
  on_upg_list(S) { this.pushUpgs(S); },
  upgOf(S, m) { const j = this.upg.find((x) => x.id === +m.id); return j && (j.from === S.id || j.to === S.id) && (j.status === 'pending' || j.status === 'accepted') ? j : null; },

  on_upg_new(S, m) {
    const P = S.P, id = this.byName.get(String(m.to ?? '').trim().toLowerCase()), C = id ? this.players.get(id) : null;
    if (!C || C.id === P.id) return this.toast(S, 'Pick a Blacksmith to ask.', 'bad'); if (R.craftFamily(C) !== 'blacksmith') return this.toast(S, `${C.name} is not a Blacksmith.`, 'bad');
    const g = P.gear.find((x) => x.uid === +m.uid); if (!g) return this.toast(S, 'Pick a piece from your bag.', 'bad'); const L = upLevel(g);
    if (L >= MAX_UP) return this.toast(S, 'That piece cannot be tempered any further.', 'bad');
    const price = Math.round(+m.price); if (!(price >= 1 && price <= 1e8)) return this.toast(S, 'Offer a sensible fee.', 'bad');
    if (this.upg.filter((j) => j.from === P.id && (j.status === 'pending' || j.status === 'accepted')).length >= UPG.maxOut) return this.toast(S, `You can have at most ${UPG.maxOut} open upgrade jobs.`, 'bad');
    if (this.upg.filter((j) => j.to === C.id && (j.status === 'pending' || j.status === 'accepted')).length >= UPG.maxIn) return this.toast(S, `${C.name} has too many open jobs.`, 'bad');
    const need = upgradeMats(g.id, L); for (const [mid, n] of Object.entries(need)) if (R.count(P, mid) < n) return this.toast(S, `You must provide ${n}× ${ITEMS[mid]?.n ?? mid} (you have ${R.count(P, mid)}).`, 'bad');
    if (P.gilt < price) return this.toast(S, `You need ${price}g to put the fee in escrow.`, 'bad');
    for (const [mid, n] of Object.entries(need)) R.removeItem(P, mid, n);
    for (const slot of Object.keys(P.equip)) if (P.equip[slot] === g.uid) R.unequip(P, slot);
    P.gear.splice(P.gear.indexOf(g), 1); P.gilt -= price;
    const j = { id: this.nextUpg++, from: P.id, fromName: P.name, to: C.id, toName: C.name, gear: { ...g, fx: g.fx ? g.fx.map((e) => ({ ...e })) : undefined, ench: g.ench ? g.ench.map((e) => ({ ...e })) : undefined }, mats: need, price, escrow: price, status: 'pending', offer: null, created: this.now(), expires: this.now() + UPG.expireMs };
    this.upg.push(j); this.recalc(S); this.touch(S); this.afterChange(S);
    this.toast(S, `Upgrade job sent to ${C.name}: ${ITEMS[g.id].n} +${L} → +${L + 1}, fee ${price}g. The piece, the materials and the fee are held until it is done.`, 'good');
    this.say(C.id, `${P.name} asks you to temper their ${ITEMS[g.id].n} (+${L} → +${L + 1}) for ${price}g. Materials are provided. Open Character → Trading → Requests.`, 'secret'); this.pushUpgsFor(j);
  },
  refundUpg(j, why) {
    const P = this.players.get(j.from); if (P) { R.addGear(P, { ...j.gear }); for (const [id, n] of Object.entries(j.mats)) R.addItem(P, id, n); P.gilt += j.escrow; const s = this.sessions.get(j.from); if (s) { this.recalc(s); this.touch(s); this.afterChange(s); } }
    j.escrow = 0; j.status = why; j.offer = null; j.finished = this.now();
  },
  on_upg_accept(S, m) {
    const j = this.upgOf(S, m); if (!j || j.to !== S.id || j.status !== 'pending') return; const L = upLevel(j.gear);
    if (R.craftFamily(S.P) !== 'blacksmith' || S.P.level < smithNeedLevel(j.gear.id, L)) return this.toast(S, `This needs smith level ${smithNeedLevel(j.gear.id, L)}. You can only reject.`, 'bad');
    j.status = 'accepted'; j.offer = null; this.toast(S, 'Accepted. Go to a forge and press "Start forging" on the job.', 'good'); this.say(j.from, `${j.toName} accepted your upgrade job. They will work on it at the forge.`, 'good'); this.pushUpgsFor(j);
  },
  on_upg_reject(S, m) { const j = this.upgOf(S, m); if (!j || j.to !== S.id) return; this.refundUpg(j, 'rejected'); this.say(j.from, `${j.toName} turned down the upgrade job. Your piece, materials and ${j.price}g are back.`, 'bad'); this.toast(S, 'Job rejected.'); this.pushUpgsFor(j); },
  on_upg_cancel(S, m) {
    const j = this.upgOf(S, m); if (!j || j.from !== S.id) return;
    if (S.upTicket?.job?.jobId === j.id || this.sessions.get(j.to)?.upTicket?.job?.jobId === j.id) return this.toast(S, 'They are at the anvil right now.', 'bad');
    this.refundUpg(j, 'cancelled'); this.say(j.to, `${j.fromName} cancelled the upgrade job.`); this.toast(S, 'Job cancelled; everything is back with you.', 'good'); this.pushUpgsFor(j);
  },
  on_upg_offer(S, m) {
    const j = this.upgOf(S, m); if (!j || j.status !== 'pending') return; const price = Math.round(+m.price), mine = j.from === S.id ? 'from' : 'to';
    if (!(price >= 1 && price <= 1e8) || price === j.price) return this.toast(S, 'Propose a different, sensible fee.', 'bad');
    if (mine === 'from' && price > j.price && S.P.gilt < price - j.price) return this.toast(S, `You would need ${price - j.price}g more.`, 'bad');
    j.offer = { by: mine, price }; this.toast(S, `Counter-offer of ${price}g sent.`); this.say(mine === 'from' ? j.to : j.from, `${S.P.name} proposes a fee of ${price}g (was ${j.price}g) for the upgrade.`, 'secret'); this.pushUpgsFor(j);
  },
  on_upg_answer(S, m) {
    const j = this.upgOf(S, m); if (!j || !j.offer) return; const mine = j.from === S.id ? 'from' : 'to'; if (j.offer.by === mine) return this.toast(S, 'Wait for the other side to answer.', 'bad');
    const other = mine === 'from' ? j.to : j.from; if (!m.accept) { j.offer = null; this.say(other, `${S.P.name} declined your proposal.`); return this.pushUpgsFor(j); }
    const payer = this.players.get(j.from), diff = j.offer.price - j.escrow;
    if (diff > 0 && payer.gilt < diff) { j.offer = null; this.say(j.from, `You cannot cover the extra ${diff}g — the proposal was dropped.`, 'bad'); return this.pushUpgsFor(j); }
    payer.gilt -= diff; j.escrow += diff; j.price = j.offer.price; j.offer = null; this.touch(this.sessions.get(j.from) ?? { dirtyMe: true });
    this.say(j.from, `Fee agreed: ${j.price}g.`, 'good'); this.say(j.to, `Fee agreed: ${j.price}g.`, 'good'); this.pushUpgsFor(j);
  },
  // the smith starts the work for an accepted job
  on_upg_forge(S, m) {
    const j = this.upgOf(S, m); if (!j || j.to !== S.id || j.status !== 'accepted') return; if (S.dead || S.ticket || S.upTicket) return this.toast(S, 'Finish what you are doing first.', 'bad');
    if (!this.stationFor(S, 'blacksmith')) return this.toast(S, 'Stand at a forge or anvil.', 'bad');
    const L = upLevel(j.gear); if (S.P.level < smithNeedLevel(j.gear.id, L)) return this.toast(S, `This needs smith level ${smithNeedLevel(j.gear.id, L)}.`, 'bad');
    this.beginUpgrade(S, { self: false, jobId: j.id, gear: j.gear, L, mats: j.mats, slot: ITEMS[j.gear.id]?.slot, ownerName: j.fromName }, !!m.quick);
  },
  tickUpgrades(nw) {
    for (const S of this.sessions.values()) if (S.upTicket && nw > S.upTicket.expires) this.dropUpTicket(S, 'The forge went cold.');
    if (!this.upg.length) return;
    for (const j of this.upg) if ((j.status === 'pending' || j.status === 'accepted') && nw >= j.expires) { this.refundUpg(j, 'expired'); this.say(j.from, 'Your upgrade job expired. The piece, materials and fee are back with you.', 'bad'); this.pushUpgsFor(j); }
    if (this.upg.length > 300) this.upg = this.upg.filter((j) => j.status === 'pending' || j.status === 'accepted' || nw - (j.finished ?? j.created) < 3 * 24 * 3600000);
  },
};
