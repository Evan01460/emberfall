// HUD, chat, party, invites, player context menu and the direct-trade window.
import { G } from './state.js';
import { CLASSES, ITEMS, ZONES, MAX_LEVEL, SKILLS, BASICS, ENEMIES } from '../data.js';
import { loadoutOf, basicOf, canAscend, canMaster } from '../loadout.js';
import { gearName } from '../rules.js';
import { quickHeal, quickMana } from '../rules.js';
import { getMap, dayPhase } from '../world.js';
import { h, $, toast, fmt } from '../ui-lib.js';
import { openWindow, closeWindow, refreshWindow, isOpen, openKeybinds } from './panels.js';
import * as I from './icons.js';

import { listen } from './listeners.js';
import { keyOf, keyLabel, keysVersion } from './keys.js';
import { openRequestTo } from './tradeui.js';
import { craftFamily } from '../rules.js';
const send = (m) => G.net.send(m);
let hud, els = {}, chatLog, chatInput, chatCh = 'say', chatFilter = 'all';

export function buildHud(root, handlers) {
  els.name = h('b'); els.xp = h('i'); els.gilt = h('b', { class: 'gold' });
  els.hp = h('i'); els.hpTxt = h('span'); els.mp = h('i'); els.mpTxt = h('span');
  els.party = h('div', { class: 'hud-party' }); els.zone = h('div', { class: 'hud-zone' }); els.net = h('span', { class: 'dim' });
  els.mini = h('canvas', { width: 168, height: 120 }); els.prompt = h('div', { class: 'hud-prompt', style: { display: 'none' } }); els.invites = h('div', { class: 'hud-invites' }); els.menu = null;
  els.bossBar = h('div', { class: 'boss-bar', style: { display: 'none' } }, els.bossName = h('div', {}), h('div', { class: 'bar hp boss-hp', style: { height: '12px' } }, els.bossFill = h('i'), h('b', { class: 'notch', style: { left: '66%' } }), h('b', { class: 'notch', style: { left: '33%' } })));
  const card = h('div', { class: 'hud-card' }, h('div', { class: 'row sb' }, els.name, els.gilt),
    h('div', { class: 'vbar hp' }, els.hp, els.hpTxt), h('div', { class: 'vbar mp' }, els.mp, els.mpTxt), h('div', { class: 'bar xp', style: { height: '5px', margin: '4px 0 2px' } }, els.xp), els.status = h('div', { class: 'row', style: { gap: '3px', margin: '2px 0', minHeight: '0' } }), els.pvp = h('button', { class: 'btn small pvp-btn', title: 'Toggle PvP (P). When on, other flagged players near your level can fight you.', onclick: () => send({ t: 'pvp.toggle' }) }, 'PvP: off'), els.war = h('div', { class: 'war-strip', style: { display: 'none' } }), els.party);
  const side = h('div', { class: 'hud-side' }, els.zone, els.mini, h('div', { class: 'row sb', style: { fontSize: '11px' } }, els.net, h('span', { class: 'row' },
    h('button', { class: 'btn small ghost', title: 'Character (I)', onclick: handlers.character }, I.ui('bag', 18)), h('button', { class: 'btn small ghost', title: 'Journal (J)', onclick: handlers.journal }, I.ui('book', 18)), h('button', { class: 'btn small ghost', title: 'World map (N)', onclick: () => handlers.worldmap?.() }, I.ui('star', 18)), h('button', { class: 'btn small ghost', title: 'Adventure log (L)', onclick: () => handlers.adventure?.() }, 'LOG'), h('button', { class: 'btn small ghost', title: 'Recall to Lanternfall (B) — 5 s, 10 min cooldown', onclick: () => handlers.recall?.() }, 'HOME'), h('button', { class: 'btn small ghost', title: 'Who is online', onclick: () => send({ t: 'who' }) }, I.ui('people', 18)), h('button', { class: 'btn small ghost', title: 'Help (H)', onclick: handlers.help }, I.ui('help', 18)), h('button', { class: 'btn small ghost', title: 'Keybinds (K)', onclick: () => openKeybinds() }, 'KEY'), h('button', { class: 'btn small ghost', title: 'Leave the world', onclick: handlers.leave }, I.ui('power', 18)))));
  els.hotbar = h('div', { class: 'hotbar' }); els.slots = [];
  chatLog = h('div', { class: 'chat-log' });
  chatInput = h('input', { id: 'chat-input', placeholder: 'Enter to chat · /w name msg · /g global · /p party', maxlength: 200, autocomplete: 'off' });
  chatInput.addEventListener('focus', () => { G.chatFocus = true; }); chatInput.addEventListener('blur', () => { G.chatFocus = false; });
  chatInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { sendChat(); chatInput.blur(); } if (e.key === 'Escape') chatInput.blur(); });
  const chSel = h('select', { id: 'chat-ch', onchange: (e) => { chatCh = e.target.value; } }, ['say', 'global', 'party', 'guild', 'trade'].map((c) => h('option', { value: c }, c)));
  const tabs = h('div', { class: 'chat-tabs' }, ['all', 'say', 'global', 'party', 'guild', 'trade', 'system'].map((c) => h('button', { class: `chat-tab ${chatFilter === c ? 'on' : ''}`, onclick: (e) => { chatFilter = c; [...e.target.parentNode.children].forEach((b) => b.classList.toggle('on', b === e.target)); repaintChat(); } }, c)));
  const chat = h('div', { class: 'hud-chat' }, tabs, chatLog, h('div', { class: 'row', style: { gap: '4px', flexWrap: 'nowrap' } }, chSel, chatInput));
  const touch = !!matchMedia?.('(pointer: coarse)').matches && !matchMedia?.('(any-pointer: fine)').matches;
  const pad = touch ? h('div', { class: 'dpad' }, ...[['up', 'u'], ['left', 'l'], ['down', 'd'], ['right', 'r']].map(([k, cls]) => {
    const b = h('button', { class: `dp dp-${cls}` }, I.ui(`dpad_${cls}`, 28)); const on = (e, v) => { e.preventDefault(); handlers.touchKey?.(k, v); };
    b.addEventListener('touchstart', (e) => on(e, true), { passive: false }); b.addEventListener('touchend', (e) => on(e, false), { passive: false }); b.addEventListener('touchcancel', (e) => on(e, false), { passive: false });
    b.addEventListener('mousedown', (e) => on(e, true)); b.addEventListener('mouseup', (e) => on(e, false)); b.addEventListener('mouseleave', (e) => on(e, false)); return b; }),
    h('button', { class: 'dp dp-e', onclick: () => handlers.interact?.() }, 'E'),
    h('div', { class: 'tpad' }, (() => { const atk = h('button', { class: 'dp dp-atk' }, I.ui('swords', 28)); atk.addEventListener('touchstart', (e) => { e.preventDefault(); handlers.touchAttack?.(true); }, { passive: false }); atk.addEventListener('touchend', (e) => { e.preventDefault(); handlers.touchAttack?.(false); }, { passive: false }); return atk; })(), ...[0, 1, 2, 3].map((i) => h('button', { class: 'dp dp-s', ontouchstart: (e) => { e.preventDefault(); handlers.touchSkill?.(i); } }, String(i + 1))), h('button', { class: 'dp dp-s', ontouchstart: (e) => { e.preventDefault(); handlers.touchDodge?.(); } }, I.skill('footnote', 28)))) : null;
  hud = h('div', { id: 'hud' }, card, side, chat, els.hotbar, els.bossBar, els.prompt, els.invites, pad);
  root.append(hud);
  listen(window, 'keydown', (e) => {
    if (G.chatFocus || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName ?? '')) return;
    const k = e.key.toLowerCase();
    if (k === 'enter') { e.preventDefault(); chatInput.focus(); }
    else if (k === 'escape') { dismissMenu(); handlers.escape?.(); }
    else if (G.inBattle) return;
    else if (k === 'p') send({ t: 'pvp.toggle' }); else if (k === 'k') openKeybinds(); else if (k === 'i') handlers.character(); else if (k === 'j') handlers.journal(); else if (k === 'h') handlers.help(); else if (k === 'n') handlers.worldmap?.(); else if (k === 'l') handlers.adventure?.(); else if (k === 'b') handlers.recall?.();
  });
  listen(window, 'mousedown', (e) => { if (els.menu && e.timeStamp !== els.menuT && !els.menu.contains(e.target)) dismissMenu(); });
}

