// ─────────────────────────────────────────────────────────────────────────────
// SKILL LIBRARY — every skill a class may learn, and where it comes from.
//   src 'level'  learned automatically at a character level          (lvl)
//   src 'path'   learned once you ASCEND into a path (and ranked by level)
//   src 'mastery' the ultimate of a Tier-2 mastery
//   src 'tome'   learned by reading a Skill Tome dropped by enemies
//   src 'hidden' learned from hidden quests and hidden places
//   src 'mythic' skills of a one-of-a-kind mythic class
// `cls` lists the classes allowed to equip it. Only 4 can be equipped at a time.
// ─────────────────────────────────────────────────────────────────────────────
const sk = (id, name, kind, cls, o = {}) => ({ id, name, kind, cls: Array.isArray(cls) ? cls : [cls], cd: 0, cast: 0, type: 'slash', ...o });
const W = 'warrior', M = 'mage', A = 'archer', B = 'blacksmith', AL = 'alchemist', ME = 'merchant';

export const EXTRA_SKILLS = {};
const add = (...list) => { for (const s of list) EXTRA_SKILLS[s.id] = s; };

// ── level extras (the base four are declared in data.js) ───────────────────
add(
  sk('shield_bash', 'Shield Bash', 'melee', W, { src: 'level', lvl: 9, power: 16, cd: 7000, cast: 140, range: 1.7, arc: 80, stun: 1200, type: 'blunt', g: 'shield', desc: 'A short, brutal bash that stuns whatever it hits.' }),
  sk('war_leap', 'War Leap', 'dash', W, { src: 'level', lvl: 12, dist: 4.4, cd: 9000, iframes: 400, land: { power: 24, radius: 1.6, stun: 700 }, type: 'blunt', g: 'wind', desc: 'Leap forward and crash down, stunning what you land on.' }),
  sk('battle_cry', 'Battle Cry', 'buff', W, { src: 'level', lvl: 16, cd: 18000, dur: 9000, buff: { dmg: 0.25, red: 0.15 }, radius: 5, g: 'sun', desc: 'Roar: +25% damage and 15% less damage taken for 9s.' }),
  sk('whirlwind', 'Whirlwind', 'melee', W, { src: 'level', lvl: 20, power: 14, hits: 5, interval: 150, cd: 11000, cast: 120, range: 2.1, arc: 360, g: 'wind', desc: 'Spin in place, cutting everything around you five times.' }),
  sk('executioner', 'Executioner', 'melee', W, { src: 'level', lvl: 25, power: 58, cd: 10000, cast: 420, range: 2.3, arc: 100, exec: 1, g: 'skull', desc: 'A slow killing blow. Deals double damage to enemies below 30% health.' }),
  sk('frost_nova', 'Frost Nova', 'aoe', M, { src: 'level', lvl: 9, power: 18, cd: 8000, cast: 250, radius: 2.7, at: 'self', slow: 2800, type: 'arcane', g: 'frost', col: '#9ad8ff', desc: 'A burst of cold that slows everything near you.' }),
  sk('chain_bolt', 'Chain Bolt', 'proj', M, { src: 'level', lvl: 12, power: 26, count: 1, speed: 19, range: 11, radius: 0.3, pierce: 4, cd: 4500, cast: 200, type: 'arcane', g: 'bolt', col: '#ffe36b', desc: 'A crackling bolt that pierces up to four targets.' }),
  sk('mana_barrier', 'Mana Barrier', 'heal', M, { src: 'level', lvl: 16, shield: 90, cd: 16000, dur: 6000, g: 'shield', desc: 'A heavy aether barrier absorbs a great deal of damage.' }),
  sk('starfall', 'Starfall', 'aoe', M, { src: 'level', lvl: 20, power: 70, cd: 14000, cast: 900, radius: 3.0, range: 9, at: 'cursor', type: 'arcane', g: 'star', col: '#ffe9a8', desc: 'Call a star down on the target area.' }),
  sk('arcane_haste', 'Arcane Haste', 'buff', M, { src: 'level', lvl: 25, cd: 20000, dur: 8000, buff: { dmg: 0.3, mpRegen: 3 }, radius: 0, g: 'bolt', desc: '+30% damage and rapid mana recovery for 8s.' }),
  sk('poison_dart', 'Poison Dart', 'proj', A, { src: 'level', lvl: 9, power: 18, count: 1, speed: 20, range: 10, radius: 0.24, cd: 4000, cast: 120, slow: 1800, type: 'pierce', g: 'leaf', col: '#8be06a', desc: 'A dart that slows its target.' }),
  sk('snare_trap', 'Snare Trap', 'trap', A, { src: 'level', lvl: 12, power: 24, cd: 10000, cast: 200, range: 6, radius: 1.6, stun: 2000, dur: 20000, type: 'pierce', g: 'fang', desc: 'Set a hidden trap. The first enemy to step on it is held for 2s.' }),
  sk('rain_of_arrows', 'Rain of Arrows', 'aoe', A, { src: 'level', lvl: 16, power: 9, cd: 13000, cast: 300, radius: 2.7, range: 9, at: 'cursor', dot: { ticks: 8, every: 400, k: 'arrows' }, type: 'pierce', g: 'wind', desc: 'A storm of arrows falls for over 3 seconds.' }),
  sk('hunters_focus', "Hunter's Focus", 'buff', A, { src: 'level', lvl: 20, cd: 18000, dur: 8000, buff: { dmg: 0.25, crit: 0.3 }, radius: 0, g: 'eye', desc: '+25% damage and +30% crit chance for 8s.' }),
  sk('piercing_gale', 'Piercing Gale', 'proj', A, { src: 'level', lvl: 25, power: 36, count: 3, spread: 10, speed: 22, range: 14, radius: 0.3, pierce: 6, cd: 12000, cast: 350, type: 'pierce', g: 'wind', desc: 'Three arrows that pass through almost everything.' }),
  sk('anvil_drop', 'Anvil Drop', 'aoe', B, { src: 'level', lvl: 9, power: 36, cd: 9000, cast: 700, radius: 1.9, range: 5, at: 'cursor', stun: 1400, type: 'blunt', g: 'anvil', desc: 'Drop an anvil on a target area.' }),
  sk('forge_fury', 'Forge Fury', 'buff', B, { src: 'level', lvl: 14, cd: 18000, dur: 8000, buff: { dmg: 0.3, red: 0.2 }, radius: 0, g: 'flame', desc: 'The fire in your veins: +30% damage, 20% less damage taken.' }),
  sk('temper', 'Temper', 'guard', B, { src: 'level', lvl: 19, cd: 14000, dur: 3500, red: 0.85, reflect: 0.3, type: 'blunt', g: 'anvil', desc: 'Harden like quenched steel: 85% less damage, reflects 30%.' }),
  sk('stink_bomb', 'Stink Bomb', 'proj', AL, { src: 'level', lvl: 9, power: 24, count: 1, speed: 9, range: 8, radius: 0.35, aoe: 1.7, slow: 2000, cd: 6000, cast: 150, type: 'arcane', g: 'drop', col: '#9ae06a', desc: 'A foul flask: bursts and slows.' }),
  sk('elixir_vigor', 'Elixir of Vigor', 'buff', AL, { src: 'level', lvl: 14, cd: 18000, dur: 8000, buff: { dmg: 0.2, regen: 0.04 }, radius: 0, g: 'drop', col: '#ff8aa8', desc: '+20% damage and steady regeneration for 8s.' }),
  sk('plague_cloud', 'Plague Cloud', 'aoe', AL, { src: 'level', lvl: 19, power: 8, cd: 14000, cast: 300, radius: 2.5, range: 7, at: 'cursor', dot: { ticks: 10, every: 400, k: 'poison' }, type: 'arcane', g: 'skull', col: '#9ae06a', desc: 'A lingering cloud that eats away at everything in it.' }),
  sk('coin_barrage', 'Coin Barrage', 'proj', ME, { src: 'level', lvl: 9, power: 9, count: 9, spread: 70, speed: 14, range: 8, radius: 0.24, cd: 6500, cast: 120, type: 'pierce', g: 'coin', desc: 'A wide shower of coins.' }),
  sk('golden_ward', 'Golden Ward', 'heal', ME, { src: 'level', lvl: 14, shield: 80, cd: 14000, dur: 5000, g: 'coin', desc: 'Gilt-plated protection absorbs damage.' }),
  sk('bribe', 'Bribe', 'aoe', ME, { src: 'level', lvl: 19, power: 10, cd: 15000, cast: 300, radius: 2.1, range: 7, at: 'cursor', stun: 2500, type: 'pierce', g: 'coin', desc: 'Pay enemies to stand still for a moment.' }),
);

