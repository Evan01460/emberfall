// ZERO-SETUP ONLINE: nobody has to run a server. The first player to open the public world becomes its host — their browser runs
// the same authoritative GameServer that the Node host runs — and everyone else connects to them peer-to-peer (WebRTC) through
// PeerJS's free public signalling broker. There is ONE global room, so everybody in the world meets in the same place.
// Every guest keeps a rolling backup of the world, so when the host leaves, the next player to arrive becomes the host and the
// world carries on from the latest backup.
//
// Built to work across the whole internet, not only one Wi-Fi: STUN + public TURN relays are configured (WebRTC falls back to a
// relay when two players are behind strict NATs), big messages are chunked so no browser pair can choke on them, the game version
// is checked so mismatched builds never share a world, and each player keeps a private copy of their own character that can be
// restored if the world they last played in has been lost.
import Peer from 'peerjs';
import { GameServer } from '../server/gameserver.js';
import { PROTOCOL } from '../version.js';
import { sendChunked, chunkReader } from '../chunk.js';
import { Net } from './net.js';
import { installRestored } from '../server/restore.js';

export const PUBLIC_ROOM = 'global';
const idFor = (room) => `emberfall-v${PROTOCOL}-${String(room).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || PUBLIC_ROOM}`;
const KEY = (room) => `emberfall-p2p-state-${room}`, BKEY = (room) => `emberfall-p2p-backup-${room}`, CKEY = (name) => `emberfall-char-${String(name).toLowerCase()}`;
const clone = (o) => JSON.parse(JSON.stringify(o));
// STUN finds a direct path; TURN relays traffic when no direct path exists (different networks, mobile data, strict firewalls).
// Override with localStorage 'emberfall-ice' (a JSON array of RTCIceServer objects) if you run your own TURN server.
const ICE = [
  { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }, { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
];
const iceServers = () => { try { const o = JSON.parse(localStorage.getItem('emberfall-ice') ?? 'null'); if (Array.isArray(o) && o.length) return o; } catch { /* default */ } return ICE; };
const peerOpts = () => { const base = { config: { iceServers: iceServers(), iceCandidatePoolSize: 4 } }; try { const s = localStorage.getItem('emberfall-signal'); if (s) { const [host, port] = s.split(':'); return { ...base, host, port: +port, path: '/', secure: false }; } } catch { /* default broker */ } return base; };
const sha = async (s) => { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ember|${s}`)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); };
const load = (k) => { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : null; } catch { return null; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };

export { sendChunked, chunkReader };

export async function connectPublic(login, room = PUBLIC_ROOM) {
  const id = idFor(room);
  // the restore copy of this character (if this browser has played it before) travels with the login
  const vault = load(CKEY(login.name));
  if (vault?.P && login.create) throw new Error(`A character named ${login.name} is saved in this browser. Creating a new one would overwrite it — use "Log in as existing" (it restores that character), or pick another name.`);
  if (vault?.P) login = { ...login, restore: vault.P };
  try { return await joinAsGuest(login, room, id); }
  catch (e) { if (e.code !== 'nohost') throw e; }
  try { return await becomeHost(login, room, id); }
  catch (e) { if (e.code === 'taken') return await joinAsGuest(login, room, id); throw e; }          // lost the race to another new host
}

const friendly = (err) => (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed' ? 'Could not reach the public matchmaking service. Check your internet connection and try again.' : `Connection problem: ${err.type ?? err.message}`);

// ── guest ───────────────────────────────────────────────────────────────────
function joinAsGuest(login, room, id) {
  return new Promise((resolve, reject) => {
    const net = new Net('online'); let done = false, peer;
    const fail = (e) => { if (done) return; done = true; try { peer?.destroy(); } catch { /* ignore */ } reject(e); };
    const timer = setTimeout(() => fail(Object.assign(new Error('The public world did not answer.'), { code: 'nohost' })), 12000);
    try { peer = new Peer(peerOpts()); } catch (e) { return fail(new Error('Could not start peer-to-peer: ' + e.message)); }
    peer.on('error', (err) => { clearTimeout(timer); fail(err.type === 'peer-unavailable' ? Object.assign(new Error('No host yet.'), { code: 'nohost' }) : new Error(friendly(err))); });
    peer.on('open', () => {
      const dc = peer.connect(id, { reliable: true, serialization: 'json' });
      let lastPong = performance.now(), pinger = 0;
      const onData = chunkReader((m) => {
        if (!done) {
          if (m?.t === 'login.error') { clearTimeout(timer); fail(new Error(m.error)); return; }
          if (m?.t === 'welcome') {
            if (m.ver !== undefined && m.ver !== PROTOCOL) { clearTimeout(timer); fail(new Error(`The world's host runs a different game version (${m.ver}, you have ${PROTOCOL}). Everyone needs the latest emberfall.html.`)); return; }
            done = true; clearTimeout(timer);
            net.send = (x) => { try { sendChunked(dc, x); } catch { /* closed */ } };
            net.close = () => { net.closed = true; clearInterval(pinger); try { dc.close(); peer.destroy(); } catch { /* ignore */ } };
            // heartbeat: if the host stops answering for 20 s, say so instead of silently freezing
            pinger = setInterval(() => { if (!dc.open) return clearInterval(pinger); net.send({ t: 'ping', c: performance.now() }); if (performance.now() - lastPong > 20000 && !net.closed) { clearInterval(pinger); net.emit({ t: 'disconnected', msg: 'The host stopped answering. Reload to rejoin — whoever arrives first hosts the world from the latest backup.' }); } }, 4000);
            resolve({ net, welcome: m }); return;
          }
        }
        if (m?.t === 'p2p.state') { store(BKEY(room), { ts: m.ts, state: m.state }); return; }             // rolling world backup for host migration
        if (m?.t === 'p2p.char') { store(CKEY(m.P?.name ?? login.name), { ts: m.ts, P: m.P }); return; }  // my own character, kept privately in this browser
        if (m?.t === 'pong') { lastPong = performance.now(); net.ping = Math.round(performance.now() - m.c); }
        net.emit(m);
      });
      dc.on('open', () => dc.send({ t: 'login', ...login }));
      dc.on('data', onData);
      dc.on('close', () => { if (done && !net.closed) net.emit({ t: 'disconnected', msg: 'The host left. Reload to rejoin — whoever arrives first hosts the world from the latest backup.' }); else fail(new Error('Connection closed.')); });
      dc.on('error', () => { /* surfaced by close */ });
    });
  });
}

