import type { AttrKey, GameState, SkillKey, StatKey } from './types';

export const ATTRS: AttrKey[] = ['str', 'end', 'agi', 'dex', 'will', 'focus', 'wit', 'lore', 'empathy', 'speech'];
export const SKILLS: SkillKey[] = ['sword', 'bow', 'magic', 'herb', 'beast', 'survival'];
export const ALL_STATS: StatKey[] = [
  ...ATTRS,
  ...SKILLS.flatMap((k) => [`${k}_p`, `${k}_t`] as StatKey[]),
];

/** 技能の壁（この値に達すると、異なる種類の経験を積むまで伸びが鈍る） */
export const WALLS = [20, 40, 60, 80, 100];

export function nextWall(s: GameState, k: SkillKey): number | undefined {
  return WALLS[s.wallsBroken[k]];
}

/** 実際に使える技能の力。理論は実技を支えるが、実技を超えては効かない */
export function skill(s: GameState, k: SkillKey): number {
  const p = s.stats[`${k}_p`];
  const t = s.stats[`${k}_t`];
  return p + Math.min(t, p + 10) * 0.25;
}

/** 怪我・疲労を加味した身体の実効値 */
export function body(s: GameState, k: AttrKey): number {
  let v = s.stats[k];
  const inj = s.cond.injuries.reduce((a, i) => a + i.severity, 0);
  v *= 1 - Math.min(0.5, inj * 0.08);
  if (s.cond.fatigue > 70) v *= 0.85;
  return v;
}

/** 0..5 の段階（描写の切り替え用） */
export function band(v: number): number {
  if (v < 10) return 0;
  if (v < 22) return 1;
  if (v < 38) return 2;
  if (v < 55) return 3;
  if (v < 75) return 4;
  return 5;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
