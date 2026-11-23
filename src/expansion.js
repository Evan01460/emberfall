// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE FAR REACHES — the world beyond Aether Reach, built from data so it can be as big as we like.
//
//   · 48 new regions (levels 34 → 100): a main road of 24 regions with a side region off every one of them,
//     twelve different biomes, a village in every third region, and a waystone, camps, ruins, towers, shrines and a boss lair in each.
//   · 12 new two-floor dungeons with their own bosses.
//   · 8 new metal tiers (Voidglass … Worldsteel), each with an ore, an ingot, a vein and a full set of gear for every class.
//   · The Endless Spire: 120 floors of dungeon that scale with depth and are open from the very first levels.
//   · Stronger potions (percentage heals) for the long climb.
//
// This file is pure data + deterministic generation (no imports), shared by the game rules, the server and the map builder.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
// Hit points grow more slowly than level beyond the old cap so fights stay a sensible length; damage and defence keep climbing.
export const effLevel = (L) => (L <= 33 ? L : 33 + (L - 33) * 0.35);

// ── metals ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// colors: ore [dark, mid, light]; metal [body, highlight, shadow] (used for icons, veins and gear art)
export const EXP_TIERS = [
  { id: 'voidglass',  name: 'Voidglass',  ing: 'voidglass_ingot',  ore: 'voidglass_ore',  oreV: 260,  ingV: 750,  lvl: 34, mult: 3.8, atk: 72,  def: 40, hp: 230, mp: 110, extra: 'echo_shard', ore3: ['#2a2048', '#5a46a0', '#b8a0ff'], metal: ['#7a62d8', '#d0c0ff', '#3a2a78'] },
  { id: 'drakesteel', name: 'Drakesteel', ing: 'drakesteel_ingot', ore: 'drakesteel_ore', oreV: 340,  ingV: 980,  lvl: 44, mult: 4.0, atk: 88,  def: 46, hp: 285, mp: 135, extra: 'coal',       ore3: ['#4a2a22', '#9a4a38', '#ffb08a'], metal: ['#d0583a', '#ffc0a0', '#702418'] },
  { id: 'celestine',  name: 'Celestine',  ing: 'celestine_ingot',  ore: 'celestine_ore',  oreV: 440,  ingV: 1280, lvl: 54, mult: 4.2, atk: 106, def: 53, hp: 350, mp: 165, extra: 'frostbloom', ore3: ['#2a4a6a', '#5a9ad0', '#d8f0ff'], metal: ['#7ac0f0', '#e8f8ff', '#3a70a0'] },
  { id: 'eternium',   name: 'Eternium',   ing: 'eternium_ingot',   ore: 'eternium_ore',   oreV: 570,  ingV: 1650, lvl: 64, mult: 4.4, atk: 126, def: 61, hp: 425, mp: 200, extra: 'ghostbloom', ore3: ['#3a4a22', '#7a9a3a', '#e0ff9a'], metal: ['#a8d050', '#f0ffc0', '#587020'] },
  { id: 'nullsteel',  name: 'Nullsteel',  ing: 'nullsteel_ingot',  ore: 'nullsteel_ore',  oreV: 730,  ingV: 2100, lvl: 74, mult: 4.6, atk: 148, def: 70, hp: 510, mp: 240, extra: 'echo_shard', ore3: ['#1a1a22', '#4a4a5a', '#e8e8ff'], metal: ['#58586c', '#d0d0f0', '#20202c'] },
  { id: 'solarite',   name: 'Solarite',   ing: 'solarite_ingot',   ore: 'solarite_ore',   oreV: 930,  ingV: 2650, lvl: 84, mult: 4.8, atk: 172, def: 80, hp: 610, mp: 285, extra: 'coal',       ore3: ['#6a4a10', '#e09a20', '#fff0a0'], metal: ['#ffb830', '#fff4c0', '#a06810'] },
  { id: 'mythril',    name: 'Mythril',    ing: 'mythril_ingot',    ore: 'mythril_ore',    oreV: 1180, ingV: 3300, lvl: 92, mult: 5.0, atk: 198, def: 91, hp: 725, mp: 335, extra: 'frostbloom', ore3: ['#1a5a5a', '#30b0a8', '#a8fff0'], metal: ['#40d0c0', '#d0fff8', '#187068'] },
  { id: 'worldsteel', name: 'Worldsteel', ing: 'worldsteel_ingot', ore: 'worldsteel_ore', oreV: 1500, ingV: 4100, lvl: 98, mult: 5.2, atk: 226, def: 104, hp: 855, mp: 390, extra: 'ghostbloom', ore3: ['#5a3a5a', '#c070b0', '#ffe0f8'], metal: ['#e090d0', '#fff0fa', '#804070'] },
];