function sendChat() {
  let t = chatInput.value.trim(); chatInput.value = ''; if (!t) return;
  let ch = chatCh, to;
  const m = /^\/(w|whisper|g|global|p|party|s|say|t|trade|who)\s*(.*)$/i.exec(t);
  if (m) { const c = m[1].toLowerCase(); t = m[2];
    if (c === 'who') return send({ t: 'who' });
    if (c === 'w' || c === 'whisper') { const mm = /^(\S+)\s+(.+)$/.exec(t); if (!mm) return; ch = 'whisper'; to = mm[1]; t = mm[2]; }
    else ch = { g: 'global', global: 'global', p: 'party', party: 'party', s: 'say', say: 'say', t: 'trade', trade: 'trade' }[c];
  }
  if (t) send({ t: 'chat', ch, text: t, to });
}
export function whisperTo(name) { chatInput.focus(); chatInput.value = `/w ${name} `; }

const CHCOL = { say: '#e8e0d0', global: '#ffd36a', party: '#8fe0a8', trade: '#9fc6ff', system: '#b9a0ff', 'whisper-from': '#ff9ad5', 'whisper-to': '#ff9ad5' };
const lines = [];
export function addChat(m) {
  lines.push(m); if (lines.length > 120) lines.shift();
  if (m.ch === 'say') { const p = [...G.players.values()].find((x) => x.n === m.from); if (p) G.bubbles.set(p.id, { text: m.text, until: Date.now() + 5000 }); }
  repaintChat();
}
function chatLine(m) {
  const col = CHCOL[m.ch] ?? '#ddd', tag = m.ch === 'system' ? '' : m.ch === 'whisper-from' ? `[from ${m.from}] ` : m.ch === 'whisper-to' ? `[to ${m.to}] ` : `[${m.ch}] ${m.from}: `;
  return h('div', { style: { color: col } }, tag, m.text);
}
function repaintChat() {
  if (!chatLog) return;
  const vis = lines.filter((m) => chatFilter === 'all' || m.ch === chatFilter || (chatFilter === 'say' && m.ch.startsWith('whisper')));
  chatLog.replaceChildren(...vis.slice(-60).map(chatLine)); chatLog.scrollTop = 1e9;
}

