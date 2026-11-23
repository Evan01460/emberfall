// Tiny DOM helpers (no framework).
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function toast(msg, kind = '') {
  let box = $('#toasts');
  if (!box) { box = h('div', { id: 'toasts' }); document.body.append(box); }
  for (const old of box.querySelectorAll('.toast')) if (old.textContent === msg && !old.classList.contains('out')) { old.remove(); }   // never stack identical notices
  const t = h('div', { class: `toast ${kind}` }, msg);
  box.append(t);
  setTimeout(() => t.classList.add('out'), 4200);
  setTimeout(() => t.remove(), 4700);
}

export function modal(content, { closable = true, cls = '' } = {}) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: `modal ${cls}` }, content);
  back.append(box); document.body.append(back);
  const close = () => back.remove();
  if (closable) back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  return { close, box, back };
}

export function bar(cls, pct) {
  const fill = h('i', { style: { width: `${Math.max(0, Math.min(100, pct))}%` } });
  return { el: h('div', { class: `bar ${cls}` }, fill), fill };
}

export function spark(values, w = 60, hgt = 16) {
  const c = document.createElement('canvas'); c.width = w; c.height = hgt; c.className = 'spark-px'; c.style.imageRendering = 'pixelated'; c.style.width = `${w}px`; c.style.height = `${hgt}px`;
  const g = c.getContext('2d'), min = Math.min(...values), max = Math.max(...values), span = max - min || 1, up = values[values.length - 1] >= values[0];
  g.fillStyle = up ? '#6fc08b' : '#e0645a'; let prev = null;
  values.forEach((v, i) => { const x = Math.round((i / Math.max(1, values.length - 1)) * (w - 2)), y = Math.round(hgt - 2 - ((v - min) / span) * (hgt - 4)); if (prev) { const steps = Math.max(Math.abs(x - prev[0]), Math.abs(y - prev[1])); for (let k = 0; k <= steps; k++) g.fillRect(Math.round(prev[0] + (x - prev[0]) * k / (steps || 1)), Math.round(prev[1] + (y - prev[1]) * k / (steps || 1)), 1, 1); } prev = [x, y]; });
  return c;
}
export const fmt = (n) => Math.round(n).toLocaleString();
