// ─────────────────────────────────────────────────────────────────────────────
// GEAR SETS — one grid of archetypes × metal tiers, so every class (hidden and mythic ones too) has weapons and armour that suit it.
//
// Every gear item carries `fits`: the classes it is made for. Wearing a piece that fits your class gives +10% to its stats
// (FIT_BONUS), and the game tells you which classes each piece suits, and which pieces suit your class.
// ─────────────────────────────────────────────────────────────────────────────
export const FIT_BONUS = 0.10;
// The seven places a piece of gear is worn. (Old saves had 'armor': that is now the chestplate, see rules.js normalizeGear.)
export const SLOTS = ['weapon', 'head', 'chest', 'legs', 'feet', 'ring', 'charm'];
export const SLOT_NAMES = { weapon: 'Weapon', head: 'Helmet', chest: 'Chestplate', legs: 'Leggings', feet: 'Boots', ring: 'Ring', charm: 'Charm' };
export const ARMOR_SLOTS = ['head', 'chest', 'legs', 'feet'];

const FIGHTERS = ['warrior', 'mage', 'archer'], HIDDEN = ['archivist', 'desperado', 'soulsmith', 'broker', 'transmuter'], MYTHIC = ['apostle', 'void_sovereign', 'titan_forgemaster', 'philosopher', 'gilded'];
export const ALL_CLASSES = ['warrior', 'mage', 'archer', 'blacksmith', 'alchemist', 'merchant', ...HIDDEN, ...MYTHIC];
void FIGHTERS;

// The seven metal tiers. `ing`/`ore` name the ingot and ore (new tiers add their own); `lvl` is the craft level of the lightest piece.
export const TIERS = [
  { id: 'iron',   name: 'Iron',        ing: 'iron_ingot',      lvl: 1,  mult: 1.4, atk: 6,  def: 3,  hp: 12,  mp: 15 },
  { id: 'steel',  name: 'Steel',       ing: 'steel_ingot',     lvl: 4,  mult: 2.0, atk: 11, def: 6,  hp: 24,  mp: 22 },
  { id: 'hollow', name: 'Shadowsteel', ing: 'hollow_ingot',    lvl: 6,  mult: 2.4, atk: 19, def: 10, hp: 40,  mp: 30, extra: 'echo_shard' },
  { id: 'sun',    name: 'Sunsteel',    ing: 'sunsteel_ingot',  lvl: 10, mult: 3.0, atk: 27, def: 15, hp: 66,  mp: 40 },
  { id: 'moon',   name: 'Moonsilver',  ing: 'moonsilver_ingot', ore: 'moonsilver_ore', oreV: 95,  ingV: 300, lvl: 14, mult: 3.2, atk: 36, def: 21, hp: 95,  mp: 54, extra: 'frostbloom' },
  { id: 'cinder', name: 'Cinderforged', ing: 'cinder_ingot',   ore: 'cinder_ore',     oreV: 140, ingV: 420, lvl: 17, mult: 3.4, atk: 46, def: 28, hp: 130, mp: 70, extra: 'coal' },
  { id: 'aether', name: 'Aetherium',   ing: 'aether_ingot',    ore: 'aether_ore',     oreV: 200, ingV: 580, lvl: 20, mult: 3.6, atk: 58, def: 36, hp: 175, mp: 90, extra: 'echo_shard' },
];

