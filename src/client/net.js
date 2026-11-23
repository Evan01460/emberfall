// Client transports. Both expose the same Net interface:
//   net.send({t,...})  ·  net.on('type', fn)  ·  net.close()
// ONLINE: WebSocket to the Node host.   SOLO: a GameServer running inside this page.
import { GameServer } from '../server/gameserver.js';

export const SOLO_KEY = 'emberfall-solo-v2';

export class Net {
  constructor(mode) { this.mode = mode; this.h = {}; this.closed = false; this.ping = 0; }
  on(t, fn) { (this.h[t] ??= []).push(fn); return this; }
  emit(m) { for (const fn of this.h[m.t] ?? []) fn(m); for (const fn of this.h['*'] ?? []) fn(m); }
  send() {} close() {}
}

export function connectWs(url, login) {
  return new Promise((resolve, reject) => {
    let ws; try { ws = new WebSocket(url); } catch (e) { return reject(new Error('Could not open a connection: ' + e.message)); }
    const net = new Net('online'); let welcomed = false;
    const timer = setTimeout(() => { if (!welcomed) { try { ws.close(); } catch {} reject(new Error('Connection timed out. Is the server running at that address?')); } }, 8000);
    net.send = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
    net.close = () => { net.closed = true; try { ws.close(); } catch {} };
    const VK = `emberfall-vault-${(() => { try { return new URL(url).host; } catch { return 'x'; } })()}-${String(login.name ?? '').trim().toLowerCase()}`;
    let restore = null; try { restore = JSON.parse(localStorage.getItem(VK) ?? 'null'); } catch { /* none */ }
    if (login.create && restore) { clearTimeout(timer); try { ws.close(); } catch {} return reject(new Error(`A character named ${login.name} is saved in this browser from this server. Creating a new one would overwrite it — use "Log in as existing" (it restores that character), or pick another name.`)); }
    if (login.create) restore = null;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'login', ...login, ...(restore ? { restore } : {}) }));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'vault') { try { localStorage.setItem(VK, JSON.stringify({ rec: m.rec, sig: m.sig })); } catch { /* quota */ } return; }
      if (!welcomed) {
        if (m.t === 'login.error') { clearTimeout(timer); ws.close(); return reject(new Error(m.error)); }
        if (m.t === 'welcome') { welcomed = true; clearTimeout(timer); resolve({ net, welcome: m }); return; }
      }
      net.emit(m);
    };
    ws.onerror = () => { if (!welcomed) { clearTimeout(timer); reject(new Error('Could not reach the server. Check the address and that it is running.')); } };
    ws.onclose = () => { if (welcomed && !net.closed) net.emit({ t: 'disconnected' }); else if (!welcomed) reject(new Error('Connection closed.')); };
    // latency probe
    const pinger = setInterval(() => { if (ws.readyState === 1) net.send({ t: 'ping', c: performance.now() }); else clearInterval(pinger); }, 4000);
    net.on('pong', (m) => { net.ping = Math.round(performance.now() - m.c); });
  });
}

export function loadSolo() { try { const t = localStorage.getItem(SOLO_KEY); return t ? JSON.parse(t) : null; } catch { return null; } }
export function soloCharacters() { const s = loadSolo(); return s ? Object.values(s.players).map((p) => ({ name: p.name, classId: p.classId, level: p.level })) : []; }
export function wipeSolo() { try { localStorage.removeItem(SOLO_KEY); } catch {} }

export function connectLocal({ name, create }) {
  return new Promise((resolve, reject) => {
    const state = loadSolo();
    const srv = new GameServer({ state: state?.v === 2 ? state : null });
    const net = new Net('solo');
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const conn = { session: null, send: (m) => { const c = clone(m); queueMicrotask(() => { if (!net.closed) net.emit(c); }); } };
    net.send = (m) => { if (!net.closed) srv.handle(conn, clone(m)); };
    const save = () => { try { localStorage.setItem(SOLO_KEY, JSON.stringify(srv.exportState())); } catch {} };
    // The solo world is lively: a handful of simulated townsfolk stand in for other players' market activity (bots in the market).
    const welcomeHandler = (m) => { if (m.t === 'welcome') { net.h = {}; resolve({ net, welcome: m }); } };
    net.on('welcome', welcomeHandler);
    const res = srv.join(conn, { name, create });
    if (!res.ok) return reject(new Error(res.error));
    const tick = setInterval(() => { try { srv.tick(); } catch (e) { console.error(e); } }, 50);
    const autosave = setInterval(save, 5000);
    const unload = () => save(); window.addEventListener('beforeunload', unload);
    net.close = () => { net.closed = true; clearInterval(tick); clearInterval(autosave); window.removeEventListener('beforeunload', unload); srv.leave(conn); save(); };
    net.ping = 0; net.server = srv;
  });
}
