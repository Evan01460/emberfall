// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// RAIDS — multi-boss instances for a party, in the manner of the great MMO raids.
//
//   Citadel of the Void Emperor (level 40+, 4 bosses)   entered from the Far Reaches
//   Wyrmcrown Sanctum           (level 80+, 5 bosses)   entered from the Far Reaches
//
// Every wing is its own arena with one encounter. An encounter is a boss (or two linked bosses), phases that trigger as its health falls
// (adds, meteors, enrage, a shield that holds while its servants live) and loot for every raider who is still standing when it dies.
// A wipe resets the whole raid. Pure data here; the engine is src/server/raids.js.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { mobDef, bossDef, EXP_TIERS, FAR_GATES } from './expansion.js';

const tier = (id) => EXP_TIERS.find((t) => t.id === id);
export const RAID_ENEMIES = {};
const add = (id, d) => { RAID_ENEMIES[id] = d; return id; };

// ── Citadel of the Void Emperor ──
const vt = tier('voidglass'), dt = tier('drakesteel');
add('vc_thrall', { ...mobDef('Void Thrall', 'imp', '#8a6ad8', 41, 'fast', vt), xp: 120 });
add('vc_acolyte', { ...mobDef('Choir Acolyte', 'witch', '#c8b8ff', 43, 'caster', vt), xp: 160 });
add('vc_krosh', bossDef('Gatewarden Krosh', 'brute', '#7a5ac8', 42, vt, ['smash', 'slam', 'lunge', 'colossus_stomp']));
add('vc_oracle_a', bossDef('Oracle Ashmere', 'witch', '#ff7a4a', 43, vt, ['nova', 'spit', 'rift_beam', 'rift_collapse', 'magma_burst']));
add('vc_oracle_f', bossDef('Oracle Frostmere', 'witch', '#7ac0ff', 43, vt, ['unwrite', 'rift_beam', 'sentence', 'nova', 'page_storm']));
add('vc_choir', bossDef('The Hollow Choir', 'wraith', '#d0c0ff', 44, dt, ['unwrite', 'page_storm', 'void_slam', 'rift_collapse', 'sentence']));
add('vc_emperor', bossDef("Void Emperor Zhul'Kath", 'warden', '#a984ff', 46, dt, ['void_slam', 'sentence', 'rift_collapse', 'unwrite', 'colossus_stomp', 'rift_beam']));

// ── Wyrmcrown Sanctum ──
const st = tier('solarite'), mt = tier('mythril'), wt = tier('worldsteel');
add('wc_hatchling', { ...mobDef('Wyrm Hatchling', 'scorpion', '#ffb84a', 81, 'fast', st), xp: 400 });
add('wc_cultist', { ...mobDef('Crown Cultist', 'witch', '#ffe090', 83, 'caster', st), xp: 480 });
add('wc_drakeling', { ...mobDef('Storm Drakeling', 'worm', '#8ab8ff', 86, 'grunt', mt), xp: 560 });
add('wc_brood', bossDef('Brood Mother Skathra', 'spider', '#c08a4a', 82, st, ['smash', 'slam', 'lunge', 'thorn_volley', 'world_slam']));
add('wc_cinderfang', bossDef('Cinderfang the Burning', 'worm', '#ff7a3a', 84, st, ['magma_burst', 'ember_fan', 'colossus_stomp', 'smash', 'slam']));
add('wc_frostmaw', bossDef('Frostmaw the Hoary', 'worm', '#9ad8ff', 84, st, ['unwrite', 'rift_beam', 'world_slam', 'sentence', 'smash']));
add('wc_storm', bossDef('Stormcaller Valtharion', 'imp', '#8ab8ff', 86, mt, ['rift_beam', 'rift_collapse', 'unwrite', 'void_slam', 'nova']));
add('wc_hollow', bossDef('The Hollow Dragon', 'wraith', '#c8c0ff', 88, mt, ['void_slam', 'unwrite', 'page_storm', 'world_slam', 'sentence']));
add('wc_aurelian', bossDef('Aurelian, the Worldwyrm', 'worm', '#ffe36b', 92, wt, ['colossus_stomp', 'world_slam', 'magma_burst', 'void_slam', 'sentence', 'rift_collapse']));

