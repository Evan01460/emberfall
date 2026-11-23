// Request/response helper for windows that wait on the server (leaderboards, Hall of Legends…): if nothing comes back in a few
// seconds the request is repeated once, and if it is still silent the player is told instead of the click doing nothing.
import { G } from './state.js';
import { toast } from '../ui-lib.js';
const waiting = new Map();
export function ask(t, reply, extra = {}) {
  clearTimeout(waiting.get(reply)?.t2); clearTimeout(waiting.get(reply)?.t3);
  const send = () => G.net.send({ t, ...extra }), w = {};
  send(); w.t2 = setTimeout(send, 3000); w.t3 = setTimeout(() => { waiting.delete(reply); toast('The world did not answer. Check your connection and try again.', 'bad'); }, 8000);
  waiting.set(reply, w);
}
export function answered(reply) { const w = waiting.get(reply); if (w) { clearTimeout(w.t2); clearTimeout(w.t3); waiting.delete(reply); } }
