// 成長モデル。行動は「未定着の経験」を生み、睡眠で能力に定着する。
import type { GameState, LearnKind, SkillKey, StatKey } from './types';
import { SKILLS, WALLS, clamp, nextWall } from './stats';

export interface GainOpts {
  /** この経験の難しさ（現在値と比べて評価される）。省略時は現在値+8 */
  difficulty?: number;
  /** 指導者・設備・集中などによる質（1が標準） */
  quality?: number;
  kind?: LearnKind;
  /** 反復による逓減を判定する行動キー */
  key?: string;
}

/** 成長速度の全体調整（バランス調整用） */
export const GROWTH_SCALE = 0.5;

/** 難しさと現在値の差による係数。少し上が最もよく伸びる */
export function challengeFactor(cur: number, difficulty: number): number {
  const d = difficulty - cur;
  if (d < 0) return Math.max(0.12, 1 + d / 14);
  if (d <= 14) return 1 + d / 28;
  return Math.max(0.25, 1.5 - (d - 14) / 24);
}

/** 直近7日間の同じ行動の回数による係数 */
export function noveltyFactor(s: GameState, key?: string): number {
  if (!key) return 1;
  const days = s.repetition[key] ?? [];
  const recent = days.filter((d) => s.day - d < 7).length;
  return Math.max(0.35, 1 / (1 + 0.16 * recent));
}

export function conditionFactor(s: GameState): number {
  let f = 1;
  if (s.cond.fatigue > 60) f *= 0.75;
  if (s.cond.fatigue > 85) f *= 0.6;
  if (s.cond.stress > 60) f *= 0.8;
  if (!s.cond.fed) f *= 0.9;
  return f;
}

function skillOf(k: StatKey): SkillKey | undefined {
  const m = /^(\w+)_(p|t)$/.exec(k);
  return m ? (m[1] as SkillKey) : undefined;
}

/** 経験を積む。戻り値は実際に加算された（未定着の）量 */
export function gain(s: GameState, k: StatKey, base: number, o: GainOpts = {}): number {
  const cur = s.stats[k];
  let g = base * GROWTH_SCALE;
  g *= challengeFactor(cur, o.difficulty ?? cur + 8);
  g *= o.quality ?? 1;
  g *= noveltyFactor(s, o.key);
  g *= conditionFactor(s);
  g *= s.apt[k];
  g *= 1 / (1 + cur / 55); // 上限はないが、高みほど一歩が重い

  const sk = skillOf(k);
  if (sk && k.endsWith('_p')) {
    const wall = nextWall(s, sk);
    // 理論の理解は実技の習得を助ける
    g *= 1 + Math.min(s.stats[`${sk}_t`], cur + 10) / 160;
    if (wall !== undefined && cur + (s.pending[k] ?? 0) >= wall) {
      g *= 0.06;
    }
  }
  if (sk) {
    const kind = o.kind ?? (k.endsWith('_t') ? 'theory' : 'practice');
    const list = s.walls[sk];
    if (!list.includes(kind)) list.push(kind);
  }
  s.pending[k] = (s.pending[k] ?? 0) + g;
  return g;
}

export function markRepetition(s: GameState, key: string) {
  const arr = (s.repetition[key] ??= []);
  arr.push(s.day);
  s.repetition[key] = arr.filter((d) => s.day - d < 14);
}

export interface Insight {
  skill: SkillKey;
  wall: number;
}

/** 壁を越えるのに必要な経験の種類数 */
export function kindsNeeded(wallIndex: number) {
  return wallIndex === 0 ? 2 : 3;
}

/** 睡眠による定着。quality: 睡眠の質 */
export function consolidate(s: GameState, quality: number): { changed: StatKey[]; insights: Insight[] } {
  const changed: StatKey[] = [];
  const q = quality * s.diligence;
  for (const [k, v] of Object.entries(s.pending) as [StatKey, number][]) {
    if (!v) continue;
    s.stats[k] += v * q;
    changed.push(k);
  }
  s.pending = {};

  const insights: Insight[] = [];
  for (const sk of SKILLS) {
    const idx = s.wallsBroken[sk];
    const wall = WALLS[idx];
    if (wall === undefined) continue;
    const p = `${sk}_p` as StatKey;
    if (s.stats[p] >= wall - 0.5) {
      s.stats[p] = Math.min(s.stats[p], wall);
      if (s.walls[sk].length >= kindsNeeded(idx)) {
        s.wallsBroken[sk] += 1;
        s.walls[sk] = [];
        s.stats[p] += 1.5; // 突破直後の伸び
        insights.push({ skill: sk, wall });
      }
    } else if (s.stats[p] < wall - 6) {
      // 壁が遠いうちは、経験の種類の記録を古いものから忘れていく
      if (s.walls[sk].length > 0 && s.day % 10 === 0) s.walls[sk].shift();
    }
  }

  s.cond.fatigue = clamp(s.cond.fatigue - 55 * quality, 0, 100);
  s.cond.stress = clamp(s.cond.stress - 12 * quality, 0, 100);
  return { changed, insights };
}

/** 使わない技能の勘が鈍る（天井は下がらない） */
export function rust(s: GameState) {
  for (const sk of SKILLS) {
    const key = `${sk}_p` as StatKey;
    const used = Object.keys(s.repetition).some(
      (r) => r.startsWith(sk + ':') && (s.repetition[r] ?? []).some((d) => s.day - d < 21),
    );
    if (!used && s.stats[key] > 15) s.stats[key] -= 0.05;
  }
}