// ── biomes ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// theme: how the map is drawn · ground/patch/edge: tile kinds · kit: the creatures that live there [name, shape, colour, role]
const BIOMES = [
  { id: 'ashen', theme: 'volcano', ground: 'grass', patch: [0.6, 'sand'], edge: 'rock', trees: 0.78, thin: 0.6, water: 0.7, rocks: 0.68, adj: ['Ashen', 'Cinder', 'Smouldering', 'Obsidian', 'Magma', 'Scorched'], noun: ['Barrens', 'Basin', 'Caldera', 'Wastes', 'Fields', 'Reach'],
    kit: [['Ash Stalker', 'hound', '#8a6a5a', 'fast'], ['Cinder Brute', 'brute', '#b8502a', 'tank'], ['Magma Imp', 'imp', '#ff7a3a', 'caster'], ['Obsidian Husk', 'golem', '#3a3a48', 'tank'], ['Slag Wisp', 'wisp', '#ff9a4a', 'caster']], bosses: ['Calderion', 'Pyrrhax', 'Ignarok'], elite: ['Pyre Knight', 'skeleton', '#ff6a2a'] },
  { id: 'frost', theme: 'snow', ground: 'grass', edge: 'rock', trees: 0.6, thin: 0.3, water: 0.78, rocks: 0.7, adj: ['Frozen', 'Rime', 'Glacial', 'Whiteout', 'Boreal', 'Hoarfrost'], noun: ['Tundra', 'Peaks', 'Expanse', 'Drifts', 'Fjords', 'Wastes'],
    kit: [['Rime Wolf', 'hound', '#d8f0ff', 'fast'], ['Frost Giant', 'brute', '#8ac0f0', 'tank'], ['Ice Witch', 'witch', '#a8d0ff', 'caster'], ['Glacier Husk', 'golem', '#b8d8f0', 'tank'], ['Snow Wraith', 'wraith', '#e8f4ff', 'fast']], bosses: ['Hrimgar', 'Skadi the Pale', 'Wintermaw'], elite: ['Frost Revenant', 'skeleton', '#7ab0e0'] },
  { id: 'marsh', theme: 'swamp', ground: 'grass', trees: 0.62, thin: 0.35, water: 0.6, rocks: 0.82, adj: ['Rotting', 'Dismal', 'Sunken', 'Mire', 'Bogwater', 'Gloam'], noun: ['Fen', 'Marsh', 'Bog', 'Hollow', 'Mere', 'Slough'],
    kit: [['Bog Lurker', 'worm', '#5a7a3a', 'tank'], ['Mire Witch', 'witch', '#7a9a4a', 'caster'], ['Fen Stalker', 'spider', '#4a5a2a', 'fast'], ['Drowned Husk', 'husk', '#6a8a6a', 'grunt'], ['Marsh Wisp', 'wisp', '#a8ff9a', 'caster']], bosses: ['Old Grimsludge', 'The Drowned Queen', 'Mirewyrm'], elite: ['Bog Knight', 'skeleton', '#5a8a4a'] },
  { id: 'dune', theme: 'desert', ground: 'grass', patch: [0.6, 'sand'], edge: 'rock', trees: 0.72, thin: 0.7, water: 0.78, rocks: 0.74, adj: ['Sunbaked', 'Gilded', 'Scouring', 'Bleached', 'Mirage', 'Searing'], noun: ['Dunes', 'Sands', 'Badlands', 'Oasis', 'Mesa', 'Expanse'],
    kit: [['Sand Scorpion', 'scorpion', '#d8a850', 'fast'], ['Dune Brute', 'brute', '#c09050', 'tank'], ['Mirage Witch', 'witch', '#f0d080', 'caster'], ['Tomb Skeleton', 'skeleton', '#e8e0c0', 'grunt'], ['Sun Wraith', 'wraith', '#ffe090', 'fast']], bosses: ['Khet-Amun', 'The Gilded Pharaoh', 'Sandmaw'], elite: ['Tomb Guardian', 'golem', '#d8b860'] },
  { id: 'sylvan', theme: 'main', ground: 'grass', trees: 0.6, thin: 0.25, water: 0.72, rocks: 0.78, adj: ['Whispering', 'Verdant', 'Elderwood', 'Moonlit', 'Tangled', 'Primeval'], noun: ['Woods', 'Glade', 'Thicket', 'Grove', 'Canopy', 'Wilds'],
    kit: [['Thorn Stag', 'stag', '#6a9a4a', 'fast'], ['Treant', 'golem', '#5a7a3a', 'tank'], ['Hollow Hag', 'witch', '#8a6aa8', 'caster'], ['Dire Boar', 'boar', '#8a6a4a', 'grunt'], ['Fae Wisp', 'wisp', '#c8ffa8', 'caster']], bosses: ['The Green Mother', 'Oakhart', 'Thornqueen Vael'], elite: ['Briar Knight', 'skeleton', '#5a9a5a'] },
  { id: 'ruin', theme: 'main', ground: 'sand', patch: [0.55, 'cobble'], edge: 'rock', trees: 0.78, thin: 0.5, water: 0.8, rocks: 0.66, clear: 'cobble', adj: ['Shattered', 'Forgotten', 'Hollowed', 'Fallen', 'Sundered', 'Lost'], noun: ['Citadel', 'Bastion', 'Keep', 'Cathedral', 'Forum', 'Ramparts'],
    kit: [['Fallen Knight', 'skeleton', '#9aa0b0', 'grunt'], ['Stone Sentinel', 'golem', '#8a8a98', 'tank'], ['Ruin Acolyte', 'witch', '#c8b8e0', 'caster'], ['Gargoyle', 'imp', '#7a7a8a', 'fast'], ['Hollow Warden', 'warden', '#a8a8c0', 'tank']], bosses: ['Lord Vaessa', 'The Last Marshal', 'Hierophant Ul'], elite: ['Oathbreaker', 'warden', '#8a8aa8'] },
  { id: 'bone', theme: 'desert', ground: 'sand', patch: [0.5, 'grass'], edge: 'rock', trees: 0.8, thin: 0.6, water: 0.8, rocks: 0.72, adj: ['Bleak', 'Marrow', 'Ossuary', 'Charnel', 'Grim', 'Boneyard'], noun: ['Plains', 'Fields', 'Cairns', 'Reach', 'Barrow', 'Ossuary'],
    kit: [['Bone Hound', 'hound', '#e0d8c0', 'fast'], ['Revenant', 'skeleton', '#c8c0a8', 'grunt'], ['Skull Mage', 'witch', '#d8d0b0', 'caster'], ['Bone Golem', 'golem', '#d0c8b0', 'tank'], ['Crypt Worm', 'worm', '#b8b098', 'tank']], bosses: ['The Ossuary King', 'Marrowgnash', 'Lady Charnel'], elite: ['Deathless Knight', 'skeleton', '#e8e0d0'] },
  { id: 'storm', theme: 'main', ground: 'sand', patch: [0.58, 'grass'], edge: 'rock', trees: 0.84, thin: 0.5, water: 0.74, rocks: 0.6, adj: ['Thunder', 'Tempest', 'Gale', 'Stormcalled', 'Skybreak', 'Lightning'], noun: ['Cliffs', 'Steppe', 'Heights', 'Plateau', 'Crags', 'Spires'],
    kit: [['Storm Hawk', 'imp', '#8ab8ff', 'fast'], ['Thunder Brute', 'brute', '#6a8ad8', 'tank'], ['Tempest Witch', 'witch', '#a8b8ff', 'caster'], ['Gale Wisp', 'wisp', '#d0e0ff', 'caster'], ['Skyscale', 'scorpion', '#7aa8d8', 'fast']], bosses: ['Zephyrion', 'The Stormfather', 'Voltrix'], elite: ['Storm Knight', 'skeleton', '#8aa8f0'] },
  { id: 'abyss', kind: 'cave', theme: 'cave', ground: 'grass', fill: 0.5, pool: 0.74, crystal: 0.03, adj: ['Abyssal', 'Deepdark', 'Sunless', 'Umbral', 'Hollowed', 'Lightless'], noun: ['Depths', 'Caverns', 'Warrens', 'Descent', 'Grottos', 'Chasm'],
    kit: [['Cave Horror', 'worm', '#4a3a6a', 'tank'], ['Deep Stalker', 'spider', '#3a3a5a', 'fast'], ['Umbral Witch', 'witch', '#6a4a9a', 'caster'], ['Gloom Husk', 'husk', '#4a4a6a', 'grunt'], ['Dark Wisp', 'wisp', '#8a6ad8', 'caster']], bosses: ['The Unlit One', 'Maw of the Deep', 'Nyx-Thar'], elite: ['Deep Knight', 'skeleton', '#5a4a8a'] },
  { id: 'crystal', kind: 'cave', theme: 'cave', ground: 'grass', fill: 0.54, pool: 0.72, crystal: 0.08, adj: ['Prismatic', 'Crystalline', 'Shardfall', 'Geode', 'Radiant', 'Gleaming'], noun: ['Caverns', 'Vaults', 'Galleries', 'Hollows', 'Grottos', 'Mines'],
    kit: [['Crystal Golem', 'golem', '#a8e8ff', 'tank'], ['Shard Imp', 'imp', '#d0a8ff', 'fast'], ['Prism Witch', 'witch', '#ffb8f0', 'caster'], ['Geode Crawler', 'scorpion', '#98d8e8', 'grunt'], ['Glimmer Wisp', 'wisp', '#ffffff', 'caster']], bosses: ['The Prism Titan', 'Queen Quartz', 'Geodion'], elite: ['Shardblade', 'skeleton', '#b8f0ff'] },
  { id: 'sky', theme: 'snow', ground: 'grass', patch: [0.6, 'cobble'], edge: 'rock', trees: 0.7, thin: 0.5, water: 0.76, rocks: 0.68, adj: ['Celestial', 'Aerial', 'Skyhold', 'Cloudpiercer', 'Starlit', 'Heavenreach'], noun: ['Terraces', 'Isles', 'Steps', 'Gardens', 'Reaches', 'Gates'],
    kit: [['Cloud Drake', 'scorpion', '#e8f0ff', 'fast'], ['Star Golem', 'golem', '#ffe8a8', 'tank'], ['Seraph Witch', 'witch', '#fff0c8', 'caster'], ['Wind Wraith', 'wraith', '#d8e8ff', 'fast'], ['Sun Wisp', 'wisp', '#ffe890', 'caster']], bosses: ['Aurelion', 'The Cloud Empress', 'Helioth'], elite: ['Skyguard', 'warden', '#fff0b0'] },
  { id: 'void', theme: 'main', ground: 'sand', patch: [0.5, 'cobble'], edge: 'rock', trees: 0.84, thin: 0.45, water: 0.7, rocks: 0.62, clear: 'cobble', adj: ['Voidtouched', 'Riftscarred', 'Nether', 'Eclipsed', 'Starless', 'Unwritten'], noun: ['Expanse', 'Rift', 'Wastes', 'Margin', 'Beyond', 'Fringe'],
    kit: [['Void Stalker', 'hound', '#6a4aa8', 'fast'], ['Rift Knight', 'skeleton', '#8a6ad8', 'grunt'], ['Nether Witch', 'witch', '#a888e8', 'caster'], ['Eclipse Golem', 'golem', '#4a3a78', 'tank'], ['Null Wisp', 'wisp', '#b8a0ff', 'caster']], bosses: ['The Unwritten King', 'Oblivara', 'Rift Emperor Zhul'], elite: ['Rift Warden', 'warden', '#7a5ac8'] },
];
const PREFIX = ['', 'Elder ', 'Dread ', 'Grim ', 'Ancient ', 'Primal ', 'Eternal ', 'Mythic '];
const ROLE = {
  grunt:  { hp: 14, atk: 1.35, def: 0.8,  speed: 3.0, xp: 18, moves: ['claw', 'lunge', 'smash'] },
  tank:   { hp: 21, atk: 1.2,  def: 1.05, speed: 2.2, xp: 22, moves: ['smash', 'slam', 'lunge'] },
  caster: { hp: 11, atk: 1.55, def: 0.6,  speed: 2.6, xp: 21, moves: ['nova', 'spit', 'rift_beam'], kite: 5 },
  fast:   { hp: 10, atk: 1.3,  def: 0.65, speed: 3.5, xp: 17, moves: ['bite', 'lunge', 'claw'] },
};
const TOMES = ['sunder', 'second_wind', 'chain_lightning', 'arcane_missiles', 'deadeye', 'caltrops', 'magma_spike', 'quicksilver_flask', 'fast_exit'];
const BOSS_MOVES = [['smash', 'slam', 'lunge', 'nova', 'void_slam'], ['sentence', 'rift_beam', 'void_slam', 'nova', 'smash'], ['colossus_stomp', 'magma_burst', 'ember_fan', 'smash', 'slam'], ['unwrite', 'page_storm', 'rift_collapse', 'sentence', 'void_slam'], ['world_slam', 'thorn_volley', 'root_lash', 'smash', 'slam']];
const tierForLevel = (L) => { let t = EXP_TIERS[0]; for (const x of EXP_TIERS) if (x.lvl <= L + 4) t = x; return t; };