let hbSig = '';
function buildHotbar() {
  const me = G.me, b = basicOf(me), lo = loadoutOf(me);
  const sig = `${me.classId}:${me.asc?.path}:${lo.join()}:${keysVersion()}`; if (sig === hbSig) return; hbSig = sig;
  const defs = [{ key: 'LMB', id: 'basic', spr: I.basicIcon(me), tip: `${b.name} - hold to attack` },
    ...lo.map((id, i) => { const sk = id && SKILLS[id]; return sk ? { key: keyLabel(keyOf('skill' + i)), id, spr: I.skillIcon(id), mp: sk.mp, tip: `${sk.name} - ${sk.desc ?? ''}` } : { key: keyLabel(keyOf('skill' + i)), id: `empty${i}`, spr: I.uiIcon('lock'), empty: true, tip: 'Empty slot — equip a skill in Character → Skills' }; }),
    { key: keyLabel(keyOf('heal')), id: 'item_heal', spr: I.itemIcon('heal_potion'), item: 'heal', tip: 'Health potion' }, { key: keyLabel(keyOf('mana')), id: 'item_mana', spr: I.itemIcon('calm_tonic'), item: 'mana', tip: 'Mana potion' }, { key: keyLabel(keyOf('flask')), id: 'flask', spr: I.flaskIcon('flask'), flask: true, tip: 'Custom flask / draught (set in Bag)' }, { key: keyLabel(keyOf('dodge')).slice(0, 3), id: 'dodge', spr: I.skillIcon('footnote'), tip: 'Dodge roll' }];
  els.slots = defs.map((d) => { const cd = h('i', { class: 'hb-cd' }), cnt = h('span', { class: 'hb-n' }), img = I.iconEl(d.spr, 36); const el = h('div', { class: 'hb', title: d.tip }, h('span', { class: 'hb-key' }, d.key), img, cd, cnt, d.mp ? h('span', { class: 'hb-mp' }, d.mp) : null); return { ...d, el, cd, cnt, img }; });
  els.hotbar.replaceChildren(...els.slots.map((x) => x.el));
}
export const quickFlaskOf = (me) => { const fl = (me.flasks ?? []).filter((f) => f.form !== 'essence'); return fl.find((f) => f.uid === me.quickFlask) ?? fl[0] ?? null; };
export function updateHotbar(now) {
  if (!G.me || !els.slots) return;
  for (const s of els.slots) {
    const rem = Math.max(0, (G.cd[s.id] ?? 0) - now), max = G.cdMax[s.id] || (s.id === 'basic' ? basicOf(G.me).cd : s.id === 'flask' ? 6000 : 1000);
    s.cd.style.height = `${Math.min(100, (rem / max) * 100)}%`;
    const locked = !!s.empty; s.el.classList.toggle('locked', !!locked);
    s.el.classList.toggle('nomp', !!(s.mp && G.mp < s.mp && !locked));
    if (s.flask) { const f = quickFlaskOf(G.me); s.cnt.textContent = f ? f.n : ''; s.el.classList.toggle('locked', !f); if (f) s.img.src = I.dataUrl(I.flaskIcon(f.form)); s.el.title = f ? `${f.name} — key ${keyLabel(keyOf('flask'))}` : 'No custom flask. Bind one in Character → Bag.'; }
    if (s.item) { const id = s.item === 'heal' ? quickHeal(G.me) : quickMana(G.me), n = id ? G.me.items[id] : 0; s.cnt.textContent = n || ''; s.el.classList.toggle('locked', !n); if (id) s.img.src = I.dataUrl(I.itemIcon(id)); }
    if (!s.item) s.cnt.textContent = '';
  }
  // buffs + mythic status + 'you can ascend' nudge
  const sig = `${Object.entries(G.buffs ?? {}).filter(([, t]) => t > now).map(([k]) => k).join()}|${G.me.classId}|${canAscend(G.me)}|${canMaster(G.me)}`;
  if (sig !== els.statusSig) {
    els.statusSig = sig; const st = CLASSES[G.me.classId]?.status, chips = [];
    if (st) chips.push(h('span', { class: 'tag v', title: st.desc }, st.name));
    for (const [id, t] of Object.entries(G.buffs ?? {})) if (t > now && id !== 'revive_used') chips.push(h('span', { class: 'tag g', title: SKILLS[id]?.desc ?? '' }, SKILLS[id]?.name ?? id));
    if (canAscend(G.me)) chips.push(h('button', { class: 'btn small gold', onclick: () => G.openAscend?.() }, 'ASCEND!'));
    else if (canMaster(G.me)) chips.push(h('button', { class: 'btn small gold', onclick: () => G.openAscend?.() }, 'MASTERY!'));
    els.status.replaceChildren(...chips);
  }
  // boss bar: the closest boss within sight
  let boss = null, bd = 18; for (const m of G.mobs.values()) if (m.bo && dist2(m) < bd) { bd = dist2(m); boss = m; }
  if (boss) { els.bossBar.style.display = ''; els.bossName.textContent = `${ENEMIES[boss.k].name} · Lv${boss.l}${boss.en ? ' — ENRAGED' : ''}`; els.bossFill.style.width = `${(boss.h / boss.mh) * 100}%`; } else els.bossBar.style.display = 'none';
}
const dist2 = (m) => Math.hypot(m.x - G.pos.x, m.y - G.pos.y);