// An encounter. `bosses`: [{ key, hpMult, x, y }] positions are fractions of the arena.
// phase effects (triggered once when the boss's health ratio falls to `at`):
//   say [title, text] · adds { key, n, every, cap } (recurring) · meteors { every, radius, pct } (recurring, % of max health) ·
//   enrage { speed, atk } · shield (the boss takes 10% damage while any add is alive) · heal (fraction of max health restored)
export const RAIDS = {
  void_citadel: {
    id: 'void_citadel', name: 'Citadel of the Void Emperor', short: 'the Citadel', minLevel: 40, size: 5, entry: { map: FAR_GATES.void_citadel, npc: 'Citadel Gatekeeper', say: ['Beyond this door the Void Emperor holds court. None have walked out unchanged.'] }, theme: 'cave', color: '#a984ff', tier: ['voidglass', 'drakesteel'], lootLevel: 44, title: 'Voidbreaker', blurb: 'Four wings, four bosses. Kill the Gatewarden, the Oracle Twins (together!), the Hollow Choir (kill its acolytes first) and finally the Emperor himself.',
    wings: [
      { id: 'vc_1', lvl: 42, name: 'The Gate of Teeth', theme: 'volcano', seed: 8101, bosses: [{ key: 'vc_krosh', hpMult: 1 }], intro: ['WING 1 — THE GATE OF TEETH', 'Gatewarden Krosh bars the way.'],
        phases: [{ at: 0.5, say: ['KROSH ENRAGES', 'The Gatewarden roars and calls his thralls.'], enrage: { speed: 1.25, atk: 1.15 }, adds: { key: 'vc_thrall', n: 2, every: 14000, cap: 6 } }] },
      { id: 'vc_2', lvl: 43, name: 'The Oracles\' Sanctum', theme: 'snow', seed: 8102, bosses: [{ key: 'vc_oracle_a', hpMult: 1, fx: 0.3 }, { key: 'vc_oracle_f', hpMult: 1, fx: 0.7 }], link: 'twin', intro: ['WING 2 — THE ORACLES\' SANCTUM', 'Ashmere and Frostmere fight as one. Kill them close together — the survivor avenges its sister.'], phases: [{ at: 0.4, say: ['THE ORACLES CHANT', 'Void bolts rain from the ceiling.'], meteors: { every: 6000, radius: 2.2, pct: 0.18 } }] },
      { id: 'vc_3', lvl: 44, name: 'The Hollow Nave', theme: 'cave', seed: 8103, bosses: [{ key: 'vc_choir', hpMult: 1.15 }], intro: ['WING 3 — THE HOLLOW NAVE', 'The Hollow Choir sings behind a wall of acolytes. Silence the singers.'],
        phases: [{ at: 1.01, say: ['THE CHOIR SINGS', 'The Choir is untouchable while its acolytes live.'], shield: true, adds: { key: 'vc_acolyte', n: 3, every: 20000, cap: 6 } }, { at: 0.35, say: ['THE CHOIR SCREAMS', 'The nave itself rejects you.'], meteors: { every: 5000, radius: 2.4, pct: 0.22 }, enrage: { speed: 1.15, atk: 1.15 } }] },
      { id: 'vc_4', lvl: 46, name: 'Throne of Nothing', theme: 'main', seed: 8104, bosses: [{ key: 'vc_emperor', hpMult: 1.7 }], intro: ['WING 4 — THRONE OF NOTHING', 'The Void Emperor rises.'],
        phases: [{ at: 0.66, say: ['PHASE 2 — THE COURT', 'The Emperor summons his court.'], adds: { key: 'vc_thrall', n: 4, every: 15000, cap: 8 } }, { at: 0.4, say: ['PHASE 3 — FALLING STARS', 'Stars fall where you stand. Keep moving.'], meteors: { every: 5000, radius: 2.4, pct: 0.28 }, enrage: { speed: 1.15, atk: 1.1 } }, { at: 0.18, say: ['PHASE 4 — THE UNMAKING', 'Everything, all at once. End it.'], meteors: { every: 3000, radius: 2.4, pct: 0.3 }, enrage: { speed: 1.2, atk: 1.2 } }] },
    ],
  },
  wyrmcrown: {
    id: 'wyrmcrown', name: 'Wyrmcrown Sanctum', short: 'the Sanctum', minLevel: 80, size: 5, entry: { map: FAR_GATES.wyrmcrown, npc: 'Wyrmcrown Warden', say: ['The dragons of the old world sleep under that crown. Do not wake the one at the bottom.'] }, theme: 'volcano', color: '#ffe36b', tier: ['solarite', 'mythril', 'worldsteel'], lootLevel: 88, title: 'Wyrmslayer', blurb: 'Five wings. A brood, twin wyrms, a storm, a hollow dragon and the Worldwyrm itself.',
    wings: [
      { id: 'wc_1', lvl: 82, name: 'The Brood Hall', theme: 'swamp', seed: 8201, bosses: [{ key: 'wc_brood', hpMult: 1 }], intro: ['WING 1 — THE BROOD HALL', 'Brood Mother Skathra guards her clutch.'], phases: [{ at: 0.8, say: ['THE CLUTCH HATCHES', 'Hatchlings pour from the eggs.'], adds: { key: 'wc_hatchling', n: 3, every: 12000, cap: 9 } }, { at: 0.35, say: ['SKATHRA ENRAGES', 'She is done being gentle.'], enrage: { speed: 1.25, atk: 1.2 } }] },
      { id: 'wc_2', lvl: 84, name: 'The Twin Furnace', theme: 'volcano', seed: 8202, bosses: [{ key: 'wc_cinderfang', hpMult: 1, fx: 0.3 }, { key: 'wc_frostmaw', hpMult: 1, fx: 0.7 }], link: 'twin', intro: ['WING 2 — THE TWIN FURNACE', 'Fire and frost, bound together. Whichever lives longer grows terrible.'], phases: [{ at: 0.5, say: ['BREATH OF EXTREMES', 'Fire and ice rain down together.'], meteors: { every: 5000, radius: 2.4, pct: 0.2 } }] },
      { id: 'wc_3', lvl: 86, name: 'The Eye of the Storm', theme: 'main', seed: 8203, bosses: [{ key: 'wc_storm', hpMult: 1.1 }], intro: ['WING 3 — THE EYE OF THE STORM', 'Stormcaller Valtharion is already summoning lightning.'], phases: [{ at: 1.01, say: ['THE STORM BREAKS', 'Lightning falls from the first heartbeat.'], meteors: { every: 5500, radius: 2.2, pct: 0.22 }, adds: { key: 'wc_drakeling', n: 2, every: 16000, cap: 6 } }, { at: 0.4, say: ['THE EYE OPENS', 'The storm tightens.'], meteors: { every: 3500, radius: 2.4, pct: 0.26 }, enrage: { speed: 1.2, atk: 1.15 } }] },
      { id: 'wc_4', lvl: 88, name: 'The Hollow Vault', theme: 'cave', seed: 8204, bosses: [{ key: 'wc_hollow', hpMult: 1.3 }], intro: ['WING 4 — THE HOLLOW VAULT', 'The Hollow Dragon hides behind its cultists. Cut them down.'], phases: [{ at: 1.01, say: ['THE HOLLOW GUARD', 'The Dragon cannot be harmed while its cultists live.'], shield: true, adds: { key: 'wc_cultist', n: 3, every: 18000, cap: 6 } }, { at: 0.3, say: ['THE HOLLOW BREATH', 'It stops hiding.'], meteors: { every: 4000, radius: 2.6, pct: 0.28 }, enrage: { speed: 1.2, atk: 1.2 } }] },
      { id: 'wc_5', lvl: 92, name: 'The Crown of the World', theme: 'snow', seed: 8205, bosses: [{ key: 'wc_aurelian', hpMult: 2 }], intro: ['WING 5 — THE CROWN OF THE WORLD', 'Aurelian opens one golden eye.'], phases: [{ at: 0.75, say: ['PHASE 2 — THE BROOD RETURNS', 'The Worldwyrm calls every drake it has ever hatched.'], adds: { key: 'wc_drakeling', n: 3, every: 14000, cap: 9 } }, { at: 0.5, say: ['PHASE 3 — SKYFALL', 'The sky comes down.'], meteors: { every: 4500, radius: 2.6, pct: 0.28 }, enrage: { speed: 1.15, atk: 1.1 } }, { at: 0.25, say: ['PHASE 4 — THE LAST BREATH', 'There is nowhere to stand.'], meteors: { every: 2800, radius: 2.6, pct: 0.3 }, enrage: { speed: 1.25, atk: 1.25 }, heal: 0.05 }] },
    ],
  },
};
export const RAID_ARENA_IDS = Object.values(RAIDS).flatMap((r) => r.wings.map((w) => w.id));