// Enemy templates. `pwr` scales the damage of every move (so bosses keep up with player health at high levels).
function mobDef(name, shape, color, L, role, tier, res = {}, drops = []) {
  const r = ROLE[role], hl = effLevel(L);
  return { name, shape, color, hp: Math.round(r.hp * hl), atk: Math.round(r.atk * L), def: Math.round(r.def * L), speed: r.speed, moves: r.moves, kite: r.kite, res, xp: Math.round(r.xp * L), gold: [Math.round(L * 6), Math.round(L * 9.5)], pwr: Math.max(1, +(L / 33).toFixed(2)), drops: [[tier.ore, 0.22, 1, 2], [tier.ing, 0.05, 1, 1], ...drops], tomes: TOMES.slice(0, 5) };
}
const eliteDef = (name, shape, color, L, tier) => ({ tough: 2.3, name, shape, color, hp: Math.round(52 * effLevel(L)), atk: Math.round(1.25 * L), def: Math.round(1.05 * L), speed: 2.6, moves: ['smash', 'lunge', 'nova', 'void_slam'], res: { arcane: 0.8 }, xp: Math.round(75 * L), gold: [Math.round(L * 28), Math.round(L * 45)], pwr: Math.max(1, +(L / 33).toFixed(2)), drops: [[tier.ore, 1, 1, 3], [tier.ing, 0.25, 1, 2], ['starmetal', 0.05, 1, 1]], tomes: TOMES });
const bossDef = (name, shape, color, L, tier, moves) => ({ tough: 2.5, name, shape, color, hp: Math.round(76 * effLevel(L)), atk: Math.round(1.2 * L), def: Math.round(0.85 * L), speed: 2.4, moves, res: { arcane: 0.7, blunt: 0.9 }, xp: Math.round(190 * L), gold: [Math.round(L * 50), Math.round(L * 85)], pwr: Math.max(1, +(L / 33).toFixed(2)), drops: [[tier.ore, 1, 3, 6], [tier.ing, 0.7, 1, 3], ['starmetal', 0.4, 1, 1], ['echo_shard', 0.6, 1, 3]], boss: true, tomes: TOMES });