export function updateHud() {
  const me = G.me; if (!me || !hud) return;
  const c = CLASSES[me.classId]; buildHotbar();
  els.name.replaceChildren(I.cls(me.classId, 20), ` ${me.name} - ${c.name} Lv${me.level}`);
  els.xp.style.width = `${me.level >= MAX_LEVEL ? 100 : (me.xp / me.xpNeed) * 100}%`;
  els.gilt.textContent = `${fmt(me.gilt)} g`;
  els.hp.style.width = `${Math.max(0, (G.hp / G.maxHp) * 100)}%`; els.hpTxt.textContent = `HP ${Math.max(0, Math.round(G.hp))} / ${G.maxHp}`;
  els.mp.style.width = `${Math.max(0, (G.mp / G.maxMp) * 100)}%`; els.mpTxt.textContent = `MP ${Math.round(G.mp)} / ${G.maxMp}`;
  const m = getMap(G.map); { const ph = dayPhase(G.serverNow || Date.now()), tod = ph < 0.05 ? 'dawn' : ph < 0.4 ? 'day' : ph < 0.5 ? 'dusk' : ph < 0.95 ? 'night' : 'dawn'; els.zone.textContent = `${m.name} · ${m.theme === 'hollow' ? 'always dusk' : m.dark ? 'underground' : tod}`; }
  els.net.textContent = G.net.mode === 'solo' ? 'Solo world' : `Online · ${G.net.ping}ms`;
  els.party.replaceChildren(...(G.party?.members ?? []).map((p) => h('div', { class: 'row sb', style: { fontSize: '12px' } }, h('span', {}, `${p.id === G.party.leader ? '(L)' : '-'} ${p.name} `, h('span', { class: 'dim' }, `Lv${p.level}`)), p.id === G.id ? h('button', { class: 'btn small ghost', onclick: () => send({ t: 'party.leave' }) }, 'Leave') : null)));
}
let deathTimer = 0;
export function showDeath(m) {
  document.querySelector('#death')?.remove(); clearInterval(deathTimer); const end = performance.now() + m.ms;
  const left = () => Math.max(0, Math.ceil((end - performance.now()) / 1000)), t = h('div', { class: 'dim', id: 'death-t' }, `${left()}`);
  const el = h('div', { id: 'death' }, h('h1', {}, 'YOU HAVE FALLEN'), h('p', {}, m.loss ? `You lost ${m.loss} gilt. You will wake in Lanternfall…` : 'You will wake in Lanternfall…'), t);
  document.body.append(el);
  // count down for real; stop as soon as the screen is gone (respawn) or the clock runs out
  deathTimer = setInterval(() => { if (!el.isConnected) return clearInterval(deathTimer); t.textContent = left() > 0 ? `${left()}` : 'Waking…'; if (left() <= 0) clearInterval(deathTimer); }, 250);
}
export function hideDeath() { clearInterval(deathTimer); document.querySelector('#death')?.remove(); }
export function setPrompt(it) {
  if (!els.prompt) return;
  if (!it) { els.prompt.style.display = 'none'; return; }
  els.prompt.style.display = ''; els.prompt.replaceChildren(h('kbd', {}, 'E'), ` ${it.name}`);
}
export const minimapCanvas = () => els.mini;
export function setPvp(on) { if (!els.pvp) return; els.pvp.textContent = on ? 'PvP: ON' : 'PvP: off'; els.pvp.classList.toggle('on', !!on); }
// The guild-war strip under your health: who you fight, the score and the clock.
let warAt = 0, warLeft = 0, warTimer = 0;
export function setWar(g) {
  const w = g?.war; if (!els.war) return; if (!w) { els.war.style.display = 'none'; clearInterval(warTimer); warTimer = 0; return; }
  warAt = performance.now(); warLeft = w.left; els.war.style.display = '';
  const paint = () => { const ms = Math.max(0, warLeft - (performance.now() - warAt)), m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; els.war.textContent = `WAR vs ${w.foe}  ${w.mine} - ${w.theirs}  (${w.goal})  ${m}:${String(s).padStart(2, '0')}`; };
  paint(); clearInterval(warTimer); warTimer = setInterval(paint, 1000);
}
export function setNetStatus(t) { if (els.net) els.net.textContent = t; }

