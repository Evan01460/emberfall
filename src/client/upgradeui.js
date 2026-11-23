// GEAR UPGRADES — the anvil window (pick a piece, see the odds and the cost) and the forging minigame:
//   1 HEAT  hold Space to keep the glowing piece in the gold band        2 FOLD  three rounds of hammer blows on a moving marker
//   3 RUNE  trace the rune with the chisel                               4 QUENCH choose a bath and dunk at the right moment
//   5 POLISH sweep the whetstone in an even rhythm                       then the REVEAL: the odds, the roll, the result.
// The server made the spec, re-scores everything this reports, and rolls the dice (src/server/upgrade.js).
import { G } from './state.js';
import { ITEMS, HP_SCALE, qualityStatMult, FIT_BONUS, fits } from '../data.js';
import { h, fmt } from '../ui-lib.js';
import * as I from './icons.js';
import { openWindow, closeWindow, refreshWindow, isOpen } from './panels.js';
import { createForgeStage } from './forgecanvas.js';
import { createRuneScene, createPolishScene, createRevealScene } from './upgradescenes.js';
import { heatStart, heatStep, heatBand, markerPos, strikeScore, QUENCH, gearName } from '../rules.js';
import { upMult, baseChance, finalChance, QUICK_SCORE, upColor, MAX_UP, upLevel } from '../upgrade.js';
import { sfx } from './sfx.js';

const send = (m) => G.net.send(m);
const pct = (v) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

// the numbers a piece has now and would have one level up (health on the real, ten-times scale)
export function gearStats(g, up = upLevel(g), me = G.me) {
  const it = ITEMS[g.id] ?? {}, qm = qualityStatMult(g.q), f = me && fits(g.id, me.classId) ? 1 + FIT_BONUS : 1, um = upMult(up), out = [];
  if (it.atk) out.push(['ATK', Math.round(it.atk * qm * f * um), '#ff9a6a']); if (it.def) out.push(['DEF', Math.round(it.def * qm * f * um), '#7fb8ff']);
  if (it.hp) out.push(['HP', Math.round(it.hp * qm * f * um * HP_SCALE), '#ff7a7a']); if (it.mp) out.push(['MP', Math.round(it.mp * qm * f), '#8ad8ff']);
  return out;
}
export const upBadge = (up) => (up > 0 ? h('span', { class: 'upbadge', style: { color: upColor(up), borderColor: upColor(up) } }, `+${up}`) : null);
export const upName = (g) => h('span', { style: { color: upColor(upLevel(g)) } }, gearName(g));
const statRow = (g) => { const now = gearStats(g), nxt = gearStats(g, upLevel(g) + 1); return h('div', { class: 'upstats' }, now.map(([k, v, c], i) => h('div', { class: 'upstat' }, h('span', { style: { color: c } }, k), h('b', {}, fmt(v)), upLevel(g) < MAX_UP ? h('span', { class: 'ups-arrow' }, '→') : null, upLevel(g) < MAX_UP ? h('b', { style: { color: '#8cffa0' } }, fmt(nxt[i][1])) : null))); };
export const matRow = (mats) => h('div', { class: 'upmats' }, mats.map((m) => h('span', { class: `upmat ${m.have != null && m.have < m.n ? 'short' : ''}`, title: ITEMS[m.id]?.n ?? m.id }, I.item(m.id, 24), h('b', {}, m.have != null ? `${m.have}/${m.n}` : `×${m.n}`), h('span', { class: 'dim' }, ITEMS[m.id]?.n ?? m.id))));
export const chanceBar = (base, bonus, L) => {
  const q = finalChance(L, QUICK_SCORE, bonus), a = finalChance(L, 0.6, bonus), p = finalChance(L, 1, bonus);
  return h('div', { class: 'upchance' }, h('div', { class: 'row sb', style: { fontSize: '12px' } }, h('span', {}, 'Chance of success'), h('b', { class: 'gold' }, `${pct(q)} – ${pct(p)}`)),
    h('div', { class: 'upbar' }, h('i', { class: 'u1', style: { width: `${q * 100}%` } }), h('i', { class: 'u2', style: { width: `${(a - q) * 100}%` } }), h('i', { class: 'u3', style: { width: `${(p - a) * 100}%` } })),
    h('div', { class: 'dim', style: { fontSize: '11px' } }, `Quick forge ${pct(q)} · decent play ${pct(a)} · perfect play ${pct(p)}`));
};
const failNote = (info) => (info.drop > 0 ? `If it fails the materials are lost and the piece may fall ${info.dropN} level${info.dropN > 1 ? 's' : ''} (${pct(info.drop)} chance).` : 'If it fails the materials are lost; the piece keeps its level.');

