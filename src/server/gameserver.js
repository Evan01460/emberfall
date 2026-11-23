// ─────────────────────────────────────────────────────────────────────────────
// GAME SERVER — authoritative simulation of the shared world.
// Transport-agnostic: a "connection" is any object with send(obj). The same class
// runs inside Node behind WebSockets (online) and inside the browser (solo / offline).
// The server owns: players, movement validation, mobs, resource nodes, battles
// (PvE, co-op, PvP), crafting tickets, both markets, trading, parties and chat.
// ─────────────────────────────────────────────────────────────────────────────
import { Rng, clamp } from '../rng.js';
import { combatMethods } from './combat.js';
import { progressMethods } from './progress.js';
import { liveMethods } from './live.js';
import { pvpMethods } from './pvp.js';
import { requestMethods } from './requests.js';
import { PROTOCOL } from '../version.js';
import { ensureSkillState, eligibleTomes } from '../loadout.js';
import { questPointVisible } from '../quests.js';
import { ITEMS, CLASSES, ZONES, NODE_TYPES, RECIPES, RUMORS, BASE_CLASSES, ENEMIES, TOMES } from '../data.js';
import { getMap, MAP_IDS, blockedAt, portalAt, portalDest, inSafeZone, stepMove, dist, PLAYER_SPEED, realmOf } from '../world.js';
import { createMarket, tickMarket, listItem, cancelListing, takeFromListing, valueOf, listingValue, trend, gearFactor } from '../economy.js';
import * as R from '../rules.js';

export const DAY_MS = 60000;
const SNAP_MS = 100, ME_MS = 120;
const AGGRO = 5.2, CHASE_SPEED = 2.9, WANDER_SPEED = 1.0, LEASH = 14, CONTACT = 0.95;
const ROUND_MS = 60000, TICKET_MS = 120000;
const POINTS = {};
for (const id of MAP_IDS) { POINTS[id] = new Map(getMap(id).points.map((p) => [p.id, p])); }