// ── invites ─────────────────────────────────────────────────────────────────
export function showInvite(m) {
  const label = { party: 'invites you to a party', trade: 'wants to trade', duel: 'challenges you to a duel', guild: `invites you to join the guild ${m.guild}`, war: `of the guild ${m.guild} declares WAR on your guild!` }[m.kind];
  const card = h('div', { class: 'invite' }, h('div', {}, h('b', {}, m.from), ` ${label}`), h('div', { class: 'row' }, h('button', { class: 'btn small gold', onclick: () => { send({ t: `${m.kind}.accept` }); card.remove(); } }, 'Accept'), h('button', { class: 'btn small ghost', onclick: () => { if (m.kind === 'war') send({ t: 'war.decline' }); card.remove(); } }, 'Decline')));
  els.invites.append(card); setTimeout(() => card.remove(), 45000);
}

// ── context menu on players ─────────────────────────────────────────────────
export function dismissMenu() { els.menu?.remove(); els.menu = null; }
export function playerMenu(p, e) {
  dismissMenu();
  const act = (fn) => () => { dismissMenu(); fn(); };
  const c = CLASSES[p.c];
  els.menu = h('div', { class: 'ctx', style: { left: `${e.clientX}px`, top: `${e.clientY}px` } }, h('div', { class: 'ctx-head' }, `${p.n} - Lv${p.l} ${c.name}`),
    h('button', { onclick: act(() => send({ t: 'trade.request', to: p.n })) }, 'Trade'),
    h('button', { onclick: act(() => send({ t: 'guild.invite', to: p.n })) }, 'Invite to guild'),
    h('button', { onclick: act(() => send({ t: 'party.invite', to: p.n })) }, 'Invite to party'),
    craftFamily({ classId: p.c }) ? h('button', { onclick: act(() => openRequestTo(p.n, craftFamily({ classId: p.c }))) }, 'Request an item') : null,
    h('button', { onclick: act(() => send({ t: 'duel.challenge', to: p.n })) }, 'Challenge to duel'),
    h('button', { onclick: act(() => whisperTo(p.n)) }, 'Whisper'));
  els.menuT = e.timeStamp; document.body.append(els.menu);
}