// ── host ────────────────────────────────────────────────────────────────────
function becomeHost(login, room, id) {
  return new Promise((resolve, reject) => {
    let peer; try { peer = new Peer(id, peerOpts()); } catch (e) { return reject(new Error('Could not start peer-to-peer: ' + e.message)); }
    let up = false;
    peer.on('error', (err) => { if (!up) reject(err.type === 'unavailable-id' ? Object.assign(new Error('taken'), { code: 'taken' }) : new Error(friendly(err))); });
    peer.on('open', async () => {
      up = true;
      // newest world we know about: our own last hosted state, or a guest-side backup
      const own = load(KEY(room)), bak = load(BKEY(room)), best = [own && { ts: own.ts ?? 0, state: own.state ?? own }, bak].filter(Boolean).sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))[0];
      const srv = new GameServer({ state: best?.state?.v === 2 ? best.state : null });
      const guests = new Set(); let myConn = null;
      const authed = async (P, pass) => { if (!P.pw) { P.pw = await sha(pass); return true; } return P.pw === await sha(pass); };
      // A character that exists only in the player's own browser (the world they last played in was lost) is brought back —
      // but only with the right passphrase, and with sane numbers, since the record comes from the player's side.
      const restore = async (login2) => {
        const r = login2.restore; if (!r || typeof r !== 'object' || String(r.name ?? '').toLowerCase() !== String(login2.name).trim().toLowerCase()) return false;
        if (!r.pw || r.pw !== await sha(login2.pass ?? '')) return false;
        return !!installRestored(srv, r);
      };
      const attach = async (conn, login2, reply) => {
        const key = String(login2.name ?? '').trim().toLowerCase(); let pid = srv.byName.get(key), P = pid ? srv.players.get(pid) : null;
        if (!P && !login2.create && login2.restore && await restore(login2)) { pid = srv.byName.get(key); P = srv.players.get(pid); }
        if (P && !(await authed(P, login2.pass ?? ''))) return reply({ t: 'login.error', error: 'Wrong passphrase for that character.' });
        if (!P && !login2.create) return reply({ t: 'login.error', error: 'No such character in this world. Create one first.' });
        if (!P && String(login2.pass ?? '').length < 4) return reply({ t: 'login.error', error: 'Passphrase needs 4+ characters.' });
        const res = srv.join(conn, { name: login2.name, create: login2.create ?? null });
        if (!res.ok) return reply({ t: 'login.error', error: res.error });
        const P2 = srv.players.get(res.id); if (P2 && !P2.pw) P2.pw = await sha(login2.pass ?? ''); return null;
      };
      peer.on('connection', (dc) => {
        const conn = { session: null, send: (m) => { try { if (dc.open) sendChunked(dc, m); } catch { /* closed */ } } };
        dc.on('data', chunkReader(async (m) => { if (!m || typeof m.t !== 'string') return; if (!conn.session) { if (m.t === 'login') await attach(conn, m, (r) => conn.send(r)); return; } srv.handle(conn, m); }));
        dc.on('open', () => guests.add(conn)); dc.on('close', () => { guests.delete(conn); srv.leave(conn); }); dc.on('error', () => { /* surfaced by close */ });
      });
      // the host plays through the same server, in-page
      const net = new Net('online'); net.hosting = true; net.server = srv;
      myConn = { session: null, send: (m) => { const c = clone(m); queueMicrotask(() => { if (!net.closed) net.emit(c); }); } };
      net.send = (m) => { if (!net.closed) srv.handle(myConn, clone(m)); };
      const welcome = new Promise((res, rej) => { net.on('welcome', (m) => { net.h = {}; res(m); }); attach(myConn, login, (r) => rej(new Error(r.error))).then((r) => r); });
      let welcomeMsg; try { welcomeMsg = await welcome; } catch (e) { peer.destroy(); return reject(e); }
      const tick = setInterval(() => { try { srv.tick(); } catch (e) { console.error(e); } }, 50);
      // persistence: the host's own copy of the world, plus every connected player's own record in their own browser
      const vault = () => { const ts = Date.now(); for (const g of guests) { const P = g.session?.P; if (P) { srv.syncRecord(g.session); g.send({ t: 'p2p.char', ts, P }); } } const me = myConn.session?.P; if (me) { srv.syncRecord(myConn.session); store(CKEY(me.name), { ts, P: me }); } };
      const save = () => { vault(); store(KEY(room), { ts: Date.now(), state: srv.exportState() }); };
      const autosave = setInterval(save, 8000);
      let rot = 0;
      const backup = setInterval(() => { const gs = [...guests]; if (!gs.length) return; const st = { t: 'p2p.state', ts: Date.now(), state: srv.exportState() }; for (let i = 0; i < Math.min(2, gs.length); i++) gs[(rot++) % gs.length].send(st); }, 30000);   // two rotating guests hold a fresh backup
      const unload = () => save(); window.addEventListener('beforeunload', unload); window.addEventListener('pagehide', unload);
      net.close = () => { net.closed = true; clearInterval(tick); clearInterval(autosave); clearInterval(backup); window.removeEventListener('beforeunload', unload); window.removeEventListener('pagehide', unload); save(); srv.leave(myConn); try { peer.destroy(); } catch { /* ignore */ } };
      resolve({ net, welcome: welcomeMsg });
    });
  });
}