// ── Skill Tomes (dropped by enemies; usable only by the classes listed) ─────
add(
  sk('sunder', 'Sunder', 'melee', W, { src: 'tome', power: 26, cd: 8000, cast: 220, range: 2.0, arc: 90, vulnHit: { v: 0.3, ms: 6000 }, g: 'skull', desc: 'A heavy cut that leaves the target 30% more vulnerable for 6s.' }),
  sk('second_wind', 'Second Wind', 'heal', W, { src: 'tome', heal: 0.3, cd: 20000, g: 'sun', desc: 'Catch your breath: restore 30% of your health.' }),
  sk('chain_lightning', 'Chain Lightning', 'proj', M, { src: 'tome', power: 34, count: 1, speed: 26, range: 13, radius: 0.3, pierce: 6, cd: 6000, cast: 250, type: 'arcane', g: 'bolt', col: '#9ad8ff', desc: 'A bolt of lightning that pierces six targets.' }),
  sk('arcane_missiles', 'Arcane Missiles', 'proj', M, { src: 'tome', power: 14, count: 6, spread: 20, speed: 15, range: 10, radius: 0.24, cd: 7000, cast: 200, type: 'arcane', g: 'star', desc: 'Six homing-ish missiles in a tight cone.' }),
  sk('deadeye', 'Deadeye', 'proj', A, { src: 'tome', power: 50, count: 1, speed: 28, range: 16, radius: 0.26, pierce: 1, cd: 9000, cast: 500, type: 'pierce', fx: { crit: 1 }, g: 'eye', desc: 'A perfectly aimed shot that always crits.' }),
  sk('caltrops', 'Caltrops', 'aoe', A, { src: 'tome', power: 6, cd: 11000, cast: 150, radius: 2.4, at: 'self', slow: 3500, type: 'pierce', g: 'fang', desc: 'Scatter spikes that slow everyone near you.' }),
  sk('magma_spike', 'Magma Spike', 'aoe', B, { src: 'tome', power: 55, cd: 10000, cast: 600, radius: 1.9, range: 7, at: 'cursor', type: 'arcane', g: 'flame', desc: 'Molten rock erupts at the target.' }),
  sk('quicksilver_flask', 'Quicksilver Flask', 'proj', AL, { src: 'tome', power: 40, count: 1, speed: 10, range: 9, radius: 0.35, aoe: 2.2, stun: 1000, cd: 9000, cast: 200, type: 'arcane', g: 'drop', col: '#d8e8ff', desc: 'A flask of living metal that stuns on bursting.' }),
  sk('fast_exit', 'Fast Exit', 'dash', ME, { src: 'tome', dist: 5.0, back: true, cd: 12000, iframes: 500, stealth: 2500, g: 'wind', desc: 'Everyone has a price. Yours is to be somewhere else.' }),
);

// ── Hidden-quest skills: two per class (quest A: Sunken Vault, quest B: The Silent Bell) ──
const HID = {
  [W]: [['phantom_edge', 'Phantom Edge', 'proj', { power: 48, count: 1, speed: 20, range: 9, radius: 0.5, pierce: 5, cd: 6000, cast: 220, type: 'slash', g: 'void', desc: 'Loose the memory of a blade as a wave of force.' }], ['dragon_dance', 'Dragon Dance', 'melee', { power: 20, hits: 7, interval: 120, cd: 14000, cast: 100, range: 2.4, arc: 200, g: 'wind', desc: 'Seven rapid cuts in a wide dancing arc.' }]],
  [M]: [['singularity', 'Singularity', 'aoe', { power: 60, cd: 20000, cast: 1000, radius: 2.4, range: 9, at: 'cursor', stun: 2000, type: 'arcane', g: 'void', desc: 'Fold space at the target: massive damage and a long stun.' }], ['mirror_image', 'Mirror Image', 'dash', { dist: 3.0, cd: 9000, iframes: 900, land: { power: 30, radius: 2.2 }, type: 'arcane', g: 'star', desc: 'Step out of the way as your reflection explodes.' }]],
  [A]: [['spirit_volley', 'Spirit Volley', 'proj', { power: 22, count: 5, spread: 30, speed: 17, range: 12, radius: 0.28, pierce: 3, cd: 9000, cast: 300, type: 'pierce', g: 'eye', desc: 'Five spectral arrows that pass through foes.' }], ['wind_walk', 'Wind Walk', 'dash', { dist: 6.0, cd: 8000, iframes: 600, stealth: 1800, g: 'wind', desc: 'Run on the wind: a very long dash that hides you briefly.' }]],
  [B]: [['starforged_slam', 'Starforged Slam', 'aoe', { power: 80, cd: 16000, cast: 800, radius: 3.0, at: 'self', stun: 1500, type: 'blunt', g: 'star', desc: 'Slam the ground with the weight of a fallen star.' }], ['living_flame', 'Living Flame', 'buff', { cd: 22000, dur: 9000, buff: { dmg: 0.35, ls: 0.15 }, radius: 0, g: 'flame', desc: 'Let the forge move through you: +35% damage and 15% lifesteal.' }]],
  [AL]: [['philosophers_flask', "Philosopher's Flask", 'proj', { power: 70, count: 1, speed: 10, range: 9, radius: 0.4, aoe: 2.5, cd: 12000, cast: 250, type: 'arcane', fx: { lifesteal: 0.4 }, g: 'drop', col: '#ffd36a', desc: 'A flask of liquid gold that drains what it burns.' }], ['grand_elixir', 'Grand Elixir', 'heal', { heal: 0.5, cd: 26000, g: 'drop', desc: 'Drink the best thing you ever brewed: restore half your health.' }]],
  [ME]: [['market_crash', 'Market Crash', 'mark', { radius: 7, cd: 24000, dur: 8000, vuln: 0.5, g: 'coin', desc: 'Everything is worth less: all nearby enemies take 50% more damage.' }], ['hostile_takeover', 'Hostile Takeover', 'aoe', { power: 50, cd: 15000, cast: 500, radius: 2.4, range: 8, at: 'cursor', stun: 1800, type: 'pierce', g: 'coin', desc: 'A very rude acquisition.' }]],
};
for (const [cls, list] of Object.entries(HID)) list.forEach(([id, name, kind, o], i) => add(sk(id, name, kind, cls, { src: 'hidden', hq: i === 0 ? 'vault' : 'bell', ...o })));

// ── Paths (Ascension). 4 skills per fighter path, 2 per trade path, plus one ultimate per mastery. ─────────────
// mods are multipliers; perk are class-specific systems hooks (crafting / economy).
export const PATHS = {};
const path = (id, cls, name, color, blurb, mods, kit, basic, masteries, perk = {}) => { PATHS[id] = { id, cls, name, color, blurb, mods, kit, basic, masteries, perk }; };
const ps = (pid, cls, id, name, kind, o) => add(sk(id, name, kind, cls, { src: 'path', path: pid, ...o }));
const ult = (pid, mid, cls, id, name, kind, o) => add(sk(id, name, kind, cls, { src: 'mastery', path: pid, mastery: mid, ...o }));

// WARRIOR ─────────────────────────────────────────────────────────────────
path('mana_sword', W, 'Mana Sword', '#7fa8ff', 'A blade wrapped in spellfire. Every cut hits twice — once as steel, once as magic — and your mana pool is vast.',
  { hp: 0.94, atk: 1.04, def: 0.92, move: 1.04, mp: 1.7, mpRegen: 1.7, dmg: 1 },
  [['arc_wave', 8], ['spell_step', 8], ['rune_edge', 10], ['aether_bloom', 12]],
  { name: 'Mana Slash', power: 10, cd: 400, range: 1.8, arc: 110, type: 'slash', mag: 0.45, fx: { mpOnHit: 2 }, combo: 'spell' },
  [{ id: 'runeblade', name: 'Runeblade', desc: 'All-in on the blade: +14% damage, Blade Storm ultimate.', mods: { dmg: 1.14, atk: 1.04 }, ult: 'blade_storm' },
   { id: 'aether_knight', name: 'Aether Knight', desc: 'Armoured in light: +15% defence, +25% HP, Mana Aegis ultimate.', mods: { def: 1.15, hp: 1.25 }, ult: 'mana_aegis' }]);
