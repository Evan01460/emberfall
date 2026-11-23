// Shared client-side state (the server is authoritative; this is the client's view of it).
export const G = {
  net: null, mode: 'solo', id: null, me: null,
  map: 'town', pos: { x: 26.5, y: 19.5 }, dir: 'd', moving: false,
  vis: new Set(), cds: new Set(),
  players: new Map(), mobs: new Map(), cust: new Map(),
  bubbles: new Map(), party: null, invites: [], chat: [],
  inBattle: false, uiBlock: 0, chatFocus: false, gather: null,
  serverNow: Date.now(), clockSkew: 0, dayMs: 60000, market: null,
  hp: 1, maxHp: 1, mp: 0, maxMp: 1, dead: false, cd: {}, cdMax: {}, zones: [], lastAtk: 0, guarding: false,
};
export const blockInput = (n) => { G.uiBlock = Math.max(0, G.uiBlock + n); };
