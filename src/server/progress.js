// ─────────────────────────────────────────────────────────────────────────────
// PROGRESSION — skills & loadouts, Ascension, hidden quests, and the mythic-class registry.
// Mixed into GameServer. Everything here is authoritative; clients only ask.
// ─────────────────────────────────────────────────────────────────────────────
import { SKILLS, MYTHICS, ITEMS, CLASSES, ZONES } from '../data.js';
import { getMap, isNight, dist, blockedAt } from '../world.js';
import { QUESTS, stepIndex, questDone, eligible, isDawn } from '../quests.js';
import * as L from '../loadout.js';
import * as R from '../rules.js';

const MYTHIC_BLURB = {
  apostle: 'Roots wake in the ground beneath your feet. The World Tree has chosen you.',
  void_sovereign: 'The throne is empty because you were always meant to sit on it.',
  titan_forgemaster: 'The Cold Forge flares white, and for the first time it is warm.',
  philosopher: 'The stone dissolves into gold light, and your hands remember every recipe there ever was.',
  gilded: 'The vault door swings open onto a room made of nothing but your name.',
};

const WAY_COST = 20;
export const progressMethods = {
  initProgress(state) { this.mythics = state?.mythics ?? {}; },

  // ── skills & loadout ──────────────────────────────────────────────────────
  on_skill_equip(S, m) {
    if (S.dead) return;
    if (this.inCombat(S)) return this.toast(S, 'Not in the heat of battle.', 'bad');
    const r = L.setSlot(S.P, +m.slot, m.id ?? null);
    if (!r.ok) return this.toast(S, r.msg, 'bad');
    this.touch(S);
  },
  // Read a skill tome from the inventory.
  on_tome_read(S, m) {
    const it = ITEMS[m.id]; if (!it?.skill || R.count(S.P, m.id) < 1) return;
    const r = L.learnSkill(S.P, it.skill);
    if (!r.ok) return this.toast(S, r.msg, 'bad');
    R.removeItem(S.P, m.id); this.toast(S, `* ${r.msg} It is in your Skills window.`, 'good'); this.afterChange(S);
  },

  // ── Ascension ─────────────────────────────────────────────────────────────
  on_ascend(S, m) {
    if (this.inCombat(S)) return this.toast(S, 'Not in the heat of battle.', 'bad');
    const r = L.ascend(S.P, String(m.path));
    if (!r.ok) return this.toast(S, r.msg, 'bad');
    this.recalc(S); S.hp = S.rt.maxHp; S.mp = S.rt.maxMp;
    this.toast(S, `* ${r.msg}`, 'good'); this.systemChat(`${S.P.name} has ascended into a ${r.path.name}!`);
    this.emit(S.map, { t: 'aura', x: S.x, y: S.y, r: 2.5, c: 'heal' });
    S.conn.send({ t: 'ascended', path: r.path.id }); S.conn.send({ t: 'cine', kind: 'ascend', id: r.path.id, cls: S.P.classId, name: r.path.name.toUpperCase(), color: r.path.color, sub: r.path.blurb?.slice(0, 70) ?? '' }); this.afterChange(S);
  },
  on_master(S, m) {
    if (this.inCombat(S)) return this.toast(S, 'Not in the heat of battle.', 'bad');
    const r = L.master(S.P, String(m.id));
    if (!r.ok) return this.toast(S, r.msg, 'bad');
    this.recalc(S); this.toast(S, `* ${r.msg}`, 'good'); this.systemChat(`${S.P.name} has mastered ${r.mastery.name}!`);
    this.emit(S.map, { t: 'aura', x: S.x, y: S.y, r: 3, c: 'rage' }); S.conn.send({ t: 'cine', kind: 'ascend', id: r.mastery.id, cls: S.P.classId, name: r.mastery.name.toUpperCase(), tag: 'MASTERY ACHIEVED', color: L.pathOf(S.P)?.color ?? '#ffd36a', sub: r.mastery.desc?.slice(0, 70) ?? '' }); this.afterChange(S);
  },
  on_respec(S) {
    if (this.inCombat(S)) return this.toast(S, 'Not in the heat of battle.', 'bad');
    const r = L.respec(S.P);
    if (!r.ok) return this.toast(S, r.msg, 'bad');
    this.recalc(S); this.toast(S, r.msg); this.afterChange(S);
  },
  // Called after any change: announce fresh level unlocks and ascension readiness.
  levelNotices(S) {
    const P = S.P, from = S.seenLevel ?? P.level; S.seenLevel = P.level; if (P.level <= from) return;
    for (const s of L.knownSkills(P)) { const lv = L.skillLevel(s, P.classId); if ((s.src === 'level' || s.src === 'path') && lv > from && lv <= P.level) this.toast(S, `* New skill learned: ${s.name}.`, 'good'); }
    if (from < L.ASCEND_LVL && P.level >= L.ASCEND_LVL && L.canAscend(P)) this.toast(S, '* You may now ASCEND. Open your Character window (I) → Ascension.', 'secret');
    if (from < L.MASTERY_LVL && P.level >= L.MASTERY_LVL && L.canMaster(P)) this.toast(S, '* A second Ascension awaits: choose a Mastery in Character → Ascension.', 'secret');
  },

  // First clear of a dungeon boss each day pays a bonus on top of the normal loot.
  dungeonClear(S, mob) {
    const z = ZONES[mob.map]; if (!z?.dungeon || !mob.boss) return;
    const P = S.P, day = Math.floor(this.now() / 86400000); P.dungeons ??= {}; if (P.dungeons[mob.map] === day) return; P.dungeons[mob.map] = day;
    const gilt = z.lvl * 150, xp = z.lvl * 160; P.gilt += gilt; const ups = R.gainXp(P, xp); P.stats.dungeons = (P.stats.dungeons ?? 0) + 1;
    this.toast(S, `* Dungeon cleared: ${z.name.split(' — ')[0]}! Daily bonus +${gilt}g, +${xp} XP${ups.length ? ` — LEVEL ${ups.at(-1)}!` : ''}`, 'secret');
  },

  // ── waystones: fast travel between attuned stones ──────────────────────────
  waystoneList(P) {
    const out = [];
    for (const id of P.ways ?? []) { const map = id.slice(0, id.indexOf('.')), pt = getMap(map)?.points.find((p) => p.id === id); if (pt) out.push({ id, map, name: ZONES[map]?.name ?? map, lvl: ZONES[map]?.lvl ?? 0 }); }
    return out;
  },
  useWaystone(S, p) {
    const P = S.P; P.ways ??= [];
    if (!P.ways.includes(p.id)) { P.ways.push(p.id); this.toast(S, `* The waystone hums and attunes to you. (${P.ways.length} known)`, 'secret'); this.emit(S.map, { t: 'aura', x: p.x, y: p.y, r: 2, c: 'ward' }); this.touch(S); }
    S.way = { x: p.x, y: p.y, id: p.id };
    S.conn.send({ t: 'ui', panel: 'waystone', here: p.id, list: this.waystoneList(P), cost: WAY_COST });
  },
  on_waystone_go(S, m) {
    const P = S.P; if (S.dead || !S.way || dist(S.x, S.y, S.way.x, S.way.y) > 3.5) return this.toast(S, 'Stand next to a waystone.', 'bad');
    if (this.inCombat(S)) return this.toast(S, 'Not in the heat of battle.', 'bad');
    const id = String(m.id), pt = (P.ways ?? []).includes(id) && getMap(id.slice(0, id.indexOf('.')))?.points.find((q) => q.id === id);
    if (!pt || id === S.way.id) return;
    if (P.gilt < WAY_COST) return this.toast(S, `The waystones ask ${WAY_COST}g for the crossing.`, 'bad');
    const map = id.slice(0, id.indexOf('.')), mp = getMap(map); let spot = null;
    for (const [dx, dy] of [[0, 1.2], [1.2, 0], [-1.2, 0], [0, -1.2], [1.2, 1.2], [-1.2, 1.2]]) if (!blockedAt(mp, pt.x + dx, pt.y + dy)) { spot = [pt.x + dx, pt.y + dy]; break; }
    if (!spot) return; P.gilt -= WAY_COST; S.way = null;
    this.travel(S, map, spot[0], spot[1]); this.toast(S, `* You step through the stones. (-${WAY_COST}g)`, 'secret'); this.afterChange(S);
  },

  // ── searchable scenery: barrels, shelves, wells, benches, fountains ───────────
  interactDecor(S, id) {
    const m = /^dec:(\d+),(\d+)$/.exec(id); if (!m || S.dead) return; const x = +m[1], y = +m[2], map = getMap(S.map);
    const d = map.decor.find((q) => q.x === x && q.y === y); if (!d) return;
    const cx = d.x + (d.w ?? 1) / 2, cy = d.y + (d.h ?? 1) / 2; if (dist(S.x, S.y, cx, cy) > 2.8) return this.toast(S, 'Move closer.');
    const P = S.P, now = this.now(), key = `dec:${S.map}:${x},${y}`, L = Math.max(1, ZONES[S.map]?.lvl ?? 1), rng = this.rng, got = [];
    const cd = (ms) => { if (now < (P.cooldowns[key] ?? 0)) { this.toast(S, 'Nothing more here for now.'); return false; } P.cooldowns[key] = now + ms; return true; };
    const gold = (a, b) => { const g = Math.round(rng.int(a, b) * (1 + L * 0.35)); P.gilt += g; got.push(`${g}g`); };
    const item = (id2, p, a, b) => { if (rng.chance(p)) { const n = rng.int(a, b); R.addItem(P, id2, n); got.push(`${n}× ${ITEMS[id2].n}`); } };
    switch (d.kind) {
      case 'well': { if (!cd(90000)) return; S.hp = Math.min(S.rt.maxHp, S.hp + S.rt.maxHp * 0.3); S.mp = Math.min(S.rt.maxMp, S.mp + S.rt.maxMp * 0.3); this.toast(S, 'Cold, clear water. You feel better.', 'good'); this.emit(S.map, { t: 'aura', x: cx, y: cy, r: 1.2, c: 'heal' }); return this.touch(S); }
      case 'bench': { if (!cd(30000)) return; S.buff = { id: 'rest', until: now + 8000, regen: 0.03 }; S.conn.send({ t: 'buff', id: 'rest', ms: 8000 }); return this.toast(S, 'You sit and catch your breath.', 'good'); }
      case 'fountain': { if (P.gilt < 5) return this.toast(S, 'You need a coin to toss.', 'bad'); if (!cd(120000)) return; P.gilt -= 5; S.buff = { ...(this.buffOf(S) ?? {}), id: 'blessing', until: now + 60000, dmg: 0.05 }; S.conn.send({ t: 'buff', id: 'blessing', ms: 60000 }); this.emit(S.map, { t: 'aura', x: cx, y: cy, r: 1.2, c: 'ward' }); return this.toast(S, 'You toss a coin and make a wish. (+5% damage for 60s)', 'secret'); }
      case 'barrel': if (!cd(480000)) return; gold(2, 9); item('hide', 0.3, 1, 2); item('herb', 0.2, 1, 2); break;
      case 'crates': if (!cd(480000)) return; gold(3, 12); item('iron_ore', 0.4, 1, 2); item('coal', 0.3, 1, 2); break;
      case 'bookshelf': if (!cd(600000)) return; item('parchment', 0.6, 1, 2); item('ink', 0.35, 1, 2); if (S.map === 'archive' || rng.chance(0.05)) item('torn_page', 0.04, 1, 1); break;
      case 'coalbin': if (!cd(420000)) return; item('coal', 1, 2, 4); break;
      case 'herbs': if (!cd(420000)) return; item('herb', 1, 2, 4); break;
      case 'potions': if (!cd(900000)) return; item('heal_potion', 0.4, 1, 1); item('calm_tonic', 0.25, 1, 1); break;
      case 'cart': if (!cd(600000)) return; gold(4, 14); item('iron_ore', 0.5, 1, 3); item('hide', 0.4, 1, 2); break;
      case 'rack': if (!cd(900000)) return; item('iron_ingot', 0.25, 1, 1); item('leather', 0.35, 1, 1); break;
      case 'grave': { if (!cd(900000)) return; gold(8, 28); item('ink', 0.2, 1, 1); if (rng.chance(0.06)) { this.hurtPlayer(S, Math.round(S.rt.maxHp * 0.06), { noPhase: true }); this.toast(S, 'Something cold grabs your wrist.', 'bad'); } break; }
      default: return;
    }
    this.emit(S.map, { t: 'chest', id, x: cx, y: cy });
    this.toast(S, got.length ? `You search the ${d.kind}: ${got.join(', ')}` : `You search the ${d.kind}. Nothing but dust.`, got.length ? 'good' : ''); this.afterChange(S);
  },

  // ── hidden quests ─────────────────────────────────────────────────────────
  on_search(S) {
    if (S.dead) return; const now = this.now(); if (now < (S.searchAt ?? 0)) return; S.searchAt = now + 1200;
    S.conn.send({ t: 'searching' });
    const spots = getMap(S.map).points.filter((p) => p.kind === 'search' && dist(S.x, S.y, p.x, p.y) <= 1.15);
    for (const p of spots) if (this.questSearch(S, p)) return;
    if (this.searchGeneric?.(S)) return;
    S.conn.send({ t: 'search', found: false });
  },
  questSearch(S, p) {
    const q = QUESTS[p.q]; if (!q || !eligible(S.P, q) || questDone(S.P, p.q)) return false;
    const i = stepIndex(S.P, p.q), st = q.steps[i];
    return !!st && st.search === p.qs && this.tryStep(S, p.q, st, i);
  },
  // A touch on a quest point (kind 'secret', secret 'q').
  questTouch(S, p) {
    const P = S.P, q = QUESTS[p.q]; if (!q || !eligible(P, q)) return this.toast(S, 'Nothing here for you.');
    const i = stepIndex(P, p.q), st = q.steps[i];
    if (st?.seq && p.qs === st.qs) return this.touchSeq(S, p, q, st, i);
    if (st?.touch === p.qs) return this.tryStep(S, p.q, st, i);
    const j = q.steps.findIndex((s) => s.touch === p.qs);                       // revisiting something already solved
    if (j >= 0 && j < i) { const s = q.steps[j]; if (s.travel) { this.toast(S, s.msg, 'secret'); return this.travel(S, ...s.travel); } return this.toast(S, s.msg, 'secret'); }
    this.toast(S, 'Nothing happens.');
  },
  touchSeq(S, p, q, st, i) {
    const P = S.P, qs = (P.quests[p.q] ??= { step: i }); qs.seq ??= [];
    const key = p.dir ?? p.n;
    if (key === st.seq[qs.seq.length]) {
      qs.seq.push(key);
      if (qs.seq.length < st.seq.length) { this.toast(S, 'The stone hums and settles.', 'secret'); this.emit(S.map, { t: 'aura', x: p.x, y: p.y, r: 1, c: 'heal' }); return; }
      qs.seq = []; return this.completeStep(S, p.q, i, st);
    }
    qs.seq = []; this.toast(S, st.wrong ?? 'Wrong.', 'bad'); this.emit(S.map, { t: 'boom', x: p.x, y: p.y, r: 1.6, ty: 'pierce', who: 'm0' });
    this.hurtPlayer(S, Math.round(S.rt.maxHp * 0.18), { noPhase: true });
  },
  // The quest step attached to a pre-existing point (e.g. the Cold Forge). Only acts when fully satisfied.
  questTouchPoint(S, p) {
    for (const [qid, q] of Object.entries(QUESTS)) {
      if (!eligible(S.P, q) || questDone(S.P, qid)) continue;
      const i = stepIndex(S.P, qid), st = q.steps[i];
      if (st?.touchPoint === p.id && this.stepReady(S, st)) return this.tryStep(S, qid, st, i);
    }
    return false;
  },
  stepReady(S, st) {
    const P = S.P, now = this.now();
    if (st.night && !isNight(now)) return false; if (st.dawn && !isDawn(now)) return false;
    for (const [k, v] of Object.entries(st.stat ?? {})) if ((P.stats[k] ?? 0) < v) return false;
    for (const [id, n] of Object.entries(st.have ?? {})) if (R.count(P, id) < n) return false;
    return !(st.pay && P.gilt < st.pay);
  },
  tryStep(S, qid, st, i) {
    const P = S.P, now = this.now();
    const no = () => { if (!st.hintNo) return false; this.toast(S, st.hintNo, 'secret'); return true; };
    if (!this.stepReady(S, st)) return no();
    if (st.count) {
      const qs = (P.quests[qid] ??= { step: i });
      if (now - (qs.last ?? 0) < (st.gap ?? 0)) { this.toast(S, 'The echo has not faded yet...', 'secret'); return true; }
      qs.last = now; qs.n = (qs.n ?? 0) + 1;
      if (qs.n < st.count) { this.toast(S, `${st.msg} (${qs.n}/${st.count})`, 'secret'); this.emit(S.map, { t: 'aura', x: S.x, y: S.y, r: 2, c: 'mark' }); return true; }
    }
    for (const [id, n] of Object.entries(st.have ?? {})) if (st.consume) R.removeItem(P, id, n);
    if (st.pay) P.gilt -= st.pay;
    this.completeStep(S, qid, i, st); return true;
  },
  completeStep(S, qid, i, st) {
    const P = S.P, q = QUESTS[qid], qs = (P.quests[qid] ??= { step: i });
    for (const [id, n] of Object.entries(st.give ?? {})) R.addItem(P, id, n);
    if (st.flag) P.flags[st.flag] = true;
    qs.step = i + 1; qs.n = 0; qs.seq = [];
    if (qs.step >= q.steps.length) qs.done = true;
    if (st.log) (P.qlog ??= []).push({ q: qid, i, text: st.log, t: Date.now() });
    if (st.msg) this.toast(S, st.msg, 'secret');
    this.emit(S.map, { t: 'aura', x: S.x, y: S.y, r: 2.2, c: 'mark' });
    if (st.reward) this.questReward(S, st.reward);
    if (st.travel) this.travel(S, ...st.travel);
    if (st.claim) this.claimMythic(S, st.claim, qid);
    this.afterChange(S);
  },
  questReward(S, r) {
    const P = S.P;
    if (r.hq) { const sk = Object.values(SKILLS).find((x) => x.src === 'hidden' && x.hq === r.hq && x.cls.includes(P.classId)); if (sk) { const res = L.learnSkill(P, sk.id); if (res.ok) S.conn.send({ t: 'secret.done', name: sk.name, msg: `A forgotten technique settles into your bones. ${sk.desc}` }); } }
    if (r.gilt) P.gilt += r.gilt;
    if (r.title && !P.titles.includes(r.title)) P.titles.push(r.title);
  },
  questKill(S, mob) {
    for (const [qid, q] of Object.entries(QUESTS)) {
      if (!eligible(S.P, q) || questDone(S.P, qid)) continue;
      const i = stepIndex(S.P, qid), st = q.steps[i];
      if (st?.kill === mob.key) this.completeStep(S, qid, i, st);
    }
  },

  // ── mythic classes: one holder per server, forever ────────────────────────
  claimMythic(S, mid, qid) {
    const P = S.P, def = MYTHICS[mid]; if (!def) return;
    const held = this.mythics[mid];
    if (held && held.pid !== P.id) {
      (P.quests[qid] ??= {}).done = true;
      return this.toast(S, `The altar is cold. ${held.name} claimed this power before you.`, 'bad');
    }
    this.mythics[mid] = { pid: P.id, name: P.name, at: Date.now() };
    P.classId = mid; L.resetForNewClass(P); (P.titles ??= []).push(def.name);
    this.recalc(S); S.hp = S.rt.maxHp; S.mp = S.rt.maxMp;
    S.conn.send({ t: 'cine', kind: 'mythic', id: mid, name: def.name.toUpperCase(), color: def.color, sub: def.status?.name ?? '' });
    S.conn.send({ t: 'secret.done', name: def.name, msg: `${MYTHIC_BLURB[mid]} You are the only ${def.name} there will ever be.` });
    for (const o of this.sessions.values()) o.conn.send({ t: 'announce', title: def.name, text: `${P.name} has awakened as ${def.name}. There can be only one.` });
    this.systemChat(` ${P.name} has awakened as ${def.name}!`);
    this.emit(S.map, { t: 'boom', x: S.x, y: S.y, r: 5, ty: 'arcane', who: S.id });
  },
  on_legends(S) {
    S.conn.send({ t: 'legends', list: Object.values(MYTHICS).map((m) => ({ id: m.id, name: this.mythics[m.id] ? m.name : '?????', color: this.mythics[m.id] ? m.color : '#6a5a80', holder: this.mythics[m.id]?.name ?? null, at: this.mythics[m.id]?.at ?? 0 })) });
  },
};