ps('mana_sword', W, 'arc_wave', 'Arc Wave', 'proj', { lvl: 8, power: 26, count: 1, speed: 15, range: 8, radius: 0.55, pierce: 3, cd: 3500, cast: 180, type: 'arcane', g: 'bolt', col: '#9ad8ff', desc: 'Throw a crescent of mana from your blade. Pierces three.' });
ps('mana_sword', W, 'spell_step', 'Spell Step', 'dash', { lvl: 8, dist: 3.6, cd: 5000, iframes: 350, land: { power: 20, radius: 1.5 }, type: 'arcane', g: 'wind', desc: 'Blink forward, detonating where you land.' });
ps('mana_sword', W, 'rune_edge', 'Rune Edge', 'buff', { lvl: 10, cd: 14000, dur: 8000, buff: { dmg: 0.35, ls: 0.08 }, radius: 0, g: 'star', desc: 'Runes flare along the blade: +35% damage and 8% lifesteal for 8s.' });
ps('mana_sword', W, 'aether_bloom', 'Aether Bloom', 'aoe', { lvl: 12, power: 46, cd: 10000, cast: 500, radius: 2.7, at: 'self', type: 'arcane', g: 'star', desc: 'A ring of unleashed mana erupts around you.' });
ult('mana_sword', 'runeblade', W, 'blade_storm', 'Blade Storm', 'melee', { power: 15, hits: 9, interval: 130, cd: 16000, cast: 150, range: 2.6, arc: 360, type: 'arcane', mag: 0.6, g: 'wind', desc: 'A whirling storm of runic cuts, nine of them.' });
ult('mana_sword', 'aether_knight', W, 'mana_aegis', 'Mana Aegis', 'heal', { shield: 150, cd: 20000, dur: 7000, buff: { dmg: 0.2 }, g: 'shield', desc: 'A massive barrier, and your strikes hit harder behind it.' });

path('brute', W, 'Brute', '#d08a3a', 'Slow, enormous swings with a long reach and a thick hide. Everything you hit moves; everything that hits you regrets it.',
  { hp: 1.38, atk: 1.16, def: 1.05, move: 0.9, mp: 0.9, mpRegen: 1, dmg: 1 },
  [['ground_pound', 8], ['boulder_hurl', 8], ['bellow', 10], ['earthbreaker', 12]],
  { name: 'Haymaker', power: 24, cd: 1100, range: 2.8, arc: 80, type: 'blunt', fx: { knock: 0.7 }, combo: 'heavy' },
  [{ id: 'titan', name: 'Titan', desc: 'Even bigger: +20% HP, Titanfall ultimate.', mods: { hp: 1.2, def: 1.1 }, ult: 'titanfall' },
   { id: 'warbringer', name: 'Warbringer', desc: 'Pure aggression: +18% damage, Reaping Sweep ultimate.', mods: { dmg: 1.18 }, ult: 'reaping_sweep' }]);
ps('brute', W, 'ground_pound', 'Ground Pound', 'aoe', { lvl: 8, power: 40, cd: 7000, cast: 700, radius: 2.5, at: 'self', stun: 1000, type: 'blunt', g: 'anvil', desc: 'Pound the earth. Stuns everything around you.' });
ps('brute', W, 'boulder_hurl', 'Boulder Hurl', 'proj', { lvl: 8, power: 44, count: 1, speed: 9, range: 9, radius: 0.5, aoe: 1.3, cd: 8000, cast: 600, type: 'blunt', g: 'skull', desc: 'Heave a boulder. It bursts on impact.' });
ps('brute', W, 'bellow', 'Bellow', 'taunt', { lvl: 10, radius: 5.5, cd: 12000, dur: 5000, red: 0.4, g: 'sun', desc: 'A challenge no enemy ignores. Take 40% less damage while they come.' });
ps('brute', W, 'earthbreaker', 'Earthbreaker', 'aoe', { lvl: 12, power: 78, cd: 14000, cast: 1000, radius: 2.4, range: 3.4, at: 'cursor', stun: 1600, type: 'blunt', g: 'anvil', desc: 'A shattering overhead blow that cracks the ground.' });
ult('brute', 'titan', W, 'titanfall', 'Titanfall', 'dash', { dist: 5.0, cd: 18000, iframes: 700, land: { power: 95, radius: 2.8, stun: 1800 }, type: 'blunt', g: 'anvil', desc: 'Leap and land like a falling mountain.' });
ult('brute', 'warbringer', W, 'reaping_sweep', 'Reaping Sweep', 'melee', { power: 64, cd: 12000, cast: 600, range: 3.6, arc: 360, type: 'slash', fx: { knock: 0.8 }, g: 'skull', desc: 'One enormous full-circle sweep.' });

path('bulwark', W, 'Bulwark', '#8ab0d0', 'The wall that does not break. Taunt the room, hold the line and keep your party alive.',
  { hp: 1.25, atk: 0.92, def: 1.4, move: 0.96, mp: 1.1, mpRegen: 1.2, dmg: 1 },
  [['challenge', 8], ['shield_charge', 8], ['iron_wall', 10], ['rally', 12]],
  { name: 'Shield Bash', power: 8, cd: 520, range: 1.6, arc: 90, type: 'blunt', combo: 'bash' },
  [{ id: 'paragon', name: 'Paragon', desc: 'The unbreakable: Last Stand ultimate and +20% HP.', mods: { hp: 1.2 }, ult: 'last_stand' },
   { id: 'warden', name: 'Warden', desc: 'The judge: +12% damage and Judgement ultimate.', mods: { dmg: 1.12, atk: 1.06 }, ult: 'judgement' }]);
ps('bulwark', W, 'challenge', 'Challenge', 'taunt', { lvl: 8, radius: 5.5, cd: 9000, dur: 5000, red: 0.4, g: 'sun', desc: 'Pull every nearby enemy onto you; take 40% less damage.' });
ps('bulwark', W, 'shield_charge', 'Shield Charge', 'dash', { lvl: 8, dist: 4.0, cd: 8000, iframes: 300, land: { power: 20, radius: 1.4, stun: 800 }, type: 'blunt', g: 'shield', desc: 'Charge forward and stun whoever you hit.' });
ps('bulwark', W, 'iron_wall', 'Iron Wall', 'guard', { lvl: 10, cd: 10000, dur: 3500, red: 0.8, reflect: 0.4, type: 'blunt', g: 'shield', desc: '80% damage reduction for 3.5s, reflecting 40%.' });
ps('bulwark', W, 'rally', 'Rally', 'heal', { lvl: 12, heal: 0.25, party: 7, cd: 16000, g: 'sun', desc: 'Heal yourself and nearby party members for 25%.' });
ult('bulwark', 'paragon', W, 'last_stand', 'Last Stand', 'guard', { red: 0.9, dur: 4000, reflect: 0.5, heal: 0.3, cd: 26000, type: 'blunt', g: 'shield', desc: '90% damage reduction for 4s and a 30% heal.' });
ult('bulwark', 'warden', W, 'judgement', 'Judgement', 'aoe', { power: 56, cd: 15000, cast: 700, radius: 3.0, at: 'self', stun: 2200, type: 'blunt', g: 'sun', desc: 'A stunning shockwave of righteous force.' });

// MAGE ───────────────────────────────────────────────────────────────────
path('pyromancer', M, 'Pyromancer', '#ff7a3a', 'Everything burns. Fireballs, burning ground and a very bad day for crowds.',
  { hp: 0.96, atk: 1.12, def: 0.9, move: 1, mp: 1.2, mpRegen: 1.2, dmg: 1 },
  [['fireball', 8], ['inferno_ring', 8], ['flame_step', 10], ['meteor', 12]],
  { name: 'Fire Bolt', power: 12, cd: 460, speed: 12, range: 9, radius: 0.28, type: 'arcane', aoe: 0.8, col: '#ff8a3a' },
  [{ id: 'infernalist', name: 'Infernalist', desc: 'Everything burns longer: Pyroclasm ultimate.', mods: { dmg: 1.12 }, ult: 'pyroclasm' },
   { id: 'phoenix', name: 'Phoenix', desc: 'Reborn in fire: +20% HP, Rebirth ultimate.', mods: { hp: 1.2, mpRegen: 1.3 }, ult: 'rebirth' }]);
