// ─────────────────────────────────────────────────────────────────────────────
// GAME DATA — everything balance-related lives here so it can be tuned/moddable.
// v2: Trade classes (Blacksmith/Alchemist/Merchant) are full classes, not side jobs.
//     A second realm, "The Shadowfell", has its own monsters, materials and market.
// ─────────────────────────────────────────────────────────────────────────────

import { EXTRA_SKILLS, PATHS, MYTHICS, COMBOS } from './skilldata.js';
import { buildGearSets } from './gearsets.js';
import { NEW_ENEMIES, NEW_ZONES } from './content2.js';
export { FIT_BONUS, ARCH, TIERS, fits, fitsOf, archOf, tierOf, classGear, ALL_CLASSES } from './gearsets.js';
export { PATHS, MYTHICS, COMBOS };

export const TYPE_ICON = { slash: '', pierce: '', blunt: '', arcane: '', guard: '', evade: '', counter: '⟲' };
export const MAX_LEVEL = 30;

// ── Real-time skills ────────────────────────────────────────────────────────
// kinds: melee (arc) · proj (projectiles) · aoe (circle at cursor/self) · dash · guard · heal · taunt · mark
// cd/cast/dur in ms · range/radius/dist in tiles · arc/spread in degrees · power ≈ damage before ATK/DEF scaling
const sk = (id, name, kind, o) => ({ id, name, kind, cd: 0, cast: 0, type: 'slash', ...o });
export const SKILLS = {
  // Warrior
  cleave: sk('cleave', 'Cleave', 'melee', { icon: '', power: 20, cd: 3500, cast: 140, range: 2.1, arc: 210, desc: 'A wide sweeping cut that hits everything around you.' }),
  bulwark: sk('bulwark', 'Bulwark', 'guard', { icon: '', cd: 8000, dur: 2200, red: 0.6, reflect: 0.15, type: 'blunt', desc: 'Brace for 2.2s: take 60% less damage and reflect 15% back.' }),
  crushing_blow: sk('crushing_blow', 'Crushing Blow', 'aoe', { icon: '', power: 36, cd: 8000, cast: 650, radius: 1.7, range: 2.8, at: 'cursor', stun: 900, type: 'blunt', desc: 'A slow, telegraphed overhead smash. Stuns.' }),
  warcry_flurry: sk('warcry_flurry', 'Warcry Flurry', 'melee', { icon: '', power: 9, hits: 6, interval: 170, cd: 9000, range: 1.9, arc: 150, desc: 'Six rapid cuts in front of you.' }),
  // Mage
  arc_volley: sk('arc_volley', 'Arc Volley', 'proj', { icon: '', power: 13, count: 3, spread: 24, speed: 11, range: 9, radius: 0.28, cd: 3200, cast: 120, type: 'arcane', desc: 'Three bolts in a fan.' }),
  blink: sk('blink', 'Blink', 'dash', { icon: '', dist: 4.2, cd: 5000, iframes: 350, desc: 'Teleport toward your cursor with a moment of invulnerability.' }),
  ward: sk('ward', 'Aether Ward', 'heal', { icon: '', shield: 40, cd: 10000, dur: 4000, desc: 'A shimmering barrier absorbs damage.' }),
  cascade: sk('cascade', 'Cascade', 'aoe', { icon: '', power: 40, cd: 9000, cast: 750, radius: 2.3, range: 8, at: 'cursor', type: 'arcane', desc: 'Call a storm of aether down at your cursor.' }),
  // Archer
  aimed_shot: sk('aimed_shot', 'Aimed Shot', 'proj', { icon: '', power: 34, count: 1, speed: 22, range: 14, radius: 0.3, pierce: 3, cd: 5000, cast: 450, type: 'pierce', desc: 'A charged shot that pierces up to 3 targets.' }),
  roll_away: sk('roll_away', 'Roll Away', 'dash', { icon: '', dist: 4.6, back: true, cd: 4500, iframes: 380, desc: 'Roll backwards away from your cursor.' }),
  pin_down: sk('pin_down', 'Pin Down', 'aoe', { icon: '', power: 14, cd: 9000, cast: 350, radius: 1.5, range: 8, at: 'cursor', stun: 1500, type: 'pierce', desc: 'Snare the area: enemies are held for 1.5s.' }),
  volley: sk('volley', 'Volley', 'proj', { icon: '', power: 14, count: 7, spread: 56, speed: 17, range: 10, radius: 0.25, cd: 8000, cast: 250, type: 'pierce', desc: 'Seven arrows in a wide cone.' }),
  // Blacksmith
  hot_tongs: sk('hot_tongs', 'Hot Tongs', 'melee', { icon: '', power: 24, cd: 3500, cast: 160, range: 2.5, arc: 45, type: 'pierce', desc: 'A glowing thrust with real reach.' }),
  anvil_guard: sk('anvil_guard', 'Anvil Guard', 'guard', { icon: '', cd: 7500, dur: 2800, red: 0.8, reflect: 0.2, type: 'blunt', desc: 'Raise the anvil-iron tongs: 80% damage reduction for 2.8s.' }),
  slag_slam: sk('slag_slam', 'Slag Slam', 'aoe', { icon: '', power: 32, cd: 8000, cast: 600, radius: 2.0, at: 'self', stun: 800, type: 'blunt', desc: 'Slam the ground around you.' }),
  molten_nova: sk('molten_nova', 'Molten Nova', 'aoe', { icon: '', power: 48, cd: 12000, cast: 800, radius: 2.7, at: 'self', type: 'arcane', desc: 'A ring of molten slag erupts around you.' }),
  resonant_strike: sk('resonant_strike', 'Resonant Strike', 'melee', { icon: '', power: 38, cd: 5000, cast: 200, range: 2.3, arc: 120, type: 'arcane', desc: 'Soulsmith: strike with the note of the Cold Forge.' }),
  // Alchemist
  acid_splash: sk('acid_splash', 'Acid Splash', 'aoe', { icon: '', power: 8, cd: 7000, cast: 300, radius: 1.9, range: 7, at: 'cursor', dot: { ticks: 6, every: 500 }, type: 'arcane', desc: 'A corrosive pool that burns for 3 seconds.' }),
  smoke_step: sk('smoke_step', 'Smoke Step', 'dash', { icon: '', dist: 3.4, cd: 6000, iframes: 500, stealth: 2000, desc: 'Vanish in smoke: dash and become untargetable for 2s.' }),
  siphon_vial: sk('siphon_vial', 'Siphon Vial', 'proj', { icon: '', power: 22, count: 1, speed: 9, range: 8, radius: 0.35, cd: 4500, cast: 200, type: 'arcane', fx: { lifesteal: 0.6 }, desc: 'A draining vial: heals you for 60% of the damage.' }),
  catalyze: sk('catalyze', 'Catalyze', 'heal', { icon: '', heal: 0.35, cd: 14000, desc: 'Restore 35% of your max HP.' }),
  transmute: sk('transmute', 'Transmute', 'aoe', { icon: '', power: 30, cd: 8000, cast: 400, radius: 2.2, range: 6, at: 'cursor', stun: 1600, type: 'arcane', desc: 'Transmuter: turn enemies to lead for 1.6s.' }),
  // Merchant
  fistful: sk('fistful', 'Fistful of Coins', 'proj', { icon: '', power: 9, count: 5, spread: 40, speed: 13, range: 7.5, radius: 0.25, cd: 3500, cast: 100, type: 'pierce', desc: 'Throw a handful of gilt in a fan.' }),
  hard_bargain: sk('hard_bargain', 'Hard Bargain', 'guard', { icon: '', cd: 7500, dur: 2500, red: 0.7, reflect: 0.35, type: 'blunt', desc: 'Refuse to budge: 70% less damage, reflects 35%.' }),
  silver_tongue: sk('silver_tongue', 'Silver Tongue', 'taunt', { icon: '', radius: 4.5, cd: 10000, dur: 4000, red: 0.3, desc: 'Draw every nearby enemy onto you and take 30% less damage for 4s.' }),
  audit: sk('audit', 'Audit', 'mark', { icon: '', radius: 5, cd: 12000, dur: 6000, vuln: 0.3, desc: 'Mark nearby enemies: they take 30% more damage for 6s.' }),
  insider_strike: sk('insider_strike', 'Insider Strike', 'proj', { icon: '', power: 40, count: 1, speed: 20, range: 12, radius: 0.3, cd: 5000, cast: 250, type: 'pierce', fx: { crit: 1 }, desc: 'Broker: you knew exactly where they would be. Always crits.' }),
  // Desperado (hidden)
  wager: sk('wager', 'Wager', 'proj', { icon: '', power: 13, count: 3, spread: 12, speed: 18, range: 10, radius: 0.25, cd: 2600, cast: 80, type: 'pierce', fx: { critChance: 0.5 }, desc: 'Three shots, each a flat 50% to crit — it always has a flat 50% chance, whatever your state.' }),
  loaded_dodge: sk('loaded_dodge', 'Loaded Dodge', 'dash', { icon: '', dist: 4.0, cd: 4000, iframes: 420, desc: 'Cheat death.' }),
  dead_mans_hand: sk('dead_mans_hand', "Dead Man's Hand", 'proj', { icon: '', power: 11, count: 8, spread: 50, speed: 18, range: 8, radius: 0.25, cd: 7000, cast: 200, type: 'slash', fx: { critChance: 0.5 }, desc: 'Eight shots in a cone.' }),
  double_down: sk('double_down', 'Double Down', 'proj', { icon: '', power: 75, count: 1, speed: 24, range: 14, radius: 0.35, pierce: 2, cd: 11000, cast: 600, type: 'blunt', fx: { critChance: 0.5 }, desc: 'One enormous shot.' }),
  // Archivist (hidden) — spends Light instead of waiting on long cooldowns
  ink_slash: sk('ink_slash', 'Ink Slash', 'melee', { icon: '', power: 17, cd: 500, cast: 100, range: 2.2, arc: 150, desc: 'A fast ink-blade arc.' }),
  footnote: sk('footnote', 'Footnote', 'dash', { icon: '', dist: 3.6, cd: 1800, iframes: 380, desc: 'Slip between the lines. Free.' }),
  rewrite: sk('rewrite', 'Rewrite', 'proj', { icon: '', power: 13, count: 5, spread: 44, speed: 14, range: 8, radius: 0.26, cd: 900, cast: 120, type: 'pierce', desc: 'Five quills in a fan.' }),
  final_chapter: sk('final_chapter', 'Final Chapter', 'aoe', { icon: '', power: 62, cd: 1500, cast: 750, radius: 2.6, range: 8, at: 'cursor', type: 'arcane', desc: 'Close the book on everything at your cursor.' }),
};

Object.assign(SKILLS, EXTRA_SKILLS);

// Mana cost per skill (by kind unless overridden). Mana regenerates; the Shadowfell drains it.
const MANA = { melee: 8, proj: 10, aoe: 14, dash: 6, guard: 8, heal: 14, taunt: 10, mark: 10, buff: 12, trap: 10, field: 16 };
for (const k of Object.values(SKILLS)) k.mp = k.mp ?? MANA[k.kind] ?? 8;
SKILLS.footnote.mp = 4; SKILLS.final_chapter.mp = 26; SKILLS.double_down.mp = 22; SKILLS.cascade.mp = 24;