// slot, damage type, stat multipliers, who it is made for, craft-level offset and recipe shape (ingots, leather, and "other" material)
export const ARCH = {
  sword:  { name: 'Blade',      slot: 'weapon', wtype: 'slash',  atk: 1.0,  fits: ['warrior', 'void_sovereign', 'desperado'], off: 1, rec: { ing: 3, leather: 1 }, role: 'swordsmen' },
  spear:  { name: 'Spear',      slot: 'weapon', wtype: 'pierce', atk: 1.0,  fits: ['warrior', 'merchant', 'gilded'], off: 1, rec: { ing: 3, leather: 1 }, role: 'spear-fighters' },
  mace:   { name: 'Maul',       slot: 'weapon', wtype: 'blunt',  atk: 1.05, fits: ['warrior'], off: 1, rec: { ing: 4 }, role: 'heavy hitters' },
  hammer: { name: 'Forgehammer', slot: 'weapon', wtype: 'blunt', atk: 1.0, hp: 0.35, fits: ['blacksmith', 'soulsmith', 'titan_forgemaster'], off: 1, rec: { ing: 4, leather: 1 }, role: 'smiths' },
  staff:  { name: 'Staff',      slot: 'weapon', wtype: 'arcane', atk: 0.95, mp: 0.5, fits: ['mage', 'archivist', 'apostle', 'void_sovereign'], off: 2, rec: { ing: 2, ink: 3, leather: 1 }, role: 'casters' },
  wand:   { name: 'Alembic Wand', slot: 'weapon', wtype: 'arcane', atk: 0.8, mp: 0.9, fits: ['alchemist', 'transmuter', 'philosopher'], off: 2, rec: { ing: 1, ink: 3, leather: 1 }, role: 'alchemists' },
  bow:    { name: 'Bow',        slot: 'weapon', wtype: 'pierce', atk: 1.0,  fits: ['archer', 'apostle'], off: 1, rec: { ing: 2, leather: 3 }, role: 'archers' },
  rapier: { name: 'Rapier',     slot: 'weapon', wtype: 'pierce', atk: 0.92, spd: 1, fits: ['merchant', 'broker', 'gilded'], off: 2, rec: { ing: 2, leather: 2 }, role: 'merchants' },
  pistol: { name: 'Revolver',   slot: 'weapon', wtype: 'pierce', atk: 0.95, crit: 0.03, fits: ['desperado'], off: 2, rec: { ing: 3, coal: 3 }, role: 'gamblers' },
  robe:   { name: 'Robes',      slot: 'chest',  def: 0.45, hp: 0.55, mp: 0.8, fits: ['mage', 'alchemist', 'archivist', 'transmuter', 'philosopher'], off: 1, rec: { leather: 2, parchment: 3, ink: 1 }, role: 'casters and alchemists' },
  coat:   { name: 'Leathers',   slot: 'chest',  def: 0.8,  hp: 0.9,  spd: 1, fits: ['archer', 'merchant', 'broker', 'gilded', 'desperado', 'apostle'], off: 0, rec: { leather: 3, ing: 1 }, role: 'light-armour wearers' },
  mail:   { name: 'Hauberk',    slot: 'chest',  def: 1.0,  hp: 1.0,  fits: ['warrior', 'blacksmith', 'soulsmith', 'void_sovereign'], off: 1, rec: { ing: 4, leather: 2 }, role: 'melee fighters' },
  plate:  { name: 'Aegis',      slot: 'chest',  def: 1.25, hp: 1.25, fits: ['warrior', 'blacksmith', 'titan_forgemaster'], off: 2, rec: { ing: 5, leather: 3 }, role: 'front-line tanks' },
  // helmets: a fifth to a sixth of the chestplate they match
  cowl:   { name: 'Cowl',       slot: 'head', style: 'robe',  def: 0.08, hp: 0.10, mp: 0.30, fits: ['mage', 'alchemist', 'archivist', 'transmuter', 'philosopher'], off: 1, rec: { leather: 1, parchment: 2 }, role: 'casters and alchemists' },
  cap:    { name: 'Cap',        slot: 'head', style: 'coat',  def: 0.14, hp: 0.16, fits: ['archer', 'merchant', 'broker', 'gilded', 'desperado', 'apostle'], off: 0, rec: { leather: 2 }, role: 'light-armour wearers' },
  helm:   { name: 'Helm',       slot: 'head', style: 'mail',  def: 0.17, hp: 0.17, fits: ['warrior', 'blacksmith', 'soulsmith', 'void_sovereign'], off: 1, rec: { ing: 2, leather: 1 }, role: 'melee fighters' },
  greathelm: { name: 'Great Helm', slot: 'head', style: 'plate', def: 0.21, hp: 0.21, fits: ['warrior', 'blacksmith', 'titan_forgemaster'], off: 2, rec: { ing: 3, leather: 1 }, role: 'front-line tanks' },
  // leggings
  wraps:  { name: 'Wraps',      slot: 'legs', style: 'robe',  def: 0.07, hp: 0.09, mp: 0.22, fits: ['mage', 'alchemist', 'archivist', 'transmuter', 'philosopher'], off: 1, rec: { leather: 1, parchment: 2 }, role: 'casters and alchemists' },
  leggings: { name: 'Leggings', slot: 'legs', style: 'coat',  def: 0.12, hp: 0.14, fits: ['archer', 'merchant', 'broker', 'gilded', 'desperado', 'apostle'], off: 0, rec: { leather: 2, ing: 1 }, role: 'light-armour wearers' },
  chausses: { name: 'Chausses', slot: 'legs', style: 'mail',  def: 0.15, hp: 0.15, fits: ['warrior', 'blacksmith', 'soulsmith', 'void_sovereign'], off: 1, rec: { ing: 3, leather: 1 }, role: 'melee fighters' },
  greaves: { name: 'Greaves',   slot: 'legs', style: 'plate', def: 0.19, hp: 0.19, fits: ['warrior', 'blacksmith', 'titan_forgemaster'], off: 2, rec: { ing: 4, leather: 2 }, role: 'front-line tanks' },
  // boots
  slippers: { name: 'Slippers', slot: 'feet', style: 'robe',  def: 0.05, hp: 0.06, mp: 0.16, fits: ['mage', 'alchemist', 'archivist', 'transmuter', 'philosopher'], off: 1, rec: { leather: 1, parchment: 1 }, role: 'casters and alchemists' },
  boots:  { name: 'Boots',      slot: 'feet', style: 'coat',  def: 0.08, hp: 0.09, spd: 1, spdFlat: true, fits: ['archer', 'merchant', 'broker', 'gilded', 'desperado', 'apostle'], off: 0, rec: { leather: 2 }, role: 'light-armour wearers' },
  warboots: { name: 'Warboots', slot: 'feet', style: 'mail',  def: 0.10, hp: 0.10, fits: ['warrior', 'blacksmith', 'soulsmith', 'void_sovereign'], off: 1, rec: { ing: 2, leather: 1 }, role: 'melee fighters' },
  sabatons: { name: 'Sabatons', slot: 'feet', style: 'plate', def: 0.125, hp: 0.125, fits: ['warrior', 'blacksmith', 'titan_forgemaster'], off: 2, rec: { ing: 3, leather: 1 }, role: 'front-line tanks' },
  // rings: small, specialised bonuses
  signet: { name: 'Signet',     slot: 'ring', atk: 0.2, fits: ['warrior', 'desperado', 'soulsmith', 'titan_forgemaster', 'void_sovereign', 'archer'], off: 1, rec: { ing: 1, coal: 1 }, role: 'the aggressive' },
  wardring: { name: 'Warding Ring', slot: 'ring', def: 0.12, hp: 0.12, fits: ['warrior', 'blacksmith', 'soulsmith', 'titan_forgemaster', 'merchant', 'gilded'], off: 1, rec: { ing: 1, leather: 1 }, role: 'the sturdy' },
  sagering: { name: 'Sage Ring', slot: 'ring', mp: 0.55, fits: ['mage', 'alchemist', 'archivist', 'transmuter', 'philosopher', 'apostle'], off: 1, rec: { ing: 1, ink: 1 }, role: 'mana users' },
  galering: { name: 'Gale Ring', slot: 'ring', crit: 0.012, critStep: 0.004, spd: 1, spdFlat: true, fits: ['archer', 'desperado', 'broker', 'merchant', 'gilded', 'void_sovereign'], off: 2, rec: { ing: 1, leather: 1, hide: 1 }, role: 'the quick' },
  locket: { name: 'Locket',     slot: 'charm',  mp: 1.0, fits: ['mage', 'alchemist', 'archivist', 'transmuter', 'philosopher', 'apostle'], off: 1, rec: { ing: 1, ink: 2 }, role: 'mana users' },
  band:   { name: 'Band',       slot: 'charm',  spd: 1, fits: ['archer', 'merchant', 'desperado', 'broker', 'gilded', 'void_sovereign'], off: 0, rec: { ing: 1, leather: 2 }, role: 'the quick' },
  forgecharm: { name: 'Anvil Charm', slot: 'charm', def: 0.5, hp: 0.5, fits: ['warrior', 'blacksmith', 'soulsmith', 'titan_forgemaster'], off: 1, rec: { ing: 2, coal: 2 }, role: 'smiths and warriors' },
};

