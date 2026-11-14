import type { GameState, Line, Txt } from './types';
import type { LineDef } from './defs';

export function fmt(s: GameState, t: Txt): string {
  const raw = typeof t === 'function' ? t(s) : t;
  return raw.replaceAll('{I}', s.hero.pronoun).replaceAll('{name}', s.hero.name);
}

export function resolveLines(s: GameState, defs: LineDef[]): Line[] {
  const out: Line[] = [];
  for (const d of defs) {
    const v = typeof d === 'function' ? d(s) : d;
    if (!v) continue;
    for (const l of Array.isArray(v) ? v : [v]) out.push({ who: l.who, text: fmt(s, l.text) });
  }
  return out;
}

/** 地の文を簡単に書くためのヘルパー */
export const n = (text: string): Line => ({ text });
export const say = (who: string, text: string): Line => ({ who, text });

export const SLOT_NAMES = ['朝', '昼', '夕方', '夜'];

export const MONTHS = ['芽月', '花月', '若葉月', '陽月', '盛夏月', '穂月', '実月', '紅月', '落葉月', '霜月', '雪月', '凍月'];

export function dateLabel(day: number) {
  const d = day - 1;
  return `${MONTHS[Math.floor(d / 30) % 12]} ${(d % 30) + 1}日`;
}
