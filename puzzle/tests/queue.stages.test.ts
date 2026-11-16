// 全ステージのクリア可能性・品質基準・自動プレイの検証。
// 「開発者が手で解けた」ではなく、完全探索と自動プレイヤーでステージの品質を保証する。
import { describe, expect, it } from 'vitest';
import type { QueueStage } from '../src/modes/queue/rules';
import { SPECS } from '../src/modes/queue/specs';
import { checkStages } from './stageSuite';
import data from '../stages/queue.json';

const stages = data as QueueStage[];

describe('ステージ一覧', () => {
  it('設計表と同じ数だけあり、番号が1から順に並んでいる', () => {
    expect(stages.length).toBe(SPECS.length);
    stages.forEach((s, i) => expect(s.id).toBe(i + 1));
  });
  it('難易度の目標（正解の手の割合）は先へ進むほど下がっていく（10面ごとの帯の最初の面は少しやさしく始めてよい）', () => {
    for (let i = 1; i < SPECS.length; i++) {
      if (SPECS[i].intro || i % 10 === 0) continue;
      expect(SPECS[i].good).toBeLessThanOrEqual(SPECS[i - 1].good + 1e-9);
    }
  });
});

checkStages(1, 50);
