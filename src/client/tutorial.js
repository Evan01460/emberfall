// A short, class-specific tutorial shown the first time a character enters the world. It never blocks play (you can keep moving
// while it is open), it can be skipped, and it can be replayed from the Help window.
import { G } from './state.js';
import { CLASSES, SKILLS } from '../data.js';
import { loadoutOf, basicOf } from '../loadout.js';
import { craftFamily, isMerchant } from '../rules.js';
import { h } from '../ui-lib.js';
import * as I from './icons.js';
import { keyOf, keyLabel } from './keys.js';
import { listen } from './listeners.js';

const FLAG = (name) => `emberfall.tutorial.${String(name).toLowerCase()}`;
export const tutorialSeen = (name) => { try { return localStorage.getItem(FLAG(name)) === '1'; } catch { return true; } };
const markSeen = (name) => { try { localStorage.setItem(FLAG(name), '1'); } catch { /* ignore */ } };
let el = null;
export const closeTutorial = () => { el?.remove(); el = null; };

function steps(me) {
  const cls = CLASSES[me.classId], fam = craftFamily(me), b = basicOf(me), lo = loadoutOf(me).filter(Boolean), K = (a) => keyLabel(keyOf(a));
  const kbd = (t) => h('kbd', {}, t);
  const list = [
    { title: `Welcome, ${me.name} the ${cls.name}`, body: [h('p', {}, cls.desc), h('p', { class: 'dim' }, 'This short guide is made for your class. You can keep playing while it is open — skip it any time, and replay it from Help (H).')], icon: I.cls(me.classId, 40) },
    { title: 'Moving and fighting', body: [h('p', {}, kbd('W'), kbd('A'), kbd('S'), kbd('D'), ' move. Your ', h('b', {}, 'mouse cursor'), ' is your aim — attacks and skills fly toward it.'),
      h('p', {}, h('b', {}, 'Hold left-click'), ` to attack with ${b.name} (${b.kind === 'melee' ? 'melee, up close' : `ranged, ${b.range} tiles`}). Enemies show every attack as a red shape on the ground: step out of it, or `, kbd(K('dodge')), ' roll through it (a brief moment of invulnerability).')], icon: I.iconEl(I.basicIcon(me), 40) },
    { title: 'Your skills', body: [h('p', {}, 'Your four skill slots sit on the hotbar. Press the key to fire one at your cursor:'),
      ...lo.map((id, i) => h('div', { class: 'row', style: { margin: '3px 0' } }, kbd(K('skill' + i)), I.iconEl(I.skillIcon(id), 26), h('b', {}, SKILLS[id].name), h('span', { class: 'dim', style: { fontSize: '12px' } }, ` — ${SKILLS[id].desc ?? ''}`))),
      h('p', { class: 'dim', style: { fontSize: '12px' } }, `Skills cost mana and have cooldowns. Learn more from level-ups, Skill Tomes and Ascension (level 8), and equip them in Character (I) → Skills. Change any key with K.`)] },
    { title: 'Staying alive', body: [h('p', {}, kbd(K('heal')), ' drinks a health potion, ', kbd(K('mana')), ' a mana potion, ', kbd(K('flask')), ' your custom flask. Towns are safe: nothing can hurt you in Lanternfall, and you heal quickly there.'),
      h('p', {}, 'Fighting enemies far above your level is punished hard, and enemies will chase you a long way — fight at your own level, and retreat before you run dry.')] },
  ];
  if (!fam && !isMerchant(me)) list.push({ title: `Your role: ${cls.name}`, body: [h('p', {}, cls.role ?? ''), h('p', {}, 'Head ', h('b', {}, 'east'), ' out of Lanternfall to the Whispering Quarry (level 1+): hounds, imps and brutes drop ore, coal and hides. Gather materials (', kbd(K('interact')), ' on veins and plants) and bring them back to sell on the Exchange.'),
    h('p', {}, 'Blacksmiths and Alchemists need your materials, and you need their gear: you can ', h('b', {}, 'request a weapon or potion directly'), ' from one in Character → Trading, and name your price.')] });
  if (fam === 'blacksmith') list.push({ title: 'Your craft: the forge', body: [h('p', {}, 'Your forge is in the smithy in the north-west of Lanternfall. Stand next to it and press ', kbd(K('interact')), '. Smelt ore into ingots first, then forge gear in three steps:'),
    h('p', {}, h('b', {}, '1. Heat'), ' — press Space to begin, then HOLD it to push the heat up and release to let it sink; keep it in the gold zone.  ', h('b', {}, '2. Hammer'), ' — strike when the marker is in the zone.  ', h('b', {}, '3. Quench'), ' — pick a bath and dunk at the right moment.'),
    h('p', { class: 'gold' }, 'Rule of the trade: you can NOT sell your creations on the Exchange or to the vendor. They sell through Merchants (wholesale orders), or directly only when someone REQUESTED them — open Character → Trading to see requests players sent you, haggle in private chat, accept or reject, and deliver for the agreed price.')] });
  if (fam === 'alchemist') list.push({ title: 'Your craft: the cauldron', body: [h('p', {}, 'Your cauldron is in the alchemist\'s hut in the north-east of Lanternfall. Press ', kbd(K('interact')), ' beside it, choose a recipe and up to two reagents, stir in rhythm for purity, then press your luck with catalysts.'),
    h('p', { class: 'gold' }, 'Rule of the trade: you can NOT sell your potions on the Exchange or to the vendor. They sell through Merchants, or directly only when someone REQUESTED them: see Character → Trading for requests, haggle in private chat, accept or reject, and deliver for the agreed price. Custom brews unlock at level 5.')] });
  if (isMerchant(me)) list.push({ title: 'Your craft: the market', body: [h('p', {}, 'The Exchange board is in the hall north of the plaza. Merchants post ', h('b', {}, 'wholesale buy orders'), ' at the prices they choose — Blacksmiths and Alchemists deliver their goods to you — and then you resell on the Exchange at any price you like.'),
    h('p', {}, 'Watch the price trends, haggle with customers in the plaza, and carry goods through the sealed gate to the Shadowfell market where prices differ. Profit and haggle wins also unlock hidden things…')] });
  list.push({ title: 'Around Lanternfall', body: [h('p', {}, kbd(K('interact')), ' interacts with anything: signs, the Exchange board (a hall north of the plaza), the bounty board for daily jobs, the waystones, benches, wells and barrels. Where nothing is shown, E searches the ground — some secrets are hidden that way.'),
    h('p', {}, kbd('I'), ' character · ', kbd('J'), ' journal · ', kbd('H'), ' help · ', kbd('P'), ' PvP · ', kbd('K'), ' keybinds · ', kbd('Enter'), ' chat · right-click a player for trade, party and duel.'), h('p', { class: 'gold' }, 'Good luck. The world is big, and not everything in it is on the map.')] });
  return list;
}

export function startTutorial(me = G.me, force = false) {
  if (!me || (!force && tutorialSeen(me.name))) return; closeTutorial(); const list = steps(me); let i = 0;
  const done = () => { markSeen(me.name); closeTutorial(); };
  const paint = () => {
    const s = list[i], last = i === list.length - 1;
    el?.remove();
    el = h('div', { class: 'tutor' }, h('div', { class: 'row sb' }, h('div', { class: 'row' }, s.icon ?? null, h('b', { class: 'gold', style: { fontSize: '17px' } }, s.title)), h('span', { class: 'dim', style: { fontSize: '11px' } }, `${i + 1} / ${list.length}`)),
      h('div', { class: 'tutor-body' }, s.body),
      h('div', { class: 'row sb', style: { marginTop: '8px' } }, h('button', { class: 'btn small ghost', onclick: done }, 'Skip tutorial'),
        h('span', { class: 'row' }, i > 0 ? h('button', { class: 'btn small', onclick: () => { i--; paint(); } }, 'Back') : null, h('button', { class: 'btn small primary', onclick: () => { if (last) done(); else { i++; paint(); } } }, last ? 'Start playing' : 'Next'))));
    document.getElementById('hud')?.append(el);
  };
  paint();
}
