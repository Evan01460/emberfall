// Procedural chiptune score: each area has its own seeded tune (lead + arpeggio + bass + simple drums) that loops forever.
// Nothing is recorded — the notes are generated from a seed, so the tunes are always the same for the same place.
import { isMuted } from './sfx.js';
let ctx = null, out = null, current = null, timer = null, step = 0, nextT = 0, track = null, enabled = true;
try { enabled = localStorage.getItem('emberfall.music') !== '0'; } catch { /* ignore */ }
const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], pent: [0, 2, 4, 7, 9] };
// root MIDI, scale, bpm, lead wave, mood (density 0..1), progression (scale degrees of chord roots)
const TRACKS = {
  title: { root: 57, scale: 'minor', bpm: 78, wave: 'triangle', dens: 0.55, prog: [0, 5, 3, 4], seed: 7 },
  town: { root: 60, scale: 'major', bpm: 96, wave: 'square', dens: 0.7, prog: [0, 3, 4, 0, 5, 3, 4, 0], seed: 11 },
  night: { root: 57, scale: 'dorian', bpm: 70, wave: 'triangle', dens: 0.4, prog: [0, 5, 0, 4], seed: 13 },
  wild: { root: 62, scale: 'lydian', bpm: 108, wave: 'square', dens: 0.65, prog: [0, 4, 5, 3], seed: 17 },
  forest: { root: 55, scale: 'pent', bpm: 88, wave: 'triangle', dens: 0.5, prog: [0, 3, 4, 3], seed: 19 },
  cave: { root: 52, scale: 'phrygian', bpm: 74, wave: 'triangle', dens: 0.4, prog: [0, 1, 0, 6], seed: 23 },
  desert: { root: 59, scale: 'phrygian', bpm: 100, wave: 'square', dens: 0.6, prog: [0, 1, 0, 4], seed: 29 },
  snow: { root: 64, scale: 'major', bpm: 66, wave: 'triangle', dens: 0.35, prog: [0, 5, 3, 4], seed: 31 },
  swamp: { root: 50, scale: 'minor', bpm: 72, wave: 'triangle', dens: 0.4, prog: [0, 3, 0, 5], seed: 37 },
  volcano: { root: 53, scale: 'phrygian', bpm: 118, wave: 'sawtooth', dens: 0.75, prog: [0, 1, 4, 1], seed: 41 },
  hollow: { root: 54, scale: 'minor', bpm: 64, wave: 'sine', dens: 0.3, prog: [0, 6, 5, 6], seed: 43 },
  dungeon: { root: 51, scale: 'minor', bpm: 82, wave: 'square', dens: 0.5, prog: [0, 5, 6, 4], seed: 47 },
  boss: { root: 48, scale: 'phrygian', bpm: 140, wave: 'sawtooth', dens: 0.9, prog: [0, 1, 0, 6, 0, 1, 5, 4], seed: 53 },
};
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function build(t) {
  const r = rng(t.seed), sc = SCALES[t.scale], bars = t.prog.length, melody = [], deg = (d) => sc[((d % sc.length) + sc.length) % sc.length] + 12 * Math.floor(d / sc.length);
  let pos = 2;
  for (let b = 0; b < bars; b++) for (let i = 0; i < 8; i++) {
    const strong = i % 4 === 0; pos += Math.round((r() - 0.5) * 4); pos = Math.max(0, Math.min(sc.length + 3, pos));
    if (strong) pos = t.prog[b] + [0, 2, 4][Math.floor(r() * 3)];
    melody.push(r() < (strong ? 0.95 : t.dens) ? t.root + 12 + deg(pos) : null);
  }
  return { melody, bars };
}
function ensureCtx() { if (ctx) return ctx; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; try { ctx = new AC(); out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination); } catch { ctx = null; } return ctx; }
function note(f, t, dur, type, vol) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02); }
function hat(t, vol = 0.05) { const n = Math.floor(ctx.sampleRate * 0.03), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = buf; f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(out); s.start(t); }
function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.18); }
function schedule() {
  if (!ctx || !track || ctx.state !== 'running') return;
  const T = TRACKS[track.name], spb = 60 / T.bpm / 2;                      // an eighth note
  while (nextT < ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 8) % track.m.bars, i = step % 8, sc = SCALES[T.scale], deg = (d) => sc[((d % sc.length) + sc.length) % sc.length] + 12 * Math.floor(d / sc.length), chord = T.prog[bar];
    const m = track.m.melody[(bar * 8 + i) % track.m.melody.length]; if (m != null) note(NOTE(m), nextT, spb * 1.7, T.wave, 0.075);
    const arp = T.root + 12 + deg(chord + [0, 2, 4, 2][i % 4] * (i % 2 ? 1 : 1)); if (i % 2 === 0) note(NOTE(arp - 12), nextT, spb * 0.9, 'square', 0.028);
    if (i % 4 === 0) note(NOTE(T.root - 12 + deg(chord)), nextT, spb * 3.4, 'triangle', 0.12);
    if (T.dens > 0.5) { if (i % 4 === 0) kick(nextT); if (i % 2 === 1) hat(nextT); } else if (i === 0) kick(nextT);
    nextT += spb; step++;
  }
}
export function playTrack(name) {
  if (!TRACKS[name] || (track && track.name === name)) return;
  const c = ensureCtx(); if (!c) return;
  track = { name, m: build(TRACKS[name]) }; step = 0; nextT = c.currentTime + 0.15;
  if (!timer) timer = setInterval(schedule, 80);
  fade();
}
export function stopMusic() { track = null; fade(); }
function fade() { if (!out) return; const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(track && enabled && !isMuted() ? 0.55 : 0, t, 0.5); }
export const toggleMusic = (muted) => { enabled = !muted; try { localStorage.setItem('emberfall.music', enabled ? '1' : '0'); } catch { /* ignore */ } fade(); return enabled; };
const resume = () => { const c = ensureCtx(); if (c?.state === 'suspended') c.resume().then(fade); else fade(); };
addEventListener('pointerdown', resume, { passive: true }); addEventListener('keydown', resume, { passive: true });
// Which tune belongs to where you are.
export function trackFor(map, night, boss) {
  if (boss) return 'boss'; if (!map) return 'title';
  const id = map.id, th = map.theme;
  if (th === 'hollow') return 'hollow'; if (th === 'cave' || /crypt|warren|catacomb|depth|dungeon|vault|cellar/.test(id)) return th === 'cave' ? 'cave' : 'dungeon';
  if (th === 'desert') return 'desert'; if (th === 'snow') return 'snow'; if (th === 'swamp') return 'swamp'; if (th === 'volcano') return 'volcano';
  if (id === 'town' || /^(greenmeadow|saltmere)$/.test(id)) return night ? 'night' : 'town';
  return night ? 'night' : id === 'gloomwood' || id === 'world_tree' ? 'forest' : 'wild';
}
