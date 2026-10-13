/** Gerador pseudo-aleatório determinístico (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const rand = Math.random;

export function rint(a: number, b: number, r: () => number = rand): number {
  return a + Math.floor(r() * (b - a + 1));
}

export function pick<T>(arr: readonly T[], r: () => number = rand): T {
  return arr[Math.floor(r() * arr.length)];
}

export function weighted<K extends string>(w: Partial<Record<K, number>>, r: () => number = rand): K {
  let total = 0;
  for (const k in w) total += w[k] ?? 0;
  let x = r() * total;
  for (const k in w) {
    x -= w[k] ?? 0;
    if (x <= 0) return k;
  }
  return Object.keys(w)[0] as K;
}

export function shuffle<T>(arr: T[], r: () => number = rand): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${wk}`;
}
