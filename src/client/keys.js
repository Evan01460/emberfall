// Rebindable action keys (skills 1-4, potions, flask, dodge, interact). Stored per browser. Movement and the window keys stay fixed.
export const ACTIONS = [
  { id: 'skill0', label: 'Skill 1', def: '1' }, { id: 'skill1', label: 'Skill 2', def: '2' }, { id: 'skill2', label: 'Skill 3', def: '3' }, { id: 'skill3', label: 'Skill 4', def: '4' },
  { id: 'heal', label: 'Health potion', def: '5' }, { id: 'mana', label: 'Mana potion', def: '6' }, { id: 'flask', label: 'Custom flask / draught', def: '7' },
  { id: 'dodge', label: 'Dodge roll', def: ' ' }, { id: 'interact', label: 'Interact', def: 'e' },
];
export const RESERVED = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter', 'escape', 'i', 'j', 'h', 'm', 'p', 'k', 'tab', 'control', 'alt', 'meta', 'capslock']);
const SK = 'emberfall.keys';
let binds = null; const listeners = new Set();
const defaults = () => Object.fromEntries(ACTIONS.map((a) => [a.id, a.def]));
function load() { binds = defaults(); try { const raw = JSON.parse(localStorage.getItem(SK) ?? 'null'); if (raw && typeof raw === 'object') for (const a of ACTIONS) if (typeof raw[a.id] === 'string' && raw[a.id].length) binds[a.id] = raw[a.id]; } catch { /* defaults */ } return binds; }
const save = () => { try { localStorage.setItem(SK, JSON.stringify(binds)); } catch { /* private mode */ } for (const f of listeners) f(); };
export const keyOf = (id) => (binds ?? load())[id];
export const actionFor = (key) => { const b = binds ?? load(); if (key === 'shift' && !Object.values(b).includes('shift')) return 'dodge'; return ACTIONS.find((a) => b[a.id] === key)?.id ?? null; };
export const keyLabel = (k) => ({ ' ': 'SPACE', shift: 'SHIFT', arrowup: 'UP', arrowdown: 'DOWN', arrowleft: 'LEFT', arrowright: 'RIGHT' }[k] ?? String(k).toUpperCase().slice(0, 5));
// Bind `key` to `id`; if another action had it, the two swap so nothing is ever left unbound or doubled.
export function setKey(id, key) {
  const b = binds ?? load(); key = String(key).toLowerCase(); if (RESERVED.has(key)) return { ok: false, why: `${keyLabel(key)} is used by the game` };
  const other = ACTIONS.find((a) => a.id !== id && b[a.id] === key); if (other) b[other.id] = b[id]; b[id] = key; save(); return { ok: true, swapped: other?.label ?? null };
}
export function resetKeys() { binds = defaults(); save(); }
export const onKeysChanged = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const keysVersion = () => Object.values(binds ?? load()).join('|');
