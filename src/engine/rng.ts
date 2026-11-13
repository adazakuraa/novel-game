import type { GameState } from './types';

// mulberry32。状態をGameStateに保持し、セーブ/ロードで再現可能にする。
export function nextRandom(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) | 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [r, next];
}

export function rand(s: GameState): number {
  const [r, n] = nextRandom(s.rng);
  s.rng = n;
  return r;
}

export function chance(s: GameState, p: number): boolean {
  return rand(s) < p;
}

export function randInt(s: GameState, min: number, max: number): number {
  return min + Math.floor(rand(s) * (max - min + 1));
}

export function pick<T>(s: GameState, arr: readonly T[]): T {
  return arr[Math.floor(rand(s) * arr.length)];
}

export function weighted<T>(s: GameState, items: readonly { w: number; v: T }[]): T | undefined {
  const total = items.reduce((a, b) => a + Math.max(0, b.w), 0);
  if (total <= 0) return undefined;
  let r = rand(s) * total;
  for (const it of items) {
    r -= Math.max(0, it.w);
    if (r <= 0) return it.v;
  }
  return items[items.length - 1].v;
}

/** 独立した乱数源（新規ゲーム生成用） */
export function makeRng(seed: number) {
  let st = seed | 0;
  return () => {
    const [r, n] = nextRandom(st);
    st = n;
    return r;
  };
}
