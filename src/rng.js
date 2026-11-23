// Small seedable RNG (mulberry32). Serializable: just store `.s`.
export class Rng {
  constructor(seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0) { this.s = seed >>> 0; }
  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  range(a, b) { return a + this.next() * (b - a); }
  weighted(entries) { // [[value, weight], ...]
    const total = entries.reduce((s, e) => s + e[1], 0);
    let r = this.next() * total;
    for (const [v, w] of entries) { r -= w; if (r <= 0) return v; }
    return entries[entries.length - 1][0];
  }
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
