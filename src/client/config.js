// Where "the global world" lives. Three ways, in order:
//  1. a dedicated server baked into this build (EMBERFALL_GLOBAL_WS=wss://… node build.mjs)  — one always-on world for everyone
//  2. this page itself is served by an Emberfall Node host (GET /health answers)  — visitors of that URL share that server
//  3. otherwise the zero-setup peer-to-peer public room
/* global __GLOBAL_WS__ */
const BUILT = typeof __GLOBAL_WS__ !== 'undefined' ? __GLOBAL_WS__ : '';
export async function dedicatedServer() {
  try { const o = localStorage.getItem('emberfall-global'); if (o) return o; } catch { /* ignore */ }
  const q = new URLSearchParams(location.search).get('global'); if (q) return q;
  if (BUILT) return BUILT;
  if (/^https?:$/.test(location.protocol) && location.host && location.host !== 'null') {
    try { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 1500); const r = await fetch('/health', { signal: ctl.signal }); clearTimeout(t); if (r.ok) { const j = await r.json(); if (j && typeof j.players === 'number') return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`; } } catch { /* not a node host */ }
  }
  return '';
}
