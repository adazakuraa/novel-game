// ヒント：いまの局面で、次に取るとよい列を1つ選ぶ。
//  1. 見えている情報だけで勝てる手（見えない皿がどんな並びでもクリアできる手）があれば、それを示す
//  2. 無ければ、実際の並びならクリアできる手を示す（見えない皿しだいの局面）
//  3. どちらも無ければ、この局面からはクリアできないと知らせる
import { SolverBudgetError } from './budget';
import { RobustSolver } from './robust';
import { apply, init, legalMoves, seatFor, status, topOf, type QState, type QueueStage } from './rules';
import { Solver } from './solver';

export type Hint =
  | { kind: 'safe'; col: number }      // 見えている情報だけで勝てる手
  | { kind: 'lucky'; col: number }     // 見えない皿の並びに助けられて勝てる手
  | { kind: 'none' };                  // もうクリアできない

export function replayMoves(stage: QueueStage, moves: number[]): QState {
  let s = init(stage);
  for (const m of moves) s = apply(s, m) ?? s;
  return s;
}

/** 注文に合う皿を先に。同じなら左の列から（同じ局面なら毎回同じヒントになるように） */
function preferred(s: QState, moves: number[]): number[] {
  return moves.slice().sort((a, b) => {
    const ma = seatFor(s, s.items[topOf(s, a)].c) >= 0 ? 0 : 1;
    const mb = seatFor(s, s.items[topOf(s, b)].c) >= 0 ? 0 : 1;
    return ma - mb || a - b;
  });
}

export function findHint(s: QState, robust = new RobustSolver(3_000_000), solver = new Solver(3_000_000)): Hint {
  if (status(s) !== 'playing') return { kind: 'none' };
  const moves = preferred(s, legalMoves(s));
  try {
    for (const m of moves) if (robust.moveWins(s, m)) return { kind: 'safe', col: m };
  } catch (e) {
    if (!(e instanceof SolverBudgetError)) throw e;
  }
  try {
    const path = solver.solve(s, (st, ms) => preferred(st, ms));
    if (path && path.length) return { kind: 'lucky', col: path[0] };
  } catch (e) {
    if (!(e instanceof SolverBudgetError)) throw e;
  }
  return { kind: 'none' };
}