export { mobDef, eliteDef, bossDef, ROLE, BOSS_MOVES };
export const EXP_ENEMIES = {};   // id → enemy definition
export const EXP_ZONES = [];     // zone specs for the data tables AND the map builder
const VENDORS = ['Marek the Far-Trader', 'Isolde the Wayfinder', 'Bram Ironcoat', 'Sable the Peddler', 'Tobin Longstride', 'Yara of the Caravans', 'Dun the Haggler', 'Ottilie Brass', 'Kestrel the Courier', 'Old Hale'];
const INNS = ['The Last Lantern', 'The Weary Wyrm', 'The Rusted Crown', 'The Hollow Tankard', 'The Gilded Stag', 'The Stormcaller', 'The Wanderer\'s Rest', 'The Burning Candle', 'The Drowned Bell', 'The Silent Mug'];
const ELDERS = ['Warden Corvane', 'Elder Mirenna', 'Captain Hask', 'Speaker Ilvane', 'Reeve Dostoff', 'Matron Hale', 'Archon Veil', 'Provost Aldric', 'Steward Nym', 'Seer Odalys'];
const LORE = [(n) => `${n} was settled by people who did not read the warnings. The warnings were correct.`, (n) => `Travellers say the road through ${n} was built by hands that no longer exist.`, (n) => `The old maps of ${n} do not match the land. Trust the land.`, (n) => `Something big sleeps under ${n}. We keep the tavern loud so it does not wake.`, (n) => `Everything that dies in ${n} gets up again. Eventually it stops getting up. Eventually.`, (n) => `The waystone in ${n} still works. It is the only thing here that does.`, (n) => `A caravan went into ${n} last spring. Their wagons came back. Only the wagons.`, (n) => `The lord of ${n} has not been seen in years. The tax collector has.`];