// ── the anvil window ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function openUpgradeStation(preUid = null) {
  let sel = preUid, info = null, qText = '';
  G.upInfoCb = (m) => { info = m; if (isOpen('upstation')) refreshWindow('upstation'); };
  const pick = (g) => { sel = g.uid; info = null; send({ t: 'upgrade.info', uid: g.uid }); refreshWindow('upstation'); };
  if (sel != null) send({ t: 'upgrade.info', uid: sel });
  openWindow('upstation', 'Anvil — upgrade gear', () => {
    const me = G.me, gear = [...(me.gear ?? [])].sort((a, b) => (Object.values(me.equip).includes(b.uid) ? 1 : 0) - (Object.values(me.equip).includes(a.uid) ? 1 : 0) || upLevel(b) - upLevel(a));
    const search = h('input', { class: 'bsearch', placeholder: 'Search your gear…', value: qText, oninput: (e) => { qText = e.target.value; refreshWindow('upstation'); setTimeout(() => document.querySelector('.upstation-q')?.focus(), 0); } }); search.classList.add('upstation-q');
    const list = gear.filter((g) => !qText || gearName(g).toLowerCase().includes(qText.toLowerCase()));
    const cards = list.map((g) => h('button', { class: `upcard ${g.uid === sel ? 'sel' : ''}`, onclick: () => pick(g) }, I.item(g.id, 34), h('div', { style: { minWidth: 0, textAlign: 'left' } }, h('div', { class: 'iname' }, upName(g)), h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap' } }, upBadge(upLevel(g)), Object.values(me.equip).includes(g.uid) ? h('span', { class: 'tag g' }, 'worn') : null, ...gearStats(g).map(([k, v, c]) => h('span', { class: 'sc', style: { color: c } }, `${k} ${fmt(v)}`))))));
    const g = me.gear.find((x) => x.uid === sel);
    return h('div', { class: 'upgrid' },
      h('div', { class: 'uplist' }, search, h('div', { class: 'upcards' }, cards.length ? cards : h('p', { class: 'dim' }, 'No gear matches.'))),
      h('div', { class: 'updetail' }, !g ? h('div', { class: 'dim', style: { padding: '30px 10px', textAlign: 'center' } }, h('p', {}, 'Pick a piece on the left.'), h('p', {}, 'Each step makes it stronger — and is harder than the last. Only Blacksmiths can do the work; others ask one (Character → Trading).')) : detail(g, info, me)));
  }, { wide: true, icon: 'forge', onClose: () => { G.upInfoCb = null; } });
}
function detail(g, info, me) {
  if (!info || info.uid !== g.uid) return h('p', { class: 'dim' }, 'Reading the metal…');
  const L = info.up, smith = !!info.smith, short = info.mats.some((m) => m.have < m.n), lowLvl = info.myLvl < info.needLvl;
  const head = h('div', { class: 'row', style: { gap: '12px', alignItems: 'center' } }, h('div', { class: 'upicon', style: { boxShadow: `0 0 18px ${upColor(L)}` } }, I.item(g.id, 56)), h('div', {}, h('h3', { style: { margin: 0 } }, upName(g)), h('div', { class: 'dim', style: { fontSize: '12px' } }, `${info.tier} · quality ${Math.round(g.q * 100)}%`), h('div', { style: { fontSize: '13px' } }, `Step ${L >= MAX_UP ? 'maxed' : `+${L} → +${L + 1}`}`)));
  if (info.maxed) return h('div', {}, head, h('p', { class: 'gold' }, 'This piece is fully tempered: +99.'));
  const ready = smith && !short && !lowLvl;
  return h('div', {}, head, statRow(g),
    h('div', { class: 'dim', style: { fontSize: '12px', margin: '8px 0 2px' } }, 'Materials for this step'), matRow(info.mats), chanceBar(info.chance, info.bonus, L),
    h('p', { class: 'dim', style: { fontSize: '12px', margin: '6px 0' } }, failNote(info)),
    h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, h('span', { class: `tag ${lowLvl ? 'r' : 'g'}` }, `smith level ${info.needLvl}${lowLvl ? ` (you are ${info.myLvl})` : ' ✓'}`), h('span', { class: 'tag' }, 'stand at a forge')),
    !smith ? h('div', { class: 'card hl', style: { margin: '8px 0' } }, h('b', {}, 'Only a Blacksmith can upgrade gear.'), h('p', { class: 'dim', style: { fontSize: '12px', margin: '4px 0' } }, `Ask one: give them the piece, the materials above and a fee (suggested ${fmt(info.fee)}g). It is all held safely until the work is done.`), h('button', { class: 'btn small gold', onclick: () => { closeWindow('upstation'); G.openUpgradeReq?.(g.uid); } }, 'Ask a Blacksmith')) : null,
    smith ? h('div', { class: 'row', style: { marginTop: '10px', gap: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn primary', disabled: !ready, title: ready ? '' : short ? 'Not enough materials' : lowLvl ? 'Your smith level is too low' : '', onclick: () => send({ t: 'upgrade.start', uid: g.uid }) }, 'Forge it (minigame)'),
      h('button', { class: 'btn ghost', disabled: !ready, title: `No minigame: ${pct(finalChance(L, QUICK_SCORE, info.bonus))}`, onclick: () => send({ t: 'upgrade.start', uid: g.uid, quick: true }) }, 'Quick forge')) : null);
}

// ── the minigame ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function startUpgrade(tk) {
  closeWindow('upstation'); closeWindow('upgrade');
  const spec = tk.spec, g0 = tk.gear, icon = I.itemIcon(g0.id), L = tk.L;
  const forge = createForgeStage({ icon });
  let phase = 'heat', raf = 0, t0 = performance.now(), finished = false, scene = null, locked = false;
  const data = { heat: [], folds: [[], [], []], rune: [], quench: 0, medium: null, polish: [] };
  const names = ['HEAT', 'FOLD', 'RUNE', 'QUENCH', 'POLISH'], pills = names.map((n, i) => h('span', { class: 'up-pill' }, `${i + 1} · ${n}`));
  const setStage = (i, color) => { pills.forEach((p, k) => { p.className = `up-pill ${k < i ? 'done' : k === i ? 'on' : ''}`; }); stage.style.color = color; };
  const stage = h('div', { class: 'fb-msg', style: { fontWeight: 700, minHeight: '24px', margin: '4px 0' } }), msg = h('div', { class: 'fb-msg dim', style: { minHeight: '36px', margin: '4px 0' } }), body = h('div', {}), hits = h('div', { class: 'row', style: { justifyContent: 'center' } });
  const zone = h('div', { class: 'fzone' }), mark = h('div', { class: 'fmark' }), fbar = h('div', { class: 'fbar', style: { display: 'none' } }, zone, mark);
  const act = h('button', { class: 'btn primary', style: { fontSize: '16px', padding: '10px 28px', touchAction: 'none' } }, '');
  const timeBar = h('div', { class: 'meter', style: { margin: '6px 0' } }, h('i', { style: { width: '0%' } }));
  const tzone = h('div', { class: 'tzone' }), tmark = h('div', { class: 'tmark' }), thermo = h('div', { class: 'thermo' }, tzone, tmark, h('span', { class: 'tlbl t1' }, 'HOT'), h('span', { class: 'tlbl t2' }, 'COLD'));
  const stageHolder = h('div', { class: 'forge-row' }, forge.el, thermo), sceneHolder = h('div', { style: { display: 'none' } });
  const head = h('div', { class: 'up-head' }, h('div', { class: 'row', style: { gap: '10px', alignItems: 'center' } }, I.item(g0.id, 36), h('div', {}, h('b', { style: { color: upColor(L) } }, gearName(g0)), h('div', { class: 'dim', style: { fontSize: '12px' } }, `Tempering +${L} → +${L + 1}${tk.self ? '' : ` for ${tk.owner}`} · base chance ${pct(tk.chance)}`))), h('div', { class: 'up-pills' }, pills));
  const root = h('div', {}, head, stage, stageHolder, sceneHolder, fbar, timeBar, msg, body, hits, h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, act));
  const abort = () => { cancelAnimationFrame(raf); forge.destroy(); scene?.destroy(); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); removeEventListener('blur', release); if (!finished) send({ t: 'upgrade.cancel' }); };
  openWindow('upgrade', `Tempering: ${ITEMS[g0.id].n}`, () => root, { onClose: abort, icon: 'forge', wide: true });
  const place = (c, half) => { zone.style.left = `${(c - half) * 100}%`; zone.style.width = `${half * 200}%`; };
  let holding = false, holdStart = 0, spaceDown = false, heatGo = false; const gate = { until: 0, needUp: false }; const arm = (ms = 550) => { gate.until = performance.now() + ms; gate.needUp = spaceDown; };
  const press = () => {
    if (locked) return; const now = performance.now();
    if (phase === 'heat') { if (!heatGo) { heatGo = true; t0 = now; act.textContent = 'HOLD TO HEAT'; msg.textContent = 'HOLD Space to push the heat up, let go to let it sink. Keep the marker in the middle of the gold zone.'; } if (!holding) { holding = true; holdStart = Math.round(now - t0); sfx('step', 60); } return; }
    if (now < gate.until || gate.needUp) return; if (phase === 'fold') strike(); else if (phase === 'quench') dunk();
  };
  const release = () => { if (phase === 'heat' && holding) { holding = false; data.heat.push([holdStart, Math.round(performance.now() - t0)]); } };
  const kd = (e) => { if (e.code === 'Space' && !/INPUT|TEXTAREA/.test(e.target?.tagName ?? '')) { e.preventDefault(); if (!e.repeat) { spaceDown = true; press(); } } };
  const ku = (e) => { if (e.code === 'Space') { e.preventDefault(); spaceDown = false; gate.needUp = false; release(); } };
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku); addEventListener('blur', () => { spaceDown = false; release(); });
  act.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); }); act.addEventListener('pointerup', release); act.addEventListener('pointerleave', release);

  // 1 · HEAT
  function startHeat() {
    const hs = spec.heat; phase = 'heat'; t0 = performance.now(); setStage(0, '#ffb84a'); tzone.style.bottom = `${(hs.center - hs.half) * 100}%`; tzone.style.height = `${hs.half * 200}%`;
    msg.textContent = 'The heat starts the moment you first press Space. HOLD to push it up, release to let it sink, and keep the marker in the middle of the gold zone for six seconds.'; act.textContent = 'PRESS SPACE TO BEGIN';
    const st = heatStart(hs); let stepT = 0;
    const loop = (now) => {
      const el = heatGo ? now - t0 : 0; while (stepT < el && stepT < hs.dur) { heatStep(hs, st, holding, stepT); stepT += 20; }
      const pos = st.pos, d = Math.abs(pos - hs.center), band = heatBand(hs, pos);
      tmark.style.bottom = `${pos * 100}%`; tmark.style.opacity = heatGo ? 1 : 0.5 + 0.5 * Math.sin(now / 220); tmark.style.background = band === 1 ? '#fff2b0' : band >= 0.75 ? '#ffd36a' : pos < hs.center ? '#6a9aff' : '#ff4a3a';
      forge.setHeat(0.25 + 0.75 * Math.max(0, 1 - d / (hs.half * 3))); forge.setFire(holding ? 1 : 0.35); timeBar.firstChild.style.width = `${Math.min(100, Math.round((el / hs.dur) * 25) * 4)}%`;
      if (heatGo && el >= hs.dur) { release(); cancelAnimationFrame(raf); thermo.style.display = 'none'; tmark.style.opacity = 1; startFold(0); return; } raf = requestAnimationFrame(loop);
    }; raf = requestAnimationFrame(loop);
  }
  // 2 · FOLD — three rounds, each four blows; every round the marker is faster and the steel has twice the layers
  let round = 0, n = 0, center = 0, lastStrike = -999;
  function startFold(r) {
    round = r; n = 0; phase = 'fold'; t0 = performance.now(); arm(600); const f = spec.folds[r]; center = f.centers[0]; setStage(1, '#d8cdbd');
    msg.textContent = r === 0 ? 'Fold the steel: strike when the marker crosses the zone! (Space / click) Three rounds, each faster.' : `Round ${r + 1} of 3 — the steel has ${2 ** (r + 3)} layers now. Faster!`; msg.style.color = ''; act.textContent = 'STRIKE!'; fbar.style.display = ''; place(center, f.half); mark.style.background = '#ffd36a'; hits.replaceChildren(); timeBar.firstChild.style.width = `${(r / 3) * 100}%`;
    cancelAnimationFrame(raf); const loop = (now) => { mark.style.left = `${Math.round(markerPos(f, now - t0) * 50) * 2}%`; raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop);
  }
  function strike() {
    const f = spec.folds[round], t = performance.now() - t0; if (t - lastStrike < 320) return; lastStrike = t; const pos = markerPos(f, t), sc = strikeScore(pos, center, f.half); data.folds[round].push(Math.round(t)); n++;
    forge.strike(sc); setTimeout(() => sfx('anvil', 60), 125);
    const label = sc >= 1 ? ['PERFECT!', '#ffd36a'] : sc > 0.6 ? ['Good', '#6fc08b'] : sc > 0.2 ? ['Weak', '#d8cdbd'] : ['Miss...', '#e0645a']; msg.textContent = label[0]; msg.style.color = label[1]; hits.append(h('span', { class: 'tag', style: { color: label[1] } }, `${Math.round(sc * 100)}%`));
    if (n >= f.strikes) { cancelAnimationFrame(raf); phase = 'wait'; lastStrike = -999; setTimeout(() => (round + 1 < spec.folds.length ? startFold(round + 1) : startRune()), 750); return; }
    center = f.centers[n]; place(center, f.half);
  }
  // 3 · RUNE
  function startRune() {
    phase = 'rune'; setStage(2, '#9adfff'); stageHolder.style.display = 'none'; fbar.style.display = 'none'; hits.replaceChildren(); act.textContent = 'DONE ENGRAVING'; act.disabled = false; timeBar.firstChild.style.width = '0%';
    msg.textContent = 'Engrave the rune. Hold the mouse button at the green start and follow the glowing groove to the red end. Stay on the line: scratches off it cost you.'; msg.style.color = '';
    scene = createRuneScene(g0.id, spec.rune, { onProgress: (p) => { timeBar.firstChild.style.width = `${Math.round(p * 25) * 4}%`; } }); sceneHolder.replaceChildren(scene.el); sceneHolder.style.display = '';
    const limit = spec.rune.limit; const tick = () => { if (phase !== 'rune') return; if (scene.started() && (scene.progress() >= 0.97 || scene.elapsed() > limit)) return endRune(); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick);
    act.onclick = () => { if (phase === 'rune' && scene.started()) endRune(); };
  }
  function endRune() { if (phase !== 'rune') return; phase = 'wait'; cancelAnimationFrame(raf); data.rune = scene.finish(); const p = scene.progress(); scene.destroy(); scene = null; sceneHolder.style.display = 'none'; act.onclick = null; msg.textContent = p > 0.85 ? 'A clean rune.' : p > 0.5 ? 'It will hold.' : 'The rune is patchy…'; setTimeout(startQuench, 600); }
  // 4 · QUENCH
  function startQuench() {
    phase = 'choose'; setStage(3, '#7fd8ff'); stageHolder.style.display = ''; msg.textContent = 'Choose the bath. It decides what the metal becomes.'; msg.style.color = ''; act.style.display = 'none'; fbar.style.display = 'none'; timeBar.style.display = 'none'; hits.replaceChildren(); thermo.style.display = 'none';
    body.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'center', alignItems: 'stretch' } }, Object.entries(QUENCH).map(([id, q]) => h('button', { class: 'card', style: { textAlign: 'left', width: '170px', cursor: 'pointer' }, onclick: () => pickBath(id) }, h('b', {}, q.name), h('div', { class: 'dim', style: { fontSize: '12px' } }, q.note)))));
  }
  function pickBath(id) {
    data.medium = id; phase = 'quench'; arm(500); body.replaceChildren(); fbar.style.display = ''; act.style.display = ''; act.disabled = false; act.textContent = 'DUNK!'; t0 = performance.now(); place(spec.quench.center, spec.quench.half * QUENCH[id].half); mark.style.background = '#7fd8ff'; msg.textContent = `Dunk it in the ${QUENCH[id].name.toLowerCase()} when the marker is in the zone!`;
    forge.setHeat(0.85); const loop = (now) => { mark.style.left = `${Math.round(markerPos(spec.quench, now - t0) * 50) * 2}%`; raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop);
  }
  function dunk() {
    sfx('hiss', 100); const t = performance.now() - t0; data.quench = Math.round(t); cancelAnimationFrame(raf); phase = 'wait'; act.disabled = true; const sc = strikeScore(markerPos(spec.quench, t), spec.quench.center, spec.quench.half * QUENCH[data.medium].half);
    forge.quench(sc > 0.4); msg.textContent = sc >= 0.9 ? 'Hiss! A perfect quench.' : sc > 0.4 ? 'It holds.' : 'A crack runs through it…'; msg.style.color = sc > 0.4 ? '#7fd8ff' : '#e0645a'; setTimeout(startPolish, 1100);
  }
  // 5 · POLISH
  function startPolish() {
    phase = 'polish'; setStage(4, '#ffe9a8'); stageHolder.style.display = 'none'; fbar.style.display = 'none'; act.style.display = ''; act.disabled = false; act.textContent = 'FINISH POLISHING'; timeBar.style.display = ''; timeBar.firstChild.style.width = '0%'; msg.style.color = '';
    msg.textContent = `Polish the edge: sweep the whetstone left and right, one pass per pulse of the ring. ${spec.polish.need} strokes in an even rhythm.`;
    scene = createPolishScene(g0.id, spec.polish, { onStroke: ({ ok, n, good }) => { timeBar.firstChild.style.width = `${Math.min(100, Math.round((n / spec.polish.need) * 25) * 4)}%`; msg.textContent = ok ? `Smooth. (${good} good strokes)` : 'Too fast or too slow — keep to the pulse.'; msg.style.color = ok ? '#8cffa0' : '#e0a070'; if (n >= spec.polish.need) setTimeout(endPolish, 450); } });
    sceneHolder.replaceChildren(scene.el); sceneHolder.style.display = ''; act.onclick = () => { if (phase === 'polish') endPolish(); };
  }
  function endPolish() { if (phase !== 'polish') return; phase = 'done'; const base = scene.strokes[0] ?? 0; data.polish = scene.strokes.map((s) => s - base + 1000); scene.destroy(); scene = null; act.onclick = null; act.disabled = true; locked = true; msg.textContent = 'The piece goes back on the anvil…'; msg.style.color = ''; finished = true; send({ t: 'upgrade.finish', data }); }
  setStage(0, '#ffb84a'); startHeat();
  return root;
}