const trimName = (s) => String(s ?? '').replace(/[^\w \-'.]/g, '').trim().slice(0, 16);

export class GameServer {
  constructor({ state = null, seed = Date.now() >>> 0, now = () => Date.now(), dayMs = DAY_MS } = {}) {
    this.now = now; this.dayMs = dayMs;
    this.rng = new Rng(state?.rngS ?? seed);
    this.players = new Map();         // id → player record (online or offline)
    this.byName = new Map();
    this.sessions = new Map();        // playerId → session (online only)
    this.mobs = []; this.nodeCd = {}; this.mapIds = MAP_IDS; this.parties = new Map(); this.trades = new Map(); this.invites = new Map();
    this.nextId = state?.nextId ?? 1; this.orders = state?.orders ?? []; this.nextOrder = state?.nextOrder ?? 1;
    this.markets = { main: null, hollow: null };
    if (state) {
      for (const P of Object.values(state.players)) { P.mail ??= []; ensureSkillState(P); this.players.set(P.id, P); this.byName.set(P.name.toLowerCase(), P.id); }
      this.markets = state.markets;
    } else {
      this.markets = { main: createMarket(this.rng, 'main'), hollow: createMarket(this.rng, 'hollow') };
    }
    this.customers = [];            // customer entities currently in town
    this.initProgress(state); this.initLive(state); this.initPvp(state); this.initRequests(state);
    this.initCombat();
    this.refillBotOrders();
    this.spawnCustomers();
    this.spawnMobs();
    this.lastTick = now(); this.lastSnap = 0; this.lastMe = 0; this.lastDay = now(); this.lastDread = now();
  }

  // ── persistence ───────────────────────────────────────────────────────────
  exportState() {
    for (const S of this.sessions.values()) this.syncRecord(S);
    return { v: 2, rngS: this.rng.s, nextId: this.nextId, orders: this.orders, nextOrder: this.nextOrder, players: Object.fromEntries(this.players), markets: this.markets, mythics: this.mythics, guilds: this.guilds, wars: this.wars, reqs: this.reqs, nextReq: this.nextReq };
  }
  syncRecord(S) { S.P.map = S.map; S.P.x = S.x; S.P.y = S.y; }

  // ── connection lifecycle ──────────────────────────────────────────────────
  // `create`: { classId } when making a new character; omit to load an existing one.
  join(conn, { name, create = null }) {
    name = trimName(name);
    if (name.length < 2) return { ok: false, error: 'Names need at least 2 letters.' };
    const key = name.toLowerCase();
    let P = this.players.get(this.byName.get(key));
    if (P && create) return { ok: false, error: 'That name is already taken. If it is yours, use "Log in as existing".' };
    if (!P) {
      if (!create) return { ok: false, error: 'No such character.' };
      if (!BASE_CLASSES.includes(create.classId)) return { ok: false, error: 'Pick one of the six starting classes.' };
      P = R.newPlayer({ id: `u${this.nextId++}`, name, classId: create.classId }); P.mail = [];
      this.players.set(P.id, P); this.byName.set(key, P.id);
    }
    const old = this.sessions.get(P.id);
    if (old) { old.conn.send({ t: 'kicked', msg: 'Logged in from elsewhere.' }); this.leave(old.conn); }
    // Safety: never resume inside a dead map/blocked tile.
    const mp = getMap(P.map in POINTS ? P.map : 'town');
    if (!(P.map in POINTS) || blockedAt(mp, P.x, P.y)) { P.map = 'town'; P.x = 26.5; P.y = 19.5; }
    const S = { conn, P, id: P.id, map: P.map, x: P.x, y: P.y, dir: 'd', moving: false, lastMoveAt: this.now(), immuneUntil: this.now() + 4000, gather: null, ticket: null, haggle: null, market: null, dirtyMe: true, visSig: '', lastChat: 0, msgCount: 0, msgWindow: 0, partyId: null, tradeId: null, listening: new Set() };
    this.initPlayerCombat(S);
    conn.session = S;
    this.sessions.set(P.id, S);
    if (P.guild && !this.guildOf(P)) P.guild = null;
    R.checkHints(P);
    conn.send({ t: 'welcome', ver: PROTOCOL, id: P.id, map: S.map, x: S.x, y: S.y, dayMs: this.dayMs, serverNow: this.now(), me: this.meView(S), vis: this.visibleIds(S), mail: P.mail.splice(0) });
    this.systemChat(`${P.name} the ${CLASSES[P.classId].name} has arrived.`); this.pushReqs(S);
    return { ok: true, id: P.id };
  }

  leave(conn) {
    const S = conn.session; if (!S || this.sessions.get(S.id) !== S) return;
    this.cancelTicket(S, true);
    if (S.duel) this.endDuel(S, this.sessions.get(S.duel), true);
    this.endTradeFor(S, 'Partner disconnected.');
    this.leaveParty(S);
    this.syncRecord(S);
    this.sessions.delete(S.id); conn.session = null;
    this.systemChat(`${S.P.name} has left.`);
  }

  // ── message dispatch ──────────────────────────────────────────────────────
  handle(conn, msg) {
    const S = conn.session;
    if (!S || !msg || typeof msg.t !== 'string') return;
    const nw = this.now();
    if (nw - S.msgWindow > 1000) { S.msgWindow = nw; S.msgCount = 0; }
    if (++S.msgCount > 80) return;                       // flood control
    const h = this['on_' + msg.t.replace(/\./g, '_')];
    if (typeof h === 'function') {
      try { h.call(this, S, msg); } catch (e) { console.error('handler error', msg.t, e); this.toast(S, 'Something went wrong on the server.', 'bad'); }
    }
  }

  toast(S, msg, kind = '') { S.conn.send({ t: 'toast', msg, kind }); }
  touch(S) { S.dirtyMe = true; }
  systemChat(text) { for (const S of this.sessions.values()) S.conn.send({ t: 'chat', ch: 'system', from: '', text, ts: this.now() }); }

  meView(S) {
    const P = S.P;
    return { ...P, xpNeed: R.xpNeed(P), unit: R.unitPreview(P), partyId: S.partyId, dayMs: this.dayMs, craftFamily: R.craftFamily(P) };
  }

  // Hidden/secret points the player can currently see on their map.
  visibleIds(S) {
    const out = [];
    for (const p of getMap(S.map).points) if (p.kind !== 'search' && (p.hidden || p.secret) && this.pointVisible(S.P, p)) out.push(p.id);
    return out;
  }
  pointVisible(P, p) {
    if (p.secret === 'q') return questPointVisible(P, p);
    if (p.hidden) return R.hiddenVisible(P, p.id);
    if (p.secret === 'coldforge') return R.craftFamily(P) === 'blacksmith' && (P.stats.ingots >= 6 || !!P.flags.coldForge);
    if (p.secret === 'starfall') return R.craftFamily(P) === 'blacksmith' && !!P.flags.coldForge;
    return true;
  }

  // ── movement ──────────────────────────────────────────────────────────────
  on_move(S, m) {
    const nw = this.now(), map = getMap(S.map);
    const x = +m.x, y = +m.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (S.dead) { S.conn.send({ t: 'correct', x: S.x, y: S.y }); return; }
    if (nw < S.dashLock) return;                       // mid-dash: the server already moved you
    if (Number.isFinite(+m.a)) S.aim = +m.a;
    const dt = clamp((nw - S.lastMoveAt) / 1000, 0.02, 1.2); S.lastMoveAt = nw;
    const maxD = PLAYER_SPEED * dt * 1.6 + 0.4;
    if (dist(x, y, S.x, S.y) > maxD || blockedAt(map, x, y)) { S.conn.send({ t: 'correct', x: S.x, y: S.y }); return; }
    S.P.stats.distance += dist(x, y, S.x, S.y);
    S.x = x; S.y = y; S.dir = ['u', 'd', 'l', 'r'].includes(m.d) ? m.d : S.dir; S.moving = !!m.mv;
    if (S.gather && dist(S.x, S.y, S.gather.x, S.gather.y) > 1.9) { S.gather = null; S.conn.send({ t: 'gather.cancel' }); }
    const portal = portalAt(map, x, y);
    if (portal) { const d = portalDest(portal); this.travel(S, portal.to.map, d.x, d.y); }
  }

  travel(S, mapId, x, y) {
    const wasShadow = realmOf(S.map) === 'hollow';
    S.map = mapId; S.x = x; S.y = y; S.gather = null; S.market = null; S.immuneUntil = this.now() + 3500; S.moving = false;
    if (!wasShadow && realmOf(mapId) === 'hollow') { S.P.stats.hollowVisits++; this.toast(S, ' You step into the Shadowfell. Your mana drains away while you are out here.', 'secret'); }
    S.conn.send({ t: 'map', id: mapId, x, y, vis: this.visibleIds(S) });
    this.touch(S);
  }

  // ── interaction ───────────────────────────────────────────────────────────
  on_interact(S, m) {
    if (S.dead) return;
    if (typeof m.id === 'string' && m.id.startsWith('cust:')) return this.interactCustomer(S, m.id);
    if (typeof m.id === 'string' && m.id.startsWith('dec:')) return this.interactDecor(S, m.id);
    const p = POINTS[S.map]?.get(m.id);
    if (!p || !this.pointVisible(S.P, p)) return;
    if (dist(S.x, S.y, p.x, p.y) > 2.6) return this.toast(S, 'Move closer.');
    const P = S.P;
    switch (p.kind) {
      case 'forge': case 'cauldron': {
        const need = p.kind === 'forge' ? 'blacksmith' : 'alchemist';
        if (R.craftFamily(P) !== need) return this.toast(S, p.kind === 'forge' ? 'Only Blacksmiths know how to work this forge.' : 'Only Alchemists can use this cauldron.');
        S.station = { kind: p.kind, x: p.x, y: p.y };
        return S.conn.send({ t: 'ui', panel: 'craft', family: need });
      }
      case 'exchange': case 'bazaar': {
        const mid = p.kind === 'exchange' ? 'main' : 'hollow';
        S.market = { id: mid, x: p.x, y: p.y };
        return S.conn.send({ t: 'ui', panel: 'exchange', market: mid, view: this.marketView(S, mid) });
      }
      case 'camp': {
        S.hp = S.rt.maxHp; S.mp = S.rt.maxMp; this.touch(S);
        return this.toast(S, ' You rest by the fire. Health and mana restored.', 'good');
      }
      case 'gate': {
        if (R.count(P, 'hollow_key') < 1) return this.toast(S, 'The gate is sealed. Its lock is shaped like a key that no shop sells — a Blacksmith could forge one from fallen starmetal.', 'secret');
        this.toast(S, ' The key hums. The gate remembers you.', 'secret');
        return this.travel(S, 'hollow_reach', 32.5, 40.5);
      }
      case 'chest': return this.openChest(S, p);
      case 'waystone': return this.useWaystone(S, p);
      case 'board': return this.on_bounty_open(S);
      case 'node': return this.startGather(S, p);
      case 'secret': return this.interactSecret(S, p);
      case 'sign': return S.conn.send({ t: 'ui', panel: 'dialog', name: p.name, icon: '', lines: p.lines ?? [p.name] });
      case 'npc': return this.interactNpc(S, p);
      default: return undefined;
    }
  }

  // ── chests: one haul per player per chest every 10 minutes ────────────────
  openChest(S, p) {
    const P = S.P, key = `chest:${p.id}`, now = this.now(), cd = P.cooldowns[key] ?? 0;
    if (now < cd) return this.toast(S, `The chest is empty. It refills in ${Math.ceil((cd - now) / 60000)} min.`);
    const zone = ZONES[S.map], L = Math.max(1, zone.lvl), loot = {
      quarry: { mats: [['iron_ore', 3, 5], ['coal', 2, 4]], gear: ['iron_sword', 'hunting_spear', 'leather_coat'] },
      gloomwood: { mats: [['herb', 3, 5], ['hide', 2, 4]], gear: ['iron_mace', 'chain_mail_placeholder', 'swift_band', 'sanity_locket'] },
      archive: { mats: [['ink', 2, 4], ['parchment', 2, 4]], gear: ['steel_sword', 'steel_pike', 'focus_rod', 'steel_plate'] },
      hollow_reach: { mats: [['hollow_ore', 1, 3], ['ghostbloom', 1, 3], ['echo_shard', 1, 2]], gear: ['hollow_blade', 'hollow_lance', 'hollow_rod', 'hollow_locket'] },
      hollow_depths: { mats: [['hollow_ore', 2, 4], ['echo_shard', 1, 3]], gear: ['hollow_maul', 'hollow_aegis', 'hollow_locket'] },
    }[S.map] ?? this.lootFor(S.map);
    P.cooldowns[key] = now + 10 * 60000;
    const gold = this.rng.int(12, 30) * L, got = [`${gold}g`], rows = [{ k: 'gilt', n: gold }]; P.gilt += gold;
    for (const [id, a, b] of loot.mats) { const n = this.rng.int(a, b); R.addItem(P, id, n); got.push(`${n}× ${ITEMS[id].n}`); rows.push({ k: 'item', id, n }); }
    if (this.rng.chance(0.07)) { const t = eligibleTomes(P, TOMES).filter((id) => !R.count(P, `tome_${id}`)); if (t.length) { const id = this.rng.pick(t); R.addItem(P, `tome_${id}`, 1); got.push(`a ${ITEMS[`tome_${id}`].n}!`); rows.push({ k: 'item', id: `tome_${id}`, n: 1 }); } }
    // chests never hold gear: weapons and armour come from the forge (Blacksmiths) — chests give gold, materials and the odd skill tome
    this.emit(S.map, { t: 'chest', id: p.id, x: p.x, y: p.y });
    S.conn.send({ t: 'chest', id: p.id, name: p.name, loot: got, rows });
    this.afterChange(S);
  }

  // Chest contents for the wide world: materials from the zone's own creatures, gear by zone level.
  lootFor(mapId) {
    const z = ZONES[mapId], mats = new Map();
    for (const e of z?.enemies ?? []) for (const [id, , a, b] of ENEMIES[e].drops) if (ITEMS[id]?.k === 'mat') mats.set(id, [id, Math.max(1, a), Math.max(2, b + 1)]);
    const pool = [...mats.values()]; const pick = pool.length ? [this.rng.pick(pool), this.rng.pick(pool)] : [['iron_ore', 2, 3]];
    const L = z?.lvl ?? 1, gear = L < 4 ? ['iron_sword', 'hunting_spear', 'leather_coat', 'swift_band'] : L < 8 ? ['iron_mace', 'iron_mail', 'focus_rod', 'steel_sword', 'sanity_locket'] : L < 14 ? ['steel_sword', 'steel_pike', 'steel_plate', 'hollow_locket', 'sun_blade', 'sun_rod'] : L < 19 ? ['hollow_blade', 'hollow_lance', 'hollow_maul', 'hollow_aegis', 'sun_blade', 'sun_maul', 'sun_aegis'] : ['hollow_blade', 'hollow_rod', 'hollow_aegis', 'sun_blade', 'sun_aegis', 'sun_maul'];
    return { mats: pick, gear };
  }

  interactNpc(S, p) {
    const P = S.P;
    if (p.role === 'vendor') { S.vendor = { x: p.x, y: p.y }; return S.conn.send({ t: 'ui', panel: 'vendor' }); }
    if (p.role === 'tavern') { S.tavern = { x: p.x, y: p.y }; return S.conn.send({ t: 'ui', panel: 'tavern' }); }
    if (p.role === 'hidden') return this.offerHidden(S, p);
    if (p.role === 'graid') return S.conn.send({ t: 'ui', panel: 'graid', name: p.name, status: this.graidStatus(S) });
    if (p.role === 'raid') return S.conn.send({ t: 'ui', panel: 'raid', name: p.name, status: this.raidStatus(S) });
    return S.conn.send({ t: 'ui', panel: 'dialog', name: p.name, icon: p.icon, lines: p.lines });
  }

  offerHidden(S, p) {
    const h = R.hiddenForPoint(p.id).find((x) => x.available(S.P));
    if (!h) return this.toast(S, 'Nothing here for you right now.');
    S.conn.send({ t: 'ui', panel: 'secret', id: h.id, title: h.title, text: h.text, label: h.label });
  }

  interactSecret(S, p) {
    const P = S.P, now = this.now();
    if (p.secret === 'q') return this.questTouch(S, p);
    if (p.secret === 'lectern') return this.offerHidden(S, p);
    if (p.secret === 'coldforge' && this.questTouchPoint(S, p)) return;
    if (p.secret === 'coldforge') {
      const off = R.hiddenForPoint(p.id).find((x) => x.available(P));
      if (off) return this.offerHidden(S, p);
      if (!P.flags.coldForge) { P.flags.coldForge = true; this.toast(S, ' Behind the slag: a hearth that radiates cold instead of heat. The Cold Forge. It wants something that fell from the sky.', 'secret'); this.afterChange(S); return; }
      return this.toast(S, 'The Cold Forge is silent. It wants starmetal.');
    }
    if (p.secret === 'starfall') {
      const cd = P.cooldowns.starfall ?? 0;
      if (now < cd) return this.toast(S, `Only dust and cold glass. (${Math.ceil((cd - now) / 1000)}s)`);
      P.cooldowns.starfall = now + 240000; R.addItem(P, 'starmetal', 1); P.stats.starmetalFound++;
      this.toast(S, ' You pry a shard of Starmetal from the glass. It hums.', 'secret'); this.afterChange(S);
    }
  }

  on_hidden_unlock(S, m) {
    const h = R.HIDDEN[m.id];
    if (!h) return;
    const pt = POINTS[S.map]?.get(h.point);
    if (!pt || dist(S.x, S.y, pt.x, pt.y) > 3.2) return this.toast(S, 'Move closer.');
    const res = R.unlockHidden(S.P, m.id);
    if (!res.ok) return this.toast(S, res.msg, 'bad');
    S.conn.send({ t: 'secret.done', name: res.name, msg: res.msg });
    this.systemChat(` ${S.P.name} has become a ${res.name}.`);
    this.afterChange(S);
    S.conn.send({ t: 'vis', vis: this.visibleIds(S) });
  }

  afterChange(S) {
    this.levelNotices(S);
    for (const h of R.checkHints(S.P)) this.toast(S, ' Your journal has a new entry.', 'secret');
    this.touch(S);
    S.conn.send({ t: 'vis', vis: this.visibleIds(S) });
  }

  // ── gathering ─────────────────────────────────────────────────────────────
  startGather(S, p) {
    const nt = NODE_TYPES[p.node], key = p.id, cd = this.nodeCd[key] ?? 0;
    if (S.gather) return;
    if (this.now() < cd) return this.toast(S, `${nt.name} is picked clean. (${Math.ceil((cd - this.now()) / 1000)}s)`);
    const mult = R.cls(S.P).gather?.[nt.item] ? 0.75 : 1;
    S.gather = { id: key, type: p.node, endAt: this.now() + nt.ms * mult, x: p.x, y: p.y };
    S.conn.send({ t: 'gather.begin', id: key, ms: nt.ms * mult });
  }

  tickGather(S) {
    const g = S.gather; if (!g || this.now() < g.endAt) return;
    S.gather = null;
    const cd = this.nodeCd[g.id] ?? 0;
    if (this.now() < cd) return;                         // someone else got there first
    const nt = NODE_TYPES[g.type];
    this.nodeCd[g.id] = this.now() + nt.respawn * 1000;
    const res = R.gatherYield(S.P, g.type, this.rng);
    S.conn.send({ t: 'gather.done', id: g.id, found: res.found }); for (const [id, n] of Object.entries(res.found)) this.bountyEvent(S, 'gather', id, n);
    if (res.levelUps.length) this.toast(S, `* Level ${res.levelUps.at(-1)}!`, 'good');
    this.afterChange(S);
  }

  // ── NPC vendor / tavern / inventory ───────────────────────────────────────
  near(S, o, r = 4) { return o && dist(S.x, S.y, o.x, o.y) <= r; }
  on_vendor_buy(S, m) { if (!this.near(S, S.vendor)) return; const r = R.buyFromVendor(S.P, m.itemId, m.qty); this.toast(S, r.msg, r.ok ? '' : 'bad'); this.touch(S); }
  on_vendor_sell(S, m) { if (!this.near(S, S.vendor)) return; const r = R.sellToVendor(S.P, { itemId: m.itemId, uid: m.uid, qty: m.qty }); this.toast(S, r.msg, r.ok ? '' : 'bad'); this.touch(S); }
  on_tavern_rumor(S) {
    if (!this.near(S, S.tavern)) return;
    const P = S.P; if (P.gilt < 15) return this.toast(S, 'A round of drinks costs 15g.', 'bad');
    P.gilt -= 15; const r = RUMORS[P.rumorsHeard % RUMORS.length]; P.rumorsHeard++;
    S.conn.send({ t: 'ui', panel: 'dialog', name: 'Tavern rumour', icon: '', lines: [r] }); this.touch(S);
  }
  on_inv_equip(S, m) { if (S.dead || this.inCombat(S)) return this.toast(S, 'Not in the heat of battle.', 'bad'); R.equip(S.P, +m.uid); this.recalc(S); this.touch(S); }
  on_inv_unequip(S, m) { if (S.dead || this.inCombat(S)) return this.toast(S, 'Not in the heat of battle.', 'bad'); R.unequip(S.P, m.slot); this.recalc(S); this.touch(S); }

  // ── crafting ──────────────────────────────────────────────────────────────
  stationFor(S, family) {
    const kind = family === 'blacksmith' ? 'forge' : 'cauldron';
    return getMap(S.map).points.find((p) => p.kind === kind && dist(S.x, S.y, p.x, p.y) <= 5);
  }
  on_craft_start(S, m) {
    if (S.dead || S.ticket) return;
    const r = RECIPES.find((x) => x.id === m.recipe);
    if (!r || !R.canCraft(S.P, r) || !this.stationFor(S, r.craft)) return this.toast(S, 'You cannot craft that here.', 'bad');
    let custom = null, rr = r;
    if (m.custom && r.craft === 'blacksmith') {
      const chk = R.customForgeCheck(S.P, r, m.custom.effects); if (!chk.ok) return this.toast(S, chk.msg, 'bad');
      for (const [id, n] of Object.entries(chk.cost)) R.removeItem(S.P, id, n);
      custom = { effects: chk.ids, name: String(m.custom.name ?? ''), cost: chk.cost }; rr = { ...r, diff: r.diff + R.forgeCustomDiff(chk.ids) };
    }
    R.consumeInputs(S.P, r);
    { const st = this.stationFor(S, r.craft); if (st) this.emit(S.map, { t: 'work', k: r.craft, x: st.x, y: st.y, ms: 4500 }); }
    if (r.craft === 'blacksmith') {
      const spec = R.forgeSpec(S.P, rr, this.rng);
      S.ticket = { kind: 'forge', r, spec, custom, startAt: this.now(), expires: this.now() + TICKET_MS };
      S.conn.send({ t: 'craft.ticket', kind: 'forge', recipe: r.id, spec, custom: custom ? { effects: custom.effects, name: custom.name } : null });
    } else {
      S.ticket = { kind: 'brew', r, b: R.brewStart(S.P, r, Array.isArray(m.extras) ? m.extras.map(String) : []), expires: this.now() + TICKET_MS };
      S.conn.send({ t: 'craft.ticket', kind: 'brew', recipe: r.id, b: { ...S.ticket.b }, stir: R.STIR });
    }
    this.touch(S);
  }
  // Custom brew: Draught / Flask / Essence with chosen effects. The base is 2 Marrow Herbs plus each effect's materials.
  on_craft_custom(S, m) {
    if (S.dead || S.ticket) return;
    const form = String(m.form), chk = R.customBrewCheck(S.P, form, m.effects);
    if (!chk.ok || !this.stationFor(S, 'alchemist')) return this.toast(S, chk.msg ?? 'You cannot brew that here.', 'bad');
    R.removeItem(S.P, 'herb', 2); for (const [id, n] of Object.entries(chk.cost)) R.removeItem(S.P, id, n);
    const name = String(m.name ?? '').replace(/[^\w \-'.]/g, '').trim().slice(0, 24);
    const r = { id: `custom_${form}`, craft: 'alchemist', lvl: 5, in: { herb: 2, ...chk.cost }, out: null, risk: 0.12 + 0.025 * chk.ids.length + 0.02 * Math.max(...chk.ids.map((i) => R.customTier(form, i))), custom: { form, effects: chk.ids, name } };
    { const st = this.stationFor(S, 'alchemist'); if (st) this.emit(S.map, { t: 'work', k: 'alchemist', x: st.x, y: st.y, ms: 4500 }); }
    S.ticket = { kind: 'brew', r, b: R.brewStart(S.P, r, Array.isArray(m.extras) ? m.extras.map(String) : []), expires: this.now() + TICKET_MS };
    S.conn.send({ t: 'craft.ticket', kind: 'brew', recipe: r.id, b: { ...S.ticket.b }, stir: R.STIR, custom: { form, effects: chk.ids, name: name || R.flaskTitle(form, chk.ids) } });
    this.touch(S);
  }
  on_craft_auto(S, m) {
    const r = RECIPES.find((x) => x.id === m.recipe);
    if (S.dead || S.ticket || !r || r.craft !== 'blacksmith' || !R.canCraft(S.P, r) || !this.stationFor(S, r.craft)) return;
    R.consumeInputs(S.P, r);
    this.finishForgeTicket(S, r, this.rng.range(0.25, 0.5));
  }
  on_craft_finish(S, m) {
    const t = S.ticket; if (!t || t.kind !== 'forge') return;
    const sc = R.scoreForge(S.P, t.r, t.spec, m.times, this.now() - t.startAt, Array.isArray(m.heat) ? { heat: m.heat, quench: m.quench, medium: m.medium } : null);
    this.finishForgeTicket(S, t.r, sc ? sc.q : 0.2, sc ? { ...sc } : null, { temper: sc?.medium ? R.QUENCH[sc.medium].affix : null, custom: t.custom });
  }
  finishForgeTicket(S, r, q, scores = null, extra = {}) {
    S.ticket = null;
    const out = R.finishForge(S.P, r, q, this.rng, extra); this.bountyEvent(S, 'craft', 'any', 1);
    S.conn.send({ t: 'craft.result', kind: 'forge', recipe: r.id, q: out.q, grade: out.grade, items: out.items, gear: out.gear ?? null, levelUps: out.levelUps, scores, fxApplied: out.fxApplied ?? null, fxLost: out.fxLost ?? null });
    if (out.levelUps.length) this.toast(S, `* Level ${out.levelUps.at(-1)}!`, 'good');
    this.afterChange(S);
  }
  on_brew_add(S) {
    const t = S.ticket; if (!t || t.kind !== 'brew' || t.b.burst || t.b.potency >= 5) return;
    R.brewAdd(S.P, t.b, this.rng);
    if (t.b.burst) return this.finishBrewTicket(S);
    S.conn.send({ t: 'brew.state', b: { ...t.b } });
  }
  on_brew_stir(S, m) { const t = S.ticket; if (!t || t.kind !== 'brew' || t.b.stirred) return; R.brewStir(S.P, t.b, m.taps); S.conn.send({ t: 'brew.state', b: { ...t.b } }); }
  on_brew_bottle(S) { const t = S.ticket; if (!t || t.kind !== 'brew') return; this.finishBrewTicket(S); }
  finishBrewTicket(S) {
    const t = S.ticket; S.ticket = null;
    const out = R.finishBrew(S.P, t.r, t.b, this.rng); if (!out.burst) this.bountyEvent(S, 'craft', 'any', 1);
    S.conn.send({ t: 'craft.result', kind: 'brew', recipe: t.r.id, custom: !!t.r.custom, burst: out.burst, items: out.items, levelUps: out.levelUps, b: { ...t.b }, purity: out.purity, potency: out.potency ?? null });
    if (out.levelUps.length) this.toast(S, `* Level ${out.levelUps.at(-1)}!`, 'good');
    this.afterChange(S);
  }
  cancelTicket(S, refund) {
    const t = S.ticket; if (!t) return; S.ticket = null;
    if (refund) { for (const [id, n] of Object.entries(t.r.in)) R.addItem(S.P, id, n); for (const id of t.b?.extras ?? []) R.addItem(S.P, id, 1); }
  }

  // ── flasks, draughts and enchanting ───────────────────────────────────────
  on_flask_use(S, m) {
    const P = S.P, fl = (P.flasks ?? []).find((x) => x.uid === +m.uid); if (!fl || S.dead) return;
    if (fl.form === 'essence') return this.toast(S, 'Essences are poured into gear by a Blacksmith, at a forge.', 'bad');
    const now = this.now(); if ((S.cds.flask ?? 0) > now) return;
    S.cds.flask = now + 6000; S.conn.send({ t: 'cd', k: 'flask', ms: 6000 });
    fl.n--; if (fl.n <= 0) P.flasks.splice(P.flasks.indexOf(fl), 1);
    this.applyFlask(S, fl, +m.a || 0, +m.tx, +m.ty); this.touch(S);
  }
  on_flask_quick(S, m) { const fl = (S.P.flasks ?? []).find((x) => x.uid === +m.uid); S.P.quickFlask = fl && fl.form !== 'essence' ? fl.uid : null; this.touch(S); }
  on_enchant(S, m) {
    if (S.dead || !this.stationFor(S, 'blacksmith')) return this.toast(S, 'Stand at a forge to enchant.', 'bad');
    const r = R.enchantGear(S.P, +m.gear, +m.flask, this.rng);
    this.toast(S, r.msg, r.ok && !r.destroyed ? 'good' : 'bad');
    if (r.ok) { const st = this.stationFor(S, 'blacksmith'); if (st) this.emit(S.map, { t: 'work', k: 'blacksmith', x: st.x, y: st.y, ms: 1800 }); S.conn.send({ t: 'enchanted', ok: !r.destroyed }); this.recalc(S); this.afterChange(S); }
  }

  // ── markets ───────────────────────────────────────────────────────────────
  marketView(S, mid) {
    const m = this.markets[mid], P = S.P;
    return {
      id: mid, day: m.day, base: m.base, fair: m.fair, history: Object.fromEntries(Object.entries(m.history).map(([k, v]) => [k, v.slice(-24)])), trend: Object.fromEntries(Object.keys(m.fair).map((k) => [k, trend(m, k)])),
      orders: this.orders.map((o) => this.orderView(o, P)), hint: P.classId === 'broker' ? m.hint : null, events: m.events.map((e) => ({ id: e.id, days: e.days, bump: e.bump, text: e.text })), news: m.news, fee: R.feeRate(P),
      listings: m.listings.map((l) => ({ id: l.id, seller: l.seller, bot: l.bot, mine: l.sellerId === P.id, itemId: l.itemId, qty: l.qty, price: l.price, q: l.q ?? null, affix: l.affix ?? null, x: l.x ?? null, age: l.age, val: Math.round(listingValue(m, l) * 10) / 10 })),
    };
  }
  pushMarket(mid) {
    for (const S of this.sessions.values()) if (S.market?.id === mid) S.conn.send({ t: 'market', view: this.marketView(S, mid) });
  }
  marketOk(S, mid) { return S.market && S.market.id === mid && this.near(S, S.market, 7); }
  on_market_open(S, m) { if (S.market && this.marketOk(S, S.market.id)) S.conn.send({ t: 'market', view: this.marketView(S, S.market.id) }); }
  on_market_list(S, m) {
    if (!S.market || !this.marketOk(S, S.market.id) || S.dead) return this.toast(S, 'Step up to the board first.', 'bad');
    const P = S.P, mk = this.markets[S.market.id], it = ITEMS[m.itemId];
    if (!it || it.k === 'quest') return this.toast(S, 'Quest items cannot be traded.', 'bad');
    if (mk.listings.filter((l) => l.sellerId === P.id).length >= 20) return this.toast(S, 'You may hold at most 20 listings.', 'bad');
    let qty = clamp(Math.floor(+m.qty) || 1, 1, 9999); const price = Math.round(+m.price);
    if (!(price >= 1 && price <= 1e7)) return this.toast(S, 'Set a sensible price.', 'bad');
    const fee = Math.ceil(price * (it.k === 'gear' ? 1 : qty) * R.feeRate(P));
    if (P.gilt < fee) return this.toast(S, `Listing fee is ${fee}g — you can't afford it.`, 'bad');
    let q, affix, x = null;
    if (it.k === 'gear') {
      const g = P.gear.find((x) => x.uid === +m.uid);
      if (!g || g.id !== m.itemId || R.isEquipped(P, g.uid)) return this.toast(S, 'Unequip it first.', 'bad');
      if (R.gearLocked(P, g)) return this.toast(S, 'Crafters cannot list their own creations. Sell it to a Merchant, or fill a commission on the Orders tab.', 'bad');
      q = g.q; affix = g.affix; x = { fx: g.fx, ench: g.ench, cname: g.cname, by: g.by }; P.gear.splice(P.gear.indexOf(g), 1); qty = 1;
    } else {
      if (qty > R.freeStack(P, m.itemId)) return this.toast(S, R.lockedStack(P, m.itemId) ? `Only ${R.freeStack(P, m.itemId)} of those are tradeable — your own creations can only go to Merchants or fill orders.` : 'Not enough items.', 'bad');
      if (!R.removeItem(P, m.itemId, qty)) return this.toast(S, 'Not enough items.', 'bad');
    }
    P.gilt -= fee;
    listItem(mk, { seller: P.name, sellerId: P.id, itemId: m.itemId, qty, price, q, affix, x });
    this.toast(S, `Listed ${qty}× ${it.n} at ${price}g (fee ${fee}g).`); this.touch(S); this.pushMarket(S.market.id);
  }
  on_market_cancel(S, m) {
    if (!S.market || !this.marketOk(S, S.market.id)) return;
    const mk = this.markets[S.market.id], l = mk.listings.find((x) => x.id === m.id);
    if (!l || l.sellerId !== S.P.id) return;
    cancelListing(mk, l.id);
    if (ITEMS[l.itemId].k === 'gear') R.addGear(S.P, { id: l.itemId, q: l.q, affix: l.affix, ...(l.x ?? {}) }); else R.addItem(S.P, l.itemId, l.qty);
    this.toast(S, 'Listing cancelled; items returned.'); this.touch(S); this.pushMarket(S.market.id);
  }
  on_market_buy(S, m) {
    if (!S.market || !this.marketOk(S, S.market.id) || S.dead) return this.toast(S, 'Step up to the board first.', 'bad');
    const P = S.P, mk = this.markets[S.market.id], l = mk.listings.find((x) => x.id === m.id);
    if (!l) return this.toast(S, 'That listing is gone.', 'bad');
    if (l.sellerId === P.id) return this.toast(S, "That's your own listing — cancel it instead.", 'bad');
    const n = Math.min(clamp(Math.floor(+m.qty) || 1, 1, 9999), l.qty);
    if (P.gilt < l.price * n) return this.toast(S, 'Not enough gilt.', 'bad');
    const got = takeFromListing(mk, l.id, n);
    P.gilt -= got.cost;
    if (ITEMS[got.itemId].k === 'gear') R.addGear(P, { id: got.itemId, q: got.q, affix: got.affix, ...(got.x ?? {}) }); else R.addItem(P, got.itemId, got.qty);
    if (!got.bot && got.sellerId) this.credit(got.sellerId, got.cost, `${P.name} bought ${got.qty}× ${ITEMS[got.itemId].n}`);
    this.toast(S, `Bought ${got.qty}× ${ITEMS[got.itemId].n} for ${got.cost}g.`); this.touch(S); this.pushMarket(S.market.id);
  }

  // Pay a seller (online → instantly; offline → mailbox). Tracks market takings; merchants earn XP from trade.
  credit(playerId, gross, note) {
    const P = this.players.get(playerId); if (!P) return;
    P.gilt += gross; P.stats.profit += gross;
    const ups = R.isMerchant(P) ? R.gainXp(P, 3 + gross / 25) : [];
    const S = this.sessions.get(playerId);
    if (S) { this.toast(S, ` ${note} for ${gross}g`, 'good'); if (ups.length) this.toast(S, `* Level ${ups.at(-1)}!`, 'good'); R.checkHints(P); this.touch(S); }
    else { P.mail.push(` ${note} for ${gross}g`); if (P.mail.length > 25) P.mail.shift(); }
  }

  marketDay() {
    for (const mid of ['main', 'hollow']) {
      const m = this.markets[mid];
      tickMarket(m, this.rng);
      for (const p of m.proceeds.splice(0)) if (p.sellerId) this.credit(p.sellerId, p.gross, `${p.buyer} bought ${p.qty}× ${ITEMS[p.itemId].n}`);
    }
    this.refillBotOrders(); this.expireOrders(); this.spawnCustomers();
    for (const S of this.sessions.values()) if (S.market) S.conn.send({ t: 'market', view: this.marketView(S, S.market.id) });
  }

  // ── customers & haggling ──────────────────────────────────────────────────
  spawnCustomers() {
    const m = this.markets.main, map = getMap('town'), out = [];
    for (const c of m.customers) {
      for (let tries = 0; tries < 30; tries++) {
        const x = this.rng.int(16, 35) + 0.5, y = this.rng.int(12, 23) + 0.5;
        if (!blockedAt(map, x, y) && !(x > 24 && x < 28 && y > 16 && y < 20)) { out.push({ ...c, id: `cust:${c.id}`, x, y, name: c.name }); break; }
      }
    }
    this.customers = out;
  }
  interactCustomer(S, id) {
    const c = this.customers.find((x) => x.id === id);
    if (!c || S.map !== 'town' || dist(S.x, S.y, c.x, c.y) > 2.6) return;
    const P = S.P, it = ITEMS[c.itemId];
    let cand = null;
    if (it.k === 'gear') cand = P.gear.filter((g) => g.id === c.itemId && g.q >= c.minQ && !R.isEquipped(P, g.uid) && !R.gearLocked(P, g)).sort((a, b) => a.q - b.q)[0];
    else if (R.freeStack(P, c.itemId) > 0) cand = { id: c.itemId };
    if (!cand) return S.conn.send({ t: 'ui', panel: 'dialog', name: c.name, icon: 'customer', lines: [`I'm looking for ${it.n}${it.k === 'gear' ? ` (quality ${Math.round(c.minQ * 100)}% or better)` : ''}. ${R.isCrafter(P) && (P.crafted?.[c.itemId] || P.gear.some((g) => g.id === c.itemId && g.crafted)) ? 'Hm, I only deal with Merchants for guild-made goods. Sell it to one — or wait for a commission.' : 'Come back when you have one.'}`] });
    this.customers = this.customers.filter((x) => x !== c);
    const h = R.haggleStart(this.markets.main, c, cand.q);
    S.haggle = { c, h, item: { itemId: c.itemId, uid: cand.uid, q: cand.q } };
    S.conn.send({ t: 'haggle.state', name: c.name, itemId: c.itemId, label: cand.uid ? R.gearName(cand) : it.n, base: h.base, mult: h.mult, ceil: R.isMerchant(P) ? h.ceil : null, round: h.round, maxRounds: h.maxRounds, over: false });
  }
  on_haggle_round(S, m) {
    const hg = S.haggle; if (!hg || hg.h.over) return;
    const r = R.haggleRound(S.P, hg.c, hg.h, m.stance === 'press' ? 'press' : 'charm', this.rng);
    S.conn.send({ t: 'haggle.round', r, h: { base: hg.h.base, mult: hg.h.mult, round: hg.h.round, maxRounds: hg.h.maxRounds, over: hg.h.over, walked: hg.h.walked } });
    if (hg.h.over) this.finishHaggle(S);
  }
  on_haggle_accept(S) { if (S.haggle) this.finishHaggle(S); }
  finishHaggle(S) {
    const { c, h, item } = S.haggle; S.haggle = null; const P = S.P;
    if (h.walked) { S.conn.send({ t: 'haggle.done', ok: false, msg: `${c.name} walks away.` }); return; }
    const price = Math.round(h.base * h.mult);
    if (ITEMS[item.itemId].k === 'gear') {
      const g = P.gear.find((x) => x.uid === item.uid); if (!g || R.isEquipped(P, g.uid)) return S.conn.send({ t: 'haggle.done', ok: false, msg: 'The item is gone.' });
      P.gear.splice(P.gear.indexOf(g), 1);
    } else if (!R.removeItem(P, item.itemId, 1)) return S.conn.send({ t: 'haggle.done', ok: false, msg: 'The item is gone.' });
    P.gilt += price; P.stats.profit += price;
    if (h.mult > 0.95) P.stats.haggleWins++;
    const ups = R.gainXp(P, 8 + Math.round(h.mult * 10) + (R.isMerchant(P) ? 6 : 0));
    S.conn.send({ t: 'haggle.done', ok: true, price, msg: `${c.name} pays ${price}g.`, levelUps: ups });
    this.afterChange(S);
  }

  // ── orders: commissions (any player) and wholesale buy orders (Merchants) ───
  // Crafters' creations leave their hands only here, or in a direct trade with a Merchant.
  orderView(o, P) {
    const bot = o.kind === 'bot';
    return { id: o.id, kind: o.kind, by: o.byName, mine: o.by === P.id, itemId: o.itemId, minQ: o.minQ, left: o.left, qty: o.qty, price: bot ? Math.round(valueOf(this.markets.main, o.itemId, 0.5) * 0.6) : o.price, scaled: bot, target: o.targetName ?? null, forMe: o.target === P.id };
  }
  botPay(o, q) { return Math.max(1, Math.round(valueOf(this.markets.main, o.itemId, q) * 0.6)); }
  refillBotOrders() {
    const outs = [...new Set(RECIPES.map((r) => r.out))], names = ['Silvertongue Imre', 'Quill & Co.', 'Madam Ocher'];
    for (const id of outs) {
      const qty = ITEMS[id].k === 'gear' ? 2 : 6, o = this.orders.find((x) => x.kind === 'bot' && x.itemId === id);
      if (o) o.left = qty; else this.orders.push({ id: this.nextOrder++, by: null, byName: this.rng.pick(names), kind: 'bot', itemId: id, minQ: ITEMS[id].k === 'gear' ? 0.3 : 0, qty, left: qty, price: 0, escrow: 0, target: null, created: this.now(), expires: Infinity });
    }
  }
  expireOrders() {
    const nw = this.now();
    for (const o of [...this.orders]) if (o.expires <= nw) { this.orders.splice(this.orders.indexOf(o), 1); this.refundOrder(o, 'expired'); }
  }
  refundOrder(o, why) {
    const P = this.players.get(o.by); if (!P || o.escrow <= 0) return;
    P.gilt += o.escrow; const msg = `Your order for ${ITEMS[o.itemId].n} ${why}; ${o.escrow}g refunded.`;
    const S = this.sessions.get(P.id); if (S) { this.toast(S, msg); this.touch(S); } else P.mail.push(msg);
    o.escrow = 0;
  }
  on_order_post(S, m) {
    if (!S.market || !this.marketOk(S, S.market.id) || S.dead) return this.toast(S, 'Step up to the board first.', 'bad');
    const P = S.P, it = ITEMS[m.itemId];
    if (!it || it.k === 'quest') return this.toast(S, 'That cannot be ordered.', 'bad');
    const qty = clamp(Math.floor(+m.qty) || 1, 1, 50), price = Math.round(+m.price);
    if (!(price >= 1 && price <= 1e6)) return this.toast(S, 'Set a sensible price per item.', 'bad');
    if (this.orders.filter((o) => o.by === P.id).length >= 10) return this.toast(S, 'You may have at most 10 open orders.', 'bad');
    const total = qty * price; if (P.gilt < total) return this.toast(S, `Escrow needed: ${total}g (price × quantity).`, 'bad');
    const merchant = R.isMerchant(P), target = !merchant && m.target ? this.byName.get(String(m.target).toLowerCase()) : null;
    if (!merchant && m.target && !target) return this.toast(S, 'No such player to commission.', 'bad');
    if (target && R.craftFamily(this.players.get(target)) !== null && it.k !== 'gear' && it.k !== 'cons' && it.k !== 'inter' && it.k !== 'key') return this.toast(S, 'Pick something that player can make.', 'bad');
    P.gilt -= total; this.touch(S);
    const o = { id: this.nextOrder++, by: P.id, byName: P.name, kind: merchant ? 'wholesale' : 'commission', itemId: m.itemId, minQ: it.k === 'gear' ? clamp(+m.minQ || 0, 0, 0.99) : 0, qty, left: qty, price, escrow: total, target: target ?? null, targetName: target ? this.players.get(target).name : null, created: this.now(), expires: this.now() + 24 * 3600 * 1000 };
    this.orders.push(o);
    this.toast(S, merchant ? `Wholesale order posted: ${qty}× ${it.n} at ${price}g each (${total}g held in escrow). Resell at your own price on the Exchange.` : `Commission posted: ${qty}× ${it.n} at ${price}g each${o.targetName ? ' for ' + o.targetName : ''} (${total}g held in escrow).`, 'good');
    if (target) { const T = this.sessions.get(target); if (T) this.toast(T, ` ${P.name} commissioned ${qty}× ${it.n} from you at ${price}g each — see the Orders tab.`, 'secret'); }
    this.pushMarket('main'); this.pushMarket('hollow');
  }
  on_order_cancel(S, m) {
    const o = this.orders.find((x) => x.id === m.id); if (!o || o.by !== S.id) return;
    this.orders.splice(this.orders.indexOf(o), 1); this.refundOrder(o, 'was cancelled'); this.pushMarket('main'); this.pushMarket('hollow');
  }
  on_order_fill(S, m) {
    if (!S.market || !this.marketOk(S, S.market.id) || S.dead) return this.toast(S, 'Step up to the board first.', 'bad');
    const o = this.orders.find((x) => x.id === m.id); if (!o) return this.toast(S, 'That order is gone.', 'bad');
    if (o.by === S.id) return this.toast(S, "That's your own order.", 'bad');
    if (o.target && o.target !== S.id) return this.toast(S, 'That commission was requested from someone else.', 'bad');
    const P = S.P, it = ITEMS[o.itemId], want = clamp(Math.floor(+m.qty) || 1, 1, o.left);
    let units = [];                              // [{q?}] items to hand over
    if (it.k === 'gear') {
      units = P.gear.filter((g) => g.id === o.itemId && g.q >= o.minQ && !R.isEquipped(P, g.uid)).sort((a, b) => (b.crafted ? 1 : 0) - (a.crafted ? 1 : 0) || a.q - b.q).slice(0, want);
    } else { const n = Math.min(want, R.count(P, o.itemId)); units = Array.from({ length: n }, () => ({})); }
    if (!units.length) return this.toast(S, `You have no ${it.n}${it.k === 'gear' ? ` of quality ${Math.round(o.minQ * 100)}%+` : ''} to deliver.`, 'bad');
    let pay = 0;
    for (const u of units) pay += o.kind === 'bot' ? this.botPay(o, u.q ?? 0.5) : o.price;
    const poster = o.by ? this.players.get(o.by) : null;
    if (it.k === 'gear') for (const g of units) { P.gear.splice(P.gear.indexOf(g), 1); if (poster) R.addGear(poster, { id: g.id, q: g.q, affix: g.affix, fx: g.fx, ench: g.ench, cname: g.cname, by: g.by }); }
    else { const c = Math.min(units.length, R.lockedStack(P, o.itemId)); if (c) P.crafted[o.itemId] -= c; R.removeItem(P, o.itemId, units.length); if (poster) R.addItem(poster, o.itemId, units.length); }
    P.gilt += pay; P.stats.profit += pay; o.left -= units.length; if (o.kind !== 'bot') o.escrow = Math.max(0, o.escrow - pay);
    if (o.left <= 0) this.orders.splice(this.orders.indexOf(o), 1);
    const ups = R.gainXp(P, 4 + units.length * 4); if (ups.length) this.toast(S, `* Level ${ups.at(-1)}!`, 'good');
    this.toast(S, `Delivered ${units.length}× ${it.n} to ${o.byName} for ${pay}g.`, 'good');
    if (poster) { const note = `${P.name} delivered ${units.length}× ${it.n} to your ${o.kind} order.`; const PS = this.sessions.get(poster.id); if (PS) { this.toast(PS, ' ' + note, 'good'); this.touch(PS); } else poster.mail.push(' ' + note); }
    R.checkHints(P); this.afterChange(S); this.pushMarket('main'); this.pushMarket('hollow');
  }

  // ── chat ──────────────────────────────────────────────────────────────────
  on_chat(S, m) {
    const nw = this.now(); if (nw - S.lastChat < 350) return; S.lastChat = nw;
    const text = String(m.text ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200); if (!text) return;
    const out = { t: 'chat', ch: m.ch, from: S.P.name, text, ts: nw };
    if (m.ch === 'global' || m.ch === 'trade') { for (const o of this.sessions.values()) o.conn.send(out); }
    else if (m.ch === 'say') { for (const o of this.sessions.values()) if (o.map === S.map && dist(o.x, o.y, S.x, S.y) < 24) o.conn.send(out); }
    else if (m.ch === 'guild') { const g = this.guildOf(S.P); if (!g) return this.toast(S, 'You are not in a guild.'); for (const id of g.members) this.sessions.get(id)?.conn.send(out); }
    else if (m.ch === 'party') { const pt = this.parties.get(S.partyId); if (!pt) return this.toast(S, 'You are not in a party.'); for (const id of pt.members) this.sessions.get(id)?.conn.send(out); }
    else if (m.ch === 'whisper') {
      const to = this.sessions.get(this.byName.get(String(m.to ?? '').toLowerCase()));
      if (!to) return this.toast(S, 'That player is not online.', 'bad');
      to.conn.send({ ...out, ch: 'whisper-from' }); S.conn.send({ ...out, ch: 'whisper-to', to: to.P.name });
    }
  }

  // ── parties ───────────────────────────────────────────────────────────────
  sessionByName(n) { return this.sessions.get(this.byName.get(String(n ?? '').toLowerCase())); }
  on_party_invite(S, m) {
    const o = this.sessionByName(m.to); if (!o || o === S) return this.toast(S, 'No such player online.', 'bad');
    const pt = this.parties.get(S.partyId); if (pt && pt.members.length >= 3) return this.toast(S, 'Your party is full.', 'bad');
    if (o.partyId) return this.toast(S, `${o.P.name} is already in a party.`, 'bad');
    this.invites.set(`party:${o.id}`, { from: S.id, at: this.now() });
    o.conn.send({ t: 'invite', kind: 'party', from: S.P.name }); this.toast(S, `Invited ${o.P.name} to your party.`);
  }
  on_party_accept(S) {
    const inv = this.invites.get(`party:${S.id}`); if (!inv) return; this.invites.delete(`party:${S.id}`);
    const L = this.sessions.get(inv.from); if (!L || S.partyId) return;
    let pt = this.parties.get(L.partyId);
    if (!pt) { pt = { id: `pt${this.nextId++}`, leader: L.id, members: [L.id] }; this.parties.set(pt.id, pt); L.partyId = pt.id; }
    if (pt.members.length >= 3) return this.toast(S, 'That party is full.', 'bad');
    pt.members.push(S.id); S.partyId = pt.id; this.pushParty(pt);
  }
  on_party_leave(S) { this.leaveParty(S); }
  leaveParty(S) {
    const pt = this.parties.get(S.partyId); if (!pt) return;
    pt.members = pt.members.filter((id) => id !== S.id); S.partyId = null;
    S.conn.send({ t: 'party', party: null }); this.touch(S);
    if (pt.members.length < 2) { for (const id of pt.members) { const s = this.sessions.get(id); if (s) { s.partyId = null; s.conn.send({ t: 'party', party: null }); } } this.parties.delete(pt.id); }
    else { if (pt.leader === S.id) pt.leader = pt.members[0]; this.pushParty(pt); }
  }
  pushParty(pt) {
    const members = pt.members.map((id) => { const P = this.players.get(id); return { id, name: P.name, level: P.level, classId: P.classId }; });
    for (const id of pt.members) { const s = this.sessions.get(id); if (s) { s.conn.send({ t: 'party', party: { id: pt.id, leader: pt.leader, members } }); this.touch(s); } }
  }

  // ── direct trading ────────────────────────────────────────────────────────
  on_trade_request(S, m) {
    const o = this.sessionByName(m.to);
    if (!o || o === S || o.map !== S.map || dist(o.x, o.y, S.x, S.y) > 8) return this.toast(S, 'They must be nearby to trade.', 'bad');
    if (S.tradeId || o.tradeId || S.duel || o.duel || this.inCombat(S) || this.inCombat(o)) return this.toast(S, 'One of you is busy.', 'bad');
    this.invites.set(`trade:${o.id}`, { from: S.id, at: this.now() });
    o.conn.send({ t: 'invite', kind: 'trade', from: S.P.name }); this.toast(S, `Trade request sent to ${o.P.name}.`);
  }
  on_trade_accept(S) {
    const inv = this.invites.get(`trade:${S.id}`); if (!inv) return; this.invites.delete(`trade:${S.id}`);
    const A = this.sessions.get(inv.from); if (!A || S.tradeId || A.tradeId || S.duel || A.duel) return;
    const tr = { id: `tr${this.nextId++}`, a: A.id, b: S.id, offers: { [A.id]: { items: {}, gear: [], gilt: 0 }, [S.id]: { items: {}, gear: [], gilt: 0 } }, ok: { [A.id]: false, [S.id]: false } };
    this.trades.set(tr.id, tr); A.tradeId = tr.id; S.tradeId = tr.id; this.pushTrade(tr);
  }
  // `partner` is the other player's record: crafters may hand their own creations ONLY to a Merchant.
  validOffer(P, o, partner) {
    const toMerchant = !partner || R.isMerchant(partner);
    for (const [id, n] of Object.entries(o.items)) { if (!ITEMS[id] || ITEMS[id].k === 'quest' || ITEMS[id].k === 'gear' || !(n > 0) || R.count(P, id) < n) return false; if (!toMerchant && n > R.freeStack(P, id)) return false; }
    for (const uid of o.gear) { const g = P.gear.find((x) => x.uid === uid); if (!g || R.isEquipped(P, uid)) return false; if (!toMerchant && R.gearLocked(P, g)) return false; }
    for (const uid of o.flasks ?? []) { const f = (P.flasks ?? []).find((x) => x.uid === uid); if (!f) return false; if (!toMerchant && !(f.form === 'essence' && partner && R.craftFamily(partner) === 'blacksmith')) return false; }   // an Alchemist may hand ESSENCES to a Blacksmith (that is the whole point)
    return o.gilt >= 0 && P.gilt >= o.gilt;
  }
  on_trade_offer(S, m) {
    const tr = this.trades.get(S.tradeId); if (!tr) return;
    const items = {}; for (const [id, n] of Object.entries(m.items ?? {})) { const q = Math.floor(+n); if (q > 0) items[id] = q; }
    const gear = [...new Set((m.gear ?? []).map(Number))].slice(0, 12); const gilt = Math.max(0, Math.floor(+m.gilt) || 0);
    const flasks = [...new Set((m.flasks ?? []).map(Number))].slice(0, 12);
    const o = { items, gear, flasks, gilt };
    const other = this.players.get(tr.a === S.id ? tr.b : tr.a);
    if (!this.validOffer(S.P, o, other)) return this.toast(S, R.isCrafter(S.P) ? 'You cannot offer your own creations to that player — only Merchants may buy them (or fill their order on the Exchange).' : 'You do not have that to offer.', 'bad');
    tr.offers[S.id] = o; tr.ok[tr.a] = tr.ok[tr.b] = false; this.pushTrade(tr);
  }
  on_trade_confirm(S) {
    const tr = this.trades.get(S.tradeId); if (!tr) return;
    tr.ok[S.id] = true; this.pushTrade(tr);
    if (!(tr.ok[tr.a] && tr.ok[tr.b])) return;
    const A = this.players.get(tr.a), B = this.players.get(tr.b), oa = tr.offers[tr.a], ob = tr.offers[tr.b];
    if (!this.validOffer(A, oa, B) || !this.validOffer(B, ob, A)) { this.endTrade(tr, 'Trade failed: an offer became invalid.'); return; }
    const move = (from, to, o) => {
      for (const [id, n] of Object.entries(o.items)) { const c = Math.min(n, R.lockedStack(from, id)); if (c) from.crafted[id] -= c; R.removeItem(from, id, n); R.addItem(to, id, n); }
      for (const uid of o.gear) { const g = from.gear.splice(from.gear.findIndex((x) => x.uid === uid), 1)[0]; R.addGear(to, { id: g.id, q: g.q, affix: g.affix, fx: g.fx, ench: g.ench, cname: g.cname, by: g.by }); }
      for (const uid of o.flasks ?? []) { const i = from.flasks.findIndex((x) => x.uid === uid), f = from.flasks.splice(i, 1)[0]; const g = R.addFlask(to, { form: f.form, name: f.name, fx: f.fx, n: f.n, by: f.by }); delete g.crafted; g.q = f.q; }
      from.gilt -= o.gilt; to.gilt += o.gilt;
    };
    move(A, B, oa); move(B, A, ob);
    this.endTrade(tr, 'Trade complete!', true);
  }
  on_trade_cancel(S) { const tr = this.trades.get(S.tradeId); if (tr) this.endTrade(tr, `${S.P.name} cancelled the trade.`); }
  endTradeFor(S, why) { const tr = this.trades.get(S.tradeId); if (tr) this.endTrade(tr, why); }
  endTrade(tr, msg, done = false) {
    this.trades.delete(tr.id);
    for (const id of [tr.a, tr.b]) { const s = this.sessions.get(id); if (s) { s.tradeId = null; s.conn.send({ t: 'trade.end', msg, done }); this.touch(s); } }
  }
  pushTrade(tr) {
    for (const id of [tr.a, tr.b]) {
      const s = this.sessions.get(id), other = id === tr.a ? tr.b : tr.a;
      s?.conn.send({ t: 'trade.state', with: this.players.get(other).name, mine: tr.offers[id], theirs: tr.offers[other], myOk: tr.ok[id], theirOk: tr.ok[other], theirGear: tr.offers[other].gear.map((uid) => this.players.get(other).gear.find((g) => g.uid === uid)).filter(Boolean), theirFlasks: (tr.offers[other].flasks ?? []).map((uid) => this.players.get(other).flasks.find((f) => f.uid === uid)).filter(Boolean) });
    }
  }

  // ── world tick ────────────────────────────────────────────────────────────
  tick() {
    const nw = this.now(), dt = clamp((nw - this.lastTick) / 1000, 0, 0.5); this.lastTick = nw;
    if (nw - this.lastDay >= this.dayMs) { this.lastDay += this.dayMs; if (nw - this.lastDay > this.dayMs) this.lastDay = nw; this.marketDay(); }
    this.tickCombat(dt, nw); this.tickLive(nw);
    for (const S of this.sessions.values()) { this.tickGather(S); if (S.ticket && nw > S.ticket.expires) { this.cancelTicket(S, false); this.toast(S, 'The batch went cold and was lost.', 'bad'); } if (S.gather && nw - S.lastHurt < 400) { S.gather = null; S.conn.send({ t: 'gather.cancel' }); } }
    for (const [k, v] of this.invites) if (nw - v.at > 60000) this.invites.delete(k);
    if (nw - this.lastSnap >= SNAP_MS) { this.lastSnap = nw; this.broadcastSnaps(); }
    if (nw - this.lastMe >= ME_MS) { this.lastMe = nw; for (const S of this.sessions.values()) if (S.dirtyMe) { S.dirtyMe = false; this.recalc(S); S.conn.send({ t: 'me', me: this.meView(S) }); } }
  }

  broadcastSnaps() {
    const groups = {}, nw = this.now();
    for (const S of this.sessions.values()) (groups[S.map] ??= []).push(S);
    for (const [mapId, list] of Object.entries(groups)) {
      const players = list.map((S) => ({ id: S.id, n: S.P.name, c: S.P.classId, l: S.P.level, x: +S.x.toFixed(2), y: +S.y.toFixed(2), d: S.dir, mv: S.moving ? 1 : 0, a: +S.aim.toFixed(2), h: Math.round(S.hp), mh: S.rt.maxHp, mp: Math.round(S.mp), mm: S.rt.maxMp, dd: S.dead ? 1 : 0, gd: nw < S.guardUntil ? 1 : 0, sl: nw < S.stealthUntil ? 1 : 0, sn: nw < S.stunUntil ? 1 : 0, dl: S.duel ? 1 : 0, pv: S.pvp ? 1 : 0, sh: S.shield > 0 && nw < S.shieldUntil ? 1 : 0, g: S.gather ? 1 : 0, pt: S.partyId, gl: S.P.guild ?? null }));
      const mobs = this.mobs.filter((m) => m.map === mapId && !m.deadUntil).map((m) => ({ id: m.id, k: m.key, l: m.level, x: +m.x.toFixed(2), y: +m.y.toFixed(2), h: Math.round(m.hp), mh: m.maxHp, nm: m.name, bo: m.boss ? 1 : 0, rd: m.radius, sn: m.stunUntil > nw ? 1 : 0, vu: m.vulnUntil > nw ? 1 : 0, ch: m.target ? 1 : 0, fl: nw - m.flash < 120 ? 1 : 0, en: m.enraged ? 1 : 0,
        w: m.wind ? { k: m.wind.mv.kind, p: Math.min(1, (nw - m.wind.t0) / m.wind.dur), a: +m.wind.a.toFixed(2), tx: +m.wind.tx.toFixed(2), ty: +m.wind.ty.toFixed(2), r: m.wind.mv.radius ?? 0, rg: m.wind.mv.range ?? 0, ar: m.wind.mv.arc ?? 0, at: m.wind.mv.at ?? '', ds: m.wind.mv.dist ?? 0 } : null }));
      const projs = this.projs.filter((p) => p.map === mapId).map((p) => ({ id: p.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2), r: p.r, o: p.owner.k, ty: p.type, c: p.col ?? null, vi: p.vi ?? null }));
      const zones = this.zones.filter((z) => z.map === mapId).map((z) => ({ id: z.id, x: z.x, y: z.y, r: z.r, k: z.k }));
      const cust = mapId === 'town' ? this.customers.map((c) => ({ id: c.id, n: c.name, x: c.x, y: c.y, it: c.itemId })) : [];
      const cds = []; for (const p of getMap(mapId).points) if (p.kind === 'node' && (this.nodeCd[p.id] ?? 0) > nw) cds.push(p.id);
      const ev = this.fx[mapId] ? this.fx[mapId].splice(0) : [];
      const snap = { t: 'snap', now: nw, players, mobs, projs, zones, cust, cds, ev };
      for (const S of list) S.conn.send(snap);
    }
    for (const k of Object.keys(this.fx)) if (!groups[k]) this.fx[k].length = 0;
  }

  on_ping(S, m) { S.conn.send({ t: 'pong', c: m.c, now: this.now() }); }
  on_who(S) { S.conn.send({ t: 'who', players: [...this.sessions.values()].map((o) => ({ n: o.P.name, c: o.P.classId, l: o.P.level, map: getMap(o.map).name })) }); }
}

Object.assign(GameServer.prototype, combatMethods, progressMethods, liveMethods, pvpMethods, requestMethods);