// Items that already exist under their old ids (kept so nothing in old saves breaks) and which archetype they are.
export const LEGACY = {
  iron_sword: 'iron/sword', steel_sword: 'steel/sword', hollow_blade: 'hollow/sword', sun_blade: 'sun/sword',
  hunting_spear: 'iron/spear', steel_pike: 'steel/spear', hollow_lance: 'hollow/spear',
  short_bow: 'iron/bow', steel_bow: 'steel/bow', hollow_bow: 'hollow/bow', sun_bow: 'sun/bow',
  iron_mace: 'iron/mace', hollow_maul: 'hollow/mace', sun_maul: 'sun/mace',
  focus_rod: 'iron/staff', hollow_rod: 'hollow/staff', sun_rod: 'sun/staff',
  leather_coat: 'iron/coat', iron_mail: 'iron/mail', steel_plate: 'steel/plate', hollow_aegis: 'hollow/plate', sun_aegis: 'sun/plate',
  sanity_locket: 'iron/locket', hollow_locket: 'hollow/locket', swift_band: 'iron/band',
};
const gid = (t, a) => `${t}_${a}`;

export const tierOf = (id) => ITEM_TIER[id] ?? null;
export const archOf = (id) => ITEM_ARCH[id] ?? null;
const ITEM_TIER = {}, ITEM_ARCH = {};
// Which classes an item suits, and whether a class gets the bonus from it.
export const fitsOf = (id) => ARCH[ITEM_ARCH[id]]?.fits ?? [];
export const fits = (id, classId) => fitsOf(id).includes(classId);
// "What should my class wear?" — grouped by slot, derived from the archetypes so it can never disagree with the items.
export function classGear(classId) {
  const out = Object.fromEntries(SLOTS.map((k) => [k, []]));
  for (const a of Object.values(ARCH)) if (a.fits.includes(classId)) out[a.slot].push(a.name.toLowerCase());
  return out;
}

