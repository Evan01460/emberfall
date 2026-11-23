// FLAT BONUSES ON LATE-GAME GEAR
// Effects (Sturdy, Dragonhide, Starforged ...) and affixes (Warded, Lively ...) add flat attack, defence, health and mana. Those numbers were
// sized for the first seven metals; on Voidglass-and-later gear (base stats 3 to 4 times larger, against monsters that hit three times as
// hard) they would be rounding errors. From the eighth tier on they scale with the metal. The original tiers are untouched.
import { TIERS, tierOf } from './gearsets.js';

const OLD_TIERS = 7;
export const flatScale = (itemId) => { const i = TIERS.findIndex((t) => t.id === tierOf(itemId)); return i < OLD_TIERS ? 1 : 1 + 0.45 * (i - OLD_TIERS + 1); };
export const FLAT_KEYS = ['atk', 'def', 'hp', 'mp'];
const r1 = (v) => { const x = Math.round(v * 10) / 10; return Number.isInteger(x) ? String(x) : x.toFixed(1); };
// "+16 max HP" on a Worldsteel piece reads "+74 max HP". Only the flat stats are scaled; percentages stay as they are.
export function scaledText(text, itemId) {
  const k = itemId ? flatScale(itemId) : 1; if (k === 1 || !text) return text ?? '';
  return text.replace(/\+(\d+(?:\.\d+)?) (max HP|HP|defence|defense|DEF|attack|ATK|max mana|max Mana|mana)(?! per hit)/g, (_, n, w) => `+${r1(+n * k)} ${w}`);
}