// ── the result ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function showUpgradeResult(m) {
  G.upLast = m; if (isOpen('upgrade')) { const w = document.querySelector('.win-back'); void w; }
  const scene = createRevealScene(m.gear.id, m), parts = m.parts ?? {};
  const bar = (k, label) => h('div', { class: 'row sb upres-row' }, h('span', {}, label), h('span', { class: 'meter', style: { width: '120px' } }, h('i', { style: { width: `${Math.round((parts[k] ?? 0) * 100)}%` } })), h('b', {}, `${Math.round((parts[k] ?? 0) * 100)}%`));
  const g = { ...m.gear, up: m.to }, g0 = { ...m.gear, up: m.from };
  const body = h('div', {}, scene.el,
    h('div', { style: { height: '8px' } }),
    h('div', { class: 'row', style: { justifyContent: 'center', gap: '8px', flexWrap: 'wrap' } }, h('b', { style: { color: upColor(m.to), fontSize: '18px' } }, gearName(g)), m.ok ? h('span', { class: 'tag g' }, `+${m.from} → +${m.to}`) : m.dropped ? h('span', { class: 'tag r' }, `fell to +${m.to}`) : h('span', { class: 'tag' }, 'kept +' + m.to)),
    m.ok ? h('div', { style: { margin: '6px 0' } }, h('div', { class: 'dim', style: { fontSize: '12px', textAlign: 'center' } }, 'Before → after'), h('div', { class: 'row', style: { justifyContent: 'center', gap: '14px' } }, gearStats(g0).map(([k, v, c], i) => h('span', {}, h('span', { style: { color: c } }, `${k} `), fmt(v), ' → ', h('b', { style: { color: '#8cffa0' } }, fmt(gearStats(g)[i][1])))))) : null,
    !m.quick ? h('div', { class: 'card', style: { margin: '8px 0', padding: '8px 12px' } }, h('div', { class: 'dim', style: { fontSize: '12px', marginBottom: '4px' } }, `Your work scored ${Math.round((parts.score ?? 0) * 100)}% — success chance ${pct(m.chance)}.`), bar('heat', 'Heat'), bar('fold', 'Folding'), bar('rune', 'Rune'), bar('quench', 'Quench'), bar('polish', 'Polish')) : h('p', { class: 'dim', style: { textAlign: 'center', fontSize: '12px' } }, `Quick forge: success chance ${pct(m.chance)}.`),
    m.fee ? h('p', { class: 'gold', style: { textAlign: 'center', margin: '4px 0' } }, `You earned ${fmt(m.fee)}g for the work on ${m.owner}'s piece.`) : null,
    h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px', gap: '8px' } }, m.self && m.to < MAX_UP ? h('button', { class: 'btn primary', onclick: () => { closeWindow('upgrade'); openUpgradeStation(m.gear.uid && G.me?.gear?.some((x) => x.uid === m.gear.uid) ? m.gear.uid : null); } }, 'Upgrade another step') : null, h('button', { class: 'btn ghost', onclick: () => closeWindow('upgrade') }, 'Close')));
  closeWindow('upgrade');
  openWindow('upgrade', m.ok ? `Success! ${gearName(g)}` : 'The metal would not take it', () => body, { icon: 'forge', onClose: () => scene.destroy() });
  setTimeout(() => sfx(m.ok ? 'secret' : 'hiss', m.ok ? 500 : 200), 1750);
}
G.openUpgrade = openUpgradeStation;