// Every class starts with a free basic attack on left-click.
export const BASICS = {
  warrior: { kind: 'melee', icon: '', name: 'Slash', power: 9, cd: 340, range: 1.7, arc: 110, type: 'slash', combo: 'slash' },
  mage: { kind: 'proj', icon: '', name: 'Aether Bolt', power: 10, cd: 500, speed: 11, range: 9, radius: 0.26, count: 1, type: 'arcane', fx: { mpOnHit: 1 } },
  archer: { kind: 'proj', icon: '', name: 'Arrow', power: 9, cd: 430, speed: 17, range: 11, radius: 0.22, count: 1, type: 'pierce' },
  blacksmith: { kind: 'melee', icon: '', name: 'Hammer Swing', power: 12, cd: 700, range: 1.5, arc: 120, type: 'blunt', combo: 'heavy' },
  alchemist: { kind: 'proj', icon: '', name: 'Flask Toss', power: 9, cd: 640, speed: 8, range: 7, radius: 0.3, count: 1, type: 'arcane', aoe: 0.9 },
  merchant: { kind: 'proj', icon: '', name: 'Coin Toss', power: 8, cd: 440, speed: 12, range: 8, radius: 0.22, count: 1, type: 'pierce' },
  desperado: { kind: 'proj', icon: '', name: 'Card Flick', power: 7, cd: 400, speed: 20, range: 11, radius: 0.22, count: 2, spread: 8, type: 'pierce', fx: { critChance: 0.5 } },
  archivist: { kind: 'proj', icon: '', name: 'Quill Storm', power: 7, cd: 380, speed: 15, range: 9, radius: 0.24, count: 3, spread: 22, type: 'arcane' },
  soulsmith: { kind: 'melee', icon: '', name: 'Coldforge Hammer', power: 19, cd: 640, range: 1.9, arc: 130, type: 'arcane', combo: 'heavy' },
  broker: { kind: 'proj', icon: '', name: 'Silver Salvo', power: 7, cd: 400, speed: 17, range: 10, radius: 0.22, count: 2, spread: 10, type: 'pierce', fx: { crit: 0 } },
  transmuter: { kind: 'proj', icon: '', name: 'Quicksilver Flask', power: 13, cd: 620, speed: 9, range: 8, radius: 0.3, count: 1, type: 'arcane', aoe: 1.3 },
};

// Signature artwork for the hidden classes' basic attacks (drawn by client/skillfx.js): no hidden class borrows another's look.
Object.assign(BASICS.desperado, { vi: 'card', vfxEnd: 'card_hit', quiet: true }); Object.assign(BASICS.archivist, { vi: 'quill', vfxEnd: 'ink_pop', quiet: true });
Object.assign(BASICS.broker, { vi: 'cheque', vfxEnd: 'cash_pop', quiet: true }); Object.assign(BASICS.transmuter, { vi: 'prism', vfxEnd: 'prism_pop', quiet: true });

// ── Enemy moves (telegraphed; the red shape on the ground is what will hit) ──
// melee: arc in front · aoe: circle (at self or at target) · proj: projectile fan · dash: charge
export const MOVES = {
  claw: { kind: 'melee', range: 1.25, arc: 100, windup: 420, cd: 1500, power: 8, type: 'slash' },
  bite: { kind: 'melee', range: 1.15, arc: 70, windup: 360, cd: 1300, power: 7, type: 'slash' },
  smash: { kind: 'melee', range: 1.7, arc: 120, windup: 680, cd: 2300, power: 14, type: 'blunt' },
  lunge: { kind: 'dash', range: 4.2, dist: 3.4, windup: 600, cd: 4000, power: 8, type: 'slash', speed: 11 },
  gore: { kind: 'dash', range: 4.8, dist: 4.0, windup: 680, cd: 4600, power: 9, type: 'pierce', speed: 12 },
  slam: { kind: 'aoe', at: 'self', radius: 1.8, windup: 820, cd: 3400, power: 15, type: 'blunt' },
  stomp: { kind: 'aoe', at: 'self', radius: 1.5, windup: 650, cd: 3000, power: 11, type: 'blunt' },
  spit: { kind: 'proj', range: 7.5, windup: 520, cd: 2300, power: 8, speed: 6.5, radius: 0.3, count: 1, type: 'arcane' },
  flick: { kind: 'proj', range: 7, windup: 560, cd: 2600, power: 5, speed: 7, radius: 0.25, count: 3, spread: 36, type: 'arcane' },
  nova: { kind: 'aoe', at: 'target', range: 7.5, radius: 1.9, windup: 950, cd: 3600, power: 13, type: 'arcane' },
  page_storm: { kind: 'proj', range: 9, windup: 900, cd: 5500, power: 7, speed: 5.5, radius: 0.28, count: 10, spread: 360, type: 'slash' },
  sentence: { kind: 'aoe', at: 'target', range: 8, radius: 2.5, windup: 1150, cd: 4200, power: 24, type: 'blunt' },
  unwrite: { kind: 'proj', range: 11, windup: 800, cd: 4200, power: 12, speed: 8, radius: 0.32, count: 7, spread: 70, type: 'arcane' },
  void_slam: { kind: 'aoe', at: 'self', radius: 3.2, windup: 1100, cd: 5200, power: 26, type: 'arcane' },
  root_lash: { kind: 'melee', range: 2.7, arc: 130, windup: 560, cd: 2400, power: 15, type: 'pierce' },
  thorn_volley: { kind: 'proj', range: 9, windup: 800, cd: 4200, power: 10, speed: 7, radius: 0.28, count: 9, spread: 110, type: 'pierce' },
  world_slam: { kind: 'aoe', at: 'self', radius: 4.2, windup: 1300, cd: 5600, power: 28, type: 'blunt' },
  rift_beam: { kind: 'proj', range: 12, windup: 700, cd: 3600, power: 12, speed: 9, radius: 0.3, count: 5, spread: 50, type: 'arcane' },
  rift_collapse: { kind: 'aoe', at: 'target', range: 10, radius: 2.8, windup: 1000, cd: 4000, power: 22, type: 'arcane' },
  magma_burst: { kind: 'aoe', at: 'self', radius: 3.6, windup: 1200, cd: 5000, power: 24, type: 'arcane' },
  ember_fan: { kind: 'proj', range: 10, windup: 700, cd: 3500, power: 10, speed: 8, radius: 0.3, count: 7, spread: 80, type: 'arcane' },
  colossus_stomp: { kind: 'aoe', at: 'self', radius: 5.0, windup: 1500, cd: 6500, power: 30, type: 'blunt' },
};

// ── Classes (Fixers) ────────────────────────────────────────────────────────
// group: combat | trade.  hp/atk/def scale with level (see units.js rtStats).
export const CLASSES = {
  warrior: { id: 'warrior', group: 'combat', name: 'Warrior', icon: '', color: '#c8402f', tie: '#c8402f', hp: 94, hpPer: 14, atk: 5, def: 3, move: 0.98,
    desc: 'A frontline fighter in plate and steel. Wide sweeps, a shield-bracing guard, and a heavy stunning smash.',
    role: 'Fights for hides, ore and glory — and keeps smiths and brewers in business.', skills: [['cleave', 1], ['bulwark', 2], ['crushing_blow', 4], ['warcry_flurry', 6]] },
  mage: { id: 'mage', group: 'combat', name: 'Mage', icon: '', color: '#6f8ad8', tie: '#6f8ad8', hp: 84, hpPer: 11, atk: 7, def: 2, move: 1.02,
    desc: 'A scholar of the arcane. Fragile, ranged, and one storm away from solving every problem.',
    role: 'Hits hard from range; wants Focus Rods and Calm Tonics.', skills: [['arc_volley', 1], ['blink', 2], ['ward', 4], ['cascade', 6]] },
  archer: { id: 'archer', group: 'combat', name: 'Archer', icon: '', color: '#6fc08b', tie: '#6fc08b', hp: 86, hpPer: 12, atk: 6, def: 2, move: 1.12,
    desc: 'A woodland marksman. Fast on their feet, lethal at distance, and always one roll from safety.',
    role: 'Scouts the wilds and brings back the rare drops.', skills: [['aimed_shot', 1], ['roll_away', 2], ['pin_down', 4], ['volley', 6]] },
  blacksmith: { id: 'blacksmith', group: 'trade', name: 'Blacksmith', icon: '', color: '#d98a3a', tie: '#d98a3a', hp: 92, hpPer: 12, atk: 4, def: 4, move: 0.94, gather: { ore: 1.5, coal: 1.5 },
    desc: 'A master of forge and anvil: smelts ingots, forges weapons and armor with a timing minigame. Quality is your signature.',
    role: 'Crafts the gear everyone else needs. Fights adequately with the hammer — party up for the deep wilds.', skills: [['hot_tongs', 1], ['anvil_guard', 2], ['slag_slam', 4], ['molten_nova', 6]] },
  alchemist: { id: 'alchemist', group: 'trade', name: 'Alchemist', icon: '', color: '#a98ad8', tie: '#a98ad8', hp: 78, hpPer: 10, atk: 6, def: 2, move: 1.02, gather: { herb: 1.5, ghostbloom: 1.5 },
    desc: 'A cauldron-keeper with a press-your-luck brewing minigame. Lantern Salve is the only thing that keeps explorers going in the Shadowfell.',
    role: 'Sells the potions that make dungeon-diving possible.', skills: [['acid_splash', 1], ['smoke_step', 2], ['siphon_vial', 4], ['catalyze', 6]] },
  merchant: { id: 'merchant', group: 'trade', name: 'Merchant', icon: '', color: '#e3b552', tie: '#e3b552', hp: 82, hpPer: 11, atk: 5, def: 2, move: 1.02,
    desc: 'A trader of goods and gossip. Haggles with walk-in customers in a dice duel, pays the lowest listing fees, and spots price gaps between the two realms.',
    role: 'Moves goods — including between the two worlds, where prices differ wildly.', skills: [['fistful', 1], ['hard_bargain', 2], ['silver_tongue', 4], ['audit', 6]] },
  // ── Hidden classes ──
  desperado: { id: 'desperado', group: 'combat', hidden: true, name: 'Desperado', icon: '', color: '#b04080', tie: '#b04080', hp: 86, hpPer: 13, atk: 6, def: 2, move: 1.04, passives: ['cornered'],
    desc: 'HIDDEN. Before every attack (except All In) you roll a die per shot: damage = base x the roll, so it averages out but a 6 hits huge and a 1 barely scratches. Cornered: damage rises as your health falls. Wager skills have a flat 50% crit chance.', skills: [['loaded_dice', 1], ['bluff_step', 2], ['dead_mans_draw', 4], ['all_in', 6]] },
  archivist: { id: 'archivist', group: 'combat', hidden: true, name: 'Archivist', icon: '', color: '#8ad8d0', tie: '#8ad8d0', hp: 76, hpPer: 11, atk: 5, def: 2, move: 1.02, taintImmune: true, mpRegen: 1.8,
    desc: 'HIDDEN. Faster mana regeneration, and the Shadowfell cannot drain you.', skills: [['inkblade_flurry', 1], ['margin_note', 2], ['living_lexicon', 4], ['epilogue', 6]] },
  soulsmith: { id: 'soulsmith', group: 'trade', hidden: true, from: ['blacksmith'], name: 'Soulsmith', icon: '', color: '#ff9f6b', tie: '#ff9f6b', hp: 98, hpPer: 13, atk: 5, def: 4, move: 0.96, gather: { ore: 1.5, coal: 1.5 },
    desc: 'HIDDEN. Everything you forge gains a Resonance affix and never comes out Crude.', skills: [['resonant_hammer', 1], ['forged_soul', 2], ['ember_chains', 4], ['coldstar_nova', 6]] },
  broker: { id: 'broker', group: 'trade', hidden: true, from: ['merchant'], name: 'Broker', icon: '', color: '#e8e8ff', tie: '#e8e8ff', hp: 76, hpPer: 10, atk: 5, def: 2, move: 1,
    desc: 'HIDDEN. Sees tomorrow\'s demand in both markets, rolls haggle dice twice and keeps the best, 2% fees.', skills: [['foresight_volley', 1], ['margin_call', 2], ['leveraged_buyout', 4], ['liquidation', 6]] },
  transmuter: { id: 'transmuter', group: 'trade', hidden: true, from: ['alchemist'], name: 'Transmuter', icon: '', color: '#d0a0ff', tie: '#d0a0ff', hp: 72, hpPer: 10, atk: 7, def: 1, move: 1, gather: { herb: 1.5, ghostbloom: 1.5 },
    desc: 'HIDDEN. Cauldrons obey you: lower burst risk and a free extra bottle from every batch.', skills: [['quicklime_flask', 1], ['lead_to_gold', 2], ['catalytic_surge', 4], ['grand_transmutation', 6]] },
};
export const BASE_CLASSES = ['warrior', 'mage', 'archer', 'blacksmith', 'alchemist', 'merchant'];
export const COMBAT_CLASSES = ['warrior', 'mage', 'archer'];