ps('pyromancer', M, 'fireball', 'Fireball', 'proj', { lvl: 8, power: 36, count: 1, speed: 11, range: 10, radius: 0.4, aoe: 1.7, cd: 4000, cast: 300, type: 'arcane', g: 'flame', col: '#ff8a3a', desc: 'A big fireball that explodes on impact.' });
ps('pyromancer', M, 'inferno_ring', 'Inferno Ring', 'aoe', { lvl: 8, power: 9, cd: 9000, cast: 350, radius: 2.6, at: 'self', dot: { ticks: 8, every: 400, k: 'fire' }, type: 'arcane', g: 'flame', desc: 'Set the ground around you ablaze.' });
ps('pyromancer', M, 'flame_step', 'Flame Step', 'dash', { lvl: 10, dist: 4.0, cd: 6000, iframes: 350, land: { power: 22, radius: 1.5 }, type: 'arcane', g: 'flame', desc: 'Vanish in a burst of flame and reappear with a bang.' });
ps('pyromancer', M, 'meteor', 'Meteor', 'aoe', { lvl: 12, power: 84, cd: 15000, cast: 1100, radius: 2.7, range: 9, at: 'cursor', type: 'arcane', g: 'flame', desc: 'Call down a meteor. Slow, and devastating.' });
ult('pyromancer', 'infernalist', M, 'pyroclasm', 'Pyroclasm', 'aoe', { power: 12, cd: 22000, cast: 900, radius: 4.2, range: 9, at: 'cursor', dot: { ticks: 14, every: 400, k: 'fire' }, type: 'arcane', g: 'flame', desc: 'A vast field of fire that burns for nearly six seconds.' });
ult('pyromancer', 'phoenix', M, 'rebirth', 'Rebirth', 'aoe', { power: 70, cd: 26000, cast: 500, radius: 3.2, at: 'self', heal: 0.45, type: 'arcane', g: 'flame', desc: 'Burst into fire: damage everything nearby and restore 45% health.' });

path('warlock', M, 'Warlock', '#a050c0', 'Pay in blood, take in blood. Drain life, curse the strong and stay alive on what others lose.',
  { hp: 1.12, atk: 1.06, def: 0.95, move: 1, mp: 1.1, mpRegen: 1, dmg: 1 },
  [['siphon_beam', 8], ['hex', 8], ['shadow_step', 10], ['soul_harvest', 12]],
  { name: 'Shadow Bolt', power: 10, cd: 480, speed: 12, range: 9, radius: 0.28, type: 'arcane', fx: { lifesteal: 0.25 }, col: '#b070e0' },
  [{ id: 'soulreaver', name: 'Soulreaver', desc: 'Harvest everything: Soul Rend ultimate.', mods: { dmg: 1.12 }, ult: 'soul_rend' },
   { id: 'hexmaster', name: 'Hexmaster', desc: 'Curses that never end: Doom ultimate.', mods: { atk: 1.08, mp: 1.2 }, ult: 'doom' }]);
ps('warlock', M, 'siphon_beam', 'Siphon Beam', 'proj', { lvl: 8, power: 24, count: 1, speed: 16, range: 9, radius: 0.3, pierce: 1, cd: 4000, cast: 200, type: 'arcane', fx: { lifesteal: 0.5 }, g: 'skull', col: '#b070e0', desc: 'A draining bolt that heals you for half the damage.' });
ps('warlock', M, 'hex', 'Hex', 'mark', { lvl: 8, radius: 6, cd: 12000, dur: 7000, vuln: 0.4, g: 'skull', desc: 'Curse everything nearby: they take 40% more damage.' });
ps('warlock', M, 'shadow_step', 'Shadow Step', 'dash', { lvl: 10, dist: 4.4, cd: 7000, iframes: 450, stealth: 1500, g: 'void', desc: 'Slip through shadow and vanish for 1.5s.' });
ps('warlock', M, 'soul_harvest', 'Soul Harvest', 'aoe', { lvl: 12, power: 52, cd: 11000, cast: 600, radius: 3.0, at: 'self', fx: { lifesteal: 0.5 }, type: 'arcane', g: 'skull', desc: 'Reap a ring of souls and heal from the damage.' });
ult('warlock', 'soulreaver', M, 'soul_rend', 'Soul Rend', 'aoe', { power: 110, cd: 20000, cast: 800, radius: 3.4, range: 8, at: 'cursor', fx: { lifesteal: 0.6 }, type: 'arcane', g: 'skull', desc: 'Tear souls from everything at the target and heal massively.' });
ult('warlock', 'hexmaster', M, 'doom', 'Doom', 'mark', { radius: 7, cd: 22000, dur: 9000, vuln: 0.65, g: 'skull', desc: 'A terrible curse: 65% more damage taken for 9s.' });

path('sage', M, 'Sage', '#7fe0a8', 'A healer who bites back. Keep the party alive with renewing light — and smite the enemy for their trouble.',
  { hp: 1.1, atk: 0.98, def: 1.05, move: 1, mp: 1.4, mpRegen: 1.8, dmg: 1 },
  [['renew', 8], ['sanctuary', 8], ['radiant_burst', 10], ['smite', 12]],
  { name: 'Holy Bolt', power: 9, cd: 470, speed: 13, range: 9, radius: 0.28, type: 'arcane', col: '#fff0a0' },
  [{ id: 'oracle', name: 'Oracle', desc: 'The party\'s lifeline: Divine Hymn ultimate.', mods: { mpRegen: 1.4 }, ult: 'divine_hymn' },
   { id: 'templar', name: 'Templar', desc: 'A holy fighter: +16% damage, Sunbrand ultimate.', mods: { dmg: 1.16, def: 1.1 }, ult: 'sunbrand' }]);
ps('sage', M, 'renew', 'Renew', 'heal', { lvl: 8, heal: 0.3, party: 8, cd: 9000, g: 'sun', desc: 'Restore 30% health to yourself and nearby party members.' });
ps('sage', M, 'sanctuary', 'Sanctuary', 'field', { lvl: 8, cd: 15000, cast: 200, radius: 3.2, dur: 7000, at: 'self', field: { heal: 0.05, every: 1000 }, k: 'holy', g: 'sun', desc: 'A field of light that heals everyone standing in it.' });
ps('sage', M, 'radiant_burst', 'Radiant Burst', 'aoe', { lvl: 10, power: 38, cd: 10000, cast: 400, radius: 2.8, at: 'self', heal: 0.12, party: 5, type: 'arcane', g: 'sun', desc: 'Damage enemies around you and heal allies in the blast.' });
ps('sage', M, 'smite', 'Smite', 'aoe', { lvl: 12, power: 62, cd: 8000, cast: 500, radius: 1.8, range: 9, at: 'cursor', type: 'arcane', g: 'sun', desc: 'A bolt of judgment from above.' });
ult('sage', 'oracle', M, 'divine_hymn', 'Divine Hymn', 'heal', { heal: 0.6, party: 9, shield: 80, dur: 6000, cd: 28000, g: 'sun', desc: 'Heal the whole party for 60% and shield them.' });
ult('sage', 'templar', M, 'sunbrand', 'Sunbrand', 'aoe', { power: 100, cd: 17000, cast: 700, radius: 3.2, range: 8, at: 'cursor', stun: 1500, type: 'arcane', g: 'sun', desc: 'Brand the area with sunlight: huge damage and a stun.' });

// ARCHER ─────────────────────────────────────────────────────────────────
path('ranger', A, 'Ranger', '#5fa860', 'A hunter of the wild: traps, poisons and a rain of arrows on anything that stays put.',
  { hp: 1.04, atk: 1.04, def: 1, move: 1.06, mp: 1.1, mpRegen: 1.2, dmg: 1 },
  [['multi_shot', 8], ['bear_trap', 8], ['thorn_rain', 10], ['camouflage', 12]],
  { name: 'Hunter Arrow', power: 10, cd: 400, speed: 17, range: 11, radius: 0.22, type: 'pierce', col: '#d8c090' },
  [{ id: 'beastmaster', name: 'Beastmaster', desc: 'Hunt as a pack: +12% damage, Wolf Pack ultimate.', mods: { dmg: 1.12 }, ult: 'wolf_pack' },
   { id: 'wildheart', name: 'Wildheart', desc: 'One with the forest: +20% HP, Verdant Ambush ultimate.', mods: { hp: 1.2, move: 1.05 }, ult: 'verdant_ambush' }]);
