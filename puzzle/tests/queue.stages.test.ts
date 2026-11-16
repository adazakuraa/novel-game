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
  it('難易度の目標（正解の手の割合）は先へ進むほど下がっていく（10面ごとの帯の最初の面は少しやさしく始めてよい）', () => {
    for (let i = 1; i < SPECS.length; i++) {
      if (SPECS[i].intro || i % 10 === 0) continue;
      expect(SPECS[i].good).toBeLessThanOrEqual(SPECS[i - 1].good + 1e-9);
    }
  });
});

describe.each(stages.map((s) => [s.id, s] as const))('ステージ %i', (id, st) => {
  const idx = id - 1;
  it('データが正しい', () => {
    expect(validateStage(st)).toEqual([]);
    expect(st.cols.length).toBe(SPECS[idx].w);
    expect(st.rows).toBe(SPECS[idx].rows);
    expect(st.bench).toBe(SPECS[idx].bench);
    expect(st.seats).toBe(SPECS[idx].seats ?? 1);
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
        expect(['cleared', 'stuck']).toContain(s);
        expect(win).toBe(s === 'cleared');
        if (s === 'stuck') expect(legalMoves(last)).toEqual([]);
        for (const t of trail) {
          // 皿は増えも減りもしない
          const inCols = t.colIds.reduce((a, ids, c) => a + ids.length - t.top[c], 0);
          const atSeats = t.seats.reduce((a, x) => a + x.got.length, 0);
          const seated = new Set(t.seats.map((x) => x.order));
          const done = st.orders.reduce((a, o, d) => a + (d < t.next && !seated.has(d) ? o.n : 0), 0);
          expect(inCols + atSeats + t.bench.length + done).toBe(t.items.length);
          expect(t.served).toBe(st.orders.filter((_, d) => d < t.next && !seated.has(d)).length);
          // 置き台は上限を超えない
          expect(t.bench.length).toBeLessThanOrEqual(st.bench);
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
