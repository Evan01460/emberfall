// ─────────────────────────────────────────────────────────────────────────────
// ECONOMY ENGINE — pure, serializable, deterministic given an Rng.
// Designed to run unchanged on an authoritative server: the browser prototype
// simulates other "players" with bots, but real players would just post to the
// same `listings` array.
// Bot archetypes: gatherers (mats), smiths (ingots/gear), alchemists (potions),
// shoppers (demand), and arbitrage merchants (buy underpriced, relist higher).
// ─────────────────────────────────────────────────────────────────────────────
import { ITEMS, qualityPriceMult } from './data.js';
import { clamp } from './rng.js';

export const TRADE_ITEMS = Object.keys(ITEMS).filter((k) => ITEMS[k].k !== 'quest');
export const VENDOR_STOCK = ['iron_ore', 'coal', 'hide', 'herb', 'ink', 'parchment'];
const BOTS = ['Kessa the Hauler', 'Old Brannoch', 'Vey & Daughters', 'Pale Tamsin', 'Gorrick Ironhand', 'Mother Ashlee', 'Dunmore', 'The Quiet Cart', 'Lio of the Lanterns', 'Harrow Wick'];
const MERCHANT_BOTS = ['Silvertongue Imre', 'Quill & Co.', 'Madam Ocher'];

export const EVENT_DEFS = [
  { id: 'raid', text: 'Raiders hit the iron caravans — ore and ingots are in demand!', items: ['iron_ore', 'iron_ingot', 'coal'], bump: 0.55, days: 6 },
  { id: 'fever', text: 'Fever in the lower wards — tonics are flying off shelves.', items: ['heal_potion', 'calm_tonic', 'herb'], bump: 0.7, days: 6 },
  { id: 'war', text: 'Border war: weapons and armor wanted by the garrison.', items: ['iron_sword', 'hunting_spear', 'iron_mace', 'iron_mail', 'steel_sword', 'steel_pike', 'steel_plate', 'leather_coat'], bump: 0.5, days: 7 },
  { id: 'scholars', text: 'Scholars flood the city: ink and parchment sell dear.', items: ['ink', 'parchment', 'light_vial', 'focus_rod'], bump: 0.55, days: 6 },
  { id: 'glut', text: 'A hide glut from the northern herds — leather prices sag.', items: ['hide', 'leather', 'leather_coat'], bump: -0.35, days: 5 },
  { id: 'festival', text: 'Lantern festival: charms and trinkets are in fashion.', items: ['sanity_locket', 'swift_band'], bump: 0.6, days: 5 },
];

export const gearFactor = (q) => qualityPriceMult(q) / qualityPriceMult(0.5);

// Realm price multipliers. The Shadowfell pays dearly for mundane goods and sells its own cheaply —
// merchants who can cross the gate profit from the gap.
export function realmMult(realm, id) {
  const it = ITEMS[id];
  if (realm !== 'hollow') return 1;
  if (it.tier === 'hollow') return 0.55;
  if (it.k === 'key') return 1;
  return it.k === 'gear' ? 1.7 : 2.3;
}

export function createMarket(rng, realm = 'main') {
  const m = {
    id: realm, day: 1, nextId: 1, listings: [], proceeds: [], news: [], events: [], customers: [],
    base: {}, fair: {}, demand: {}, history: {}, lastSale: {}, volume: {}, hint: {},
  };
  for (const id of TRADE_ITEMS) {
    m.base[id] = Math.round(ITEMS[id].v * realmMult(realm, id) * 10) / 10;
    m.fair[id] = m.base[id]; m.demand[id] = 1; m.history[id] = [m.base[id]]; m.volume[id] = 0;
  }
  for (let i = 0; i < 10; i++) tickMarket(m, rng);
  m.day = 1; m.news = ['The Exchange bell rings. Another day of trade.'];
  return m;
}

// Bots only restock what makes sense for the realm; rare goods must come from players.
function botSupplies(m, id) {
  const it = ITEMS[id];
  if (it.k === 'key') return false;
  if (m.id === 'hollow') return it.tier === 'hollow' && it.k === 'mat';
  return it.tier !== 'hollow';
}

