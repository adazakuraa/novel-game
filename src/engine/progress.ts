// 長期目標：ギルドへの貢献と等級、能力の段階表示。
import type { GameState, SkillKey, StatKey } from './types';
import { WALLS, band, nextWall } from './stats';
import { kindsNeeded } from './growth';

export const RANKS = ['仮登録', '石級', '銅級', '鉄級', '銀級', '金級', '星級'];

/** ギルドへの貢献（社会的な評価なので、数値で見せてよい） */
export function merit(s: GameState): number {
  const c = (k: string) => s.counters[k] ?? 0;
  return Math.round(
    c('questDone') * 10 +
      c('kill:rat') * 1 +
      c('kill:wolf') * 4 +
      c('kill:boar') * 6 +
      c('kill:serpent') * 5 +
      c('kill:alpha') * 20 +
      c('kill:bear') * 20 +
      c('nightwatch') * 3 +
      c('meritBonus') -
      c('questFail') * 5,
  );
}

/** 次の等級に必要な貢献と、審査の内容 */
export const RANK_REQS: Record<number, { merit: number; exam: string } | undefined> = {
  1: { merit: 0, exam: 'ガラドとの立ち合い（訓練場）' },
  2: { merit: 50, exam: '試験依頼：審査官の前で澱狼を討つ（ギルド）' },
  3: { merit: 130, exam: '試験依頼：審査官の前で棘猪を討つ（ギルド）' },
  4: { merit: 300, exam: '（第2章以降で実装予定）' },
};

export type StatView = 'hidden' | 'stage' | 'number';
export const statView = (s: GameState): StatView => (s.flags.statView as StatView | undefined) ?? 'stage';

export const STAGE_NAMES = ['未熟', '見習い', '駆け出し', '一人前', '熟練', '達人'];
const BAND_EDGES = [0, 10, 22, 38, 55, 75, 100];

/** 段階と、次の段階までの進み具合（0〜1） */
export function stageOf(v: number): { stage: number; name: string; ratio: number } {
  const b = band(v);
  const lo = BAND_EDGES[b];
  const hi = BAND_EDGES[b + 1] ?? lo + 25;
  return { stage: b, name: STAGE_NAMES[b], ratio: Math.max(0, Math.min(1, (v - lo) / (hi - lo))) };
}

export const STAT_LABELS: Record<StatKey, string> = {
  str: '筋力',
  end: '持久',
  agi: '敏捷',
  dex: '器用',
  will: '意志',
  focus: '集中',
  wit: '洞察',
  lore: '知識',
  empathy: '共感',
  speech: '弁舌',
  sword_p: '剣（実技）',
  sword_t: '剣（理論）',
  bow_p: '弓（実技）',
  bow_t: '弓（理論）',
  magic_p: '魔法（実技）',
  magic_t: '魔法（理論）',
  herb_p: '薬草（実技）',
  herb_t: '薬草（理論）',
  beast_p: '魔物（実戦の勘）',
  beast_t: '魔物（知識）',
  survival_p: '野外（実技）',
  survival_t: '野外（知識）',
};

const KIND_LABEL: Record<string, string> = { practice: '反復の練習', theory: '理論の学習', combat: '実戦', mentor: '人からの指導' };

/** 技能の壁に当たっているなら、何が足りないかを返す */
export function wallHint(s: GameState, k: SkillKey): string | null {
  const wall = nextWall(s, k);
  if (wall === undefined) return null;
  const v = s.stats[`${k}_p`] + (s.pending[`${k}_p`] ?? 0);
  if (v < wall - 1.5) return null;
  const idx = WALLS.indexOf(wall);
  const need = kindsNeeded(idx);
  const have = s.walls[k];
  const missing = Object.keys(KIND_LABEL).filter((x) => !have.includes(x as never));
  return `壁に当たっている。異なる種類の経験があと${Math.max(0, need - have.length)}つ要る（まだ：${missing.map((x) => KIND_LABEL[x]).join('・')}）`;
}
