// Skills, loadouts, Ascension and mythic status — pure helpers shared by server and client.
import { SKILLS, BASICS, CLASSES, BASE_CLASSES, PATHS, COMBOS, MAX_LEVEL } from './data.js';

export const SLOTS = 4;
export const ASCEND_LVL = 8, MASTERY_LVL = 20;
export const respecCost = (P) => 150 * P.level;

export function ensureSkillState(P) {
  P.asc ??= { path: null, mastery: null };
  P.learned ??= [];
  P.loadout ??= null;
  P.quests ??= {};
  P.ways ??= [];
  P.pot ??= {};
  P.qlog ??= [];
  P.titles ??= [];
  return P;
}

export const pathOf = (P) => (P.asc?.path ? PATHS[P.asc.path] : null);
export const masteryOf = (P) => { const p = pathOf(P); return p && P.asc.mastery ? p.masteries.find((m) => m.id === P.asc.mastery) ?? null : null; };
export const isMythic = (P) => !!CLASSES[P.classId]?.mythic;
export const statusOf = (P) => CLASSES[P.classId]?.status ?? null;

// Required character level to know a skill (class-specific for shared base skills).
export const skillLevel = (s, classId) => s.lv?.[classId] ?? s.lvl ?? 1;

export function fitsClass(P, s) {
  if (!s || !s.cls.includes(P.classId)) return false;
  if (s.path && P.asc?.path !== s.path) return false;
  if (s.mastery && P.asc?.mastery !== s.mastery) return false;
  return true;
}
export function knows(P, s) {
  if (!fitsClass(P, s)) return false;
  if (s.src === 'tome' || s.src === 'hidden') return (P.learned ?? []).includes(s.id);
  return P.level >= skillLevel(s, P.classId);
}
// Skills of the player's class that exist but are not known yet (for the "locked" half of the skills window).
export function classSkillPool(P) {
  return Object.values(SKILLS).filter((s) => fitsClass(P, s) || (s.cls.includes(P.classId) && !s.path && !s.mastery) || (s.path && s.path === P.asc?.path) || (s.cls.includes(P.classId) && s.src === 'tome'));
}
export const knownSkills = (P) => Object.values(SKILLS).filter((s) => knows(P, s));

export function defaultLoadout(P) {
  const known = knownSkills(P), rank = (s) => ({ mastery: 0, mythic: 1, path: 2, level: 3, hidden: 4, tome: 5 }[s.src] ?? 6);
  const lv = (s) => skillLevel(s, P.classId);
  // Base skills first for a fresh character (the original 4); path/mastery/mythic skills take over once you have them.
  const pri = known.slice().sort((a, b) => rank(a) - rank(b) || lv(a) - lv(b));
  const out = pri.slice(0, SLOTS).map((s) => s.id);
  while (out.length < SLOTS) out.push(null);
  return out;
}
export function loadoutOf(P) {
  const cur = Array.isArray(P.loadout) ? P.loadout.slice(0, SLOTS) : null;
  const ok = (id) => id && SKILLS[id] && knows(P, SKILLS[id]);
  if (!cur) return defaultLoadout(P);
  const out = cur.map((id) => (ok(id) ? id : null)); while (out.length < SLOTS) out.push(null);
  // Fresh unlocks fill an empty slot automatically.
  const have = new Set(out.filter(Boolean));
  for (let i = 0; i < SLOTS; i++) if (!out[i]) { const n = defaultLoadout(P).find((id) => id && !have.has(id)); if (n) { out[i] = n; have.add(n); } }
  return out;
}
export function setSlot(P, slot, id) {
  slot = Math.floor(slot); if (!(slot >= 0 && slot < SLOTS)) return { ok: false, msg: 'No such slot.' };
  const cur = loadoutOf(P);
  if (id === null || id === undefined || id === '') { cur[slot] = null; P.loadout = cur; return { ok: true }; }
  const s = SKILLS[id]; if (!s || !knows(P, s)) return { ok: false, msg: 'You have not learned that skill.' };
  const at = cur.indexOf(id); if (at >= 0) cur[at] = cur[slot];
  cur[slot] = id; P.loadout = cur; return { ok: true };
}