export function showWho(m) {
  openWindow('who', `Online (${m.players.length})`, () => h('table', {}, h('tr', {}, ['Name', 'Class', 'Lv', 'Where'].map((x) => h('th', {}, x))), ...m.players.map((p) => h('tr', {}, h('td', {}, p.n), h('td', {}, I.cls(p.c, 18), ` ${CLASSES[p.c].name}`), h('td', {}, p.l), h('td', { class: 'dim' }, p.map)))));
}

// ── trade window ────────────────────────────────────────────────────────────
let myOffer = { items: {}, gear: [], flasks: [], gilt: 0 };
export function openTrade(s) {
  if (!isOpen('trade')) myOffer = { items: {}, gear: [], flasks: [], gilt: 0 };
  G.trade = s;
  openWindow('trade', `Trading with ${s.with}`, () => buildTrade(), { wide: true, onClose: () => { if (G.trade) send({ t: 'trade.cancel' }); G.trade = null; } });
}
export function updateTrade(s) { G.trade = s; myOffer = { items: s.mine.items, gear: s.mine.gear, flasks: s.mine.flasks ?? [], gilt: s.mine.gilt }; if (isOpen('trade')) refreshWindow('trade'); else openTrade(s); }
export function endTrade(m) { G.trade = null; closeWindow('trade'); toast(m.msg, m.done ? 'good' : 'bad'); }
function pushOffer() { send({ t: 'trade.offer', items: myOffer.items, gear: myOffer.gear, flasks: myOffer.flasks, gilt: myOffer.gilt }); }
function buildTrade() {
  const s = G.trade, me = G.me;
  const invItems = Object.entries(me.items).filter(([id]) => ITEMS[id].k !== 'quest');
  const bag = me.gear.filter((g) => !Object.values(me.equip).includes(g.uid));
  const theirs = h('div', {}, h('h3', {}, `${s.with} offers`), Object.entries(s.theirs.items).map(([id, n]) => h('div', { class: 'item' }, I.item(id, 20), ` ${n}x ${ITEMS[id].n}`)), s.theirGear.map((g) => h('div', { class: 'item' }, I.item(g.id, 20), ` ${gearName(g)} (${Math.round(g.q * 100)}%)`)), (s.theirFlasks ?? []).map((f) => h('div', { class: 'item' }, I.ui('star', 20), ` ${f.n}x ${f.name} [${f.form}]`)), s.theirs.gilt ? h('div', { class: 'gold' }, `${s.theirs.gilt} gilt`) : null, !Object.keys(s.theirs.items).length && !s.theirGear.length && !s.theirs.gilt ? h('div', { class: 'dim' }, 'Nothing yet.') : null,
    h('div', { style: { marginTop: '8px' } }, s.theirOk ? h('span', { class: 'tag g' }, 'confirmed') : h('span', { class: 'tag' }, 'thinking…')));
  const gilt = h('input', { type: 'number', min: 0, value: myOffer.gilt, style: { width: '90px' }, onchange: (e) => { myOffer.gilt = Math.max(0, Math.floor(+e.target.value) || 0); pushOffer(); } });
  const mine = h('div', {}, h('h3', {}, 'You offer'),
    h('div', { style: { maxHeight: '28vh', overflow: 'auto' } }, invItems.map(([id, n]) => { const inp = h('input', { type: 'number', min: 0, max: n, value: myOffer.items[id] ?? 0, style: { width: '58px' }, onchange: (e) => { const q = Math.max(0, Math.min(n, Math.floor(+e.target.value) || 0)); if (q) myOffer.items[id] = q; else delete myOffer.items[id]; pushOffer(); } }); return h('div', { class: 'row sb', style: { margin: '2px 0' } }, h('span', { class: 'item' }, I.item(id, 20), ` ${ITEMS[id].n} `, h('span', { class: 'dim' }, `(${n})`)), inp); }),
      (me.flasks ?? []).map((f) => h('label', { class: 'row', style: { margin: '2px 0' } }, h('input', { type: 'checkbox', checked: myOffer.flasks.includes(f.uid), onchange: (e) => { myOffer.flasks = e.target.checked ? [...myOffer.flasks, f.uid] : myOffer.flasks.filter((x) => x !== f.uid); pushOffer(); } }), I.ui('star', 20), ` ${f.n}x ${f.name} [${f.form}]`)),
      bag.map((g) => h('label', { class: 'row', style: { margin: '2px 0' } }, h('input', { type: 'checkbox', checked: myOffer.gear.includes(g.uid), onchange: (e) => { myOffer.gear = e.target.checked ? [...myOffer.gear, g.uid] : myOffer.gear.filter((x) => x !== g.uid); pushOffer(); } }), I.item(g.id, 20), ` ${ITEMS[g.id].n} (${Math.round(g.q * 100)}%)`))),
    h('div', { class: 'row', style: { marginTop: '6px' } }, 'Gilt', gilt));
  return h('div', {}, h('div', { class: 'grid g2' }, mine, theirs), h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } }, h('button', { class: `btn ${s.myOk ? '' : 'gold'}`, disabled: s.myOk, onclick: () => send({ t: 'trade.confirm' }) }, s.myOk ? 'You confirmed - waiting' : 'Confirm trade'), h('button', { class: 'btn ghost', onclick: () => closeWindow('trade') }, 'Cancel')),
    h('p', { class: 'dim', style: { fontSize: '11px', textAlign: 'center' } }, 'Changing either offer resets both confirmations. Nothing moves until both of you confirm.'));
}

// A short call-out under the boss bar: which mechanic just started and what to do about it.
export function showBossMsg(e) {
  document.querySelectorAll('.bossmsg').forEach((x) => x.remove());
  const col = { fire: '#ff9a5a', ice: '#9adfff', void: '#c89aff', storm: '#ffe96a', earth: '#d8b880', poison: '#9aff8a', holy: '#fff4b0' }[e.el] ?? '#fff';
  const el = h('div', { class: `bossmsg ${e.big ? 'big' : ''}`, style: { borderColor: col, color: col } }, h('div', { class: 'bossmsg-t' }, e.text), e.hint ? h('div', { class: 'bossmsg-h' }, e.hint) : null);
  document.getElementById('hud')?.append(el) ?? document.body.append(el); setTimeout(() => el.classList.add('out'), e.big ? 3200 : 2300); setTimeout(() => el.remove(), e.big ? 3900 : 2900);
}
export function showAnnounce({ title, text }) {
  const el = h('div', { class: 'announce' }, h('div', { class: 'announce-t' }, title), h('div', {}, text));
  document.body.append(el); setTimeout(() => el.classList.add('out'), 7000); setTimeout(() => el.remove(), 8000);
}
