// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ADVENTURES — every overland region has a short list of goals: hunt its monsters, bring down its elite and its lair boss, gather its resources,
// find places of interest (camps, ruins, shrines, waystones), clear its dungeon. Each goal pays gilt and XP the moment it is done; finishing
// all of them masters the region (a bigger prize and progress towards titles). Pure data shared by server and client.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { ZONES, ENEMIES } from './data.js';
import { regionFeatures } from './world.js';
import { xpForLevel } from './units.js';

const cache = new Map();
export function adventureGoals(regionId) {
  if (cache.has(regionId)) return cache.get(regionId);
  const z = ZONES[regionId]; if (!z || !(z.lvl > 0) || z.dungeon) { cache.set(regionId, null); return null; }
  const L = z.lvl, f = regionFeatures(regionId), nm = z.name, XP = xpForLevel(Math.max(1, Math.min(L, 100)));
  const pay = (k) => ({ gilt: Math.round((L * L * 0.6 + 60) * k), xp: Math.round(XP * 0.05 * k) });
  const goals = [{ id: 'cull', text: `Hunt monsters in ${nm}`, need: 8 + Math.floor(L / 10), ...pay(1) }];
  if (z.elite) goals.push({ id: 'elite', text: `Defeat the elite ${(ENEMIES[z.elite]?.name ?? 'elite').replace(' (Elite)', '')}`, need: 1, ...pay(1.4) });
  if (z.boss) goals.push({ id: 'boss', text: `Slay the lair boss ${ENEMIES[z.boss]?.name ?? 'boss'}`, need: 1, ...pay(2) });
  goals.push({ id: 'gather', text: `Gather resources in ${nm}`, need: 6 + Math.floor(L / 12), ...pay(0.8) });
  goals.push({ id: 'discover', text: 'Find places of interest (camps, ruins, shrines, waystones)', need: 5 + Math.floor(L / 30), ...pay(1) });
  if (f.dungeons.length) goals.push({ id: 'dungeon', text: `Clear ${f.dungeons[0].replace(/ \(Lv.*$/, '')}`, need: 1, ...pay(2.4) });
  const mastery = { gilt: Math.round((L * L * 0.6 + 60) * 5), xp: Math.round(XP * 0.25) };
  const out = { region: regionId, name: nm, lvl: L, goals, mastery }; cache.set(regionId, out); return out;
}
export const POI_KINDS = new Set(['chest', 'sign', 'waystone']);
