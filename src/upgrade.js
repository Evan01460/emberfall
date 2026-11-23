// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// GEAR UPGRADES — a Blacksmith can temper a piece of gear again and again, from +0 to +99. Each step costs materials of the gear's own metal and
// can fail; the higher the level, the worse the odds. The forging minigame (heat, folding, rune engraving, quench, polish) lifts the odds,
// a better smith lifts them a little more. Pure rules shared by server and client; the server rolls the dice.
//
//   chance   100% for the first steps, then falling steadily towards 2% by +99      (baseChance)
//   stats    +1.5% per level to +20, +1.2% to +50, +1% to +99: +99 is about 2.15x    (upMult)
//   failure  the materials are lost; from +10 the piece may drop 1 level (2 from +40); it is never destroyed
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { TIERS, tierOf } from './gearsets.js';

export const MAX_UP = 99;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const upLevel = (g) => clamp(Math.floor(+(g?.up ?? 0)) || 0, 0, MAX_UP);
// the factor applied to a piece's attack, defence and health
export const upMult = (up = 0) => { up = clamp(Math.floor(+up) || 0, 0, MAX_UP); return 1 + 0.015 * Math.min(up, 20) + 0.012 * clamp(up - 20, 0, 30) + 0.01 * Math.max(0, up - 50); };
// the chance that the step from `L` to `L+1` works with a mediocre performance (the minigame and the smith move it up or down)
export const baseChance = (L) => (L < 3 ? 1 : Math.max(0.02, 0.96 * Math.exp(-0.045 * (L - 2))));
export const tierOfGear = (id) => TIERS.find((t) => t.id === tierOf(id)) ?? TIERS[0];
// materials for the step L -> L+1: the gear's own ingot and coal, then echo shards and starmetal for the deep levels
export function upgradeMats(gearId, L) {
  const T = tierOfGear(gearId), m = { [T.ing]: 1 + Math.floor(L / 4), coal: 1 + Math.floor(L / 6) };
  if (L >= 20) m.echo_shard = 1 + Math.floor((L - 20) / 10); if (L >= 50) m.starmetal = 1 + Math.floor((L - 50) / 12);
  return m;
}
// what a smith may reasonably ask for the labour (the requester can offer more or less)
export const suggestedFee = (gearId, L) => { const T = tierOfGear(gearId), idx = Math.max(0, TIERS.indexOf(T)); return Math.round(30 * (L + 1) * (1 + idx * 0.4)); };
// how skilled the smith must be: the metal's own craft level plus a little more for every level
export const smithNeedLevel = (gearId, L) => Math.min(100, Math.max(1, Math.round(tierOfGear(gearId).lvl * 0.8 + (L + 1) * 0.35)));
// failing may cost levels
export const dropChance = (L) => (L >= 10 ? Math.min(0.6, 0.1 + L * 0.006) : 0);
export const dropAmount = (L) => (L >= 40 ? 2 : 1);
// the odds of this very attempt. `score` is the minigame result 0..1; `bonus` the smith's own skill (see smithBonus)
export function finalChance(L, score, bonus = 0) {
  const b = baseChance(L); if (b >= 1) return 1;
  return clamp(b * (0.7 + 0.65 * clamp(score, 0, 1)) * (1 + bonus), 0.01, 0.98);
}
export const QUICK_SCORE = 0.3;   // the result of "quick forge" (no minigame)
export const upLabel = (up) => (up > 0 ? `+${up}` : '');
export const upColor = (up) => (up >= 99 ? '#ff5ad2' : up >= 80 ? '#ff6a4a' : up >= 60 ? '#ffa23a' : up >= 40 ? '#ffd84a' : up >= 20 ? '#b07aff' : up >= 10 ? '#5aa8ff' : up >= 1 ? '#9ad0ff' : '#c8c0d8');

// ── the forging minigame (spec made by the server, played on the client, re-scored by the server) ─────────────────────────────────────────
// Stage 1 HEAT keep the billet in the glowing band; 2 FOLD three rounds of hammer strikes on a moving marker; 3 RUNE trace the rune with the
// cursor; 4 QUENCH one dunk at the right moment; 5 POLISH strokes of the whetstone in an even rhythm.
export function upgradeSpec(L, smithLevel, rng) {
  const hard = clamp(L / MAX_UP, 0, 1), lv = smithLevel ?? 1;
  const nPts = 5 + Math.floor(hard * 5), pts = [];
  // a rune: a zig-zag of straight strokes inside the unit square, so it is a real shape, never a straight line
  for (let i = 0; i < nPts; i++) { const x = 0.12 + (i / (nPts - 1)) * 0.76, y = i % 2 ? rng.range(0.14, 0.34) : rng.range(0.62, 0.86); pts.push([+(x).toFixed(3), +y.toFixed(3)]); }
  if (rng.chance(0.5)) pts.forEach((p) => { p[1] = +(1 - p[1]).toFixed(3); });
  return {
    heat: { dur: 6000, center: 0.5, half: clamp(0.1 - hard * 0.05 + lv * 0.0006, 0.04, 0.13), up: 0.55, down: 0.42, tau: 0.09, drift: 0.05 + hard * 0.12, dp: 2.2 + rng.range(0, 1.2), dph: rng.range(0, 6.28) },
    folds: Array.from({ length: 3 }, (_, r) => ({ strikes: 4, half: clamp(0.11 - hard * 0.05 + lv * 0.0007, 0.04, 0.14), speed: 0.65 + hard * 0.8 + r * 0.14, centers: Array.from({ length: 4 }, () => +rng.range(0.2, 0.8).toFixed(3)) })),
    rune: { pts, tol: +clamp(0.07 - hard * 0.03 + lv * 0.0002, 0.035, 0.085).toFixed(3), limit: 14000 },
    quench: { center: +rng.range(0.3, 0.7).toFixed(3), half: clamp(0.15 - hard * 0.08 + lv * 0.0008, 0.05, 0.22), speed: 0.8 + hard * 0.6 },
    polish: { need: 8 + Math.floor(hard * 6), lo: 330, hi: 720 },
  };
}

// ── critical forging: a (nearly) perfect performance can lift the piece by more than one level ──────────────────────────────────────────────
// A smith's reach: +2 from smith level 40, +3 with a Mastery (level 20 path choice), a mythic class or smith level 85. The chance needs a near-perfect
// score, grows with how perfect it was and with the smith's level, and a double is far likelier than a triple.
export const PERFECT = 0.86;
export const maxJump = (smithLevel, mastered) => 1 + (smithLevel >= 40 ? 1 : 0) + (mastered || smithLevel >= 85 ? 1 : 0);
export function critChances(score, smithLevel, mastered, L) {
  const j = maxJump(smithLevel, mastered); if (score < PERFECT || j < 2) return { two: 0, three: 0, max: j };
  const k = clamp((score - PERFECT) / (1 - PERFECT), 0, 1), two = clamp(0.14 + 0.24 * k + smithLevel * 0.001, 0, 0.5) * (L >= 80 ? 0.8 : 1);
  return { two, three: j >= 3 ? two * (0.28 + 0.12 * k) : 0, max: j };
}
export function critSteps(rng, score, smithLevel, mastered, L) {
  const c = critChances(score, smithLevel, mastered, L); let n = 1; if (rng.chance(c.two)) { n = 2; if (c.three && rng.chance(c.three / Math.max(c.two, 1e-9))) n = 3; }
  return Math.min(n, MAX_UP - L);
}