// ── the regions ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const used = new Set();
function zoneName(b, r) { for (let k = 0; k < 40; k++) { const n = `${pick(r, b.adj)} ${pick(r, b.noun)}`; if (!used.has(n)) { used.add(n); return n; } } let n = 2; while (used.has(`${b.adj[0]} ${b.noun[0]} ${n}`)) n++; const x = `${b.adj[0]} ${b.noun[0]} ${n}`; used.add(x); return x; }
const LAIR_AT = [0.5, 0.12];
// ── THE FAR REACHES: a ring continent ───────────────────────────────────────────────────────────────────────────────────────────────────
// Aether Reach leads to the Crossing (the hub). From it two roads climb round a great ring - west through the Mirelands and east through the
// Ember Sands - and meet at the Gate of the Crown in the north. Behind the gate is the Crown itself. Spurs branch off the ring to dungeons
// and lair bosses nobody has to visit. Levels rise with the road distance from the Crossing, so every region lists the level it expects.
// Grid cells are [x, y, biome, role, parent?]; x runs east, y runs south, so north is negative y. Original Aether Reach sits at [2, -3].
const CELL = [
  [2, -4, 'ashen', 'hub'],
  [1, -4, 'sylvan', 'spur', [2, -4]], [3, -4, 'dune', 'spur', [2, -4]], [4, -4, 'storm', 'spur', [3, -4]], [5, -4, 'ruin', 'spur', [4, -4]],
  [2, -5, 'ruin', 'ring'], [1, -5, 'sylvan', 'ring'], [0, -5, 'marsh', 'ring'], [-1, -5, 'bone', 'ring'], [3, -5, 'dune', 'ring'], [4, -5, 'ashen', 'ring'], [5, -5, 'storm', 'ring'],
  [-1, -6, 'marsh', 'ring'], [-1, -7, 'sylvan', 'ring'], [-1, -8, 'abyss', 'ring'], [-1, -9, 'marsh', 'ring'], [-1, -10, 'frost', 'ring'],
  [5, -6, 'ruin', 'ring'], [5, -7, 'bone', 'ring'], [5, -8, 'dune', 'ring'], [5, -9, 'ashen', 'ring'], [5, -10, 'sky', 'ring'],
  [0, -10, 'frost', 'ring'], [1, -10, 'crystal', 'ring'], [2, -10, 'sky', 'ring'], [3, -10, 'crystal', 'ring'], [4, -10, 'frost', 'ring'],
  [2, -9, 'void', 'crown'], [2, -8, 'storm', 'crown'], [1, -8, 'abyss', 'crown'], [3, -8, 'crystal', 'crown'], [2, -7, 'void', 'crown'], [2, -6, 'storm', 'crown'],
  [1, -7, 'void', 'crown'], [3, -7, 'abyss', 'crown'],
  [-2, -5, 'bone', 'spur', [-1, -5]], [-2, -6, 'marsh', 'spur', [-1, -6]], [-2, -8, 'sylvan', 'spur', [-1, -8]], [-3, -8, 'marsh', 'spur', [-2, -8]], [-2, -10, 'frost', 'spur', [-1, -10]],
  [6, -6, 'ruin', 'spur', [5, -6]], [6, -8, 'dune', 'spur', [5, -8]], [7, -8, 'ashen', 'spur', [6, -8]], [6, -10, 'sky', 'spur', [5, -10]],
  [0, -11, 'crystal', 'spur', [0, -10]], [2, -11, 'sky', 'spur', [2, -10]], [2, -12, 'void', 'spur', [2, -11]], [4, -11, 'storm', 'spur', [4, -10]],
];
const key = (x, y) => `${x},${y}`;
const cellAt = new Map(CELL.map((c) => [key(c[0], c[1]), c]));
// who is joined to whom (ring cells to their ring neighbours, crown cells as a small tree, spurs to their parents)
const FAR_LINKS = [];
const join = (a, b) => { if (cellAt.has(key(...a)) && cellAt.has(key(...b))) FAR_LINKS.push([a, b]); else throw new Error(`far reaches layout: ${a} / ${b}`); };
join([2, -4], [2, -5]);
for (const [a, b] of [[[2, -5], [1, -5]], [[1, -5], [0, -5]], [[0, -5], [-1, -5]], [[2, -5], [3, -5]], [[3, -5], [4, -5]], [[4, -5], [5, -5]]]) join(a, b);
for (let y = -5; y > -10; y--) { join([-1, y], [-1, y - 1]); join([5, y], [5, y - 1]); }
for (let x = -1; x < 5; x++) join([x, -10], [x + 1, -10]);
for (const [a, b] of [[[2, -10], [2, -9]], [[2, -9], [2, -8]], [[2, -8], [1, -8]], [[2, -8], [3, -8]], [[2, -8], [2, -7]], [[2, -7], [2, -6]], [[1, -8], [1, -7]], [[3, -8], [3, -7]]]) join(a, b);
for (const c of CELL) if (c[3] === 'spur') join(c[4], [c[0], c[1]]);
// breadth-first from the hub: depth sets the level, parents set the arrival side of each region
const nbr = new Map(); for (const [a, b] of FAR_LINKS) { (nbr.get(key(...a)) ?? nbr.set(key(...a), []).get(key(...a))).push(b); (nbr.get(key(...b)) ?? nbr.set(key(...b), []).get(key(...b))).push(a); }
const depth = new Map([[key(2, -4), 0]]), order = [[2, -4]], par = new Map();
for (let q = 0; q < order.length; q++) for (const n of nbr.get(key(...order[q])) ?? []) if (!depth.has(key(...n))) { depth.set(key(...n), depth.get(key(...order[q])) + 1); par.set(key(...n), order[q]); order.push(n); }
if (order.length !== CELL.length) throw new Error('far reaches layout is not connected');
let nMain = 0, nSide = 0; const idOf = new Map();
for (const [x, y] of order) { const c = cellAt.get(key(x, y)); idOf.set(key(x, y), c[3] === 'spur' ? `far_s${String(nSide++).padStart(2, '0')}` : `far_p${String(nMain++).padStart(2, '0')}`); }
export const FAR_POS = Object.fromEntries(order.map(([x, y]) => [idOf.get(key(x, y)), [x, y]]));
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
// [from, to, side of `from` the road leaves by] in breadth-first order, so each region's first portal faces the hub
export const FAR_EDGES = [];
for (const [x, y] of order) for (const n of nbr.get(key(x, y)) ?? []) if (depth.get(key(...n)) === depth.get(key(x, y)) + 1) { const d = Object.entries(DIRS).find(([, v]) => v[0] === n[0] - x && v[1] === n[1] - y)[0]; FAR_EDGES.push([idOf.get(key(x, y)), idOf.get(key(...n)), d]); }
// edges between regions at equal depth (the ring top, crown rungs) - joined too, after the tree edges
for (const [a, b] of FAR_LINKS) if (depth.get(key(...a)) === depth.get(key(...b))) { const d = Object.entries(DIRS).find(([, v]) => v[0] === b[0] - a[0] && v[1] === b[1] - a[1])[0]; FAR_EDGES.push([idOf.get(key(...a)), idOf.get(key(...b)), d]); }
export const FAR_GATES = {};   // raid gates: region ids, filled below