ps('ranger', A, 'multi_shot', 'Multi-Shot', 'proj', { lvl: 8, power: 16, count: 5, spread: 30, speed: 18, range: 10, radius: 0.24, cd: 5000, cast: 200, type: 'pierce', g: 'wind', desc: 'Five arrows in a fan.' });
ps('ranger', A, 'bear_trap', 'Bear Trap', 'trap', { lvl: 8, power: 40, cd: 9000, cast: 200, range: 6, radius: 1.5, stun: 2500, dur: 22000, type: 'pierce', g: 'fang', desc: 'A heavy trap. 2.5 seconds of held, bleeding enemy.' });
ps('ranger', A, 'thorn_rain', 'Thorn Rain', 'aoe', { lvl: 10, power: 10, cd: 12000, cast: 300, radius: 2.8, range: 9, at: 'cursor', dot: { ticks: 9, every: 400, k: 'poison' }, slow: 1500, type: 'pierce', g: 'leaf', desc: 'A rain of poisoned thorns: damage and slow.' });
ps('ranger', A, 'camouflage', 'Camouflage', 'dash', { lvl: 12, dist: 3.4, back: true, cd: 11000, iframes: 400, stealth: 3000, g: 'leaf', desc: 'Fade into the undergrowth for 3 seconds.' });
ult('ranger', 'beastmaster', A, 'wolf_pack', 'Wolf Pack', 'proj', { power: 26, count: 6, spread: 120, speed: 12, range: 10, radius: 0.4, pierce: 2, cd: 15000, cast: 300, type: 'pierce', g: 'fang', desc: 'Loose a pack of spirit wolves in a wide arc.' });
ult('ranger', 'wildheart', A, 'verdant_ambush', 'Verdant Ambush', 'aoe', { power: 60, cd: 18000, cast: 350, radius: 3.0, range: 8, at: 'cursor', stun: 2200, type: 'pierce', g: 'leaf', desc: 'The ground erupts in thorned vines: heavy damage and a long stun.' });

path('sniper', A, 'Sniper', '#c0c8d8', 'Slow, patient, devastating. Very long range and enormous single hits.',
  { hp: 0.94, atk: 1.2, def: 0.9, move: 1, mp: 1, mpRegen: 1, dmg: 1 },
  [['headshot', 8], ['spotter', 8], ['disengage', 10], ['piercing_bolt', 12]],
  { name: 'Longshot', power: 24, cd: 950, speed: 28, range: 16, radius: 0.22, pierce: 1, type: 'pierce', col: '#ffffff' },
  [{ id: 'deadshot', name: 'Deadshot', desc: 'Pure damage: +15% damage, Execution Round ultimate.', mods: { dmg: 1.15 }, ult: 'execution_round' },
   { id: 'phantom', name: 'Phantom', desc: 'Unseen: +10% move speed, Ghost Round ultimate.', mods: { move: 1.1, dmg: 1.05 }, ult: 'ghost_round' }]);
ps('sniper', A, 'headshot', 'Headshot', 'proj', { lvl: 8, power: 92, count: 1, speed: 30, range: 18, radius: 0.24, pierce: 1, cd: 7000, cast: 900, type: 'pierce', fx: { crit: 1 }, g: 'eye', desc: 'A slow, perfectly aimed shot that always crits.' });
ps('sniper', A, 'spotter', "Spotter's Mark", 'mark', { lvl: 8, radius: 8, cd: 12000, dur: 7000, vuln: 0.35, g: 'eye', desc: 'Mark enemies in sight: +35% damage taken for 7s.' });
ps('sniper', A, 'disengage', 'Disengage', 'dash', { lvl: 10, dist: 5.0, back: true, cd: 7000, iframes: 450, g: 'wind', desc: 'A long backwards leap.' });
ps('sniper', A, 'piercing_bolt', 'Piercing Bolt', 'proj', { lvl: 12, power: 48, count: 1, speed: 30, range: 18, radius: 0.28, pierce: 8, cd: 8000, cast: 500, type: 'pierce', g: 'bolt', desc: 'An iron bolt that goes through eight enemies.' });
ult('sniper', 'deadshot', A, 'execution_round', 'Execution Round', 'proj', { power: 120, count: 1, speed: 34, range: 20, radius: 0.26, pierce: 2, cd: 16000, cast: 1000, type: 'pierce', exec: 1, fx: { crit: 1 }, g: 'skull', desc: 'Lethal: always crits, and doubles against weakened enemies.' });
ult('sniper', 'phantom', A, 'ghost_round', 'Ghost Round', 'proj', { power: 80, count: 1, speed: 34, range: 20, radius: 0.26, pierce: 6, cd: 12000, cast: 500, type: 'arcane', stealth: 2500, g: 'void', desc: 'A ghostly round that passes through six enemies and hides you.' });

path('windrunner', A, 'Windrunner', '#8ad8e8', 'A blur with a bow: fast arrows, long dashes and almost no standing still.',
  { hp: 0.98, atk: 1.02, def: 0.95, move: 1.22, mp: 1.1, mpRegen: 1.4, dmg: 1 },
  [['gale_volley', 8], ['wind_dash', 8], ['tailwind', 10], ['cyclone_arrow', 12]],
  { name: 'Quick Shot', power: 7, cd: 300, speed: 19, range: 10, radius: 0.2, count: 2, spread: 8, type: 'pierce', col: '#d0f0ff' },
  [{ id: 'stormcaller', name: 'Stormcaller', desc: 'Command the gale: Tempest ultimate.', mods: { dmg: 1.12 }, ult: 'tempest' },
   { id: 'skydancer', name: 'Skydancer', desc: 'Even faster: +12% speed, Sky Dance ultimate.', mods: { move: 1.12 }, ult: 'sky_dance' }]);
ps('windrunner', A, 'gale_volley', 'Gale Volley', 'proj', { lvl: 8, power: 11, count: 9, spread: 70, speed: 19, range: 10, radius: 0.22, cd: 7000, cast: 150, type: 'pierce', g: 'wind', desc: 'Nine arrows in a wide arc.' });
ps('windrunner', A, 'wind_dash', 'Wind Dash', 'dash', { lvl: 8, dist: 5.6, cd: 4500, iframes: 450, g: 'wind', desc: 'A very fast, long dash.' });
ps('windrunner', A, 'tailwind', 'Tailwind', 'buff', { lvl: 10, cd: 16000, dur: 8000, buff: { dmg: 0.25, crit: 0.2 }, radius: 0, g: 'wind', desc: '+25% damage and +20% crit chance.' });
ps('windrunner', A, 'cyclone_arrow', 'Cyclone Arrow', 'proj', { lvl: 12, power: 42, count: 1, speed: 20, range: 12, radius: 0.6, pierce: 4, cd: 9000, cast: 300, type: 'pierce', fx: { knock: 0.5 }, g: 'wind', desc: 'A wide spinning arrow that knocks enemies about.' });
ult('windrunner', 'stormcaller', A, 'tempest', 'Tempest', 'aoe', { power: 18, cd: 22000, cast: 600, radius: 4.0, range: 9, at: 'cursor', dot: { ticks: 12, every: 350, k: 'storm' }, type: 'arcane', g: 'bolt', desc: 'Summon a storm that lashes everything inside.' });
ult('windrunner', 'skydancer', A, 'sky_dance', 'Sky Dance', 'dash', { dist: 6.5, cd: 9000, iframes: 900, land: { power: 38, radius: 2.0 }, type: 'pierce', g: 'wind', desc: 'Leap through the air and rain arrows where you land.' });

// TRADE PATHS: lighter combat kits, bigger crafting / economy perks ───────────────
path('weaponsmith', B, 'Weaponsmith', '#e07a3a', 'Blades are your art. Wider forging sweet spots on weapons, higher quality and a chance for a rune affix.',
  { hp: 1, atk: 1.12, def: 1, move: 1, mp: 1, mpRegen: 1, dmg: 1.06 }, [['blade_dance', 8], ['white_hot', 10]], null,
  [{ id: 'bladesinger', name: 'Bladesinger', desc: 'Every weapon sings: +8% weapon quality, rune affix on masterworks.', mods: { dmg: 1.08 }, ult: 'ringing_cut', perk: { weaponQ: 0.08, affixMaster: 1 } },
   { id: 'runesmith', name: 'Runesmith', desc: 'Etched metal: weapons gain an affix more often, +12% sweet spot.', mods: { atk: 1.05 }, ult: 'rune_hammer', perk: { affix: 0.35, sweet: 0.12 } }],
  { weaponQ: 0.06, sweet: 0.06, affix: 0.12 });