// ── Mythic classes (one player per server) and skill registration ───────────────────
for (const [id, m] of Object.entries(MYTHICS)) {
  CLASSES[id] = { id, group: m.group, mythic: true, hidden: true, name: m.name, icon: '', color: m.color, tie: m.color, hp: m.hp, hpPer: m.hpPer, atk: m.atk, def: m.def, move: m.move, mpRegen: m.mpRegen, gather: m.gather, craftFamily: m.craftFamily, desc: m.desc, status: m.status, skills: m.skills };
  BASICS[id] = { icon: '', ...m.basic };
}
// Every class's level-kit skills: remember which class learns them at which level.
for (const c of Object.values(CLASSES)) for (const [id, l] of c.skills) {
  const sk = SKILLS[id]; if (!sk) continue;
  sk.src ??= 'level'; sk.cls = [...new Set([...(sk.cls ?? []), c.id])]; (sk.lv ??= {})[c.id] = l;
}
for (const sk of Object.values(SKILLS)) { sk.cls ??= []; sk.src ??= 'level'; sk.id ??= ''; }
// Skill Tomes: bound items that teach a skill (class-restricted at use time).
export const TOMES = Object.values(SKILLS).filter((x) => x.src === 'tome').map((x) => x.id);


// ── Items ───────────────────────────────────────────────────────────────────
// k: mat | inter | gear | cons | quest (untradeable) | key
export const ITEMS = {
  iron_ore: { n: 'Iron Ore', k: 'mat', v: 6, icon: '' },
  coal: { n: 'Coal', k: 'mat', v: 4, icon: '' },
  hide: { n: 'Beast Hide', k: 'mat', v: 5, icon: '' },
  herb: { n: 'Marrow Herb', k: 'mat', v: 5, icon: '' },
  ink: { n: 'Wraith Ink', k: 'mat', v: 9, icon: '' },
  parchment: { n: 'Old Parchment', k: 'mat', v: 7, icon: '' },
  iron_ingot: { n: 'Iron Ingot', k: 'inter', v: 18, icon: '' },
  steel_ingot: { n: 'Steel Ingot', k: 'inter', v: 52, icon: '' },
  leather: { n: 'Cured Leather', k: 'inter', v: 14, icon: '' },
  torn_page: { n: 'Torn Page', k: 'quest', v: 40, icon: '' },
  starmetal: { n: 'Starmetal Shard', k: 'quest', v: 160, icon: '' },
  hollow_ichor: { n: 'Shadow Ichor', k: 'quest', v: 200, icon: '' },
  sunsteel_ore: { n: 'Sunsteel Ore', k: 'mat', v: 60, icon: '' },
  frostbloom: { n: 'Frostbloom', k: 'mat', v: 52, icon: '' },
  sunsteel_ingot: { n: 'Sunsteel Ingot', k: 'inter', v: 190, icon: '' },
  sun_blade: { n: 'Sunsteel Blade', k: 'gear', slot: 'weapon', wtype: 'slash', atk: 27, v: 900, icon: '' },
  sun_bow: { n: 'Sunsteel Bow', k: 'gear', slot: 'weapon', wtype: 'pierce', atk: 27, v: 900, icon: '' },
  sun_maul: { n: 'Sunsteel Maul', k: 'gear', slot: 'weapon', wtype: 'blunt', atk: 28, v: 940, icon: '' },
  sun_rod: { n: 'Sunsteel Staff', k: 'gear', slot: 'weapon', wtype: 'arcane', atk: 26, v: 950, icon: '' },
  sun_aegis: { n: 'Sunsteel Aegis', k: 'gear', slot: 'armor', def: 22, hp: 110, v: 1000, icon: '' },
  frost_elixir: { n: 'Frost Elixir', k: 'cons', v: 160, icon: '', desc: 'Restore 220 HP. (key 5)' },
  heartwood_seed: { n: 'Heartwood Seed', k: 'quest', v: 0, icon: '', desc: 'It is warm. It wants to be planted at first light.' },
  titan_core: { n: 'Titan Core', k: 'quest', v: 0, icon: '', desc: 'A heart of forged starmetal. The Cold Forge wants it.' },
  philosophers_stone: { n: "Philosopher's Stone", k: 'quest', v: 0, icon: '', desc: 'Lead, if lead were a promise.' },
  // gear (instances with quality)
  iron_sword: { n: 'Iron Sword', k: 'gear', slot: 'weapon', wtype: 'slash', atk: 6, v: 90, icon: '' },
  short_bow: { n: 'Short Bow', k: 'gear', slot: 'weapon', wtype: 'pierce', atk: 6, v: 90, icon: '' },
  hunting_spear: { n: 'Hunting Spear', k: 'gear', slot: 'weapon', wtype: 'pierce', atk: 6, v: 90, icon: '' },
  iron_mace: { n: 'Iron Mace', k: 'gear', slot: 'weapon', wtype: 'blunt', atk: 7, v: 105, icon: '' },
  focus_rod: { n: 'Oak Staff', k: 'gear', slot: 'weapon', wtype: 'arcane', atk: 6, v: 110, icon: '' },
  steel_sword: { n: 'Steel Sword', k: 'gear', slot: 'weapon', wtype: 'slash', atk: 11, v: 260, icon: '' },
  steel_pike: { n: 'Steel Pike', k: 'gear', slot: 'weapon', wtype: 'pierce', atk: 11, v: 260, icon: '' },
  steel_bow: { n: 'Longbow', k: 'gear', slot: 'weapon', wtype: 'pierce', atk: 11, v: 260, icon: '' },
  leather_coat: { n: 'Leather Coat', k: 'gear', slot: 'armor', def: 3, hp: 12, v: 55, icon: '' },
  iron_mail: { n: 'Chain Mail', k: 'gear', slot: 'armor', def: 6, hp: 24, v: 150, icon: '' },
  steel_plate: { n: 'Steel Plate', k: 'gear', slot: 'armor', def: 10, hp: 40, v: 340, icon: '' },
  sanity_locket: { n: 'Mana Locket', k: 'gear', slot: 'charm', mp: 15, v: 95, icon: '' },
  swift_band: { n: 'Swift Band', k: 'gear', slot: 'charm', spd: 1, v: 80, icon: '〰' },
  // consumables
  heal_potion: { n: 'Marrow Tonic', k: 'cons', v: 24, icon: '', desc: 'Restore 45 HP. (key 5)' },
  calm_tonic: { n: 'Calm Tonic', k: 'cons', v: 30, icon: '', desc: 'Restore 20 Mana. (key 6)' },
  light_vial: { n: 'Lamp Oil Vial', k: 'cons', v: 34, icon: '', desc: 'Restore 3 Light (Archivists).' },
  // ── The Shadowfell (second realm) ──
  hollow_key: { n: 'Shadow Key', k: 'key', v: 320, icon: '', desc: 'Carry it to the sealed gate in the Drowned Archive. Not consumed.' },
  hollow_ore: { n: 'Shadow Ore', k: 'mat', v: 40, icon: '', tier: 'hollow' },
  ghostbloom: { n: 'Ghostbloom', k: 'mat', v: 36, icon: '', tier: 'hollow' },
  echo_shard: { n: 'Echo Shard', k: 'mat', v: 55, icon: '', tier: 'hollow' },
  hollow_ingot: { n: 'Shadowsteel Ingot', k: 'inter', v: 150, icon: '', tier: 'hollow' },
  hollow_blade: { n: 'Shadowsteel Blade', k: 'gear', slot: 'weapon', wtype: 'slash', atk: 19, v: 720, icon: '', tier: 'hollow' },
  hollow_lance: { n: 'Shadowsteel Lance', k: 'gear', slot: 'weapon', wtype: 'pierce', atk: 19, v: 720, icon: '', tier: 'hollow' },
  hollow_bow: { n: 'Shadowsteel Bow', k: 'gear', slot: 'weapon', wtype: 'pierce', atk: 19, v: 720, icon: '', tier: 'hollow' },
  hollow_maul: { n: 'Shadowsteel Maul', k: 'gear', slot: 'weapon', wtype: 'blunt', atk: 20, v: 760, icon: '', tier: 'hollow' },
  hollow_rod: { n: 'Shadow Staff', k: 'gear', slot: 'weapon', wtype: 'arcane', atk: 19, v: 760, icon: '', tier: 'hollow' },
  hollow_aegis: { n: 'Shadowsteel Aegis', k: 'gear', slot: 'armor', def: 17, hp: 80, v: 820, icon: '', tier: 'hollow' },
  hollow_locket: { n: 'Shadow Locket', k: 'gear', slot: 'charm', mp: 30, v: 520, icon: '', tier: 'hollow' },
  ghost_elixir: { n: 'Ghost Elixir', k: 'cons', v: 110, icon: '', desc: 'Restore 120 HP. (key 5)', tier: 'hollow' },
  clarity_draught: { n: 'Clarity Draught', k: 'cons', v: 90, icon: '', desc: 'Restore 40 Mana. (key 6)', tier: 'hollow' },
  lantern_salve: { n: 'Lantern Salve', k: 'cons', v: 70, icon: '', desc: 'Restore 25 Mana and stave off the Shadowfell. (key 6)', tier: 'hollow' },
};

for (const id of TOMES) ITEMS[`tome_${id}`] = { n: `Tome: ${SKILLS[id].name}`, k: 'quest', v: 0, icon: '', skill: id, desc: `Teaches ${SKILLS[id].name} to ${SKILLS[id].cls.map((c) => CLASSES[c].name).join(' / ')}.` };

export const GRADES = [
  { id: 'crude', name: 'Crude', min: 0, color: '#9a8f86' },
  { id: 'common', name: 'Common', min: 0.45, color: '#d8cdbd' },
  { id: 'fine', name: 'Fine', min: 0.66, color: '#6fc08b' },
  { id: 'masterwork', name: 'Masterwork', min: 0.85, color: '#e7b449' },
  { id: 'flawless', name: 'Flawless', min: 0.96, color: '#ff6b57' },
];
export const gradeOf = (q) => [...GRADES].reverse().find((g) => q >= g.min);
export const qualityStatMult = (q) => 0.8 + 0.7 * q;       // 0.8 … 1.5
export const qualityPriceMult = (q) => 0.7 + 0.9 * q;      // 0.7 … 1.6

export const AFFIXES = [
  { id: 'keen', name: 'Keen', text: '+10% damage', dmg: 0.1 },
  { id: 'echoing', name: 'Echoing', text: '+12 max Mana', mp: 12 },
  { id: 'hungering', name: 'Hungering', text: '+8% skill power', power: 1 },
  { id: 'warded', name: 'Warded', text: '+3 defense', def: 3 },
  { id: 'lively', name: 'Lively', text: '+15 max HP', hp: 15 },
];

