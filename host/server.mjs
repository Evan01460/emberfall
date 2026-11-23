// Online host: serves the game over HTTP and runs the shared world over WebSocket.
//   npm start                 → http://localhost:8080  (PORT env to change)
// State is saved to ./data/world.json (autosave + on shutdown). Accounts live in ./data/accounts.json.
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, statSync, createReadStream } from 'node:fs';
import { join, extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scryptSync, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { GameServer } from '../src/server/gameserver.js';
import { installRestored, heldFor, applyHeld } from '../src/server/restore.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = +(process.env.PORT || 8080);
const DATA = resolve(process.env.DATA_DIR || join(ROOT, 'data'));
mkdirSync(DATA, { recursive: true });
const WORLD_FILE = join(DATA, 'world.json'), ACC_FILE = join(DATA, 'accounts.json');

const readJson = (f) => { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; } catch (e) { console.error('could not read', f, e.message); return null; } };
const writeJson = (f, o) => { const tmp = f + '.tmp'; writeFileSync(tmp, JSON.stringify(o)); renameSync(tmp, f); };

// ── optional off-site backup (a GitHub Gist) ─────────────────────────────────────────────────────────────────────────────────
// Free hosts wipe the disk on every restart. Set BACKUP_GIST_ID (a secret gist you created) and BACKUP_GITHUB_TOKEN (a token with the
// "gist" scope) and the whole world — market listings, orders, guilds, accounts — is saved to that gist every ~90 s and on shutdown,
// and restored automatically when the server starts with an empty disk.
const GIST_ID = process.env.BACKUP_GIST_ID, GIST_TOKEN = process.env.BACKUP_GITHUB_TOKEN, GITHUB_API = process.env.GITHUB_API || 'https://api.github.com';
const gh = async (path, opts = {}) => { const r = await fetch(GITHUB_API + path, { ...opts, headers: { authorization: `Bearer ${GIST_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'emberfall-server', 'content-type': 'application/json' } }); if (!r.ok) throw new Error(`GitHub answered ${r.status}`); return r.json(); };
if (GIST_ID && GIST_TOKEN && !existsSync(WORLD_FILE)) {
  try { const g = await gh(`/gists/${GIST_ID}`); let n = 0; for (const name of ['world.json', 'accounts.json']) { const f = g.files?.[name]; if (!f) continue; const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content; if (text) { writeFileSync(join(DATA, name), text); n++; } } console.log(n ? 'Restored the world from the gist backup' : 'The gist backup is empty — starting fresh'); }
  catch (e) { console.error('Could not restore from the gist backup:', e.message); }
}
const state = readJson(WORLD_FILE);
const accounts = readJson(ACC_FILE) ?? {};
const game = new GameServer({ state: state?.v === 2 ? state : null });
console.log(state ? `Loaded world: ${Object.keys(state.players).length} characters` : 'Fresh world created');

// ── the vault ───────────────────────────────────────────────────────────────
// On free hosting the disk is wiped whenever the server sleeps or is redeployed. So every player's browser also keeps a copy of their
// own character, SIGNED by this server (HMAC with VAULT_SECRET, which must stay the same between restarts — on Render it is generated once
// by render.yaml). If the world was wiped, the signed copy brings the character back; nobody can forge or edit one.
const SECRET_FILE = join(DATA, 'vault.key');
const VAULT_SECRET = process.env.VAULT_SECRET || (existsSync(SECRET_FILE) ? readFileSync(SECRET_FILE, 'utf8') : (() => { const k = randomBytes(32).toString('hex'); try { writeFileSync(SECRET_FILE, k); } catch {} return k; })());
if (!process.env.VAULT_SECRET) console.warn('VAULT_SECRET is not set: characters saved in players\' browsers only survive a wipe if this disk (data/vault.key) survives. Set VAULT_SECRET to a long random string on free hosting.');
const sign = (s) => createHmac('sha256', VAULT_SECRET).update(s).digest('hex');
const vaultFor = (S) => { game.syncRecord(S); const rec = JSON.stringify({ v: 2, name: S.P.name, acc: accounts[S.P.name.toLowerCase()] ?? null, P: S.P, held: heldFor(game, S.P), ts: Date.now() }); return { rec, sig: sign(rec) }; };
function restoreFromVault(name, pass, v) {
  try {
    if (!v || typeof v.rec !== 'string' || typeof v.sig !== 'string') return false;
    const a = Buffer.from(sign(v.rec)), b = Buffer.from(v.sig); if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const r = JSON.parse(v.rec); if (!(r.v === 1 || r.v === 2) || String(r.name).toLowerCase() !== name.toLowerCase() || !r.acc) return false;
    if (!timingSafeEqual(hash(pass, Buffer.from(r.acc.salt, 'hex')), Buffer.from(r.acc.hash, 'hex'))) return false;
    const P = installRestored(game, r.P); if (!P) return false; applyHeld(P, r.held);
    accounts[name.toLowerCase()] = r.acc; writeJson(ACC_FILE, accounts); return true;
  } catch { return false; }
}

// ── accounts ─────────────────────────────────────────────────────────────────
const hash = (pass, salt) => scryptSync(String(pass), salt, 32);
function checkAccount(name, pass, create) {
  const key = name.toLowerCase();
  const acc = accounts[key];
  if (create) {
    if (acc || game.byName.has(key)) return 'That name is taken.';
    const salt = randomBytes(16); accounts[key] = { salt: salt.toString('hex'), hash: hash(pass, salt).toString('hex') }; writeJson(ACC_FILE, accounts); return null;
  }
  if (!acc) return 'No such character. Check the name, or create one.';
  const ok = timingSafeEqual(hash(pass, Buffer.from(acc.salt, 'hex')), Buffer.from(acc.hash, 'hex'));
  return ok ? null : 'Wrong passphrase.';
}

// ── HTTP (static) ────────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PAGE = join(ROOT, 'dist', 'emberfall.html');
// The page is the self-contained bundle (the game imports npm packages, so the raw source files cannot run in a browser as-is).
// Build it on first start if it is missing.
if (!existsSync(PAGE)) {
  try { const cwd = process.cwd(); process.chdir(ROOT); await import('../build.mjs'); process.chdir(cwd); console.log('Built dist/emberfall.html'); }
  catch (e) { console.error('Could not build the game page. Run `npm install && npm run build` first.', e.message); process.exit(1); }
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, players: game.sessions.size, online: game.sessions.size, characters: game.players.size, day: game.markets.main.day })); }
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/emberfall.html') { res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' }); return createReadStream(PAGE).pipe(res); }
  res.writeHead(404); res.end('not found');
});

// ── WebSocket ────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });   // a login may carry the player's signed character copy
const perIp = new Map();
wss.on('connection', (ws, req) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').toString().split(',')[0].trim();
  if ((perIp.get(ip) ?? 0) >= 8) { ws.close(1013, 'too many connections'); return; }
  perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
  const conn = { session: null, send(o) { if (ws.readyState === 1) ws.send(JSON.stringify(o)); } };
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  let loginTries = 0;
  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!conn.session) {
      if (msg.t !== 'login') return;
      if (++loginTries > 8) { ws.close(1008, 'too many attempts'); return; }
      const name = String(msg.name ?? '').replace(/[^\w \-'.]/g, '').trim().slice(0, 16), pass = String(msg.pass ?? '');
      if (pass.length < 4) return conn.send({ t: 'login.error', error: 'Passphrase needs at least 4 characters.' });
      if (name.length < 2) return conn.send({ t: 'login.error', error: 'Names need at least 2 letters.' });
      if (!msg.create && msg.restore && !accounts[name.toLowerCase()] && !game.byName.has(name.toLowerCase())) { if (restoreFromVault(name, pass, msg.restore)) console.log('Restored', name, 'from its signed vault copy'); }
      const err = checkAccount(name, pass, !!msg.create);
      if (err) return conn.send({ t: 'login.error', error: err });
      const r = game.join(conn, { name, create: msg.create ? { classId: msg.create.classId } : null });
      if (!r.ok) { if (msg.create) { delete accounts[name.toLowerCase()]; writeJson(ACC_FILE, accounts); } conn.send({ t: 'login.error', error: r.error }); }
      return;
    }
    game.handle(conn, msg);
  });
  ws.on('close', () => { perIp.set(ip, Math.max(0, (perIp.get(ip) ?? 1) - 1)); game.leave(conn); });
  ws.on('error', () => {});
});

// ── heartbeat: drop dead sockets so their characters leave the world ──
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch {} } }, 30000);

// ── loops & persistence ──────────────────────────────────────────────────────
setInterval(() => { try { game.tick(); } catch (e) { console.error('tick error', e); } }, 50);
const save = () => { try { writeJson(WORLD_FILE, game.exportState()); } catch (e) { console.error('save failed', e.message); } };
setInterval(save, 30000);
let lastBackup = '';
async function backupToGist() {
  if (!GIST_ID || !GIST_TOKEN) return;
  const world = JSON.stringify(game.exportState()), acc = JSON.stringify(accounts), sum = createHash('sha1').update(world).update(acc).digest('hex'); if (sum === lastBackup) return;
  await gh(`/gists/${GIST_ID}`, { method: 'PATCH', body: JSON.stringify({ files: { 'world.json': { content: world }, 'accounts.json': { content: acc } } }) }); lastBackup = sum;
}
if (GIST_ID && GIST_TOKEN) { console.log('Gist backup is ON'); setInterval(() => backupToGist().catch((e) => console.error('gist backup failed:', e.message)), +(process.env.BACKUP_EVERY_MS || 90000)); }
// every connected player gets a fresh signed copy of their own character every 20 s
setInterval(() => { for (const S of game.sessions.values()) { try { S.conn.send({ t: 'vault', ...vaultFor(S) }); } catch {} } }, 20000);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { console.log(`\n${sig}: saving world…`); save(); try { await Promise.race([backupToGist(), new Promise((r) => setTimeout(r, 8000))]); } catch (e) { console.error('final gist backup failed:', e.message); } process.exit(0); });

server.listen(PORT, () => console.log(`Emberfall online → http://localhost:${PORT}   (ws path /ws, data in ${DATA})`));