ps('weaponsmith', B, 'blade_dance', 'Blade Dance', 'melee', { lvl: 8, power: 14, hits: 4, interval: 150, cd: 8000, cast: 120, range: 2.2, arc: 220, g: 'flame', desc: 'Whirl with a half-forged blade: four cuts.' });
ps('weaponsmith', B, 'white_hot', 'White-Hot', 'aoe', { lvl: 10, power: 52, cd: 11000, cast: 450, radius: 2.4, at: 'self', type: 'arcane', g: 'flame', desc: 'Release the heat in your hammer.' });
ult('weaponsmith', 'bladesinger', B, 'ringing_cut', 'Ringing Cut', 'melee', { power: 70, cd: 14000, cast: 300, range: 2.8, arc: 90, type: 'slash', g: 'star', desc: 'One perfect strike. It rings.' });
ult('weaponsmith', 'runesmith', B, 'rune_hammer', 'Rune Hammer', 'aoe', { power: 85, cd: 16000, cast: 650, radius: 2.6, at: 'self', stun: 1500, type: 'arcane', g: 'star', desc: 'Runes flare, then the ground does.' });

path('armorsmith', B, 'Armorsmith', '#8a9ab0', 'Plate, mail and charms. Armour comes out stronger, you wear it better, and the hammer hits harder behind a wall of steel.',
  { hp: 1.2, atk: 1, def: 1.25, move: 0.98, mp: 1, mpRegen: 1, dmg: 1 }, [['plate_stance', 8], ['shield_slam', 10]], null,
  [{ id: 'bastion', name: 'Bastion', desc: 'Armour like a fortress: +20% HP, +8% armour quality.', mods: { hp: 1.2 }, ult: 'fortress', perk: { armorQ: 0.08 } },
   { id: 'charmwright', name: 'Charmwright', desc: 'Charms and lockets of real power: +10% charm quality, Warding Strike ultimate.', mods: { mp: 1.2 }, ult: 'warding_strike', perk: { charmQ: 0.1, armorQ: 0.04 } }],
  { armorQ: 0.07, charmQ: 0.05, sweet: 0.04 });
ps('armorsmith', B, 'plate_stance', 'Plate Stance', 'guard', { lvl: 8, cd: 9000, dur: 3000, red: 0.75, reflect: 0.25, type: 'blunt', g: 'shield', desc: 'Set your feet in plate: 75% damage reduction.' });
ps('armorsmith', B, 'shield_slam', 'Shield Slam', 'melee', { lvl: 10, power: 30, cd: 7000, cast: 200, range: 1.8, arc: 100, stun: 1400, type: 'blunt', g: 'shield', desc: 'Slam them with the flat of a pauldron.' });
ult('armorsmith', 'bastion', B, 'fortress', 'Fortress', 'guard', { red: 0.88, dur: 4500, reflect: 0.45, cd: 24000, type: 'blunt', g: 'shield', desc: 'Become a fortress for 4.5 seconds.' });
ult('armorsmith', 'charmwright', B, 'warding_strike', 'Warding Strike', 'melee', { power: 54, cd: 12000, cast: 300, range: 2.2, arc: 110, shield: 80, type: 'blunt', g: 'star', desc: 'Strike, and a ward forms around you.' });

path('apothecary', AL, 'Apothecary', '#7fe08a', 'Healing in a bottle: healing potions are stronger, bursts are rarer and you can heal your friends in the field.',
  { hp: 1.08, atk: 0.95, def: 1.05, move: 1, mp: 1.2, mpRegen: 1.3, dmg: 1 }, [['mend', 8], ['tonic_cloud', 10]], null,
  [{ id: 'herbalist', name: 'Herbalist', desc: 'Potions strengthen further and burst less often.', mods: { mp: 1.1 }, ult: 'verdant_draught', perk: { heal: 0.2, risk: 0.04 } },
   { id: 'plague_doctor', name: 'Plague Doctor', desc: 'A darker trade: stronger poisons, Quarantine ultimate.', mods: { dmg: 1.1 }, ult: 'quarantine', perk: { heal: 0.1, bottle: 0.2 } }],
  { heal: 0.15, risk: 0.02, bottle: 0.1 });
ps('apothecary', AL, 'mend', 'Mend', 'heal', { lvl: 8, heal: 0.3, party: 7, cd: 9000, g: 'drop', col: '#7fe08a', desc: 'Heal yourself and nearby party members.' });
ps('apothecary', AL, 'tonic_cloud', 'Tonic Cloud', 'field', { lvl: 10, cd: 15000, cast: 200, radius: 3.0, dur: 6000, at: 'cursor', range: 7, field: { heal: 0.05, every: 1000 }, k: 'holy', g: 'drop', col: '#7fe08a', desc: 'A healing mist for everyone standing in it.' });
ult('apothecary', 'herbalist', AL, 'verdant_draught', 'Verdant Draught', 'heal', { heal: 0.55, party: 8, cd: 24000, g: 'leaf', desc: 'A powerful draught: heal everyone nearby for 55%.' });
ult('apothecary', 'plague_doctor', AL, 'quarantine', 'Quarantine', 'aoe', { power: 14, cd: 20000, cast: 400, radius: 3.4, range: 8, at: 'cursor', dot: { ticks: 14, every: 400, k: 'poison' }, slow: 2500, type: 'arcane', g: 'skull', desc: 'Seal the area in a poison cloud.' });

path('bombardier', AL, 'Bombardier', '#e0603a', 'Flasks that go bang. A combat-first brewer with explosive tools and stronger offensive potions.',
  { hp: 1, atk: 1.15, def: 0.95, move: 1.04, mp: 1, mpRegen: 1, dmg: 1.08 }, [['fire_flask', 8], ['cluster_bomb', 10]], null,
  [{ id: 'demolitionist', name: 'Demolitionist', desc: 'Bigger booms: +12% damage, Mega Bomb ultimate.', mods: { dmg: 1.12 }, ult: 'mega_bomb', perk: { bottle: 0.1 } },
   { id: 'toxicologist', name: 'Toxicologist', desc: 'Poisons that never stop: Neurotoxin ultimate.', mods: { atk: 1.08 }, ult: 'neurotoxin', perk: { risk: 0.03 } }],
  { bottle: 0.05, risk: 0.01 });
ps('bombardier', AL, 'fire_flask', 'Fire Flask', 'proj', { lvl: 8, power: 34, count: 1, speed: 10, range: 9, radius: 0.35, aoe: 1.8, cd: 5000, cast: 200, type: 'arcane', g: 'flame', col: '#ff8a3a', desc: 'A flask of burning oil.' });
ps('bombardier', AL, 'cluster_bomb', 'Cluster Bomb', 'proj', { lvl: 10, power: 18, count: 4, spread: 40, speed: 9, range: 8, radius: 0.3, aoe: 1.3, cd: 9000, cast: 200, type: 'arcane', g: 'flame', desc: 'Four small bombs in a spread.' });
ult('bombardier', 'demolitionist', AL, 'mega_bomb', 'Mega Bomb', 'proj', { power: 120, count: 1, speed: 9, range: 10, radius: 0.5, aoe: 3.2, cd: 20000, cast: 600, stun: 1400, type: 'arcane', g: 'flame', desc: 'An enormous bomb.' });
ult('bombardier', 'toxicologist', AL, 'neurotoxin', 'Neurotoxin', 'aoe', { power: 14, cd: 18000, cast: 350, radius: 3.0, range: 8, at: 'cursor', dot: { ticks: 14, every: 350, k: 'poison' }, stun: 1200, type: 'arcane', g: 'skull', desc: 'A paralysing poison cloud.' });

path('auctioneer', ME, 'Auctioneer', '#e8c860', 'The Exchange is your stage: lower listing fees, more listings, and a talent for the highest bid.',
  { hp: 1, atk: 1, def: 1, move: 1, mp: 1.2, mpRegen: 1.2, dmg: 1 }, [['going_once', 8], ['sold', 10]], null,
  [{ id: 'house_master', name: 'House Master', desc: 'Even smaller fees and +5 listings.', mods: { mp: 1.1 }, ult: 'gavel_strike', perk: { fee: 0.01, slots: 5 } },
   { id: 'speculator', name: 'Speculator', desc: 'See the swings: +1 haggle bonus, +10% from customers.', mods: { atk: 1.05 }, ult: 'insider_flurry', perk: { haggle: 1, customer: 0.1 } }],
  { fee: 0.01, slots: 3 });