// ── Recipes ─────────────────────────────────────────────────────────────────
// craft: 'blacksmith' (forge minigame, at a Forge) | 'alchemist' (cauldron, at a Cauldron).
// Crafting is class-locked: only that class may make it.
export const RECIPES = [
  { id: 'iron_ingot', craft: 'blacksmith', lvl: 1, in: { iron_ore: 2, coal: 1 }, out: 'iron_ingot', qty: 1, diff: 0.1, smelt: true },
  { id: 'leather', craft: 'blacksmith', lvl: 1, in: { hide: 2 }, out: 'leather', qty: 1, diff: 0.1, smelt: true },
  { id: 'leather_coat', craft: 'blacksmith', lvl: 1, in: { leather: 3 }, out: 'leather_coat', qty: 1, diff: 0.2 },
  { id: 'iron_sword', craft: 'blacksmith', lvl: 1, in: { iron_ingot: 3, leather: 1 }, out: 'iron_sword', qty: 1, diff: 0.25 },
  { id: 'hunting_spear', craft: 'blacksmith', lvl: 2, in: { iron_ingot: 3, leather: 1 }, out: 'hunting_spear', qty: 1, diff: 0.25 },
  { id: 'short_bow', craft: 'blacksmith', lvl: 2, in: { iron_ingot: 2, leather: 2 }, out: 'short_bow', qty: 1, diff: 0.25 },
  { id: 'iron_mace', craft: 'blacksmith', lvl: 2, in: { iron_ingot: 4 }, out: 'iron_mace', qty: 1, diff: 0.28 },
  { id: 'sanity_locket', craft: 'blacksmith', lvl: 2, in: { iron_ingot: 1, ink: 1 }, out: 'sanity_locket', qty: 1, diff: 0.3 },
  { id: 'focus_rod', craft: 'blacksmith', lvl: 3, in: { iron_ingot: 2, ink: 2, leather: 1 }, out: 'focus_rod', qty: 1, diff: 0.3 },
  { id: 'iron_mail', craft: 'blacksmith', lvl: 3, in: { iron_ingot: 4, leather: 2 }, out: 'iron_mail', qty: 1, diff: 0.32 },
  { id: 'swift_band', craft: 'blacksmith', lvl: 3, in: { leather: 2, iron_ingot: 1 }, out: 'swift_band', qty: 1, diff: 0.3 },
  { id: 'steel_ingot', craft: 'blacksmith', lvl: 4, in: { iron_ingot: 2, coal: 3 }, out: 'steel_ingot', qty: 1, diff: 0.4, smelt: true },
  { id: 'hollow_key', craft: 'blacksmith', lvl: 4, in: { starmetal: 1, iron_ingot: 3, ink: 2 }, out: 'hollow_key', qty: 1, diff: 0.35, desc: 'Opens the sealed gate to the Shadowfell.' },
  { id: 'steel_sword', craft: 'blacksmith', lvl: 5, in: { steel_ingot: 3, leather: 2 }, out: 'steel_sword', qty: 1, diff: 0.42 },
  { id: 'steel_pike', craft: 'blacksmith', lvl: 5, in: { steel_ingot: 3, leather: 2 }, out: 'steel_pike', qty: 1, diff: 0.42 },
  { id: 'steel_bow', craft: 'blacksmith', lvl: 5, in: { steel_ingot: 2, leather: 3 }, out: 'steel_bow', qty: 1, diff: 0.42 },
  { id: 'steel_plate', craft: 'blacksmith', lvl: 6, in: { steel_ingot: 4, leather: 3 }, out: 'steel_plate', qty: 1, diff: 0.48 },
  { id: 'hollow_ingot', craft: 'blacksmith', lvl: 6, in: { hollow_ore: 3, coal: 2 }, out: 'hollow_ingot', qty: 1, diff: 0.45, smelt: true },
  { id: 'hollow_blade', craft: 'blacksmith', lvl: 7, in: { hollow_ingot: 3, leather: 2, echo_shard: 1 }, out: 'hollow_blade', qty: 1, diff: 0.5 },
  { id: 'hollow_lance', craft: 'blacksmith', lvl: 7, in: { hollow_ingot: 3, leather: 2, echo_shard: 1 }, out: 'hollow_lance', qty: 1, diff: 0.5 },
  { id: 'hollow_bow', craft: 'blacksmith', lvl: 7, in: { hollow_ingot: 2, leather: 2, echo_shard: 1 }, out: 'hollow_bow', qty: 1, diff: 0.5 },
  { id: 'hollow_maul', craft: 'blacksmith', lvl: 8, in: { hollow_ingot: 4, echo_shard: 1 }, out: 'hollow_maul', qty: 1, diff: 0.52 },
  { id: 'hollow_rod', craft: 'blacksmith', lvl: 8, in: { hollow_ingot: 2, ink: 3, echo_shard: 2 }, out: 'hollow_rod', qty: 1, diff: 0.52 },
  { id: 'hollow_aegis', craft: 'blacksmith', lvl: 9, in: { hollow_ingot: 5, leather: 3, echo_shard: 2 }, out: 'hollow_aegis', qty: 1, diff: 0.55 },
  { id: 'hollow_locket', craft: 'blacksmith', lvl: 8, in: { hollow_ingot: 1, echo_shard: 3 }, out: 'hollow_locket', qty: 1, diff: 0.5 },
  { id: 'titan_core', craft: 'blacksmith', lvl: 22, secret: 'recipe_titan_core', in: { starmetal: 3, hollow_ingot: 5, echo_shard: 5 }, out: 'titan_core', qty: 1, diff: 0.62, desc: 'A heart of forged starmetal.' },
  { id: 'philosophers_stone', craft: 'alchemist', lvl: 22, secret: 'recipe_philosophers_stone', in: { hollow_ichor: 3, ghostbloom: 10, ink: 5 }, out: 'philosophers_stone', qty: 1, risk: 0.2, desc: 'Cooked, never found.' },
  { id: 'sunsteel_ingot', craft: 'blacksmith', lvl: 10, in: { sunsteel_ore: 2, coal: 2 }, out: 'sunsteel_ingot', qty: 1, diff: 0.5, smelt: true },
  { id: 'sun_blade', craft: 'blacksmith', lvl: 11, in: { sunsteel_ingot: 3, leather: 2 }, out: 'sun_blade', qty: 1, diff: 0.55 },
  { id: 'sun_bow', craft: 'blacksmith', lvl: 11, in: { sunsteel_ingot: 3, leather: 2 }, out: 'sun_bow', qty: 1, diff: 0.55 },
  { id: 'sun_maul', craft: 'blacksmith', lvl: 11, in: { sunsteel_ingot: 4, leather: 1 }, out: 'sun_maul', qty: 1, diff: 0.56 },
  { id: 'sun_rod', craft: 'blacksmith', lvl: 12, in: { sunsteel_ingot: 2, ink: 3, echo_shard: 1 }, out: 'sun_rod', qty: 1, diff: 0.56 },
  { id: 'sun_aegis', craft: 'blacksmith', lvl: 13, in: { sunsteel_ingot: 5, leather: 3 }, out: 'sun_aegis', qty: 1, diff: 0.6 },
  { id: 'frost_elixir', craft: 'alchemist', lvl: 11, in: { frostbloom: 2, herb: 2 }, out: 'frost_elixir', qty: 1, risk: 0.2 },
  { id: 'heal_potion', craft: 'alchemist', lvl: 1, in: { herb: 2 }, out: 'heal_potion', qty: 1, risk: 0.10 },
  { id: 'calm_tonic', craft: 'alchemist', lvl: 2, in: { herb: 1, ink: 1 }, out: 'calm_tonic', qty: 1, risk: 0.13 },
  { id: 'light_vial', craft: 'alchemist', lvl: 3, in: { ink: 2, parchment: 1 }, out: 'light_vial', qty: 1, risk: 0.15 },
  { id: 'lantern_salve', craft: 'alchemist', lvl: 4, in: { ghostbloom: 1, herb: 2 }, out: 'lantern_salve', qty: 1, risk: 0.16 },
  { id: 'ghost_elixir', craft: 'alchemist', lvl: 5, in: { ghostbloom: 2, herb: 1 }, out: 'ghost_elixir', qty: 1, risk: 0.18 },
  { id: 'clarity_draught', craft: 'alchemist', lvl: 5, in: { ghostbloom: 1, ink: 2 }, out: 'clarity_draught', qty: 1, risk: 0.18 },
];