// Fair value of a specific item instance.
export function valueOf(m, itemId, q) {
  const it = ITEMS[itemId];
  return (m.fair[itemId] ?? m.base?.[itemId] ?? it.v) * (it.k === 'gear' ? gearFactor(q ?? 0.5) : 1);
}

export function listingValue(m, l) { return valueOf(m, l.itemId, l.q); }

export function vendorSellPrice(itemId) { return VENDOR_STOCK.includes(itemId) ? Math.ceil(ITEMS[itemId].v * 1.6) : null; }
export function vendorBuyPrice(itemId, q) {
  const it = ITEMS[itemId];
  if (it.k === 'quest') return Math.round(it.v * 0.5);
  return Math.max(1, Math.round(it.v * 0.4 * (it.k === 'gear' ? qualityPriceMult(q ?? 0.5) / qualityPriceMult(0.5) : 1)));
}

export function listingsFor(m, itemId) {
  return m.listings.filter((l) => l.itemId === itemId).sort((a, b) => a.price - b.price);
}
export const totalSupply = (m, itemId) => m.listings.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.qty, 0);

function pushListing(m, o) {
  const l = { id: m.nextId++, age: 0, bot: true, qty: 1, ...o };
  m.listings.push(l);
  return l;
}

export function listItem(m, { seller, sellerId, itemId, qty, price, q, affix, uid, x }) {
  return pushListing(m, { seller, sellerId, bot: false, itemId, qty, price: Math.max(1, Math.round(price)), q, affix, uid, x: x ?? null });
}

export function cancelListing(m, id) {
  const i = m.listings.findIndex((l) => l.id === id && !l.bot);
  if (i < 0) return null;
  return m.listings.splice(i, 1)[0];
}

// Removes `qty` from a listing and returns what was taken. Callers move gold/items.
export function takeFromListing(m, id, qty = 1) {
  const l = m.listings.find((x) => x.id === id);
  if (!l) return null;
  const n = Math.min(qty, l.qty);
  l.qty -= n;
  if (l.qty <= 0) m.listings.splice(m.listings.indexOf(l), 1);
  noteSale(m, l.itemId, l.price, n, l.q);
  return { ...l, qty: n, cost: l.price * n };
}

function noteSale(m, itemId, price, n, q) {
  const norm = price / (ITEMS[itemId].k === 'gear' ? gearFactor(q ?? 0.5) : 1);
  m.lastSale[itemId] = norm;
  m.volume[itemId] = (m.volume[itemId] ?? 0) + n;
}