ps('auctioneer', ME, 'going_once', 'Going Once', 'aoe', { lvl: 8, power: 30, cd: 8000, cast: 400, radius: 2.0, range: 7, at: 'cursor', stun: 1200, type: 'blunt', g: 'coin', desc: 'A rap of the gavel.' });
ps('auctioneer', ME, 'sold', 'Sold!', 'melee', { lvl: 10, power: 44, cd: 8000, cast: 250, range: 2.2, arc: 110, type: 'blunt', g: 'coin', desc: 'Bring the gavel down.' });
ult('auctioneer', 'house_master', ME, 'gavel_strike', 'Gavel Strike', 'aoe', { power: 90, cd: 18000, cast: 600, radius: 2.8, at: 'self', stun: 1800, type: 'blunt', g: 'coin', desc: 'The final bid.' });
ult('auctioneer', 'speculator', ME, 'insider_flurry', 'Insider Flurry', 'proj', { power: 16, count: 8, spread: 60, speed: 16, range: 10, radius: 0.25, cd: 14000, cast: 250, type: 'pierce', fx: { critChance: 0.5 }, g: 'coin', desc: 'Eight shots that know where to land.' });

path('caravan_master', ME, 'Caravan Master', '#c89a5a', 'Roads and routes. Cheaper cross-realm trading, tougher on the road, and always carrying a little more.',
  { hp: 1.15, atk: 1.04, def: 1.1, move: 1.08, mp: 1, mpRegen: 1, dmg: 1 }, [['road_warden', 8], ['whip_crack', 10]], null,
  [{ id: 'trailblazer', name: 'Trailblazer', desc: 'Move faster, and +8% on cross-realm sales.', mods: { move: 1.08 }, ult: 'stampede', perk: { realm: 0.08 } },
   { id: 'tycoon', name: 'Tycoon', desc: 'A fortune in motion: +12% sale prices to the bots.', mods: { dmg: 1.06 }, ult: 'golden_gale', perk: { customer: 0.12 } }],
  { realm: 0.04 });
ps('caravan_master', ME, 'road_warden', 'Road Warden', 'guard', { lvl: 8, cd: 10000, dur: 3000, red: 0.7, reflect: 0.3, type: 'blunt', g: 'shield', desc: 'Hold the road.' });
ps('caravan_master', ME, 'whip_crack', 'Whip Crack', 'melee', { lvl: 10, power: 30, cd: 6000, cast: 180, range: 3.2, arc: 40, slow: 2000, type: 'slash', g: 'wind', desc: 'A long, slow-inflicting lash.' });
ult('caravan_master', 'trailblazer', ME, 'stampede', 'Stampede', 'dash', { dist: 5.5, cd: 14000, iframes: 700, land: { power: 70, radius: 2.4, stun: 1200 }, type: 'blunt', g: 'wind', desc: 'Charge through the line.' });
ult('caravan_master', 'tycoon', ME, 'golden_gale', 'Golden Gale', 'proj', { power: 16, count: 12, spread: 90, speed: 15, range: 9, radius: 0.24, cd: 16000, cast: 250, type: 'pierce', g: 'coin', desc: 'A gale of gilt.' });

