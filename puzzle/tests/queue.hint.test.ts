import { describe, expect, it } from 'vitest';
import { rng } from '../src/core/mode';
import { findHint, replayMoves } from '../src/modes/queue/hint';
import { RobustSolver } from '../src/modes/queue/robust';
import { apply, init, legalMoves, status, type QState, type QueueStage } from '../src/modes/queue/rules';
import { Solver } from '../src/modes/queue/solver';
import data from '../stages/queue.json';

const stages = data as QueueStage[];

/** 無作為に打って、条件に合う局面を探す */
function findState(pred: (s: QState) => boolean, tries = 400): QState | null {
  const r = rng(11);
  for (let t = 0; t < tries; t++) {
    const st = stages[r.int(40)];
    let s = init(st);
    while (status(s) === 'playing') {
      if (pred(s)) return s;
      s = apply(s, r.pick(legalMoves(s)))!;
    }
  }
  return null;
}

describe('ヒント', () => {
  it('同じ局面なら毎回同じヒント', () => {
    const s = init(stages[9]);
    expect(findHint(s)).toEqual(findHint(s));
  });
  it('手順から局面を作り直せる（ヒントは画面と別の場所で計算するため）', () => {
    const st = stages[5];
    const s1 = apply(apply(init(st), 0)!, 1)!;
    expect(replayMoves(st, [0, 1])).toEqual(s1);
  });
  it('見えている情報だけで勝てる手が無くても、実際の並びで勝てる手があれば示す', () => {
    const s = findState((x) => !new RobustSolver().wins(x) && new Solver().solvable(x));
    expect(s).not.toBeNull();
    const h = findHint(s!);
    expect(h.kind).toBe('lucky');
    if (h.kind === 'lucky') expect(new Solver().solvable(apply(s!, h.col)!)).toBe(true);
  });
  it('もうクリアできない局面では、そう知らせる', () => {
    const s = findState((x) => !new Solver().solvable(x));
    expect(s).not.toBeNull();
    expect(findHint(s!).kind).toBe('none');
  });
  it('「確実な手」と示した手は、本当に見えている情報だけで勝てる手', () => {
    const r = rng(5);
    for (const st of stages.slice(0, 30)) {
      let s = init(st);
      for (let i = 0; i < 3 && status(s) === 'playing'; i++) s = apply(s, r.pick(legalMoves(s)))!;
      const h = findHint(s);
      if (h.kind === 'safe') expect(new RobustSolver().moveWins(s, h.col)).toBe(true);
    }
  });
});
