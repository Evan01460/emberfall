// Entry point: login screen → connect (solo or online) → real-time game loop.
import { G } from './state.js';
import { connectPublic } from './p2p.js';
import { dedicatedServer } from './config.js';
import { answered } from './ask.js';
import { startTutorial } from './tutorial.js';
import { playCinematic, afterCinematic } from './cinematic.js';
import { connectWs, connectLocal, soloCharacters, wipeSolo } from './net.js';
import { WorldView } from './worldview.js';
import { buildHud, updateHud, updateHotbar, showDeath, hideDeath, setPrompt, minimapCanvas, addChat, showAnnounce, showInvite, setPvp, setWar, playerMenu, showWho, openTrade, updateTrade, endTrade, dismissMenu } from './ui.js';
import { sfx, toggleMute, isMuted } from './sfx.js';
import { playTrack, trackFor, stopMusic } from './music.js';
import { startTitleScene } from './title.js';
import { dayPhase, isNight } from '../world.js';
import { openCharacter, openWindow, closeWindow, closeAll, refreshWindow, isOpen, topWindow, showDialog, showSecret, showSecretDone, showLegends, showLoot, openWaystone, openRaid, openGraid, openBounty, showLeaderboard, openVendor, openTavern, openCraft, openExchange, updateExchange, startForge, startBrew, showCraftResult, startHaggle, openHelp } from './panels.js';
import { ingest, syncProjectiles } from './fx.js';
import { h, $, toast, modal } from '../ui-lib.js';
import * as I from './icons.js';
import { CLASSES, BASE_CLASSES, ITEMS, ZONES } from '../data.js';
import { getMap, blockedAt, inSafeZone } from '../world.js';
import { listen, unlistenAll } from './listeners.js';

const app = $('#app');
let view = null, raf = 0, brewCtl = null, hagCtl = null, lastMini = 0, running = false;
const LS_URL = 'emberfall-server', LS_NAME = 'emberfall-name';
const lsGet = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