// ── Enemies ─────────────────────────────────────────────────────────────────
export const ENEMIES = {
  // shape = silhouette drawn by the client; color = body tint. speed in tiles/s; kite = keeps its distance.
  rock_hound: { name: 'Slag Hound', shape: 'hound', color: '#8a7466', hp: 40, atk: 4, def: 2, speed: 2.9, moves: ['bite', 'lunge'], res: { blunt: 0.8, pierce: 1.2 }, xp: 14, gold: [5, 12], tomes: ['second_wind', 'caltrops', 'sunder'], drops: [['hide', 0.55, 1, 2], ['iron_ore', 0.25, 1, 1]] },
  cinder_imp: { name: 'Cinder Imp', shape: 'imp', color: '#c0503a', hp: 34, atk: 5, def: 1, speed: 3.0, moves: ['flick', 'claw'], kite: 4.5, res: { arcane: 0.7, blunt: 1.25 }, xp: 15, gold: [6, 14], tomes: ['arcane_missiles', 'magma_spike', 'fast_exit'], drops: [['coal', 0.6, 1, 3]] },
  slag_brute: { name: 'Slag Brute', shape: 'brute', color: '#6a6360', hp: 78, atk: 7, def: 5, speed: 2.0, moves: ['smash', 'slam'], res: { slash: 0.7, blunt: 1.3, pierce: 0.9 }, xp: 30, gold: [14, 28], tomes: ['sunder', 'magma_spike', 'second_wind'], drops: [['iron_ore', 0.8, 2, 3], ['coal', 0.5, 1, 2]] },
  thorn_stag: { name: 'Thorn Stag', shape: 'stag', color: '#6a7a4a', hp: 58, atk: 6, def: 3, speed: 3.2, moves: ['gore', 'stomp'], res: { pierce: 0.8, slash: 1.2 }, xp: 24, gold: [10, 20], tomes: ['deadeye', 'fast_exit', 'caltrops'], drops: [['hide', 0.7, 1, 3], ['herb', 0.35, 1, 2]] },
  mire_wisp: { name: 'Mire Wisp', shape: 'wisp', color: '#6ac0b0', hp: 46, atk: 6, def: 2, speed: 2.4, moves: ['spit', 'nova'], kite: 5, res: { arcane: 0.6, slash: 1.3 }, xp: 22, gold: [8, 18], tomes: ['chain_lightning', 'quicksilver_flask', 'arcane_missiles'], drops: [['herb', 0.6, 1, 3], ['ink', 0.2, 1, 1]] },
  bramble_witch: { name: 'Bramble Witch', shape: 'witch', color: '#7a4a7a', hp: 62, atk: 7, def: 3, speed: 2.5, moves: ['flick', 'nova', 'spit'], kite: 5.5, res: { pierce: 0.8, blunt: 1.2 }, xp: 34, gold: [14, 26], tomes: ['arcane_missiles', 'quicksilver_flask', 'chain_lightning'], drops: [['herb', 0.7, 2, 3], ['ink', 0.3, 1, 1]] },
  ink_wraith: { name: 'Ink Wraith', shape: 'wraith', color: '#3a3a5a', hp: 52, atk: 7, def: 2, speed: 3.0, moves: ['claw', 'spit'], res: { slash: 0.6, blunt: 1.3, arcane: 1.2 }, xp: 30, gold: [12, 24], tomes: ['chain_lightning', 'deadeye', 'fast_exit', 'magma_spike'], drops: [['ink', 0.6, 1, 2], ['parchment', 0.45, 1, 2]], torn: 0.10 },
  page_eater: { name: 'Page Eater', shape: 'worm', color: '#b0a070', hp: 70, atk: 8, def: 4, speed: 2.6, moves: ['bite', 'lunge', 'slam'], res: { pierce: 0.8, blunt: 1.0, slash: 1.2 }, xp: 44, gold: [18, 32], tomes: ['sunder', 'second_wind', 'caltrops', 'quicksilver_flask'], drops: [['parchment', 0.6, 1, 3], ['ink', 0.3, 1, 2]], torn: 0.12 },
  lectern_warden: { name: 'Lectern Warden', shape: 'warden', color: '#8a7a9a', hp: 190, atk: 10, def: 6, speed: 2.1, moves: ['sentence', 'smash', 'page_storm', 'nova'], res: { slash: 0.8, blunt: 1.0, pierce: 1.0, arcane: 1.3 }, xp: 120, gold: [60, 90], tomes: ['sunder', 'second_wind', 'chain_lightning', 'arcane_missiles', 'deadeye', 'caltrops', 'magma_spike', 'quicksilver_flask', 'fast_exit'], drops: [['ink', 1, 2, 4], ['parchment', 1, 2, 4]], torn: 0.5, boss: true },
  // The Shadowfell (mirror city)
  hollow_wisp: { tough: 1.5, name: 'Shadow Wisp', shape: 'wisp', color: '#a070e0', hp: 62, atk: 9, def: 4, speed: 2.7, moves: ['nova', 'flick', 'spit'], kite: 5, res: { arcane: 0.5, slash: 1.3 }, xp: 46, gold: [20, 40], tomes: ['chain_lightning', 'quicksilver_flask'], drops: [['ghostbloom', 0.6, 1, 2], ['echo_shard', 0.25, 1, 1]] },
  husk: { tough: 1.5, name: 'Shadow Husk', shape: 'husk', color: '#5a4a72', hp: 100, atk: 10, def: 7, speed: 2.3, moves: ['smash', 'slam', 'lunge'], res: { blunt: 0.8, slash: 1.2, arcane: 1.1 }, xp: 56, gold: [24, 46], tomes: ['sunder', 'magma_spike', 'second_wind'], drops: [['hollow_ore', 0.7, 1, 2], ['echo_shard', 0.2, 1, 1]], ichor: 0.04 },
  reflection: { name: 'Shade', shape: 'mirror', color: '#c8d0ff', hp: 90, atk: 8, def: 6, speed: 3.0, moves: [], res: {}, xp: 80, gold: [30, 56], tomes: ['deadeye', 'fast_exit', 'arcane_missiles'], drops: [['echo_shard', 0.5, 1, 2], ['hollow_ore', 0.3, 1, 1]], mirror: true },
  the_unwritten: { tough: 1.5, name: 'The Unwritten', shape: 'unwritten', color: '#d8d0ff', hp: 420, atk: 14, def: 9, speed: 2.2, moves: ['unwrite', 'nova', 'void_slam', 'page_storm', 'sentence'], res: { slash: 0.9, blunt: 0.9, pierce: 0.9, arcane: 1.2 }, xp: 400, gold: [180, 260], tomes: ['sunder', 'second_wind', 'chain_lightning', 'arcane_missiles', 'deadeye', 'caltrops', 'magma_spike', 'quicksilver_flask', 'fast_exit'], drops: [['hollow_ore', 1, 2, 4], ['ghostbloom', 1, 2, 4], ['echo_shard', 1, 1, 3]], ichor: 1, boss: true },
  // ── hidden places ──
  root_creeper: { name: 'Root Creeper', shape: 'worm', color: '#5a8a3a', hp: 80, atk: 9, def: 6, speed: 2.5, moves: ['bite', 'lunge', 'root_lash'], res: { slash: 0.9, arcane: 1.1 }, xp: 70, gold: [30, 50], drops: [['herb', 0.8, 2, 4]] },
  root_warden: { tough: 1.4, name: 'The Rootwarden', shape: 'warden', color: '#4a8a4a', hp: 300, atk: 12, def: 8, speed: 2.2, moves: ['root_lash', 'smash', 'thorn_volley', 'slam'], res: { slash: 0.8, arcane: 1.0, pierce: 0.8, blunt: 1.0 }, xp: 300, gold: [90, 150], drops: [['herb', 1, 3, 6]], boss: true, tomes: ['sunder', 'chain_lightning', 'deadeye'] },
  tree_thrall: { tough: 1.3, name: 'Tree Thrall', shape: 'brute', color: '#5a8a4a', hp: 110, atk: 11, def: 8, speed: 2.1, moves: ['smash', 'slam', 'root_lash'], res: { pierce: 0.8, slash: 1.2, arcane: 0.9 }, xp: 110, gold: [40, 70], drops: [['hide', 0.8, 2, 4]] },
  withered_guardian: { tough: 1.6, name: 'The Withered Guardian', shape: 'unwritten', color: '#b8d890', hp: 640, atk: 17, def: 12, speed: 2.3, moves: ['world_slam', 'thorn_volley', 'root_lash', 'nova', 'smash'], res: { slash: 0.9, blunt: 0.9, pierce: 0.8, arcane: 1.1 }, xp: 900, gold: [300, 420], drops: [['ghostbloom', 1, 2, 4]], boss: true },
  void_stalker: { tough: 1.5, name: 'Void Stalker', shape: 'wraith', color: '#7a5aff', hp: 150, atk: 14, def: 8, speed: 3.0, moves: ['claw', 'rift_beam', 'lunge'], res: { slash: 0.7, blunt: 1.2, arcane: 0.7 }, xp: 150, gold: [60, 90], drops: [['echo_shard', 0.35, 1, 2]] },
  rift_king: { tough: 1.7, name: 'The Rift King', shape: 'unwritten', color: '#5a3aa8', hp: 700, atk: 20, def: 13, speed: 2.5, moves: ['rift_collapse', 'rift_beam', 'void_slam', 'unwrite', 'page_storm'], res: { slash: 0.9, blunt: 0.9, pierce: 0.9, arcane: 0.6 }, xp: 1100, gold: [400, 520], drops: [['echo_shard', 1, 2, 4]], boss: true },
  goblin_king: { tough: 1.3, name: 'The Goblin King', shape: 'bandit', color: '#4a8a3a', hp: 320, atk: 11, def: 8, speed: 2.7, moves: ['claw', 'flick', 'lunge', 'slam'], res: {}, xp: 260, gold: [120, 200], drops: [['iron_ore', 1, 4, 8], ['hide', 1, 3, 5]], boss: true, tomes: ['sunder', 'deadeye', 'second_wind', 'fast_exit', 'caltrops'] },
  goblin_shaman: { tough: 1.2, name: 'Goblin Shaman', shape: 'witch', color: '#5aa04a', hp: 150, atk: 9, def: 5, speed: 2.5, moves: ['flick', 'nova', 'spit'], kite: 5, res: { arcane: 0.7 }, xp: 120, gold: [50, 90], drops: [['herb', 1, 2, 4]], tomes: ['arcane_missiles', 'chain_lightning'] },
  crypt_lord: { tough: 1.6, name: 'The Crypt Lord', shape: 'skeleton', color: '#5a8a8a', hp: 560, atk: 15, def: 10, speed: 2.3, moves: ['smash', 'nova', 'page_storm', 'sentence'], res: { slash: 0.6, pierce: 0.6, arcane: 1.2 }, xp: 700, gold: [260, 420], drops: [['ink', 1, 3, 6], ['ghostbloom', 0.6, 1, 2]], boss: true, tomes: ['sunder', 'chain_lightning', 'quicksilver_flask', 'magma_spike', 'second_wind'] },
  wailing_wraith: { tough: 1.5, name: 'Wailing Wraith', shape: 'wraith', color: '#9ad0d0', hp: 300, atk: 13, def: 6, speed: 3.1, moves: ['claw', 'spit', 'nova'], res: { slash: 0.5, blunt: 1.3, arcane: 1.1 }, xp: 380, gold: [120, 200], drops: [['ink', 1, 2, 4]], tomes: ['chain_lightning', 'deadeye'] },
  lich_king: { tough: 1.9, name: 'The Lich King', shape: 'witch', color: '#6ab8f0', hp: 900, atk: 21, def: 12, speed: 2.5, moves: ['nova', 'rift_beam', 'rift_collapse', 'thorn_volley', 'sentence'], kite: 4, res: { arcane: 0.5, blunt: 1.2 }, xp: 1600, gold: [500, 800], drops: [['frostbloom', 1, 3, 6], ['echo_shard', 0.7, 1, 2]], boss: true, tomes: ['chain_lightning', 'arcane_missiles', 'quicksilver_flask', 'deadeye', 'second_wind', 'magma_spike'] },
  bone_colossus: { tough: 1.9, name: 'Bone Colossus', shape: 'golem', color: '#d8e4f0', hp: 700, atk: 20, def: 16, speed: 1.9, moves: ['smash', 'slam', 'world_slam'], res: { slash: 0.5, pierce: 0.4, blunt: 1.5 }, xp: 1000, gold: [320, 520], drops: [['steel_ingot', 1, 1, 3]], tomes: ['sunder', 'caltrops', 'second_wind'] },
  infernal_warden: { tough: 2.2, name: 'The Infernal Warden', shape: 'warden', color: '#ff5a2a', hp: 1500, atk: 27, def: 15, speed: 2.3, moves: ['magma_burst', 'ember_fan', 'colossus_stomp', 'smash', 'sentence'], res: { arcane: 0.4, blunt: 0.9 }, xp: 2600, gold: [800, 1300], drops: [['sunsteel_ore', 1, 4, 8], ['starmetal', 0.5, 1, 1]], boss: true, tomes: ['sunder', 'magma_spike', 'second_wind', 'chain_lightning', 'deadeye', 'caltrops', 'quicksilver_flask', 'arcane_missiles'] },
  fire_drake: { tough: 2.1, name: 'Fire Drake', shape: 'stag', color: '#ff7a3a', hp: 800, atk: 25, def: 14, speed: 3.1, moves: ['gore', 'magma_burst', 'ember_fan', 'lunge'], res: { arcane: 0.4 }, xp: 1500, gold: [500, 800], drops: [['sunsteel_ore', 1, 2, 5]], tomes: ['magma_spike', 'deadeye', 'sunder'] },
  // ── live events ──
  cinder_colossus: { tough: 2.0, name: 'Cinder Colossus', shape: 'brute', color: '#e0602a', hp: 2200, atk: 18, def: 11, speed: 1.9, moves: ['colossus_stomp', 'ember_fan', 'magma_burst', 'smash'], res: { blunt: 0.7, pierce: 1.0, slash: 0.9, arcane: 1.0 }, xp: 1500, gold: [400, 700], drops: [['iron_ore', 1, 6, 10], ['coal', 1, 6, 10]], boss: true, world: true },
  ember_tyrant: { tough: 2.0, name: 'The Ember Tyrant', shape: 'warden', color: '#d8402a', hp: 2000, atk: 22, def: 13, speed: 2.1, moves: ['magma_burst', 'ember_fan', 'colossus_stomp', 'smash', 'slam'], res: { blunt: 0.8, slash: 0.9, pierce: 0.9, arcane: 1.0 }, xp: 3000, gold: [900, 1400], drops: [['starmetal', 0.5, 1, 1]], boss: true, raid: true },
  obsidian_titan: { tough: 2.3, name: 'The Obsidian Titan', shape: 'warden', color: '#3a2a48', hp: 3000, atk: 26, def: 16, speed: 2.1, moves: ['colossus_stomp', 'magma_burst', 'world_slam', 'rift_collapse', 'smash'], res: { arcane: 0.7, blunt: 0.8 }, xp: 5000, gold: [1500, 2400], drops: [['starmetal', 1, 1, 2]], boss: true, graid: true },
  tyrant_spawn: { tough: 1.4, name: 'Tyrant Spawn', shape: 'imp', color: '#e8602a', hp: 70, atk: 14, def: 5, speed: 3.2, moves: ['flick', 'claw'], kite: 4.0, res: { arcane: 0.6, blunt: 1.25 }, xp: 40, gold: [10, 20], drops: [] },
  // ── the wider world ──
  wild_boar: { name: 'Wild Boar', shape: 'boar', color: '#8a6a4a', hp: 38, atk: 4, def: 2, speed: 2.8, moves: ['gore', 'stomp'], res: { pierce: 0.9, slash: 1.1 }, xp: 12, gold: [4, 10], drops: [['hide', 0.7, 1, 2]], tomes: ['second_wind', 'caltrops'] },
  grey_wolf: { name: 'Grey Wolf', shape: 'hound', color: '#8a8f98', hp: 34, atk: 4, def: 2, speed: 3.1, moves: ['bite', 'lunge'], res: { blunt: 1.1 }, xp: 12, gold: [4, 10], drops: [['hide', 0.6, 1, 2]] },
  bandit: { name: 'Meadow Bandit', shape: 'bandit', color: '#7a5a3a', hp: 42, atk: 5, def: 3, speed: 2.7, moves: ['claw', 'flick'], kite: 3.5, res: {}, xp: 15, gold: [8, 18], drops: [['iron_ore', 0.3, 1, 2], ['leather', 0.1, 1, 1]], tomes: ['sunder', 'deadeye', 'fast_exit'] },
  giant_beetle: { name: 'Giant Beetle', shape: 'scorpion', color: '#4a7a3a', hp: 52, atk: 5, def: 6, speed: 2.2, moves: ['bite', 'stomp'], res: { pierce: 0.6, blunt: 1.4 }, xp: 18, gold: [6, 14], drops: [['hide', 0.5, 1, 2], ['herb', 0.3, 1, 2]] },
  boar_king: { tough: 1.2, name: 'The Boar King', shape: 'boar', color: '#6a3a2a', hp: 170, atk: 8, def: 5, speed: 2.7, moves: ['gore', 'slam', 'stomp'], res: { pierce: 0.8 }, xp: 120, gold: [60, 100], drops: [['hide', 1, 3, 5]], boss: true, tomes: ['sunder', 'second_wind', 'caltrops', 'deadeye'] },
  bandit_chief: { tough: 1.3, name: 'Bandit Chief', shape: 'bandit', color: '#5a2a2a', hp: 110, atk: 8, def: 5, speed: 2.8, moves: ['claw', 'flick', 'lunge'], res: {}, xp: 90, gold: [60, 110], drops: [['iron_ore', 1, 2, 4]], tomes: ['sunder', 'deadeye', 'fast_exit'] },
  shore_crab: { name: 'Shore Crab', shape: 'scorpion', color: '#d0704a', hp: 66, atk: 7, def: 8, speed: 2.1, moves: ['bite', 'smash'], res: { pierce: 0.6, blunt: 1.4, arcane: 1.1 }, xp: 30, gold: [12, 24], drops: [['hide', 0.5, 1, 3]] },
  drowned_sailor: { name: 'Drowned Sailor', shape: 'skeleton', color: '#4a8a8a', hp: 72, atk: 8, def: 4, speed: 2.4, moves: ['claw', 'smash'], res: { slash: 0.7, blunt: 1.3, pierce: 0.8 }, xp: 34, gold: [16, 30], drops: [['ink', 0.4, 1, 2], ['iron_ore', 0.4, 1, 3]], tomes: ['magma_spike'] },
  sea_wisp: { name: 'Sea Wisp', shape: 'wisp', color: '#4a90e0', hp: 54, atk: 8, def: 3, speed: 2.5, moves: ['spit', 'nova'], kite: 5, res: { arcane: 0.6, slash: 1.3 }, xp: 32, gold: [14, 26], drops: [['herb', 0.5, 1, 3], ['ink', 0.25, 1, 1]], tomes: ['chain_lightning', 'quicksilver_flask'] },
  tide_hag: { tough: 1.3, name: 'The Tide Hag', shape: 'witch', color: '#3a8a9a', hp: 240, atk: 11, def: 7, speed: 2.4, moves: ['nova', 'spit', 'flick', 'slam'], kite: 4, res: { arcane: 0.8, blunt: 1.2 }, xp: 240, gold: [100, 170], drops: [['ink', 1, 2, 4]], boss: true, tomes: ['chain_lightning', 'quicksilver_flask', 'arcane_missiles'] },
  smuggler_captain: { tough: 1.4, name: 'Smuggler Captain', shape: 'bandit', color: '#2a4a6a', hp: 150, atk: 11, def: 7, speed: 2.8, moves: ['claw', 'flick', 'lunge'], res: {}, xp: 150, gold: [120, 200], drops: [['steel_ingot', 0.4, 1, 1]], tomes: ['deadeye', 'fast_exit', 'sunder'] },
  cave_bat: { name: 'Cave Bat', shape: 'imp', color: '#6a6a7a', hp: 30, atk: 5, def: 1, speed: 3.4, moves: ['claw', 'lunge'], res: { blunt: 1.3 }, xp: 14, gold: [4, 10], drops: [['coal', 0.4, 1, 2]] },
  mine_spider: { name: 'Mine Spider', shape: 'spider', color: '#5a3a4a', hp: 48, atk: 6, def: 3, speed: 3.0, moves: ['bite', 'spit', 'lunge'], res: { pierce: 0.8, slash: 1.1 }, xp: 22, gold: [8, 16], drops: [['hide', 0.3, 1, 2], ['coal', 0.5, 1, 2]] },
  rock_golem: { name: 'Rock Golem', shape: 'golem', color: '#7a7a82', hp: 100, atk: 8, def: 8, speed: 1.8, moves: ['smash', 'slam'], res: { slash: 0.6, pierce: 0.6, blunt: 1.4, arcane: 1.0 }, xp: 40, gold: [20, 40], drops: [['iron_ore', 0.9, 2, 4], ['coal', 0.6, 1, 3]], tomes: ['sunder', 'magma_spike'] },
  kobold_miner: { name: 'Kobold Miner', shape: 'bandit', color: '#8a6a3a', hp: 44, atk: 6, def: 3, speed: 2.8, moves: ['claw', 'flick'], kite: 3, res: {}, xp: 20, gold: [10, 20], drops: [['iron_ore', 0.7, 1, 3], ['coal', 0.4, 1, 2]] },
  foreman_gor: { tough: 1.4, name: 'Foreman Gor', shape: 'brute', color: '#9a6a3a', hp: 260, atk: 11, def: 9, speed: 2.1, moves: ['smash', 'slam', 'lunge'], res: { blunt: 0.9, slash: 0.8 }, xp: 220, gold: [100, 160], drops: [['iron_ore', 1, 4, 8], ['steel_ingot', 0.4, 1, 1]], boss: true, tomes: ['sunder', 'magma_spike', 'second_wind'] },
  golem_elder: { tough: 1.5, name: 'Golem Elder', shape: 'golem', color: '#8a8a60', hp: 200, atk: 10, def: 11, speed: 1.8, moves: ['smash', 'slam', 'nova'], res: { slash: 0.5, pierce: 0.5, blunt: 1.5 }, xp: 140, gold: [80, 130], drops: [['steel_ingot', 0.5, 1, 1]], tomes: ['sunder', 'magma_spike'] },
  bog_lurker: { name: 'Bog Lurker', shape: 'worm', color: '#4a6a3a', hp: 84, atk: 10, def: 5, speed: 2.4, moves: ['bite', 'lunge', 'slam'], res: { pierce: 0.7, arcane: 1.2 }, xp: 50, gold: [20, 36], drops: [['herb', 0.7, 2, 4]] },
  mire_shambler: { name: 'Mire Shambler', shape: 'husk', color: '#4a6a4a', hp: 110, atk: 11, def: 7, speed: 2.1, moves: ['smash', 'slam'], res: { blunt: 0.8, slash: 1.2 }, xp: 56, gold: [24, 42], drops: [['hide', 0.5, 1, 3], ['herb', 0.5, 1, 3]], tomes: ['second_wind', 'sunder'] },
  swamp_witch: { name: 'Swamp Witch', shape: 'witch', color: '#4a7a5a', hp: 78, atk: 11, def: 5, speed: 2.5, moves: ['flick', 'nova', 'spit'], kite: 5.5, res: { arcane: 0.7, blunt: 1.2 }, xp: 54, gold: [24, 44], drops: [['herb', 0.8, 2, 4], ['ink', 0.4, 1, 2]], tomes: ['arcane_missiles', 'quicksilver_flask'] },
  giant_toad: { name: 'Giant Toad', shape: 'boar', color: '#5a8a4a', hp: 90, atk: 9, def: 4, speed: 2.6, moves: ['lunge', 'stomp'], res: { pierce: 1.1, blunt: 0.8 }, xp: 46, gold: [18, 32], drops: [['hide', 0.6, 1, 3]] },
  will_o_wisp: { name: 'Will-o-Wisp', shape: 'wisp', color: '#9ae08a', hp: 60, atk: 11, def: 3, speed: 2.9, moves: ['nova', 'flick'], kite: 5, res: { arcane: 0.5, slash: 1.3 }, xp: 52, gold: [22, 40], drops: [['ghostbloom', 0.15, 1, 1], ['herb', 0.5, 1, 2]], tomes: ['chain_lightning', 'arcane_missiles'] },
  hag_queen: { tough: 1.5, name: 'The Hag Queen', shape: 'witch', color: '#6a2a6a', hp: 420, atk: 14, def: 9, speed: 2.5, moves: ['nova', 'thorn_volley', 'flick', 'slam', 'root_lash'], kite: 3, res: { arcane: 0.8, pierce: 0.8 }, xp: 480, gold: [180, 280], drops: [['ghostbloom', 1, 1, 2]], boss: true, tomes: ['arcane_missiles', 'chain_lightning', 'quicksilver_flask', 'deadeye'] },
  moss_troll: { tough: 1.6, name: 'Moss Troll', shape: 'brute', color: '#4a7a3a', hp: 300, atk: 13, def: 10, speed: 2.0, moves: ['smash', 'slam', 'root_lash'], res: { blunt: 0.9, slash: 0.9 }, xp: 260, gold: [120, 200], drops: [['herb', 1, 3, 6]], tomes: ['sunder', 'second_wind'] },
  sand_scorpion: { name: 'Sand Scorpion', shape: 'scorpion', color: '#c8a050', hp: 90, atk: 13, def: 8, speed: 2.7, moves: ['bite', 'lunge', 'spit'], res: { pierce: 0.7, blunt: 1.3 }, xp: 90, gold: [36, 60], drops: [['hide', 0.4, 1, 2], ['sunsteel_ore', 0.15, 1, 1]] },
  dune_wraith: { name: 'Dune Wraith', shape: 'wraith', color: '#d8c080', hp: 82, atk: 14, def: 5, speed: 3.1, moves: ['claw', 'spit', 'lunge'], res: { slash: 0.6, blunt: 1.3, arcane: 1.1 }, xp: 92, gold: [38, 62], drops: [['ink', 0.5, 1, 3]], tomes: ['deadeye', 'chain_lightning'] },
  mummy: { name: 'Sand Mummy', shape: 'skeleton', color: '#c8b890', hp: 130, atk: 13, def: 8, speed: 2.1, moves: ['smash', 'claw'], res: { slash: 0.8, pierce: 0.7, blunt: 1.1, arcane: 1.4 }, xp: 100, gold: [40, 70], drops: [['parchment', 0.5, 1, 3], ['torn_page', 0.03, 1, 1]], tomes: ['sunder', 'magma_spike', 'second_wind'] },
  cactus_imp: { name: 'Cactus Imp', shape: 'imp', color: '#5aa050', hp: 66, atk: 13, def: 4, speed: 3.0, moves: ['flick', 'claw'], kite: 4.5, res: { arcane: 0.8, blunt: 1.2 }, xp: 84, gold: [30, 54], drops: [['herb', 0.5, 1, 3]], tomes: ['arcane_missiles', 'fast_exit'] },
  sandworm: { tough: 1.6, name: 'The Great Sandworm', shape: 'worm', color: '#c8a860', hp: 600, atk: 17, def: 11, speed: 2.5, moves: ['bite', 'lunge', 'slam', 'world_slam'], res: { pierce: 0.8, arcane: 1.1 }, xp: 900, gold: [300, 480], drops: [['sunsteel_ore', 1, 3, 6]], boss: true, tomes: ['sunder', 'deadeye', 'chain_lightning', 'magma_spike', 'caltrops'] },
  sand_pharaoh: { tough: 1.8, name: 'The Sand Pharaoh', shape: 'warden', color: '#e0c060', hp: 520, atk: 18, def: 12, speed: 2.3, moves: ['sentence', 'nova', 'smash', 'unwrite'], res: { arcane: 0.9, slash: 0.8 }, xp: 700, gold: [260, 420], drops: [['sunsteel_ore', 1, 2, 4]], tomes: ['sunder', 'chain_lightning', 'quicksilver_flask', 'second_wind'] },
  frost_wolf: { name: 'Frost Wolf', shape: 'hound', color: '#c8e0f0', hp: 110, atk: 16, def: 7, speed: 3.3, moves: ['bite', 'lunge'], res: { arcane: 1.3, blunt: 1.1 }, xp: 130, gold: [50, 80], drops: [['hide', 0.7, 2, 3]] },
  ice_wisp: { name: 'Ice Wisp', shape: 'wisp', color: '#a8d8ff', hp: 90, atk: 17, def: 5, speed: 2.7, moves: ['nova', 'flick'], kite: 5.5, res: { arcane: 0.4, slash: 1.3, blunt: 1.4 }, xp: 126, gold: [48, 78], drops: [['frostbloom', 0.4, 1, 2]], tomes: ['chain_lightning', 'arcane_missiles'] },
  yeti: { name: 'Yeti', shape: 'brute', color: '#e8f0f8', hp: 190, atk: 17, def: 10, speed: 2.4, moves: ['smash', 'slam', 'lunge'], res: { blunt: 0.8, slash: 0.9, arcane: 1.3 }, xp: 150, gold: [60, 100], drops: [['hide', 0.8, 2, 4], ['frostbloom', 0.3, 1, 2]], tomes: ['sunder', 'second_wind'] },
  frozen_knight: { name: 'Frozen Knight', shape: 'skeleton', color: '#8ab0d0', hp: 150, atk: 17, def: 12, speed: 2.2, moves: ['smash', 'claw', 'nova'], res: { slash: 0.6, pierce: 0.7, blunt: 1.2, arcane: 1.0 }, xp: 140, gold: [56, 90], drops: [['steel_ingot', 0.15, 1, 1], ['iron_ore', 0.5, 1, 3]], tomes: ['sunder', 'second_wind', 'caltrops'] },
  frost_giant: { tough: 1.8, name: 'The Frost Giant', shape: 'warden', color: '#a8d0f0', hp: 900, atk: 21, def: 14, speed: 2.2, moves: ['world_slam', 'smash', 'nova', 'sentence'], res: { arcane: 1.3, blunt: 0.8, slash: 0.9 }, xp: 1500, gold: [500, 800], drops: [['frostbloom', 1, 3, 6]], boss: true, tomes: ['sunder', 'second_wind', 'chain_lightning', 'deadeye', 'quicksilver_flask', 'magma_spike'] },
  ice_queen: { tough: 1.8, name: 'The Ice Queen', shape: 'witch', color: '#c8e8ff', hp: 520, atk: 20, def: 10, speed: 2.6, moves: ['nova', 'rift_beam', 'flick', 'thorn_volley'], kite: 5, res: { arcane: 0.5, blunt: 1.3 }, xp: 800, gold: [300, 480], drops: [['frostbloom', 1, 2, 4]], tomes: ['chain_lightning', 'arcane_missiles', 'quicksilver_flask'] },
  ember_imp: { name: 'Ember Imp', shape: 'imp', color: '#e05a2a', hp: 100, atk: 20, def: 7, speed: 3.2, moves: ['ember_fan', 'claw'], kite: 4.5, res: { arcane: 0.4, blunt: 1.3 }, xp: 190, gold: [70, 110], drops: [['coal', 0.8, 2, 5]], tomes: ['arcane_missiles', 'magma_spike'] },
  magma_hound: { name: 'Magma Hound', shape: 'hound', color: '#e0602a', hp: 150, atk: 21, def: 9, speed: 3.3, moves: ['bite', 'lunge', 'magma_burst'], res: { arcane: 0.5, blunt: 1.2 }, xp: 200, gold: [74, 118], drops: [['coal', 0.7, 2, 4], ['sunsteel_ore', 0.2, 1, 2]] },
  obsidian_golem: { name: 'Obsidian Golem', shape: 'golem', color: '#3a3038', hp: 300, atk: 22, def: 16, speed: 1.9, moves: ['smash', 'slam', 'magma_burst'], res: { slash: 0.5, pierce: 0.5, blunt: 1.5, arcane: 0.9 }, xp: 240, gold: [90, 140], drops: [['steel_ingot', 0.3, 1, 2], ['sunsteel_ore', 0.4, 1, 3]], tomes: ['sunder', 'magma_spike', 'second_wind'] },
  fire_wisp: { name: 'Fire Wisp', shape: 'wisp', color: '#ff8a3a', hp: 110, atk: 21, def: 6, speed: 2.9, moves: ['ember_fan', 'nova'], kite: 5, res: { arcane: 0.3, slash: 1.3, blunt: 1.4 }, xp: 196, gold: [72, 112], drops: [['coal', 0.5, 1, 3]], tomes: ['chain_lightning', 'arcane_missiles'] },
  magma_lord: { tough: 2.0, name: 'The Magma Lord', shape: 'brute', color: '#ff6a2a', hp: 1100, atk: 25, def: 16, speed: 2.1, moves: ['colossus_stomp', 'magma_burst', 'ember_fan', 'smash'], res: { arcane: 0.4, blunt: 0.9 }, xp: 2200, gold: [700, 1100], drops: [['sunsteel_ore', 1, 4, 8], ['starmetal', 0.3, 1, 1]], boss: true, tomes: ['sunder', 'magma_spike', 'second_wind', 'chain_lightning', 'deadeye', 'caltrops', 'quicksilver_flask'] },
  lava_drake: { tough: 2.0, name: 'Lava Drake', shape: 'stag', color: '#c0301a', hp: 640, atk: 24, def: 13, speed: 3.0, moves: ['gore', 'magma_burst', 'ember_fan', 'lunge'], res: { arcane: 0.4 }, xp: 1100, gold: [420, 680], drops: [['sunsteel_ore', 1, 2, 5]], tomes: ['magma_spike', 'deadeye', 'sunder'] },
  shard_bat: { name: 'Shard Bat', shape: 'imp', color: '#8ad8ff', hp: 150, atk: 23, def: 8, speed: 3.5, moves: ['claw', 'lunge', 'rift_beam'], res: { arcane: 0.7, blunt: 1.3 }, xp: 250, gold: [90, 140], drops: [['echo_shard', 0.2, 1, 1]] },
  gem_spider: { name: 'Gem Spider', shape: 'spider', color: '#a984ff', hp: 190, atk: 24, def: 10, speed: 3.1, moves: ['bite', 'spit', 'lunge', 'rift_beam'], res: { arcane: 0.6, pierce: 0.8 }, xp: 270, gold: [96, 150], drops: [['echo_shard', 0.25, 1, 2]], tomes: ['deadeye', 'arcane_missiles'] },
  crystal_golem: { name: 'Crystal Golem', shape: 'golem', color: '#9ad0ff', hp: 360, atk: 24, def: 18, speed: 1.9, moves: ['smash', 'slam', 'rift_collapse'], res: { slash: 0.5, pierce: 0.5, blunt: 1.6, arcane: 0.5 }, xp: 300, gold: [110, 170], drops: [['echo_shard', 0.5, 1, 2], ['hollow_ore', 0.3, 1, 2]], tomes: ['sunder', 'magma_spike'] },
  prism_wisp: { name: 'Prism Wisp', shape: 'wisp', color: '#e0a8ff', hp: 140, atk: 24, def: 7, speed: 2.9, moves: ['rift_beam', 'nova'], kite: 5.5, res: { arcane: 0.3, slash: 1.3, blunt: 1.4 }, xp: 260, gold: [92, 146], drops: [['echo_shard', 0.3, 1, 1]], tomes: ['chain_lightning', 'quicksilver_flask'] },
  prism_wyrm: { tough: 2.2, name: 'The Prism Wyrm', shape: 'worm', color: '#b8a0ff', hp: 1500, atk: 27, def: 18, speed: 2.6, moves: ['rift_collapse', 'rift_beam', 'slam', 'lunge', 'unwrite'], res: { arcane: 0.5 }, xp: 3000, gold: [900, 1400], drops: [['echo_shard', 1, 4, 8], ['hollow_ore', 1, 3, 6]], boss: true, tomes: ['sunder', 'chain_lightning', 'deadeye', 'arcane_missiles', 'second_wind', 'magma_spike', 'caltrops', 'quicksilver_flask', 'fast_exit'] },
  geode_horror: { tough: 2.2, name: 'Geode Horror', shape: 'brute', color: '#7a8ad0', hp: 800, atk: 26, def: 17, speed: 2.1, moves: ['smash', 'slam', 'rift_collapse'], res: { arcane: 0.6 }, xp: 1300, gold: [480, 780], drops: [['echo_shard', 1, 2, 4]], tomes: ['sunder', 'magma_spike', 'second_wind'] },
  fallen_knight: { name: 'Fallen Knight', shape: 'skeleton', color: '#8a8a9a', hp: 260, atk: 27, def: 18, speed: 2.4, moves: ['smash', 'claw', 'lunge'], res: { slash: 0.6, pierce: 0.7, blunt: 1.2, arcane: 1.1 }, xp: 380, gold: [130, 200], drops: [['steel_ingot', 0.25, 1, 2]], tomes: ['sunder', 'second_wind', 'caltrops'] },
  cursed_priest: { name: 'Cursed Priest', shape: 'witch', color: '#5a4a7a', hp: 200, atk: 28, def: 11, speed: 2.5, moves: ['nova', 'spit', 'rift_beam', 'sentence'], kite: 5.5, res: { arcane: 0.6, slash: 1.2 }, xp: 390, gold: [132, 206], drops: [['ink', 0.6, 2, 3], ['torn_page', 0.05, 1, 1]], tomes: ['arcane_missiles', 'chain_lightning', 'quicksilver_flask'] },
  gargoyle: { name: 'Gargoyle', shape: 'imp', color: '#6a6a72', hp: 280, atk: 27, def: 16, speed: 3.2, moves: ['claw', 'lunge', 'rift_beam'], res: { slash: 0.6, pierce: 0.6, blunt: 1.3 }, xp: 360, gold: [126, 196], drops: [['iron_ore', 0.6, 2, 4]], tomes: ['deadeye', 'fast_exit'] },
  dread_hound: { name: 'Dread Hound', shape: 'hound', color: '#3a2a3a', hp: 230, atk: 28, def: 13, speed: 3.6, moves: ['bite', 'lunge', 'claw'], res: { arcane: 1.2 }, xp: 370, gold: [128, 200], drops: [['hide', 0.6, 2, 4]] },
  citadel_lord: { tough: 2.4, name: 'The Citadel Lord', shape: 'warden', color: '#6a4a8a', hp: 2000, atk: 30, def: 20, speed: 2.4, moves: ['sentence', 'void_slam', 'rift_collapse', 'smash', 'unwrite', 'page_storm'], res: { arcane: 0.8 }, xp: 4500, gold: [1400, 2200], drops: [['steel_ingot', 1, 2, 4], ['echo_shard', 1, 2, 4], ['starmetal', 0.6, 1, 1]], boss: true, tomes: ['sunder', 'second_wind', 'chain_lightning', 'arcane_missiles', 'deadeye', 'caltrops', 'magma_spike', 'quicksilver_flask', 'fast_exit'] },
  death_knight: { tough: 2.4, name: 'Death Knight', shape: 'skeleton', color: '#4a3a5a', hp: 1100, atk: 29, def: 20, speed: 2.6, moves: ['smash', 'lunge', 'nova', 'void_slam'], res: { slash: 0.6, pierce: 0.6, arcane: 0.9 }, xp: 1800, gold: [700, 1100], drops: [['steel_ingot', 1, 1, 3]], tomes: ['sunder', 'second_wind', 'deadeye', 'chain_lightning'] },

};

