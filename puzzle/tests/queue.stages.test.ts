// 全ステージのクリア可能性・品質基準・自動プレイの検証。
// 「開発者が手で解けた」ではなく、完全探索と自動プレイヤーでステージの品質を保証する。
import { describe, expect, it } from 'vitest';
import { rng } from '../src/core/mode';
import { apply, init, legalMoves, status, validateStage, type Frame, type QueueStage } from '../src/modes/queue/rules';
import { greedyPolicy, measure, playout, randomPolicy, replay } from '../src/modes/queue/solver';
import { check, MEASURE, SPECS } from '../src/modes/queue/specs';
import data from '../stages/queue.json';

const stages = data as QueueStage[];

describe('ステージ一覧', () => {
  it('設計表と同じ数だけあり、番号が1から順に並んでいる', () => {
    expect(stages.length).toBe(SPECS.length);
    stages.forEach((s, i) => expect(s.id).toBe(i + 1));
  });
  it('難易度の目標（素直な打ち手の勝率の上限）は先へ進むほど下がっていく（各ギミックの導入面を除く）', () => {
    for (let i = 1; i < SPECS.length; i++) {
      if (SPECS[i].intro) continue;
      expect(SPECS[i].greedy[1]).toBeLessThanOrEqual(SPECS[i - 1].greedy[1] + 1e-9);
    }
  });
});

describe.each(stages.map((s) => [s.id, s] as const))('ステージ %i', (id, st) => {
  const idx = id - 1;
  it('データが正しい', () => {
    expect(validateStage(st)).toEqual([]);
    expect(st.w).toBe(SPECS[idx].w);
    expect(st.h).toBe(SPECS[idx].h);
    expect(st.bench).toBe(SPECS[idx].bench);
  });

  const m = measure(st, { ...MEASURE, seed: st.seed ?? 0 });

  it('クリアでき、品質基準（複数の解法・難易度・罠の深さ）を満たす', () => {
    expect(m.solvable).toBe(true);
    expect(check(SPECS[idx], m, idx)).toEqual([]);
  });

  it('解法の手順をルール本体で再生するとクリアになる', () => {
    const end = replay(st, m.solution);
    expect(end).not.toBeNull();
    expect(status(end!)).toBe('cleared');
  });

  it('自動プレイ：どんな打ち方でも終局し、終局の状態が正しい', () => {
    const r = rng(id);
    for (const policy of [randomPolicy, greedyPolicy]) {
      for (let k = 0; k < 10; k++) {
        const { trail, win } = playout(st, policy, r);
        const last = trail[trail.length - 1];
        const s = status(last);
        expect(['cleared', 'full', 'stuck']).toContain(s);
        expect(win).toBe(s === 'cleared');
        if (s === 'full') expect(last.bench.length).toBe(st.bench);
        if (s === 'stuck') expect(legalMoves(last)).toEqual([]);
        // 客は増えも減りもしない
        for (const t of trail) {
          const onBoard = t.board.filter((v) => v >= 0).length;
          const hidden = t.tunnels.reduce((a, x) => a + x.ids.length - x.next, 0);
          const done = t.dish * 3;
          expect(onBoard + hidden + t.seats.length + t.bench.length + done).toBe(t.custs.length);
        }
      }
    }
  });

  it('演出用の途中経過の最後は、1手の結果と一致する', () => {
    let s = init(st);
    for (const mv of m.solution) {
      const frames: Frame[] = [];
      const n = apply(s, mv, frames)!;
      expect(frames.length).toBeGreaterThan(0);
      expect(frames[frames.length - 1].state).toEqual(n);
      s = n;
    }
  });
});
