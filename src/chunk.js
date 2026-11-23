// Chunked messaging for WebRTC data channels: any message bigger than ~12 KB is split into pieces and put back together on the
// other side, so no browser pair can choke on a large payload (the Exchange view, the leaderboards, world backups…).
// even fully JSON-escaped a piece stays under 16 KB, the oldest cross-browser limit
const CHUNK = 7000; let chunkId = 1;
export function sendChunked(dc, m) {
  const s = JSON.stringify(m);
  if (s.length <= CHUNK) return dc.send(m);
  const id = chunkId++, n = Math.ceil(s.length / CHUNK);
  for (let i = 0; i < n; i++) dc.send({ __c: id, i, n, d: s.slice(i * CHUNK, (i + 1) * CHUNK) });
}
export function chunkReader(onMessage) {
  const parts = new Map();
  return (m) => {
    if (!m || m.__c === undefined) return onMessage(m);
    let e = parts.get(m.__c); if (!e) { e = { n: m.n, got: 0, p: new Array(m.n) }; parts.set(m.__c, e); if (parts.size > 40) parts.delete(parts.keys().next().value); }
    if (e.p[m.i] === undefined) { e.p[m.i] = m.d; e.got++; }
    if (e.got === e.n) { parts.delete(m.__c); let obj; try { obj = JSON.parse(e.p.join('')); } catch { return; } onMessage(obj); }
  };
}