let zi = 0;
for (const [cx, cy] of order) {
  const c = cellAt.get(key(cx, cy)), id = idOf.get(key(cx, cy)), dpt = depth.get(key(cx, cy)), spur = c[3] === 'spur', i = zi++, r = mulberry(5000 + i * 97), b = BIOMES.find((x) => x.id === c[2]);
  const L = Math.min(100, Math.round(34 + dpt * 4.125)), tier = tierForLevel(L), name = zoneName(b, r), cave = b.kind === 'cave', pi = dpt;
  const kitStart = (i * 2) % 5, picks = [0, 1, 2, 3].map((k) => b.kit[(kitStart + k) % 5]), pre = PREFIX[Math.min(PREFIX.length - 1, Math.floor(dpt / 2.2))];
  const enemyIds = []; picks.forEach(([nm, sh, col, role], k) => { const eid = `${id}_m${k}`; EXP_ENEMIES[eid] = mobDef(`${pre}${nm}`, sh, col, L + (k % 2), role, tier, k === 1 ? { blunt: 0.85 } : k === 2 ? { arcane: 0.7 } : {}); enemyIds.push(eid); });
  const eliteId = `${id}_e`, bossId = `${id}_b`, bn = b.bosses[(i + (spur ? 1 : 0)) % b.bosses.length];
  EXP_ENEMIES[eliteId] = eliteDef(`${pre}${b.elite[0]}`, b.elite[1], b.elite[2], L + 2, tier);
  EXP_ENEMIES[bossId] = bossDef(spur ? `${bn} the Lesser` : bn, picks[1][1] === 'golem' ? 'golem' : 'brute', picks[1][2], L + 3, tier, BOSS_MOVES[(i + pi) % BOSS_MOVES.length]);
  const village = !cave && (c[3] === 'hub' || (c[3] === 'ring' && dpt % 4 === 0) || (c[3] === 'crown' && cx === 2 && cy === -9)), dun = spur && !cave, dk = `far_d${String(i).padStart(2, '0')}`;
  // exits (as fractions of the region's edges): where the roads leave, so the lair can be put well away from them
  const exitsAt = []; for (const [a, bb, d] of FAR_EDGES) { const back = { n: 's', s: 'n', e: 'w', w: 'e' }[d]; if (idOf.get(key(cx, cy)) === a) exitsAt.push(d); if (idOf.get(key(cx, cy)) === bb) exitsAt.push(back); }
  const edgePt = (d) => (d === 'n' ? [0.5, 0] : d === 's' ? [0.5, 1] : d === 'w' ? [0, 0.5] : [1, 0.5]);
  const LAIRS = [[0.2, 0.2], [0.8, 0.2], [0.2, 0.78], [0.8, 0.74], [0.5, 0.5]], lairAt = LAIRS.map((p) => ({ p, d: Math.min(9, ...exitsAt.map((e) => { const q = edgePt(e); return Math.hypot((p[0] - q[0]) * 1.4, p[1] - q[1]); })) })).sort((u, v) => v.d - u.d)[(i % 2)].p;
  const lm = [];
  if (village) lm.push({ t: 'village', at: [0.5, 0.78], vendor: pick(r, VENDORS), inn: pick(r, INNS), elder: pick(r, ELDERS), lines: [pick(r, LORE)(name), pick(r, LORE)(name)] });
  if (dun && !cave) lm.push({ t: 'dungeon', at: [0.82 - r() * 0.1, 0.3 + r() * 0.15], to: `${dk}_1`, label: `${name.split(' ')[0]} Depths (Lv ${L + 1}-${L + 5})`, signName: `${name.split(' ')[0]} Depths`, lines: [`THE ${name.toUpperCase()} DEPTHS. Whatever is down there has been waiting. (Lv ${L + 1}-${L + 5})`] });
  const jit = () => (r() - 0.5) * 0.12;
  if (!cave) lm.push({ t: 'camp', at: [0.2 + jit(), 0.4 + jit()], chest: `${pick(r, b.noun)} Camp` }, { t: 'camp', at: [0.78 + jit(), 0.35 + jit()] }, { t: 'ruin', at: [0.4 + jit(), 0.62 + jit()], chest: `${pick(r, b.adj)} Ruin` }, { t: 'ruin', at: [0.7 + jit(), 0.66 + jit()], chest: `Lost ${pick(r, ['Cache', 'Vault', 'Reliquary', 'Strongbox'])}` }, { t: 'tower', at: [0.3 + jit(), 0.28 + jit()], name: `${pick(r, ['Watch', 'Signal', 'Memorial', 'Old'])} Stone`, lines: [`Scratched into the stone: ${pick(r, ['THE ROAD GOES ON AND SO MUST YOU.', 'TURN BACK OR CARRY MORE POTIONS.', 'THE BEAST IN THE NORTH IS NOT THE WORST OF IT.', 'WE WERE HERE. THEN WE WERE NOT.', 'SEVEN CAME. ONE LEFT.'])}`] }, { t: 'shrine', at: [0.85 + jit(), 0.8 + jit()] }, { t: 'lair', at: lairAt });
  const nodes = { [tier.id]: cave ? 22 : 16 + (pi % 5), herb: 8, hide: 6, ore: 4 + (pi % 3) * 2, coal: 4 + (pi % 2) * 3 }; if (b.id === 'frost' || b.id === 'sky') nodes.frostbloom = 8; if (b.id === 'marsh' || b.id === 'abyss' || b.id === 'void') nodes.ghostbloom = 5; if (cave || b.id === 'crystal') nodes.echo = 6;
  const spec = { id, name, lvl: L, kind: cave ? 'cave' : 'out', theme: b.theme, biome: b.id, w: cave ? 128 : spur ? 144 : 176, h: cave ? 104 : spur ? 104 : 128, seed: 6100 + i * 31, ground: b.ground, patch: b.patch, edge: b.edge, trees: b.trees, thin: b.thin, water: b.water, rocks: b.rocks, clear: b.clear, fs: 12 + (i % 7) * 2, fill: b.fill, pool: b.pool, crystal: b.crystal, landmarks: lm, nodes, mobs: cave ? 56 : 60 + (pi % 4) * 2, elites: cave ? 5 : undefined, chests: 9, deco: [['bones', 12, { solid: false }], ['stump', 6]], waystones: 1,
    enemies: enemyIds, elite: eliteId, boss: bossId, tier: tier.id, parent: par.has(key(cx, cy)) ? idOf.get(key(...par.get(key(cx, cy)))) : 'aether_reach', depth: dpt, role: c[3], biomeId: b.id, gx: cx, gy: cy, village, dungeon: dun ? dk : null };
  EXP_ZONES.push(spec);
  // the dungeon behind this region
  if (dun) {
    const dl = L + 1, dBoss = `${dk}_b`; EXP_ENEMIES[dBoss] = bossDef(`${bn}, Warden of the Depths`, 'warden', picks[2][2], dl + 4, tier, BOSS_MOVES[(i + 2) % BOSS_MOVES.length]);
    const de = [0, 1, 2, 3].map((k) => { const eid = `${dk}_m${k}`, p = b.kit[(kitStart + k + 1) % 5]; EXP_ENEMIES[eid] = mobDef(`${pre}${p[0]}`, p[1], p[2], dl + (k % 3), p[3], tier); return eid; });
    EXP_ZONES.push({ id: `${dk}_1`, name: `${name.split(' ')[0]} Depths — Upper`, lvl: dl, dungeon: true, biome: b.id, theme: cave ? 'cave' : b.theme === 'desert' ? 'desert' : b.theme, enemies: de, elite: eliteId, tier: tier.id, floor: 1, dk, seed: 7100 + i * 13, parentZone: id });
    EXP_ZONES.push({ id: `${dk}_2`, name: `${name.split(' ')[0]} Depths — Heart`, lvl: dl + 2, dungeon: true, biome: b.id, theme: cave ? 'cave' : b.theme, enemies: de, elite: eliteId, boss: dBoss, tier: tier.id, floor: 2, dk, seed: 7101 + i * 13, parentZone: id });
  }
}