// The basic attack: the class's, overlaid by Ascension, with a combo table attached.
export function basicOf(P) {
  const base = BASICS[P.classId] ?? BASICS.warrior, p = pathOf(P);
  return p?.basic ? { ...base, ...p.basic } : base;
}
export const comboOf = (b) => (b.combo ? COMBOS[b.combo] : null);

// Multiplicative stat mods from path and mastery.
export function modsOf(P) {
  const m = { hp: 1, atk: 1, def: 1, move: 1, mp: 1, mpRegen: 1, dmg: 1 };
  for (const src of [pathOf(P)?.mods, masteryOf(P)?.mods]) if (src) for (const [k, v] of Object.entries(src)) m[k] = (m[k] ?? 1) * v;
  return m;
}
export function perkOf(P) {
  const out = {};
  for (const src of [pathOf(P)?.perk, masteryOf(P)?.perk]) if (src) for (const [k, v] of Object.entries(src)) out[k] = (out[k] ?? 0) + v;
  return out;
}

// ── Ascension ─────────────────────────────────────────────────────────────
export const canAscend = (P) => BASE_CLASSES.includes(P.classId) && P.level >= ASCEND_LVL && !P.asc?.path;
export const canMaster = (P) => !!P.asc?.path && !P.asc.mastery && P.level >= MASTERY_LVL;
export function pathsFor(P) { return Object.values(PATHS).filter((p) => p.cls === P.classId); }
export function ascend(P, pathId) {
  ensureSkillState(P);
  const p = PATHS[pathId];
  if (!canAscend(P) || !p || p.cls !== P.classId) return { ok: false, msg: 'You cannot take that path.' };
  P.asc = { path: pathId, mastery: null }; P.loadout = null; P.loadout = defaultLoadout(P);
  return { ok: true, msg: `You have ascended: ${p.name}.`, path: p };
}
export function master(P, id) {
  const p = pathOf(P), m = p?.masteries.find((x) => x.id === id);
  if (!canMaster(P) || !m) return { ok: false, msg: 'You cannot take that mastery.' };
  P.asc.mastery = id;
  const cur = loadoutOf(P); cur[SLOTS - 1] = m.ult; P.loadout = cur;
  return { ok: true, msg: `Mastery gained: ${m.name}.`, mastery: m };
}
export function respec(P) {
  if (!P.asc?.path) return { ok: false, msg: 'You have not ascended.' };
  const cost = respecCost(P); if (P.gilt < cost) return { ok: false, msg: `Un-ascending costs ${cost}g.` };
  P.gilt -= cost; P.asc = { path: null, mastery: null }; P.loadout = null; P.loadout = defaultLoadout(P);
  return { ok: true, msg: `You return to your class. (-${cost}g)` };
}
// Taking a hidden / mythic class wipes the old path: the new class has its own kit.
export function resetForNewClass(P) { P.asc = { path: null, mastery: null }; P.loadout = null; P.loadout = defaultLoadout(P); }

// Learn a tome/hidden skill. Returns {ok,msg}. Does not consume items.
export function learnSkill(P, id) {
  const s = SKILLS[id]; if (!s) return { ok: false, msg: 'Unknown skill.' };
  if (!s.cls.includes(P.classId)) return { ok: false, msg: `Your training cannot contain ${s.name}.` };
  if ((P.learned ??= []).includes(id)) return { ok: false, msg: `You already know ${s.name}.` };
  P.learned.push(id);
  const cur = loadoutOf(P); // equip automatically if there's room
  if (cur.includes(null) && knows(P, s)) { cur[cur.indexOf(null)] = id; P.loadout = cur; }
  return { ok: true, msg: `Learned ${s.name}!`, skill: s };
}

// Which tome skills could drop for this player (class-eligible, not yet known).
export const eligibleTomes = (P, ids) => ids.filter((id) => SKILLS[id] && SKILLS[id].cls.includes(P.classId) && !(P.learned ?? []).includes(id));

export { MAX_LEVEL };