// ── Maps / zones (geometry lives in world.js) ───────────────────────────────
export const ZONES = {
  town: { id: 'town', name: 'Lanternfall', realm: 'main', lvl: 0, safe: true, enemies: [] },
  quarry: { id: 'quarry', name: 'Whispering Quarry', realm: 'main', lvl: 1, enemies: ['rock_hound', 'cinder_imp', 'slag_brute'] },
  gloomwood: { id: 'gloomwood', name: 'Gloomwood', realm: 'main', lvl: 3, enemies: ['thorn_stag', 'mire_wisp', 'bramble_witch'] },
  archive: { id: 'archive', name: 'Drowned Archive', realm: 'main', lvl: 5, enemies: ['ink_wraith', 'page_eater'], boss: 'lectern_warden' },
  hollow_reach: { id: 'hollow_reach', name: 'Shadow Reach', realm: 'hollow', lvl: 7, enemies: ['hollow_wisp', 'husk', 'reflection'] },
  hollow_depths: { id: 'hollow_depths', name: 'The Depths', realm: 'hollow', lvl: 9, enemies: ['husk', 'hollow_wisp', 'reflection'], boss: 'the_unwritten' },
  root_cellar: { id: 'root_cellar', name: 'The Root Cellar', realm: 'main', lvl: 18, enemies: ['root_creeper'], boss: 'root_warden' },
  world_tree: { id: 'world_tree', name: "Yggdrasil's Crown", realm: 'main', lvl: 22, enemies: ['tree_thrall', 'root_creeper'], boss: 'withered_guardian' },
  sunken_vault: { id: 'sunken_vault', name: 'The Sunken Vault', realm: 'main', lvl: 0, safe: true, enemies: [] },
  void_rift: { id: 'void_rift', name: 'The Void Rift', realm: 'hollow', lvl: 22, enemies: ['void_stalker'], boss: 'rift_king' },
  greenmeadow: { id: 'greenmeadow', name: 'Greenmeadow', realm: 'main', lvl: 1, enemies: ['wild_boar', 'grey_wolf', 'bandit', 'giant_beetle'], boss: 'boar_king', elite: 'bandit_chief' },
  saltmere: { id: 'saltmere', name: 'Saltmere Coast', realm: 'main', lvl: 5, enemies: ['shore_crab', 'drowned_sailor', 'sea_wisp'], boss: 'tide_hag', elite: 'smuggler_captain' },
  ironhold: { id: 'ironhold', name: 'Ironhold Mines', realm: 'main', lvl: 4, enemies: ['cave_bat', 'mine_spider', 'rock_golem', 'kobold_miner'], boss: 'foreman_gor', elite: 'golem_elder' },
  mistfen: { id: 'mistfen', name: 'Mistfen Marsh', realm: 'main', lvl: 6, enemies: ['bog_lurker', 'mire_shambler', 'swamp_witch', 'giant_toad', 'will_o_wisp'], boss: 'hag_queen', elite: 'moss_troll' },
  sunscorch: { id: 'sunscorch', name: 'Sunscorch Dunes', realm: 'main', lvl: 9, enemies: ['sand_scorpion', 'dune_wraith', 'mummy', 'cactus_imp'], boss: 'sandworm', elite: 'sand_pharaoh' },
  frostpeak: { id: 'frostpeak', name: 'Frostpeak Highlands', realm: 'main', lvl: 12, enemies: ['frost_wolf', 'ice_wisp', 'yeti', 'frozen_knight'], boss: 'frost_giant', elite: 'ice_queen' },
  emberwaste: { id: 'emberwaste', name: 'The Emberwaste', realm: 'main', lvl: 15, enemies: ['ember_imp', 'magma_hound', 'obsidian_golem', 'fire_wisp'], boss: 'magma_lord', elite: 'lava_drake' },
  crystal_caverns: { id: 'crystal_caverns', name: 'Crystal Caverns', realm: 'main', lvl: 17, enemies: ['shard_bat', 'gem_spider', 'crystal_golem', 'prism_wisp'], boss: 'prism_wyrm', elite: 'geode_horror' },
  goblin_warrens_1: { id: 'goblin_warrens_1', name: 'Goblin Warrens — Upper', realm: 'main', lvl: 3, dungeon: true, enemies: ['kobold_miner', 'cave_bat', 'mine_spider', 'bandit'], elite: 'goblin_shaman' },
  goblin_warrens_2: { id: 'goblin_warrens_2', name: 'Goblin Warrens — Throne', realm: 'main', lvl: 5, dungeon: true, enemies: ['kobold_miner', 'mine_spider', 'bandit', 'rock_golem'], boss: 'goblin_king', elite: 'goblin_shaman' },
  sunken_crypt_1: { id: 'sunken_crypt_1', name: 'Sunken Crypt — Nave', realm: 'main', lvl: 8, dungeon: true, enemies: ['drowned_sailor', 'bog_lurker', 'will_o_wisp', 'mummy'], elite: 'wailing_wraith' },
  sunken_crypt_2: { id: 'sunken_crypt_2', name: 'Sunken Crypt — Ossuary', realm: 'main', lvl: 10, dungeon: true, enemies: ['drowned_sailor', 'mummy', 'will_o_wisp', 'mire_shambler'], boss: 'crypt_lord', elite: 'wailing_wraith' },
  frozen_catacombs_1: { id: 'frozen_catacombs_1', name: 'Frozen Catacombs — Halls', realm: 'main', lvl: 13, dungeon: true, enemies: ['frozen_knight', 'ice_wisp', 'frost_wolf', 'yeti'], elite: 'bone_colossus' },
  frozen_catacombs_2: { id: 'frozen_catacombs_2', name: 'Frozen Catacombs — Ice Throne', realm: 'main', lvl: 15, dungeon: true, enemies: ['frozen_knight', 'ice_wisp', 'frost_wolf', 'yeti'], boss: 'lich_king', elite: 'bone_colossus' },
  magma_depths_1: { id: 'magma_depths_1', name: 'Magma Depths — Forges', realm: 'main', lvl: 17, dungeon: true, enemies: ['magma_hound', 'ember_imp', 'obsidian_golem', 'fire_wisp'], elite: 'fire_drake' },
  magma_depths_2: { id: 'magma_depths_2', name: 'Magma Depths — Furnace', realm: 'main', lvl: 19, dungeon: true, enemies: ['magma_hound', 'ember_imp', 'obsidian_golem', 'fire_wisp'], boss: 'infernal_warden', elite: 'fire_drake' },
  guild_raid: { id: 'guild_raid', name: "The Titan's Crucible (Guild Raid)", realm: 'main', lvl: 22, enemies: [], boss: 'obsidian_titan' },
  raid_bastion: { id: 'raid_bastion', name: 'Cinderhold Bastion (Raid)', realm: 'main', lvl: 22, enemies: [], boss: 'ember_tyrant' },
  ruined_citadel: { id: 'ruined_citadel', name: 'The Ruined Citadel', realm: 'main', lvl: 20, enemies: ['fallen_knight', 'cursed_priest', 'gargoyle', 'dread_hound'], boss: 'citadel_lord', elite: 'death_knight' },
};
Object.assign(ENEMIES, NEW_ENEMIES); Object.assign(ZONES, NEW_ZONES);   // the endgame regions (src/content2.js)