// ── Mythic classes: ONE player in the entire game may hold each ─────────────────────
export const MYTHICS = {
  apostle: { id: 'apostle', name: "Yggdrasil's Apostle", color: '#6adf8a', group: 'combat', hp: 150, hpPer: 19, atk: 10, def: 5, move: 1.06, mpRegen: 2.2,
    desc: 'MYTHIC. The World Tree speaks through you. Roots answer your call, wounds close by themselves, and death is a thing that happens to other people — once every five minutes.',
    status: { id: 'worldtree', name: "World-Tree's Mantle", desc: 'Regenerate 1.4% max HP per second. Reflect 15% of damage taken. Once every 5 minutes a killing blow instead restores half your health and roots every enemy nearby.', regen: 0.014, thorns: 0.15, revive: 300000 },
    skills: [['thorn_lash', 1], ['rootbind', 1], ['seed_barrage', 1], ['bloom', 1], ['worldtree_wrath', 1]], basic: { name: 'Root Whip', kind: 'melee', power: 16, cd: 460, range: 2.5, arc: 100, type: 'pierce', combo: 'whip' } },
  void_sovereign: { id: 'void_sovereign', name: 'Void Sovereign', color: '#7a5aff', group: 'combat', hp: 120, hpPer: 15, atk: 13, def: 3, move: 1.16, mpRegen: 2.0,
    desc: 'MYTHIC. A crown cut from nothing. Reality does not like to hit you, and everything you kill makes you worse to fight.',
    status: { id: 'voidborn', name: 'Voidborn', desc: 'Each hit has a 16% chance to phase through you. Every kill grants a Void stack (+3% damage, up to 15) that fades after 20 seconds without a kill.', phase: 0.16, stacks: { per: 0.03, max: 15, decay: 20000 } },
    skills: [['void_rend', 1], ['rift_step', 1], ['event_horizon', 1], ['null_barrage', 1], ['oblivion', 1]], basic: { name: 'Null Edge', kind: 'melee', power: 14, cd: 380, range: 2.0, arc: 120, type: 'arcane', combo: 'spell' } },
  titan_forgemaster: { id: 'titan_forgemaster', name: 'Titan Forgemaster', color: '#ff8a2a', group: 'trade', hp: 140, hpPer: 17, atk: 10, def: 8, move: 1.0, mpRegen: 1.5, gather: { ore: 2, coal: 2 }, craftFamily: 'blacksmith',
    desc: 'MYTHIC. The first forge was lit by a titan; you are its heir. Anything you forge is never crude, ember burns wherever you walk, and the Cold Forge itself answers to you.',
    status: { id: 'forgeheart', name: 'Heart of the Forge', desc: 'Forged items gain +15% quality and a Resonance affix. Enemies within 2 tiles burn for 4 damage per second.', forgeQ: 0.15, affix: 1, aura: { r: 2.0, dps: 4 } },
    skills: [['hot_tongs', 1], ['titan_slam', 1], ['molten_chain', 1], ['forge_nova', 1]], basic: { name: 'Titan Hammer', kind: 'melee', power: 18, cd: 620, range: 1.9, arc: 120, type: 'blunt', combo: 'heavy' } },
  philosopher: { id: 'philosopher', name: "Philosopher's Heir", color: '#ffd36a', group: 'trade', hp: 110, hpPer: 13, atk: 12, def: 3, move: 1.06, mpRegen: 2.4, gather: { herb: 2, ghostbloom: 2 }, craftFamily: 'alchemist',
    desc: 'MYTHIC. Lead becomes gold, water becomes life. Your cauldron cannot burst, your potions heal half again as much, and every batch brims with extra bottles.',
    status: { id: 'gold_from_lead', name: 'Gold From Lead', desc: 'Brews never burst, yield 2 extra bottles, and all your healing is 50% stronger. Your attacks have a 20% chance to transmute a drop of gold.', noBurst: 1, bottles: 2, healMult: 0.5, midas: 0.2 },
    skills: [['acid_splash', 1], ['elixir_storm', 1], ['aurum_flask', 1], ['panacea', 1]], basic: { name: 'Golden Flask', kind: 'proj', power: 13, cd: 520, speed: 10, range: 8, radius: 0.3, aoe: 1.1, type: 'arcane', col: '#ffd36a' } },
  gilded: { id: 'gilded', name: 'Gilded Sovereign', color: '#ffe36b', group: 'trade', hp: 125, hpPer: 15, atk: 11, def: 4, move: 1.08, mpRegen: 1.8,
    desc: 'MYTHIC. The market bows. You pay no fees, never lose a haggle and your wealth is a weapon — more gilt in your purse means harder hits.',
    status: { id: 'midas', name: "Midas' Ledger", desc: 'Pay no listing fees. Never lose a haggle round. +1% damage per 1000 gilt carried (max +40%).', noFee: 1, haggleWin: 1, goldPower: { per: 0.01, step: 1000, max: 0.4 } },
    skills: [['fistful', 1], ['gilded_cage', 1], ['coin_storm', 1], ['golden_parachute', 1]], basic: { name: 'Gilt Toss', kind: 'proj', power: 14, cd: 400, speed: 13, range: 9, radius: 0.24, count: 2, spread: 10, type: 'pierce', col: '#ffe36b' } },
};
const MY = (cls, id, name, kind, o) => add(sk(id, name, kind, cls, { src: 'mythic', lvl: 1, ...o }));
MY('apostle', 'thorn_lash', 'Thorn Lash', 'melee', { power: 32, cd: 2600, cast: 150, range: 2.8, arc: 170, type: 'pierce', fx: { lifesteal: 0.2 }, g: 'leaf', desc: 'A long whip of living thorn. Heals you.' });
MY('apostle', 'rootbind', 'Rootbind', 'aoe', { power: 26, cd: 9000, cast: 350, radius: 2.9, range: 8, at: 'cursor', stun: 2200, dot: { ticks: 6, every: 400, k: 'poison' }, type: 'pierce', g: 'leaf', desc: 'Roots burst out of the ground and hold everything in place.' });
MY('apostle', 'seed_barrage', 'Seed Barrage', 'proj', { power: 22, count: 7, spread: 50, speed: 14, range: 10, radius: 0.26, pierce: 1, cd: 7000, cast: 220, type: 'pierce', g: 'leaf', desc: 'Seven explosive seeds.' });
MY('apostle', 'bloom', 'Bloom', 'field', { cd: 14000, cast: 250, radius: 3.4, dur: 7000, at: 'self', field: { heal: 0.06, every: 1000, dmg: 14 }, k: 'holy', g: 'leaf', col: '#6adf8a', desc: 'A flowering field that heals allies and scorches enemies.' });
MY('apostle', 'worldtree_wrath', "World Tree's Wrath", 'aoe', { power: 115, cd: 22000, cast: 900, radius: 4.4, at: 'self', stun: 1400, type: 'pierce', g: 'leaf', desc: 'The tree itself answers: enormous damage in all directions.' });
MY('void_sovereign', 'void_rend', 'Void Rend', 'melee', { power: 42, cd: 5000, cast: 200, range: 2.6, arc: 200, type: 'arcane', mag: 1, g: 'void', desc: 'Tear the air itself.' });
MY('void_sovereign', 'rift_step', 'Rift Step', 'dash', { dist: 5.2, cd: 5000, iframes: 600, land: { power: 36, radius: 2.0 }, type: 'arcane', stealth: 800, g: 'void', desc: 'Step through a rift and strike from the other side.' });
MY('void_sovereign', 'event_horizon', 'Event Horizon', 'aoe', { power: 70, cd: 13000, cast: 700, radius: 3.4, range: 9, at: 'cursor', stun: 1800, slow: 3000, type: 'arcane', g: 'void', desc: 'A hole in the world. Enemies caught in it are held.' });
MY('void_sovereign', 'null_barrage', 'Null Barrage', 'proj', { power: 20, count: 9, spread: 90, speed: 17, range: 11, radius: 0.26, pierce: 2, cd: 8000, cast: 200, type: 'arcane', g: 'void', desc: 'Nine bolts of nothing.' });
MY('void_sovereign', 'oblivion', 'Oblivion', 'aoe', { power: 150, cd: 26000, cast: 1100, radius: 4.6, at: 'self', type: 'arcane', g: 'void', desc: 'Erase everything close to you.' });
MY('titan_forgemaster', 'titan_slam', 'Titan Slam', 'aoe', { power: 70, cd: 9000, cast: 600, radius: 2.8, at: 'self', stun: 1400, type: 'blunt', g: 'anvil', desc: 'The first hammer-blow.' });
MY('titan_forgemaster', 'molten_chain', 'Molten Chain', 'proj', { power: 52, count: 1, speed: 18, range: 11, radius: 0.5, pierce: 5, cd: 6000, cast: 250, type: 'arcane', g: 'flame', desc: 'A chain of molten iron that cuts through a line of enemies.' });
MY('titan_forgemaster', 'forge_nova', 'Forge Nova', 'aoe', { power: 130, cd: 22000, cast: 900, radius: 4.2, at: 'self', stun: 1400, type: 'arcane', g: 'flame', desc: 'The forge detonates.' });
MY('philosopher', 'elixir_storm', 'Elixir Storm', 'proj', { power: 18, count: 10, spread: 100, speed: 12, range: 9, radius: 0.28, aoe: 1.2, cd: 9000, cast: 250, type: 'arcane', g: 'drop', col: '#ffd36a', desc: 'A storm of flasks.' });
MY('philosopher', 'aurum_flask', 'Aurum Flask', 'proj', { power: 95, count: 1, speed: 11, range: 10, radius: 0.45, aoe: 2.8, cd: 14000, cast: 300, type: 'arcane', fx: { lifesteal: 0.5 }, g: 'drop', col: '#ffd36a', desc: 'Liquid gold that drains what it burns.' });
MY('philosopher', 'panacea', 'Panacea', 'heal', { heal: 0.65, party: 10, shield: 120, dur: 7000, cd: 24000, g: 'drop', col: '#ffd36a', desc: 'The cure for everything. Heals and shields the whole party.' });
MY('gilded', 'gilded_cage', 'Gilded Cage', 'aoe', { power: 40, cd: 12000, cast: 400, radius: 2.8, range: 9, at: 'cursor', stun: 2400, type: 'pierce', g: 'coin', desc: 'Bars of gold close around a group.' });
MY('gilded', 'coin_storm', 'Coin Storm', 'proj', { power: 18, count: 14, spread: 140, speed: 15, range: 9, radius: 0.26, pierce: 1, cd: 10000, cast: 200, type: 'pierce', g: 'coin', desc: 'A storm of coins in every direction.' });
MY('gilded', 'golden_parachute', 'Golden Parachute', 'dash', { dist: 5.0, back: true, cd: 8000, iframes: 700, stealth: 2000, land: { power: 30, radius: 2.0 }, g: 'coin', desc: 'A golden exit, with a bang.' });

// ── Combo definitions for basic attacks (arrays of steps; merged over the basic's own fields) ──
export const COMBOS = {
  slash: { window: 900, steps: [
    { power: 1.0, range: 1.0, arc: 1.0, cd: 340, lunge: 0.25, dir: 1, hit: 0 },
    { power: 1.1, range: 1.05, arc: 1.05, cd: 360, lunge: 0.25, dir: -1, hit: 0 },
    { power: 2.0, range: 1.2, arc: 1.7, cd: 620, lunge: 0.6, dir: 1, hit: 1, knock: 0.5 }] },
  spell: { window: 900, steps: [
    { power: 1.0, range: 1.0, arc: 1.0, cd: 330, lunge: 0.2, dir: 1, hit: 0 },
    { power: 1.0, range: 1.0, arc: 1.0, cd: 330, lunge: 0.2, dir: -1, hit: 0 },
    { power: 1.9, range: 1.3, arc: 1.6, cd: 600, lunge: 0.5, dir: 1, hit: 1, knock: 0.4 }] },
  heavy: { window: 1500, steps: [
    { power: 1.0, range: 1.0, arc: 1.0, cd: 1000, lunge: 0.4, dir: 1, hit: 1, knock: 0.7 },
    { power: 1.4, range: 1.1, arc: 1.3, cd: 1150, lunge: 0.5, dir: -1, hit: 1, knock: 0.9 }] },
  bash: { window: 900, steps: [
    { power: 1.0, range: 1.0, arc: 1.0, cd: 460, lunge: 0.2, dir: 1, hit: 0 },
    { power: 1.0, range: 1.0, arc: 1.0, cd: 460, lunge: 0.2, dir: -1, hit: 0 },
    { power: 1.8, range: 1.0, arc: 1.2, cd: 700, lunge: 0.4, dir: 1, hit: 1, knock: 0.5, stun: 700 }] },
  whip: { window: 900, steps: [
    { power: 1.0, range: 1.0, arc: 1.0, cd: 380, lunge: 0, dir: 1, hit: 0 },
    { power: 1.0, range: 1.0, arc: 1.0, cd: 380, lunge: 0, dir: -1, hit: 0 },
    { power: 1.8, range: 1.25, arc: 1.5, cd: 560, lunge: 0.2, dir: 1, hit: 1, knock: 0.3 }] },
};

// ── Skill helpers (pure, shared by server and client) ──────────────────────────────────
export function describeSkill(s) {
  if (s.desc) return s.desc;
  return `${s.kind}${s.power ? `, power ${s.power}` : ''}`;
}