// raid gates: the first is a hub spur (an early raid), the second is the front door of the Crown
FAR_GATES.void_citadel = idOf.get(key(3, -4)); FAR_GATES.wyrmcrown = idOf.get(key(2, -9));

// ── the Endless Spire ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const SPIRE_FLOORS = 120, SPIRE_BAND = 5;
export const spireLevel = (f) => Math.max(3, Math.round(3 + f * 0.9));
export const SPIRE_ZONES = []; // dungeon-zone specs, one per floor
for (let band = 0; band < SPIRE_FLOORS / SPIRE_BAND; band++) {
  const r = mulberry(9000 + band * 53), b = BIOMES[band % BIOMES.length], L0 = spireLevel(band * SPIRE_BAND + 3), tier = tierForLevel(L0);
  const ids = [0, 1, 2, 3].map((k) => { const p = b.kit[(band + k) % 5], eid = `sp${band}_m${k}`; EXP_ENEMIES[eid] = mobDef(`${PREFIX[Math.min(7, Math.floor(band / 3))]}${p[0]}`, p[1], p[2], L0 + (k % 2), p[3], band < 6 ? { ...tierForLevel(34), ore: 'iron_ore', ing: 'steel_ingot' } : tier); return eid; });
  const eid = `sp${band}_e`, bid = `sp${band}_b`; EXP_ENEMIES[eid] = eliteDef(`${PREFIX[Math.min(7, Math.floor(band / 3))]}${b.elite[0]}`, b.elite[1], b.elite[2], L0 + 2, band < 6 ? { ...tierForLevel(34), ore: 'iron_ore', ing: 'steel_ingot' } : tier);
  EXP_ENEMIES[bid] = bossDef(`${b.bosses[band % 3]}, Spire Guardian`, 'warden', b.kit[1][2], L0 + 3, band < 6 ? { ...tierForLevel(34), ore: 'iron_ore', ing: 'steel_ingot' } : tier, BOSS_MOVES[band % BOSS_MOVES.length]);
  for (let k = 0; k < SPIRE_BAND; k++) {
    const f = band * SPIRE_BAND + k + 1, bossFloor = f % 10 === 0;
    SPIRE_ZONES.push({ id: `spire_${f}`, name: `Endless Spire — Floor ${f}`, lvl: spireLevel(f), dungeon: true, spire: f, theme: b.theme === 'desert' ? 'desert' : b.theme === 'volcano' ? 'volcano' : b.theme === 'snow' ? 'snow' : b.theme === 'swamp' ? 'swamp' : 'cave', enemies: ids, elite: eid, boss: bossFloor ? bid : undefined, seed: 12000 + f * 7, rooms: 8 + (f % 5), elites: 2 + Math.floor(f / 25), bossFloor });
  }
}