// Resource nodes by type
export const NODE_TYPES = {
  ore: { name: 'Iron Vein', icon: '', item: 'iron_ore', qty: [2, 4], ms: 1600, respawn: 45 },
  coal: { name: 'Coal Seam', icon: '', item: 'coal', qty: [2, 4], ms: 1400, respawn: 40 },
  herb: { name: 'Marrow Herbs', icon: '', item: 'herb', qty: [2, 4], ms: 1200, respawn: 35 },
  hide: { name: 'Carcass', icon: '', item: 'hide', qty: [1, 3], ms: 1200, respawn: 50 },
  shelf: { name: 'Sodden Shelf', icon: '', item: 'parchment', qty: [1, 3], ms: 1500, respawn: 45, bonus: [['ink', 0.35, 1, 2], ['torn_page', 0.05, 1, 1]] },
  hollow_ore: { name: 'Shadow Vein', icon: '', item: 'hollow_ore', qty: [1, 3], ms: 2200, respawn: 70 },
  ghostbloom: { name: 'Ghostbloom', icon: '', item: 'ghostbloom', qty: [1, 3], ms: 1800, respawn: 60 },
  sunsteel: { name: 'Sunsteel Vein', icon: '', item: 'sunsteel_ore', qty: [1, 3], ms: 2200, respawn: 60 },
  frostbloom: { name: 'Frostbloom', icon: '', item: 'frostbloom', qty: [1, 3], ms: 1600, respawn: 55 },
  echo: { name: 'Echo Crystal', icon: '', item: 'echo_shard', qty: [1, 2], ms: 2400, respawn: 90 },
};
buildGearSets(ITEMS, RECIPES, NODE_TYPES);   // the full gear grid (every class, seven metal tiers), new ores, recipes and honest prices


