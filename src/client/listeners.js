// Window/document listeners that belong to one play session. Leaving to the title screen and entering again builds a fresh
// view and HUD; without this the old ones kept listening too, so every key press and click was handled twice (double toasts, double actions).
const list = [];
export function listen(target, ev, fn, opts) { target.addEventListener(ev, fn, opts); list.push([target, ev, fn, opts]); }
export function unlistenAll() { for (const [t, ev, fn, o] of list.splice(0)) t.removeEventListener(ev, fn, o); }