// Adds every missing archetype × tier item, the new ores/ingots and all recipes to the live tables. Prices are never below what the
// materials cost: price = max(current, ingredients × tier multiplier), so top-tier gear is worth what it takes to make.
export function buildGearSets(ITEMS, RECIPES, NODE_TYPES) {
  for (const [id, key] of Object.entries(LEGACY)) { const [t, a] = key.split('/'); ITEM_TIER[id] = t; ITEM_ARCH[id] = a; }
  // new materials
  for (const t of TIERS) if (t.ore) {
    ITEMS[t.ore] = { n: `${t.name} Ore`, k: 'mat', v: t.oreV, icon: '' };
    ITEMS[t.ing] = { n: `${t.name} Ingot`, k: 'inter', v: t.ingV, icon: '' };
    const fuel = t.id === 'cinder' ? 3 : 2;
    RECIPES.push({ id: t.ing, craft: 'blacksmith', lvl: t.lvl - 1, in: { [t.ore]: 2, coal: fuel }, out: t.ing, qty: 1, diff: 0.5 + TIERS.indexOf(t) * 0.03, smelt: true });
    NODE_TYPES[t.id === 'moon' ? 'moonsilver' : t.id] = { name: `${t.name} Vein`, icon: '', item: t.ore, qty: [1, 3], ms: 2300 + TIERS.indexOf(t) * 100, respawn: 60 + TIERS.indexOf(t) * 5 };
  }
  const val = (id) => ITEMS[id]?.v ?? 0;
  TIERS.forEach((T, ti) => {
    for (const [ak, A] of Object.entries(ARCH)) {
      const id = Object.keys(LEGACY).find((k) => LEGACY[k] === `${T.id}/${ak}`) ?? gid(T.id, ak);
      ITEM_TIER[id] = T.id; ITEM_ARCH[id] = ak;
      // forge-charm and the old-tier magic gear only make sense from steel upwards; keep the grid reasonable for the bottom tier
      const exists = ITEMS[id];
      if (!exists) {
        const it = { n: `${T.name} ${A.name}`, k: 'gear', slot: A.slot, icon: '' };
        if (A.wtype) it.wtype = A.wtype;
        if (A.atk) it.atk = Math.max(1, Math.round(T.atk * A.atk));
        if (A.def) it.def = Math.max(1, Math.round(T.def * A.def)); if (A.hp) it.hp = Math.round(T.hp * A.hp); if (A.mp) it.mp = Math.round(T.mp * A.mp);
        if (A.spd) it.spd = A.spdFlat ? A.spd : Math.min(3, A.spd + Math.floor(ti / 3)); if (A.crit) it.crit = +(A.crit + ti * (A.critStep ?? 0.012)).toFixed(3);
        if (T.id === 'hollow') it.tier = 'hollow';
        ITEMS[id] = it;
      }
      ITEMS[id].fits = A.fits;
      // recipe (blacksmith) unless one already exists
      if (!RECIPES.some((r) => r.out === id)) {
        const rec = {}; for (const [m, n] of Object.entries(A.rec)) rec[m === 'ing' ? T.ing : m] = n + (m === 'ing' && ti >= 5 ? 1 : 0);
        if (T.extra && A.slot === 'weapon' && (ak === 'staff' || ak === 'wand')) rec[T.extra] = (rec[T.extra] ?? 0) + 1; else if (T.extra && T.id !== 'iron' && T.id !== 'steel' && T.extra !== 'coal' && ti >= 4) rec[T.extra] = (rec[T.extra] ?? 0) + 1;
        RECIPES.push({ id, craft: 'blacksmith', lvl: T.lvl + A.off, in: rec, out: id, qty: 1, diff: +(0.25 + ti * 0.05 + A.off * 0.02).toFixed(2) });
      }
    }
  });
  // every piece that used to be 'armor' is a chestplate now
  for (const it of Object.values(ITEMS)) if (it.slot === 'armor') it.slot = 'chest';
  // prices: never cheaper than the materials, scaled up by tier
  for (const r of RECIPES) {
    const it = ITEMS[r.out]; if (!it || it.k !== 'gear') continue;
    const cost = Object.entries(r.in).reduce((n, [m, q]) => n + val(m) * q, 0), T = TIERS.find((x) => x.id === ITEM_TIER[r.out]);
    if (T) it.v = Math.max(it.v ?? 0, Math.ceil((cost * T.mult) / 5) * 5);
  }
}