// ── Hidden-content journal hints (progressive, cryptic) ─────────────────────
export const HINTS = [
  { id: 'h_page1', text: 'A torn page, damp and inked in a hand that is not quite handwriting: "…the Lectern remembers who reads…"', cond: (p) => p.stats.pagesFound >= 1 },
  { id: 'h_page2', text: 'Two pages now. The margins are full of tallies — dice tallies. Something in the Drowned Archive wants these returned.', cond: (p) => p.stats.pagesFound >= 2 },
  { id: 'h_forge1', text: 'The slag in the Quarry has a cold pocket where it should be hot. Smelting a great deal of iron might draw attention.', cond: (p) => p.stats.ingots >= 6 },
  { id: 'h_forge2', text: 'You uncovered a Cold Forge behind the slag. It wants something that fell from the sky.', cond: (p) => p.flags.coldForge },
  { id: 'h_gamble1', text: 'Odd: you won a fight while one blow from death. A stranger would pay to see more of that.', cond: (p) => p.stats.lowSpWins >= 2 },
  { id: 'h_gamble2', text: 'The Tavern has a corner table nobody sits at — unless they have fought on at a sliver of health, again and again.', cond: (p) => p.stats.lowSpWins >= 5 },
  { id: 'h_broker1', text: 'Your margins are noticed. Someone in the Exchange has been watching your sales.', cond: (p) => p.stats.profit >= 250 },
  { id: 'h_broker2', text: 'A veiled figure waits in the Exchange hall for those who both profit and persuade.', cond: (p) => p.stats.profit >= 500 && p.stats.haggleWins >= 5 },
  { id: 'h_brew1', text: 'A perfect batch fills five bottles. The cauldron hums as if it wants to be asked for more.', cond: (p) => p.stats.perfectBrews >= 1 },
  { id: 'h_hollow1', text: 'Starmetal, a gate that will not open for anyone, and a key no one has ever made. The Archive\'s northern door is sealed — but a Blacksmith could cut a key.', cond: (p) => p.flags.coldForge || p.stats.starmetalFound >= 1 },
  { id: 'h_hollow2', text: 'You stepped through the gate. The Shadowfell mirrors Lanternfall the way a pond mirrors a face: close, wet, and wrong. Your mana drains a little every few seconds you stay.', cond: (p) => p.stats.hollowVisits >= 1 },
  { id: 'h_hollow3', text: 'Something here wears your face. Shades fight as you do — only a little better.', cond: (p) => p.stats.reflectionsSlain >= 1 },
  { id: 'h_titan', text: 'The Cold Forge hums when you pass now, the way an old dog does when a familiar boot walks by. It wants more shards than you carry — and a great deal more skill.', cond: (p) => ['blacksmith', 'soulsmith'].includes(p.classId) && p.stats.masterworks >= 12 },
  { id: 'h_phil', text: 'Twelve perfect pots. The ground behind the cauldron smells faintly of something that is not herbs.', cond: (p) => ['alchemist', 'transmuter'].includes(p.classId) && p.stats.perfectBrews >= 12 },
  { id: 'h_gild', text: 'The Exchange clerk looks at you a beat too long. Under the market there is a vault, and it knows what your ledger says.', cond: (p) => ['merchant', 'broker'].includes(p.classId) && p.stats.profit >= 4000 },
  { id: 'h_transmute', text: 'A Shadow husk leaked something that is not blood. The Alchemist\'s hut might know what to do with Ichor — if the cauldron already trusts you.', cond: (p) => p.stats.ichor >= 1 },
];

export const RUMORS = [
  'A drunk quarryman swears the slag goes cold when you smelt too much. "Forges remember, friend."',
  'A scribe at the corner table whispers that the Drowned Archive drops its torn pages only from the things that read.',
  'The innkeeper: "Folk who win while they\'re at death\'s door… they get offers. Ask no questions."',
  'A merchant mutters about a veiled Broker who only appears to those who turn a real profit.',
  'A gambler laughs: "Heads or tails, it\'s all the same to me" and tosses a coin that never lands.',
  'Dockhands say starmetal falls like rain on cold forges. Nowhere else.',
  'An old caravaneer: "There\'s a second Lanternfall, you know. Everything costs more there — and it sells things we can\'t get here."',
  'Someone carved into the bar: "THE GATE OPENS FOR KEY-BEARERS. THE KEY IS FORGED, NOT FOUND."',
  'A pale alchemist: "Bring Lantern Salve. The Shadowfell sips your mana, minute by minute."',
  'A child in the market hums a song with no end: "Under the well, the root remembers. Only when the lamps are lit."',
  'A drunk digger swears the Quarry wall in the far south-west sweats where an old vault sleeps. "Knock where it is dampest."',
  'The gravedigger in Gloomwood: "The Ringer was buried without his bell. Only the night people ask where it went."',
  'A Shadowfell whisper: "Five echoes make a door. Nobody has ever come back with the second half of the sentence."',
  'A tinker, to nobody: "The Cold Forge wants a heart. A titan\'s. Or a very good copy."',
  'The Brewmaster, muttering: "The Stone is not found. It is cooked. Fifteen perfect pots, then ask the paving."',
  'The Exchange clerk: "There is a vault under every market. Ours is for those the market has noticed. Bring a great deal of gilt."',
];