// ── potions for the long climb: heal a percentage of maximum health, so they stay useful at any level ──────────────────────────────────
export const EXP_POTIONS = [
  { id: 'greater_tonic',   n: 'Greater Marrow Tonic',  v: 90,   pct: 0.25, lvl: 18, color: '#ff4a6a', in: { herb: 3, ink: 1 } },
  { id: 'superior_elixir', n: 'Superior Elixir',       v: 260,  pct: 0.35, lvl: 36, color: '#ff7a4a', in: { herb: 4, frostbloom: 2 } },
  { id: 'grand_elixir',    n: 'Grand Elixir',          v: 700,  pct: 0.45, lvl: 56, color: '#ffb84a', in: { herb: 5, ghostbloom: 3, echo_shard: 1 } },
  { id: 'supreme_elixir',  n: 'Supreme Elixir',        v: 1800, pct: 0.55, lvl: 76, color: '#ffe36b', in: { herb: 6, ghostbloom: 4, echo_shard: 2 } },
  { id: 'mana_surge',      n: 'Mana Surge',            v: 80,   mpPct: 0.3, lvl: 22, color: '#4ad8ff', in: { herb: 2, ink: 2 } },
  { id: 'grand_mana',      n: 'Grand Mana Draught',    v: 600,  mpPct: 0.5, lvl: 60, color: '#6aa8ff', in: { herb: 4, ghostbloom: 2, echo_shard: 1 } },
];
