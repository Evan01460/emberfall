// Character-window tabs for skills, Ascension and the hidden-deeds log. Pure rendering: every action is a message to the server.
import { G } from './state.js';
import { SKILLS, CLASSES } from '../data.js';
import * as L from '../loadout.js';
import { h } from '../ui-lib.js';
import { ask } from './ask.js';
import * as I from './icons.js';
import { TITLES, titleInfo } from '../rules.js';
import { TITLE_COL } from './badges.js';
import { ADV_LEVELS, ADV_NAMES, HM, advMods } from '../advskills.js';

const send = (m) => G.net.send(m);
const pct = (v) => `${v >= 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
const modText = (mods) => Object.entries(mods).filter(([, v]) => Math.abs(v - 1) > 0.005).map(([k, v]) => `${{ hp: 'HP', atk: 'ATK', def: 'DEF', move: 'Speed', mp: 'Mana', mpRegen: 'Mana regen', dmg: 'Damage' }[k] ?? k} ${pct(v)}`).join(' · ');
const SRC = { level: ['level', ''], path: ['path', 'v'], mastery: ['mastery', 'g'], tome: ['tome', 'g'], hidden: ['hidden', 'v'], mythic: ['mythic', 'r'] };
const cdText = (s) => `${(s.cd / 1000).toFixed(1)}s${s.mp ? ` · ${s.mp} MP` : ''}`;

export function skillsTab(me, refresh) {
  const loadout = L.loadoutOf(me), b = L.basicOf(me), combo = L.comboOf(b);
  const known = L.knownSkills(me), knownIds = new Set(known.map((s) => s.id));
  const pool = Object.values(SKILLS).filter((s) => s.cls.includes(me.classId) && !knownIds.has(s.id) && (!s.path || s.path === me.asc?.path) && (!s.mastery || s.mastery === me.asc?.mastery));
  const equip = (slot, id) => send({ t: 'skill.equip', slot, id });
  const slotBox = (i) => {
    const id = loadout[i], s = id && SKILLS[id];
    return h('div', { class: 'card', style: { padding: '8px', minWidth: '150px', flex: '1' } }, h('div', { class: 'row sb' }, h('kbd', {}, i + 1), s ? h('button', { class: 'btn small ghost', title: 'Unequip', onclick: () => equip(i, null) }, 'x') : null),
      s ? h('div', { class: 'row' }, I.skill(id, 32), h('div', {}, h('b', {}, s.name), h('div', { class: 'dim', style: { fontSize: '11px' } }, cdText(s)))) : h('div', { class: 'dim', style: { padding: '8px 0' } }, 'empty slot'));
  };
  const row = (s) => {
    const [label, cl] = SRC[s.src] ?? ['', ''], on = loadout.indexOf(s.id);
    return h('div', { class: 'card', style: { padding: '8px', marginBottom: '6px' } }, h('div', { class: 'row sb' },
      h('div', { class: 'row' }, I.skill(s.id, 30), h('div', {}, h('b', {}, s.name), ' ', h('span', { class: `tag ${cl}` }, label), h('div', { class: 'dim', style: { fontSize: '12px', maxWidth: '420px' } }, s.desc ?? ''), h('div', { class: 'dim', style: { fontSize: '11px' } }, `${s.kind}${s.power ? ` · power ${s.power}` : ''} · ${cdText(s)}`))),
      h('div', { class: 'row' }, [0, 1, 2, 3].map((i) => h('button', { class: `btn small ${on === i ? 'gold' : ''}`, title: `Equip in slot ${i + 1}`, onclick: () => equip(i, s.id) }, i + 1)))));
  };
  const hidden = pool.filter((s) => s.src === 'hidden').length;
  const locked = pool.filter((s) => s.src !== 'hidden');
  return h('div', {},
    h('div', { class: 'card', style: { marginBottom: '10px' } }, h('div', { class: 'row' }, I.iconEl(I.basicIcon(me), 32), h('div', {}, h('b', {}, b.name), h('span', { class: 'dim' }, ` — left-click (hold). ${b.kind === 'melee' ? `Melee, reach ${b.range.toFixed(1)}` : `Ranged, ${b.range} tiles`} · power ${b.power}${combo ? ` · ${combo.steps.length}-hit combo — the last hit is the big one` : ''}`)))),
    h('h3', {}, 'Equipped skills (keys 1–4)'), h('div', { class: 'row', style: { alignItems: 'stretch', marginBottom: '10px' } }, [0, 1, 2, 3].map(slotBox)),
    h('p', { class: 'dim', style: { fontSize: '12px' } }, 'You can only equip skills that belong to your class. Skills come from levelling, from Skill Tomes dropped by enemies, from Ascension — and from places nobody tells you about. Swapping is only possible out of combat.'),
    h('h3', {}, `Known skills (${known.length})`), known.length ? known.map(row) : h('p', { class: 'dim' }, 'None yet.'),
    h('h3', { style: { marginTop: '12px' } }, 'Not yet learned'),
    locked.length ? locked.map((s) => { const [label, cl] = SRC[s.src] ?? ['', '']; const lv = L.skillLevel(s, me.classId);
      return h('div', { class: 'row sb', style: { margin: '3px 0', opacity: 0.6 } }, h('div', { class: 'row' }, I.skill(s.id, 22), s.name, ' ', h('span', { class: `tag ${cl}` }, label)), h('span', { class: 'dim', style: { fontSize: '12px' } }, s.src === 'tome' ? 'drops from enemies as a Skill Tome' : s.src === 'level' || s.src === 'path' ? `level ${lv}` : s.src === 'mastery' ? 'a Mastery ultimate' : '')); }) : h('p', { class: 'dim' }, 'Nothing else to learn at the moment.'),
    hidden ? h('p', { class: 'clue', style: { marginTop: '8px' } }, `There ${hidden === 1 ? 'is' : 'are'} ${hidden} hidden technique${hidden === 1 ? '' : 's'} for your class. They are not for sale and nobody will say where they are.`) : null);
}

// Advancements: ordinary paths grow at levels 35 / 55 / 80; hidden and mythic classes RANK UP five times (their own ladder, see HM in advskills.js).
// Every step is a named rank, a stat tier and one new skill.
function advancementCard(me, cur) {
  const hm = HM[me.classId], levels = hm ? hm.lv : ADV_LEVELS;
  const tiers = levels.map((lv, i) => { const skill = hm ? Object.values(SKILLS).find((s) => s.kind === 'script' && !s.path && s.cls.includes(me.classId) && L.skillLevel(s, me.classId) === lv) : cur ? Object.values(SKILLS).find((s) => s.path === cur.id && s.lvl === lv) : null, got = me.level >= lv;
    const a = advMods(lv, me.classId), b = i ? advMods(levels[i - 1], me.classId) : {}, d = {}; for (const k of Object.keys(a)) d[k] = a[k] / (b[k] ?? 1);
    return h('div', { class: 'card', style: { flex: '1', minWidth: hm ? '170px' : '200px', opacity: got ? 1 : 0.6, borderColor: got ? '#ffd36a' : undefined } },
      h('div', { class: 'row sb' }, h('b', { class: got ? 'gold' : '' }, hm ? hm.names[i] : cur ? ADV_NAMES[cur.id][i] : `Tier ${i + 1}`), h('span', { class: `tag ${got ? 'g' : ''}` }, got ? 'reached' : `level ${lv}`)),
      h('div', { class: 'tag', style: { margin: '4px 0' } }, modText(d)),
      skill ? h('div', { class: 'row', style: { gap: '8px', alignItems: 'flex-start' } }, I.skill(skill.id, 32), h('div', {}, h('b', {}, skill.name), h('div', { class: 'dim', style: { fontSize: '12px' } }, skill.desc), h('div', { class: 'dim', style: { fontSize: '11px' } }, cdText(skill)))) : h('p', { class: 'dim', style: { fontSize: '12px' } }, 'Your class grows stronger at this level.'));
  });
  return h('div', {}, h('h3', { style: { marginTop: '14px' } }, hm ? `Ranks (levels ${levels.join(', ')})` : 'Advancements (levels 35, 55, 80)'),
    h('p', { class: 'dim', style: { fontSize: '12px' } }, hm ? 'Your class keeps ranking up. Each rank gives a title, a stat tier and a signature skill built from mechanics only you have. Equip them in the Skills tab.' : 'Each advancement raises your stats and teaches a skill built around a mechanic of its own — orbiting blades, shockwaves, vortices, familiars, totems, walls of force. Equip them in the Skills tab.'),
    h('div', { class: 'row', style: { alignItems: 'stretch', flexWrap: 'wrap' } }, tiers));
}
export function ascendTab(me) {
  const cls = CLASSES[me.classId], cur = L.pathOf(me), mas = L.masteryOf(me);
  if (cls.mythic) return h('div', {}, h('h2', { class: 'gold' }, cls.name), h('div', { class: 'card hl' }, h('b', {}, cls.status.name), h('p', {}, cls.status.desc)), h('p', { class: 'dim' }, cls.desc), h('p', { class: 'clue' }, 'There is no one else like you in this world. There never will be.'), advancementCard(me, null));
  if (cls.hidden) return h('div', {}, h('p', { class: 'dim' }, `${cls.name} is a hidden class with its own path. It does not ascend.`), advancementCard(me, null));
  const pathCard = (p) => h('div', { class: `card ${cur?.id === p.id ? 'hl' : ''}`, style: { flex: '1', minWidth: '230px' } },
    h('h3', { style: { color: p.color } }, p.name), h('p', { class: 'dim', style: { fontSize: '12px' } }, p.blurb), h('div', { class: 'tag' }, modText(p.mods) || 'no stat change'),
    p.basic ? h('p', { style: { fontSize: '12px' } }, h('b', {}, `Basic: ${p.basic.name}`), p.basic.range ? ` · reach ${p.basic.range}` : '', p.basic.cd ? ` · ${p.basic.cd}ms` : '') : null,
    h('div', { style: { margin: '6px 0' } }, p.kit.map(([id, lv]) => h('div', { class: 'row', style: { fontSize: '12px', opacity: me.level >= lv ? 1 : 0.55 } }, I.skill(id, 20), SKILLS[id].name, h('span', { class: 'dim' }, ` Lv${lv}`)))),
    p.perk && Object.keys(p.perk).length ? h('p', { class: 'gold', style: { fontSize: '12px' } }, 'Trade perks: ' + Object.entries(p.perk).map(([k, v]) => ({ weaponQ: `weapon quality +${Math.round(v * 100)}%`, armorQ: `armour quality +${Math.round(v * 100)}%`, charmQ: `charm quality +${Math.round(v * 100)}%`, sweet: `forge sweet spot +${Math.round(v * 100)}%`, affix: `affix chance +${Math.round(v * 100)}%`, heal: `healing +${Math.round(v * 100)}%`, risk: `burst risk -${Math.round(v * 100)}%`, bottle: `extra bottle chance ${Math.round(v * 100)}%`, fee: `fees -${Math.round(v * 100)}%`, slots: `+${v} listings`, realm: `cross-realm sales +${Math.round(v * 100)}%`, haggle: `haggle +${v}`, customer: `customer prices +${Math.round(v * 100)}%` }[k] ?? k)).join(' · ')) : null,
    !cur ? h('button', { class: 'btn gold', disabled: !L.canAscend(me), onclick: () => { if (confirm(`Ascend as ${p.name}? You can change later, but it costs gilt.`)) send({ t: 'ascend', path: p.id }); } }, me.level < L.ASCEND_LVL ? `Unlocks at level ${L.ASCEND_LVL}` : `Ascend as ${p.name}`) : null);
  const mastery = (m) => h('div', { class: `card ${mas?.id === m.id ? 'hl' : ''}`, style: { flex: '1', minWidth: '220px' } }, h('b', {}, m.name), h('p', { class: 'dim', style: { fontSize: '12px' } }, m.desc), h('div', { class: 'row', style: { fontSize: '12px' } }, I.skill(m.ult, 22), `Ultimate: ${SKILLS[m.ult].name}`),
    !mas && cur ? h('button', { class: 'btn gold', disabled: !L.canMaster(me), style: { marginTop: '6px' }, onclick: () => { if (confirm(`Take the ${m.name} mastery?`)) send({ t: 'master', id: m.id }); } }, me.level < L.MASTERY_LVL ? `Unlocks at level ${L.MASTERY_LVL}` : `Choose ${m.name}`) : null);
  return h('div', {},
    h('p', { class: 'dim' }, `At level ${L.ASCEND_LVL} you may ASCEND: choose a path that reshapes your class — stats, basic attack and a new set of skills. At level ${L.MASTERY_LVL} a second choice, a Mastery, adds an ultimate. After that your path advances at levels 35, 55 and 80. Hidden classes are separate and replace all of this.`),
    cur ? h('h2', { style: { color: cur.color } }, `${cur.name}${mas ? ` · ${mas.name}` : ''}`) : h('h2', {}, `Choose a path — ${cls.name}`),
    h('div', { class: 'row', style: { alignItems: 'stretch' } }, L.pathsFor(me).map(pathCard)),
    cur ? h('div', {}, h('h3', { style: { marginTop: '14px' } }, 'Mastery (level 20)'), h('div', { class: 'row', style: { alignItems: 'stretch' } }, cur.masteries.map(mastery)),
      advancementCard(me, cur), h('div', { style: { marginTop: '12px' } }, h('button', { class: 'btn small ghost', onclick: () => { if (confirm(`Return to ${cls.name}? This costs ${L.respecCost(me)}g.`)) send({ t: 'respec' }); } }, `Un-ascend (${L.respecCost(me)}g)`))) : null);
}

export function deedsLog(me) {
  const log = me.qlog ?? [];
  return h('div', {}, h('h3', { style: { marginTop: '10px' } }, 'Hidden deeds'), log.length ? log.map((e) => h('p', { class: 'clue' }, e.text)) : h('p', { class: 'dim' }, 'Nothing you have discovered yet is worth writing down.'),
    titlesPanel(me),
    h('div', { class: 'row' }, h('button', { class: 'btn small ghost', onclick: () => ask('legends', 'legends') }, 'Hall of Legends'), h('button', { class: 'btn small ghost', onclick: () => ask('leaderboard', 'leaderboard') }, 'Leaderboards')));
}

// Titles: feats to show off. Click an earned title to wear it (it appears above your class plate); click it again to take it off.
let showLocked = false;
function titlesPanel(me) {
  const owned = me.titles ?? [], worn = me.title ?? null, tp = (name) => titleInfo(name);
  const chip = (name, have) => { const i = tp(name), col = TITLE_COL[i.rar] ?? '#d8cdbd', on = worn === name; return h('button', { class: `chip ${on ? 'on' : ''}`, style: { borderColor: have ? col : '#3a2d52', color: have ? col : '#6a5f80', opacity: have ? 1 : 0.7 }, title: `${i.rar} — ${i.desc}`, disabled: !have, onclick: () => { send({ t: 'title.set', title: on ? null : name }); setTimeout(() => G.refresh?.('character'), 250); } }, on ? `★ ${name}` : name); };
  const locked = TITLES.filter((t) => !owned.includes(t.name) && t.test);
  return h('div', { class: 'card', style: { margin: '10px 0' } }, h('div', { class: 'row sb' }, h('h3', { style: { margin: 0 } }, `Titles (${owned.length} earned)`), h('span', { class: 'dim', style: { fontSize: '12px' } }, worn ? `Wearing: ${worn}` : 'No title worn')),
    h('div', { class: 'chips', style: { margin: '8px 0' } }, owned.length ? owned.map((n) => chip(n, true)) : h('span', { class: 'dim' }, 'Nothing earned yet — feats like levelling, crafting, trading and exploring award titles.')),
    h('button', { class: 'btn small ghost', onclick: () => { showLocked = !showLocked; G.refresh?.('character'); } }, showLocked ? 'Hide unearned titles' : `Show ${locked.length} unearned titles`),
    showLocked ? h('div', { style: { marginTop: '6px' } }, locked.map((t) => h('div', { class: 'row', style: { margin: '2px 0', fontSize: '12px' } }, h('span', { style: { color: '#6a5f80', minWidth: '140px' } }, t.name), h('span', { class: 'dim' }, t.desc)))) : null);
}