// ── Daily tick ──────────────────────────────────────────────────────────────
export function tickMarket(m, rng) {
  m.day++;
  m.news = [];

  m.events = m.events.filter((e) => --e.days > 0);
  if (m.events.length < 2 && rng.chance(0.16)) {
    const def = rng.pick(EVENT_DEFS);
    if (!m.events.some((e) => e.id === def.id)) { m.events.push({ ...def }); m.news.push(def.text); }
  }

  // demand drifts toward event-adjusted baseline
  for (const id of TRADE_ITEMS) {
    const bump = m.events.reduce((s, e) => s + (e.items.includes(id) ? e.bump : 0), 0);
    const target = 1 + bump;
    m.hint[id] = Math.sign(target - m.demand[id]);
    m.demand[id] = clamp(m.demand[id] + (target - m.demand[id]) * 0.22 + rng.range(-0.07, 0.07), 0.55, 2.3);
  }

  // Bot supply
  for (const id of TRADE_ITEMS) {
    const it = ITEMS[id];
    if (!botSupplies(m, id)) continue;
    const base = { mat: 0.6, inter: 0.38, gear: 0.2, cons: 0.3 }[it.k] ?? 0.2;
    const supply = totalSupply(m, id);
    const p = base * clamp(1.2 / m.demand[id], 0.5, 1.5) * (supply > 14 ? 0.25 : 1);
    if (!rng.chance(p)) continue;
    const distress = rng.chance(0.08);
    const f = distress ? rng.range(0.55, 0.8) : rng.range(0.92, 1.32);
    const o = { seller: rng.pick(BOTS), itemId: id, qty: it.k === 'gear' ? 1 : it.k === 'mat' ? rng.int(2, 8) : rng.int(1, 4) };
    if (it.k === 'gear') o.q = rng.range(0.25, 0.85);
    o.price = Math.max(1, Math.round(valueOf(m, id, o.q) * f));
    pushListing(m, o);
  }

  // Bot shoppers
  for (const id of TRADE_ITEMS) {
    const it = ITEMS[id];
    let buyers = rng.int(0, 2) + (m.demand[id] > 1.25 ? 1 : 0) + (m.demand[id] > 1.7 ? 1 : 0) + (m.demand[id] < 0.8 ? -1 : 0);
    if (it.k === 'mat' || it.k === 'inter') buyers += 1;
    const threshold = clamp(0.95 + 0.35 * (m.demand[id] - 0.8), 0.8, 1.6);
    for (let b = 0; b < buyers; b++) {
      const best = m.listings.filter((l) => l.itemId === id)
        .map((l) => ({ l, r: l.price / listingValue(m, l) })).sort((a, c) => a.r - c.r)[0];
      if (!best || best.r > threshold) break;
      const n = Math.min(best.l.qty, it.k === 'gear' ? 1 : rng.int(1, 3));
      const sold = { ...best.l };
      takeFromListing(m, best.l.id, n);
      if (!sold.bot) m.proceeds.push({ itemId: id, qty: n, gross: sold.price * n, price: sold.price, q: sold.q, buyer: rng.pick(BOTS), sellerId: sold.sellerId });
    }
  }

  // Arbitrage merchants: snap up underpriced listings and relist higher.
  for (let k = 0; k < 2; k++) {
    if (!rng.chance(0.55)) continue;
    const cand = m.listings.map((l) => ({ l, r: l.price / listingValue(m, l) })).filter((x) => x.r < 0.85).sort((a, b) => a.r - b.r)[0];
    if (!cand) continue;
    const n = Math.min(cand.l.qty, 3);
    const l = { ...cand.l };
    takeFromListing(m, cand.l.id, n);
    if (!l.bot) m.proceeds.push({ itemId: l.itemId, qty: n, gross: l.price * n, price: l.price, q: l.q, buyer: rng.pick(MERCHANT_BOTS), sellerId: l.sellerId });
    pushListing(m, { seller: rng.pick(MERCHANT_BOTS), itemId: l.itemId, qty: n, q: l.q, price: Math.round(listingValue(m, l) * rng.range(1.05, 1.18)) });
  }

  // Price discovery
  for (const id of TRADE_ITEMS) {
    const it = ITEMS[id];
    const supply = totalSupply(m, id);
    const sf = clamp(1.25 - 0.025 * supply, 0.7, 1.3);
    let fair = m.fair[id] + (m.base[id] * m.demand[id] * sf - m.fair[id]) * 0.25;
    if (m.lastSale[id]) fair += (m.lastSale[id] - fair) * 0.25;
    m.fair[id] = Math.max(1, Math.round(fair * 10) / 10);
    m.history[id].push(m.fair[id]);
    if (m.history[id].length > 40) m.history[id].shift();
  }

  // Housekeeping + daily walk-in customers (for the haggling minigame)
  for (const l of m.listings) l.age++;
  m.listings = m.listings.filter((l) => !l.bot || l.age < 10);
  const pool = TRADE_ITEMS.filter((id) => ITEMS[id].k !== 'mat' || rng.chance(0.4));
  m.customers = m.id === 'hollow' ? [] : Array.from({ length: 3 }, (_, i) => {
    const itemId = rng.pick(pool), it = ITEMS[itemId];
    return {
      id: `${m.day}-${i}`, name: rng.pick(BOTS), itemId, minQ: it.k === 'gear' ? rng.range(0.3, 0.7) : 0,
      resolve: rng.int(1, 4), ceil: rng.range(1.2, 1.45),
    };
  });
  if (m.news.length === 0) m.news.push(rng.pick(['A quiet day at the Exchange.', 'Carters rattle past the Exchange gates.', 'The bell tolls noon; stalls hum with haggling.']));
  return m;
}

export function trend(m, id) {
  const h = m.history[id]; if (h.length < 4) return 0;
  const a = h[h.length - 1], b = h[Math.max(0, h.length - 5)];
  return (a - b) / b;
}
