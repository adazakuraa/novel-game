// 全ステージの品質検証の本体。範囲ごとに別ファイルから呼び、並列に走らせる。
import { describe, expect, it } from 'vitest';
import { rng } from '../src/core/mode';
import { apply, init, legalMoves, status, validateStage, type Frame, type QueueStage } from '../src/modes/queue/rules';
import { greedyPolicy, measure, playout, randomPolicy, replay, Solver } from '../src/modes/queue/solver';
import { findHint } from '../src/modes/queue/hint';
import { RobustSolver } from '../src/modes/queue/robust';
import { check, MEASURE, SPECS } from '../src/modes/queue/specs';
import data from '../stages/queue.json';

const stages = data as QueueStage[];

/** ステージ from〜to（1始まり、両端を含む）を検証する */
export function checkStages(from: number, to: number) {
  describe.each(stages.slice(from - 1, to).map((s) => [s.id, s] as const))('ステージ %i', (id, st) => {
    const idx = id - 1;
    it('データが正しい', () => {
      expect(validateStage(st)).toEqual([]);
      expect(st.cols.length).toBe(SPECS[idx].w);
      expect(st.rows).toBe(SPECS[idx].rows);
      expect(st.bench).toBe(SPECS[idx].bench);
      expect(st.seats).toBe(SPECS[idx].seats ?? 1);
    });

    const m = measure(st, { ...MEASURE, seed: st.seed ?? 0 });

    it('見えている情報だけで必ずクリアでき、品質基準（複数の解法・難易度・罠の深さ）を満たす', () => {
      expect(m.solvable).toBe(true);
      expect(check(SPECS[idx], m, idx)).toEqual([]);
    });

    it('ヒントに従い続けると、見えている情報だけで決まる確実な手のまま必ずクリアできる', () => {
      const robust = new RobustSolver(3_000_000), solver = new Solver(3_000_000);
      let s = init(st);
      for (let guard = 0; status(s) === 'playing' && guard < 500; guard++) {
        const h = findHint(s, robust, solver);
        expect(h.kind).toBe('safe');
        if (h.kind === 'none') break;
        s = apply(s, h.col)!;
      }
      expect(status(s)).toBe('cleared');
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
}
