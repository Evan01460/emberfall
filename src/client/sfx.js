// Tiny chiptune-style sound effects, synthesised with WebAudio (no audio files). Starts on the first click/key.
let ctx = null, master = null, muted = false;
try { muted = localStorage.getItem('emberfall.mute') === '1'; } catch { /* storage may be blocked */ }
const ensure = () => {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination); } catch { ctx = null; }
  return ctx;
};
const unlock = () => { const c = ensure(); if (c?.state === 'suspended') c.resume(); };
addEventListener('pointerdown', unlock, { passive: true }); addEventListener('keydown', unlock, { passive: true });

// One blip: oscillator with a frequency slide and a fast decay.
function tone({ f = 440, f2 = null, dur = 0.12, type = 'square', vol = 0.5, delay = 0 }) {
  const c = ensure(); if (!c || muted || c.state !== 'running') return;
  const t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise({ dur = 0.1, vol = 0.4, hp = 800, delay = 0 }) {
  const c = ensure(); if (!c || muted || c.state !== 'running') return;
  const t0 = c.currentTime + delay, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(t0);
}
const last = {}; const gate = (k, ms) => { const n = performance.now(); if (n - (last[k] ?? 0) < ms) return false; last[k] = n; return true; };

const LIB = {
  swing: () => { noise({ dur: 0.09, vol: 0.28, hp: 1800 }); tone({ f: 380, f2: 160, dur: 0.07, type: 'triangle', vol: 0.2 }); },
  hit: () => { noise({ dur: 0.07, vol: 0.4, hp: 500 }); tone({ f: 200, f2: 70, dur: 0.09, type: 'square', vol: 0.35 }); },
  crit: () => { noise({ dur: 0.1, vol: 0.45, hp: 400 }); tone({ f: 520, f2: 90, dur: 0.14, type: 'sawtooth', vol: 0.35 }); tone({ f: 900, dur: 0.05, type: 'square', vol: 0.25, delay: 0.03 }); },
  hurt: () => { tone({ f: 160, f2: 60, dur: 0.18, type: 'sawtooth', vol: 0.4 }); },
  cast: () => { tone({ f: 300, f2: 900, dur: 0.18, type: 'sine', vol: 0.3 }); },
  shoot: () => { tone({ f: 700, f2: 250, dur: 0.07, type: 'square', vol: 0.18 }); noise({ dur: 0.04, vol: 0.15, hp: 3000 }); },
  boom: () => { noise({ dur: 0.35, vol: 0.5, hp: 90 }); tone({ f: 110, f2: 35, dur: 0.3, type: 'sawtooth', vol: 0.4 }); },
  dash: () => { noise({ dur: 0.14, vol: 0.25, hp: 1200 }); },
  door: () => { tone({ f: 120, f2: 90, dur: 0.16, type: 'square', vol: 0.22 }); noise({ dur: 0.1, vol: 0.12, hp: 400, delay: 0.02 }); },
  step: () => { noise({ dur: 0.03, vol: 0.07, hp: 600 }); },
  pickup: () => { tone({ f: 660, dur: 0.06, type: 'square', vol: 0.22 }); tone({ f: 990, dur: 0.09, type: 'square', vol: 0.22, delay: 0.06 }); },
  coin: () => { tone({ f: 1320, dur: 0.05, type: 'square', vol: 0.2 }); tone({ f: 1760, dur: 0.12, type: 'square', vol: 0.2, delay: 0.05 }); },
  click: () => { tone({ f: 520, dur: 0.03, type: 'square', vol: 0.16 }); },
  open: () => { tone({ f: 330, dur: 0.05, type: 'triangle', vol: 0.2 }); tone({ f: 495, dur: 0.07, type: 'triangle', vol: 0.2, delay: 0.05 }); },
  anvil: () => { noise({ dur: 0.05, vol: 0.5, hp: 2500 }); tone({ f: 1500, f2: 1100, dur: 0.22, type: 'triangle', vol: 0.35 }); tone({ f: 2250, dur: 0.15, type: 'sine', vol: 0.15 }); },
  hiss: () => { noise({ dur: 0.35, vol: 0.3, hp: 3500 }); },
  bubble: () => { tone({ f: 260, f2: 520, dur: 0.1, type: 'sine', vol: 0.25 }); },
  levelup: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.14, type: 'square', vol: 0.25, delay: i * 0.09 })); },
  death: () => { [330, 262, 196, 147].forEach((f, i) => tone({ f, dur: 0.22, type: 'triangle', vol: 0.3, delay: i * 0.16 })); },
  secret: () => { [392, 494, 587, 740, 988].forEach((f, i) => tone({ f, dur: 0.18, type: 'sine', vol: 0.22, delay: i * 0.08 })); },
  roar: () => { noise({ dur: 0.5, vol: 0.4, hp: 70 }); tone({ f: 90, f2: 45, dur: 0.5, type: 'sawtooth', vol: 0.4 }); },
};
export const sfx = (name, gateMs = 40) => { if (!LIB[name] || !gate(name, gateMs)) return; try { LIB[name](); } catch { /* audio is a nicety */ } };
export const isMuted = () => muted;
export const toggleMute = () => { muted = !muted; try { localStorage.setItem('emberfall.mute', muted ? '1' : '0'); } catch { /* ignore */ } return muted; };
