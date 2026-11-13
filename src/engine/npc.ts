// 人間関係。一度の出来事で関係が大きく動きすぎないよう、1日あたりの変化量に上限を設ける。
import type { GameState, RelAxis } from './types';
import { clamp } from './stats';

const DAILY_CAP = 14;

export function rel(s: GameState, id: string, axis: RelAxis, delta: number, opts: { big?: boolean } = {}) {
  const n = s.npcs[id];
  if (!n) return;
  if (n.dailyBudget.day !== s.day) n.dailyBudget = { day: s.day, used: 0 };
  let d = delta;
  if (!opts.big) {
    const remain = Math.max(0, DAILY_CAP - n.dailyBudget.used);
    const mag = Math.min(Math.abs(d), remain);
    d = Math.sign(d) * mag;
    n.dailyBudget.used += mag * 0.6; // 軸をまたいで少しずつ予算を使う
  }
  // 既に高い（低い）関係ほど、同じ方向には動きにくい
  const cur = n.rel[axis];
  if (d > 0 && cur > 40) d *= 0.6;
  if (d < 0 && cur < -40) d *= 0.6;
  n.rel[axis] = clamp(cur + d, -100, 100);
}

export function remember(s: GameState, id: string, tag: string, note: string) {
  const n = s.npcs[id];
  if (!n) return;
  if (n.memories.some((m) => m.tag === tag)) return;
  n.memories.push({ day: s.day, tag, note });
}

export function hasMemory(s: GameState, id: string, tag: string) {
  return !!s.npcs[id]?.memories.some((m) => m.tag === tag);
}

export function meet(s: GameState, id: string) {
  const n = s.npcs[id];
  if (n) n.met = true;
}

export function r(s: GameState, id: string, axis: RelAxis) {
  return s.npcs[id]?.rel[axis] ?? 0;
}

/** 総合的な近さ（イベント条件用） */
export function closeness(s: GameState, id: string) {
  const x = s.npcs[id]?.rel;
  if (!x) return 0;
  return x.trust * 0.4 + x.affinity * 0.4 + x.respect * 0.2 - x.wariness * 0.3;
}
