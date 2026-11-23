// ─────────────────────────────────────────────────────────────────────────────
// ENDGAME CONTENT — three new regions beyond the Crystal Caverns, the Emberwaste and the Ruined Citadel, two new dungeons, and the
// enemies that live there. They are where the new Moonsilver, Cinderforged and Aetherium ores are mined.
//
//   Moonspire Heights (Lv 22)   north of the Crystal Caverns   · Moonlit Barrow dungeon
//   The Cinder Foundry (Lv 25)  east of the Emberwaste
//   Aether Reach (Lv 28)        north of the Ruined Citadel    · Aether Vault dungeon
// ─────────────────────────────────────────────────────────────────────────────
// Enemy stats follow the same curve as the existing late-game roster (stats scale again with the zone level at spawn time).
const ROLE = {
  grunt:  { hp: 14, atk: 1.35, def: 0.8,  speed: 3.0, xp: 18, moves: ['claw', 'lunge', 'smash'] },
  tank:   { hp: 21, atk: 1.2,  def: 1.05, speed: 2.2, xp: 22, moves: ['smash', 'slam', 'lunge'] },
  caster: { hp: 11, atk: 1.55, def: 0.6,  speed: 2.6, xp: 21, moves: ['nova', 'spit', 'rift_beam'], kite: 5 },
  fast:   { hp: 10, atk: 1.3,  def: 0.65, speed: 3.5, xp: 17, moves: ['bite', 'lunge', 'claw'] },
};
const TOMES = ['sunder', 'second_wind', 'chain_lightning', 'arcane_missiles', 'deadeye', 'caltrops', 'magma_spike', 'quicksilver_flask', 'fast_exit'];
function mob(id, name, shape, color, L, role, ore, res = {}, extra = {}) {
  const r = ROLE[role];
  return [id, { name, shape, color, hp: Math.round(r.hp * L), atk: Math.round(r.atk * L), def: Math.round(r.def * L), speed: r.speed, moves: r.moves, kite: r.kite, res, xp: Math.round(r.xp * L), gold: [Math.round(L * 6), Math.round(L * 9.5)], drops: ore ? [[ore, 0.22, 1, 2], ['steel_ingot', 0.1, 1, 1]] : [], tomes: TOMES.slice(0, 5), ...extra }];
}
const elite = (id, name, shape, color, L, ore, extra = {}) => [id, { tough: 2.3, name, shape, color, hp: Math.round(52 * L), atk: Math.round(1.25 * L), def: Math.round(1.05 * L), speed: 2.6, moves: ['smash', 'lunge', 'nova', 'void_slam'], res: { arcane: 0.8 }, xp: Math.round(75 * L), gold: [Math.round(L * 28), Math.round(L * 45)], drops: [[ore, 1, 1, 3], ['starmetal', 0.05, 1, 1]], tomes: TOMES, ...extra }];
const boss = (id, name, shape, color, L, ore, moves, extra = {}) => [id, { tough: 2.5, name, shape, color, hp: Math.round(76 * L), atk: Math.round(1.2 * L), def: Math.round(0.85 * L), speed: 2.4, moves, res: { arcane: 0.7, blunt: 0.9 }, xp: Math.round(190 * L), gold: [Math.round(L * 50), Math.round(L * 85)], drops: [[ore, 1, 3, 6], ['starmetal', 0.4, 1, 1], ['echo_shard', 0.6, 1, 3]], boss: true, tomes: TOMES, ...extra }];