// ── login screen ────────────────────────────────────────────────────────────
function showLogin(notice = '') {
  stopGame(); startTitleScene(); playTrack('title');
  let mode = 'solo', cls = 'warrior';
  const name = h('input', { id: 'login-name', value: lsGet(LS_NAME, ''), maxlength: 16, placeholder: 'Character name', autocomplete: 'off' });
  const pass = h('input', { id: 'login-pass', type: 'password', placeholder: 'Passphrase (online, 4+ letters)', autocomplete: 'current-password' });
  const defUrl = /^https?:$/.test(location.protocol) && location.host && location.host !== 'null' ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws` : 'ws://localhost:8080/ws';
  const url = h('input', { id: 'login-url', value: lsGet(LS_URL, defUrl), placeholder: 'ws://host:8080/ws' });
  const room = h('input', { id: 'login-room', value: lsGet('emberfall.room', 'public'), maxlength: 24, style: { width: '140px' } });
  const err = h('div', { class: 'login-err' }, notice);
  const clsBox = h('div', {}), modeBox = h('div', {}), saved = soloCharacters();
  const paint = () => {
    const card = (c) => { const d = CLASSES[c]; return h('button', { class: `choice ${cls === c ? 'on' : ''}`, onclick: () => { cls = c; paint(); } }, h('div', { class: 'big' }, I.cls(c, 40)), h('b', {}, d.name), h('p', {}, d.role ?? d.desc)); };
    clsBox.replaceChildren(h('h3', {}, 'Fighters — hunt, gather, level'), h('div', { class: 'choice-row' }, ['warrior', 'mage', 'archer'].map(card)), h('h3', {}, 'Trade classes — craft, brew, trade (they hire blades to fight)'), h('div', { class: 'choice-row' }, ['blacksmith', 'alchemist', 'merchant'].map(card)));
    const mb = (id, label) => h('button', { class: `btn ${mode === id ? 'gold' : ''}`, onclick: () => { mode = id; paint(); } }, label);
    modeBox.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'center', marginBottom: '8px' } }, mb('solo', 'Solo world'), mb('public', 'Online · Public world'), mb('server', 'Online · My own server')),
      mode === 'public' ? h('div', { style: { textAlign: 'center' } },
        h('div', { class: 'dim', style: { fontSize: '12px', marginTop: '4px' } }, 'ONE global world for everybody, on any network. No setup: the first player hosts it from their browser and everyone else joins them over the internet (with relay servers for strict networks). If the host leaves, the next arrival continues the world from the latest backup, and your character is also kept privately in this browser. Needs a passphrase (4+ letters) so nobody steals your character.'))
      : mode === 'server' ? h('div', { class: 'row', style: { justifyContent: 'center' } }, h('span', { class: 'dim' }, 'Server'), url, h('span', { class: 'dim', style: { fontSize: '11px' } }, 'run `npm start` to host a dedicated one'))
      : h('div', { class: 'dim', style: { textAlign: 'center', fontSize: '12px' } }, 'Your own private Lanternfall, saved in this browser. Same game, same rules — other adventurers are simulated by the market. Switch to Online to meet real players.'));
  };
  paint();
  const go = async (create) => {
    err.textContent = ''; const n = name.value.trim(); if (n.length < 2) { err.textContent = 'Pick a name (2+ letters).'; return; }
    lsSet(LS_NAME, n); btns.forEach((b) => (b.disabled = true));
    try {
      let r;
      if (mode === 'solo') r = await connectLocal({ name: n, create: create ? { classId: cls } : null });
      else if (mode === 'public') {
        const login = { name: n, pass: pass.value, create: create ? { classId: cls } : null }, ded = await dedicatedServer();
        r = ded ? await connectWs(ded, login) : await connectPublic(login);
      }
      else { lsSet(LS_URL, url.value.trim()); r = await connectWs(url.value.trim(), { name: n, pass: pass.value, create: create ? { classId: cls } : null }); }
      enter(r);
    } catch (e) { err.textContent = e.message; btns.forEach((b) => (b.disabled = false)); }
  };
  const bNew = h('button', { class: 'btn primary', style: { fontSize: '16px', padding: '10px 26px' }, onclick: () => go(true) }, 'Create character & enter');
  const bLog = h('button', { class: 'btn', style: { padding: '10px 22px' }, onclick: () => go(false) }, 'Log in as existing');
  const btns = [bNew, bLog];
  app.replaceChildren(h('div', { class: 'title' },
    h('h1', {}, 'EMBERFALL'), h('div', { class: 'sub' }, 'A living world of steel, craft and trade — with another world folded inside it.'),
    modeBox, h('div', { class: 'row', style: { justifyContent: 'center', margin: '8px 0' } }, name, h('span', { class: 'dim' }, ''), pass), clsBox,
    h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } }, bNew, bLog), err,
    saved.length ? h('div', { class: 'dim', style: { marginTop: '14px' } }, 'Solo characters on this device: ', saved.map((s) => h('button', { class: 'btn small ghost', onclick: () => { name.value = s.name; mode = 'solo'; paint(); go(false); } }, `${s.name} Lv${s.level}`)), h('button', { class: 'btn small ghost', style: { marginLeft: '8px' }, onclick: () => { if (confirm_('Erase ALL solo characters on this device?')) { wipeSolo(); showLogin(); } } }, 'erase all')) : null));
}
function confirm_(msg) { return window.confirm ? window.confirm(msg) || false : false; }

// ── game ─────────────────────────────────────────────────────────────────────
function enter({ net, welcome }) {
  document.getElementById('title-scene')?.remove();
  Object.assign(G, { cd: {}, cdMax: {}, zones: [], dead: false, net, mode: net.mode, id: welcome.id, me: welcome.me, map: welcome.map, pos: { x: welcome.x, y: welcome.y }, dir: 'd', moving: false, vis: new Set(welcome.vis), cds: new Set(), dayMs: welcome.dayMs, party: null, inBattle: false, uiBlock: 0, chatFocus: false, gather: null });
  G.players.clear(); G.mobs.clear(); G.cust.clear(); G.bubbles.clear();
  const canvas = h('canvas', { id: 'world' });
  app.replaceChildren(canvas); document.body.classList.add('ingame');
  view = new WorldView(canvas); view.setMap(G.map);
  view.onPrompt = setPrompt; view.onClickPlayer = (p, e) => playerMenu(p, e);
  buildHud(app, { character: () => openCharacter(), journal: () => openCharacter('journal'), help: openHelp, leave: leave, escape: () => { const t = topWindow(); if (t) closeWindow(t); }, touchKey: (k, d) => { view.keys[k] = d; }, interact: () => view.interact(), touchAttack: (d) => { view.touchAtk = d; }, touchSkill: (i) => view.useSkill(i), touchDodge: () => view.dodge() });
  G.openAscend = () => openCharacter('ascend'); G.openTrading = () => openCharacter('trading'); G.reqs = []; G.crafters = []; G.buffs = {}; G.guild = null; G.guildLoaded = false;
  listen(document, 'click', (e) => { if (e.target.closest?.('.btn, .choice, .chat-tab')) sfx('click', 30); });
  wire(net); updateHud(); setTimeout(() => { if (running) startTutorial(G.me); }, 1800);
  for (const m of welcome.mail ?? []) toast(m, 'good');
  toast(`Welcome to ${getMap(G.map).name}. ${G.mode === 'solo' ? '' : 'You are online.'}`);
  zoneBanner(getMap(G.map), ZONES[G.map]); fadeIn();
  running = true; let last = performance.now();
  const frame = (now) => {
    if (!running) return; const dt = Math.min(0.05, (now - last) / 1000); last = now;
    G.serverNow = Date.now(); view.update(dt, now); view.draw();
    if (now - (G.musicAt ?? 0) > 1500) { G.musicAt = now; let boss = false; for (const m of G.mobs.values()) if (m.bo && Math.hypot(m.x - G.pos.x, m.y - G.pos.y) < 14) boss = true; playTrack(trackFor(getMap(G.map), isNight(G.serverNow || Date.now()), boss)); }
    updateHotbar(now); if (now - lastMini > 120) { lastMini = now; view.drawMinimap(minimapCanvas()); updateHud(); }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
function fadeIn() { let f = document.getElementById('fade'); if (!f) { f = h('div', { id: 'fade' }); document.body.append(f); } f.style.transition = 'none'; f.style.opacity = '1'; void f.offsetWidth; f.style.transition = 'opacity .7s steps(7)'; f.style.opacity = '0'; }
function zoneBanner(z, zone) { document.querySelectorAll('.zone-banner').forEach((e) => e.remove()); const el = h('div', { class: 'zone-banner' }, h('div', { class: 'zone-banner-t' }, z.name), h('div', { class: 'zone-banner-s' }, zone?.safe ? 'A safe haven' : zone?.lvl ? `Recommended level ${zone.lvl}+` : '')); document.body.append(el); setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3600); }
function stopGame() { unlistenAll(); running = false; cancelAnimationFrame(raf); closeAll(); document.body.classList.remove('ingame'); document.querySelectorAll('.battle,.ctx,#hud,.zone-banner,#fade').forEach((e) => e.remove()); playTrack('title'); G.net?.close?.(); G.net = null; }
function leave() { stopGame(); showLogin(); }

function wire(net) {
  net.on('snap', (m) => {
    const seen = new Set();
    for (const p of m.players) { seen.add(p.id); const o = G.players.get(p.id); if (o) Object.assign(o, p); else G.players.set(p.id, { ...p }); }
    for (const id of [...G.players.keys()]) if (!seen.has(id)) G.players.delete(id);
    const ms = new Set();
    for (const p of m.mobs) { ms.add(p.id); const o = G.mobs.get(p.id); if (o) Object.assign(o, p); else G.mobs.set(p.id, { ...p }); }
    for (const id of [...G.mobs.keys()]) if (!ms.has(id)) G.mobs.delete(id);
    G.cust.clear(); for (const c of m.cust) G.cust.set(c.id, c);
    G.cds = new Set(m.cds); G.zones = m.zones ?? []; syncProjectiles(m.projs ?? []); ingest(m.ev); G.guarding = !!G.players.get(G.id)?.gd;
  });
  net.on('me', (m) => {
    G.me = m.me; updateHud();
    // re-render open windows with fresh inventory, but never while the player is typing in one
    const typing = document.activeElement?.closest?.('.win-body') && /INPUT|SELECT/.test(document.activeElement.tagName);
    if (!typing) for (const w of ['character', 'craft', 'vendor', 'trade', 'exchange']) if (isOpen(w)) refreshWindow(w);
  });
  net.on('correct', (m) => { G.pos.x = m.x; G.pos.y = m.y; });
  net.on('map', (m) => {
    closeAll(); G.map = m.id; G.pos = { x: m.x, y: m.y }; G.vis = new Set(m.vis); G.players.clear(); G.mobs.clear(); G.cust.clear(); G.gather = null;
    view.setMap(m.id); fadeIn(); const z = getMap(m.id); zoneBanner(z, ZONES[m.id]); toast(`${z.name}${ZONES[m.id]?.lvl ? ` — recommended Lv ${ZONES[m.id].lvl}+` : ''}`, z.theme === 'hollow' ? 'secret' : '');
  });
  net.on('vis', (m) => { G.vis = new Set(m.vis); });
  net.on('toast', (m) => { toast(m.msg, m.kind); if (m.kind === 'secret') sfx('secret', 400); else if (m.kind === 'good') sfx('pickup', 200); });
  net.on('chat', addChat);
  net.on('invite', showInvite);
  net.on('party', (m) => { G.party = m.party; updateHud(); if (m.party) toast('Party updated.'); });
  net.on('who', showWho);
  net.on('trade.state', (m) => (isOpen('trade') ? updateTrade(m) : openTrade(m)));
  net.on('trade.end', endTrade);
  net.on('ui', (m) => {
    switch (m.panel) {
      case 'craft': return openCraft(m.family);
      case 'exchange': return openExchange(m.view);
      case 'vendor': return openVendor();
      case 'tavern': return openTavern();
      case 'waystone': return openWaystone(m);
      case 'raid': return openRaid(m);
      case 'graid': return openGraid(m);
      case 'bounty': return openBounty(m);
      case 'dialog': return showDialog(m);
      case 'secret': return showSecret(m);
      default: return undefined;
    }
  });
  net.on('market', (m) => updateExchange(m.view));
  net.on('cine', (m) => { closeAll(); playCinematic(m); });
  net.on('secret.done', (m) => afterCinematic(() => { sfx('secret', 400); showSecretDone(m); }));
  net.on('gather.begin', (m) => { G.gather = { id: m.id, start: performance.now(), ms: m.ms }; });
  net.on('gather.cancel', () => { G.gather = null; });
  net.on('gather.done', (m) => { sfx('pickup', 100); G.gather = null; toast(`+ ${Object.entries(m.found).map(([id, n]) => `${n}× ${ITEMS[id].n}`).join(', ')}`, 'good'); });
  net.on('craft.ticket', (m) => { if (m.kind === 'forge') startForge(m); else brewCtl = startBrew(m); });
  net.on('brew.state', (m) => brewCtl?.state(m.b));
  net.on('craft.result', (m) => { sfx(m.burst ? 'boom' : 'levelup', 200); showCraftResult(m, brewCtl); brewCtl = null; });
  net.on('haggle.state', (m) => { hagCtl = startHaggle(m); });
  net.on('haggle.round', (m) => hagCtl?.round(m));
  net.on('haggle.done', (m) => { if (hagCtl) hagCtl.done(m); else toast(m.msg); hagCtl = null; });
  net.on('dash', (m) => view.startDash(m.x, m.y, m.ms));
  net.on('hurt', (m) => { view.shake = Math.min(0.35, 0.1 + m.v / 150); view.hurtFlash = 0.35; });
  net.on('nomana', () => { G.flashMana = performance.now(); toast('Not enough mana.', 'bad'); });
  net.on('cd', (m) => { G.cd[m.k] = performance.now() + m.ms; G.cdMax[m.k] = m.ms; });
  net.on('died', (m) => { sfx('death'); showDeath(m); closeAll(); view.shake = 0.5; });
  net.on('respawned', () => { hideDeath(); toast('You wake in Lanternfall.'); });
  net.on('loot', (m) => { sfx(m.levelUps?.length ? 'levelup' : 'coin', 120); const parts = [`+${m.xp} XP`, `+${m.gold}g`, ...Object.entries(m.drops).map(([id, n]) => `${n}× ${ITEMS[id].n}`)]; toast(`${m.boss ? 'BOSS DOWN! ' : ''}${parts.join(' - ')}`, m.boss ? 'secret' : 'good'); if (m.levelUps.length) { toast(`* LEVEL UP → ${m.levelUps.at(-1)}! You are fully restored.`, 'good'); view.flash = 0.4; } });
  net.on('enchanted', () => sfx('anvil'));
  net.on('chest', (m) => showLoot(m));
  net.on('buff', (m) => { G.buffs ??= {}; G.buffs[m.id] = performance.now() + m.ms; });
  net.on('announce', (m) => { sfx('roar', 500); showAnnounce(m); });
  net.on('legends', (m) => { answered('legends'); try { showLegends(Array.isArray(m.list) ? m.list : []); } catch (e) { console.error(e); toast('Could not show the Hall of Legends.', 'bad'); } });
  net.on('leaderboard', (m) => {
    answered('leaderboard');
    try {   // a host running an older build sends {title: rows}; show it too instead of failing
      const boards = Array.isArray(m.boards) ? m.boards : Object.entries(m.boards ?? {}).map(([title, rows]) => ({ id: title, group: 'Deeds', title, unit: '', rows }));
      showLeaderboard(boards);
    } catch (e) { console.error(e); toast('Could not show the leaderboards.', 'bad'); }
  });
  net.on('guild', (m) => { G.guild = m.guild; setWar(m.guild); if (isOpen('character')) refreshWindow('character'); });
  net.on('pvp', (m) => { G.pvp = m.on; setPvp(m.on); });
  net.on('reqs', (m) => { G.reqs = m.list ?? []; if (isOpen('character')) refreshWindow('character'); });
  net.on('crafters', (m) => { G.crafters = m.list ?? []; if (isOpen('character')) refreshWindow('character'); });
  net.on('searching', () => { view.searchFx = performance.now(); });
  net.on('search', () => { toast('You search the area. Nothing here.'); });
  net.on('ascended', () => { view.flash = 0.6; });
  net.on('duel', (m) => { if (m.on) toast(`Duel with ${m.foe} - first to fall loses!`, 'secret'); else toast(m.won ? 'You won the duel!' : 'The duel is over.', m.won ? 'good' : ''); });
  net.on('kicked', (m) => { leaveWith(m.msg); });
  net.on('disconnected', (m) => { running = false; modal([h('h2', {}, 'Connection lost'), h('p', { class: 'dim' }, m.msg ?? 'The server closed the connection. Your character is saved on the server.'), h('button', { class: 'btn gold', onclick: () => location.reload() }, 'Reconnect')], { closable: false }); });
}
function leaveWith(msg) { stopGame(); showLogin(msg); }

showLogin();
window.__W = { getMap, blockedAt, inSafeZone };
window.__hl = { G, get view() { return view; }, leave };