export const NEW_ENEMIES = Object.fromEntries([
  // Moonspire Heights
  mob('moon_stalker', 'Moon Stalker', 'wraith', '#bfe0ff', 22, 'fast', 'moonsilver_ore', { slash: 0.7, arcane: 1.2 }),
  mob('glacier_brute', 'Glacier Brute', 'brute', '#8ac0f0', 23, 'tank', 'moonsilver_ore', { blunt: 0.8, arcane: 1.2 }),
  mob('rime_witch', 'Rime Witch', 'witch', '#a8c8f0', 22, 'caster', 'moonsilver_ore', { arcane: 0.6 }),
  mob('lunar_hound', 'Lunar Hound', 'hound', '#e8f2ff', 23, 'fast', 'moonsilver_ore'),
  elite('frost_revenant', 'Frost Revenant', 'skeleton', '#7ab0e0', 24, 'moonsilver_ore'),
  boss('moon_queen', 'The Moon Queen', 'warden', '#cfe3ff', 25, 'moonsilver_ore', ['sentence', 'rift_beam', 'void_slam', 'nova', 'smash', 'page_storm']),
  // Moonlit Barrow (dungeon)
  mob('barrow_wight', 'Barrow Wight', 'skeleton', '#9ab0c8', 24, 'grunt', 'moonsilver_ore', { slash: 0.7, pierce: 0.7 }),
  mob('pale_acolyte', 'Pale Acolyte', 'witch', '#d0d8f0', 24, 'caster', 'moonsilver_ore'),
  boss('barrow_king', 'The Barrow King', 'skeleton', '#b8c8e8', 26, 'moonsilver_ore', ['smash', 'lunge', 'nova', 'void_slam', 'sentence']),
  // The Cinder Foundry
  mob('slag_golem', 'Slag Golem', 'golem', '#d86a2a', 25, 'tank', 'cinder_ore', { blunt: 0.8, arcane: 0.5 }),
  mob('forge_wraith', 'Forge Wraith', 'wisp', '#ff9a4a', 25, 'caster', 'cinder_ore', { arcane: 0.6 }),
  mob('cinder_hound', 'Cinder Hound', 'hound', '#ff7a3a', 26, 'fast', 'cinder_ore'),
  mob('foundry_overseer', 'Foundry Overseer', 'brute', '#c85a2a', 26, 'grunt', 'cinder_ore', { slash: 0.8 }),
  elite('molten_knight', 'Molten Knight', 'skeleton', '#ff6a2a', 27, 'cinder_ore'),
  boss('forge_tyrant', 'The Forge Tyrant', 'brute', '#ff5a1a', 28, 'cinder_ore', ['colossus_stomp', 'magma_burst', 'ember_fan', 'smash', 'slam']),
  // Aether Reach
  mob('aether_sprite', 'Aether Sprite', 'wisp', '#6af0d0', 28, 'caster', 'aether_ore', { arcane: 0.5 }),
  mob('star_golem', 'Star Golem', 'golem', '#8affd8', 29, 'tank', 'aether_ore', { arcane: 0.7 }),
  mob('prism_stalker', 'Prism Stalker', 'hound', '#b8fff0', 29, 'fast', 'aether_ore'),
  mob('void_knight', 'Void Knight', 'skeleton', '#6a5aa8', 30, 'grunt', 'aether_ore', { slash: 0.7, arcane: 0.8 }),
  elite('astral_horror', 'Astral Horror', 'worm', '#8affd8', 30, 'aether_ore'),
  boss('aether_sovereign', 'The Aether Sovereign', 'warden', '#6af0d0', 32, 'aether_ore', ['rift_collapse', 'rift_beam', 'void_slam', 'unwrite', 'page_storm', 'sentence']),
  // Aether Vault (dungeon)
  mob('vault_sentinel', 'Vault Sentinel', 'golem', '#9ac8d8', 30, 'tank', 'aether_ore'),
  mob('rune_wraith', 'Rune Wraith', 'wraith', '#8ae8ff', 30, 'caster', 'aether_ore'),
  boss('vault_warden', 'The Vault Warden', 'warden', '#8ae8ff', 33, 'aether_ore', ['sentence', 'void_slam', 'rift_collapse', 'smash', 'nova', 'unwrite']),
].map(([id, d]) => [id, d]));

export const NEW_ZONES = {
  moonspire: { id: 'moonspire', name: 'Moonspire Heights', realm: 'main', lvl: 22, enemies: ['moon_stalker', 'glacier_brute', 'rime_witch', 'lunar_hound'], boss: 'moon_queen', elite: 'frost_revenant' },
  moonlit_barrow_1: { id: 'moonlit_barrow_1', name: 'Moonlit Barrow — Cairn', realm: 'main', lvl: 23, dungeon: true, enemies: ['barrow_wight', 'pale_acolyte', 'moon_stalker', 'glacier_brute'], elite: 'frost_revenant' },
  moonlit_barrow_2: { id: 'moonlit_barrow_2', name: 'Moonlit Barrow — Crown Vault', realm: 'main', lvl: 25, dungeon: true, enemies: ['barrow_wight', 'pale_acolyte', 'moon_stalker', 'glacier_brute'], boss: 'barrow_king', elite: 'frost_revenant' },
  cinder_foundry: { id: 'cinder_foundry', name: 'The Cinder Foundry', realm: 'main', lvl: 25, enemies: ['slag_golem', 'forge_wraith', 'cinder_hound', 'foundry_overseer'], boss: 'forge_tyrant', elite: 'molten_knight' },
  aether_reach: { id: 'aether_reach', name: 'Aether Reach', realm: 'main', lvl: 28, enemies: ['aether_sprite', 'star_golem', 'prism_stalker', 'void_knight'], boss: 'aether_sovereign', elite: 'astral_horror' },
  aether_vault_1: { id: 'aether_vault_1', name: 'Aether Vault — Antechamber', realm: 'main', lvl: 29, dungeon: true, enemies: ['vault_sentinel', 'rune_wraith', 'star_golem', 'void_knight'], elite: 'astral_horror' },
  aether_vault_2: { id: 'aether_vault_2', name: 'Aether Vault — Heart', realm: 'main', lvl: 31, dungeon: true, enemies: ['vault_sentinel', 'rune_wraith', 'star_golem', 'void_knight'], boss: 'vault_warden', elite: 'astral_horror' },
};
