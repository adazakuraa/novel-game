// 解法探索と品質指標。ステージ生成（tools）と全ステージ検証（tests）で使う。
import { rng, type Rng } from '../../core/mode';
import { RobustSolver } from './robust';
import { SolverBudgetError } from './budget';
import { apply, init, legalMoves, seatFor, status, topOf, stateKey, type QState, type QueueStage } from './rules';

export class Solver {
  /** 局面キー → クリア可能か（探索し切った局面だけを記録） */
  readonly memo = new Map<string, boolean>();
  nodes = 0;
  constructor(public budget = 2_000_000) {}

  /** クリア可能なら手順、不可能なら null。探索量の上限を超えたら例外 */
  solve(s: QState, order?: (s: QState, moves: number[]) => number[]): number[] | null {
    const path: number[] = [];
    return this.dfs(s, path, order) ? path : null;
  }

  solvable(s: QState): boolean {
    const st = status(s);
    if (st === 'cleared') return true;
    if (st !== 'playing') return false;
    const k = stateKey(s);
    const m = this.memo.get(k);
    if (m !== undefined) return m;
    return this.dfs(s, [], undefined);
  }

  private dfs(s: QState, path: number[], order?: (s: QState, moves: number[]) => number[]): boolean {
    if (s.served >= s.stage.orders.length) return true;
    const k = stateKey(s);
    const m = this.memo.get(k);
    if (m === false) return false;
    // m===true でも手順を得るために降りる（記録済みなので速い）
    if (++this.nodes > this.budget) throw new SolverBudgetError();
    let moves = legalMoves(s);
    moves = order ? order(s, moves) : defaultOrder(s, moves);
    for (const mv of moves) {
      const n = apply(s, mv)!;
      path.push(mv);
      if (this.dfs(n, path, order)) { this.memo.set(k, true); return true; }
      path.pop();
    }
    this.memo.set(k, false);
    return false;
  }
}

export { SolverBudgetError };

/** 注文に合う皿を先に、置き台へ置くなら早く出番が来る色を先に */
function defaultOrder(s: QState, moves: number[]): number[] {
  const d = s.stage.orders;
  const soon = (c: number) => {
    if (seatFor(s, c) >= 0) return 0;
    const i = d.findIndex((o, j) => j >= s.next && o.c === c);
    return i < 0 ? 999 : 1 + i - s.next;
  };
  return moves
    .map((m) => ({ m, v: soon(s.items[topOf(s, m)].c) }))
    .sort((a, b) => a.v - b.v)
    .map((x) => x.m);
}

function shuffledOrder(r: Rng) {
  return (_s: QState, moves: number[]) => r.shuffle(moves.slice());
}

/** 手順を最初から再生してクリアになるか */
export function replay(stage: QueueStage, moves: number[]): QState | null {
  let s = init(stage);
  for (const m of moves) {
    const n = apply(s, m);
    if (!n) return null;
    s = n;
  }
  return s;
}

export type Policy = (s: QState, moves: number[], r: Rng) => number;

/** 何も考えない：打てる手から無作為に選ぶ */
export const randomPolicy: Policy = (_s, moves, r) => r.pick(moves);

/** 素直な打ち手：注文に合う皿があればその中から、なければ無作為に置き台へ */
export const greedyPolicy: Policy = (s, moves, r) => {
  const match = moves.filter((m) => seatFor(s, s.items[topOf(s, m)].c) >= 0);
  return r.pick(match.length ? match : moves);
};

export function playout(stage: QueueStage, policy: Policy, r: Rng): { win: boolean; trail: QState[] } {
  let s = init(stage);
  const trail = [s];
  for (let moves = legalMoves(s); moves.length; moves = legalMoves(s)) {
    s = apply(s, policy(s, moves, r))!;
    trail.push(s);
  }
  return { win: status(s) === 'cleared', trail };
}

export interface Metrics {
  /** 見えている情報だけで解けるか（見えない皿がどんな並びでも、正しく考えれば必ずクリアできる） */
  solvable: boolean;
  solution: number[];
  plates: number;      // 皿の総数
  /** 正解の手の割合：見えている情報だけで勝てる局面で、打てる手のうち勝ち筋に残る手の割合（手が1つしかない局面は除く）の平均。低いほど難しい */
  goodRatio: number;
  /** 本質的に異なる解法の数（どの皿を置き台に通したかの組が違う解法） */
  distinct: number;
  /** 最初の一手のうち、見えている情報だけで勝ち筋に残れる手の数 / 全部の手 */
  firstWin: number;
  firstAll: number;
  randomWin: number;
  greedyWin: number;
  /** 「詰みが確定してから、実際に負けるまで」に打てる最大の手数（罠の深さ） */
  trapDepth: number;
  /** 解法の手順で置き台の空きが最も少なくなったときの空きの数 */
  minSlack: number;
  nodes: number;
}

export interface MeasureOptions {
  seed?: number;
  runs?: number;
  samples?: number;
  budget?: number;
  /** 正解の手の割合を見た時点で打ち切るか（生成の高速化用）。false を返すと null */
  gate?: (goodRatio: number) => boolean;
}

export function measure(stage: QueueStage, opt: MeasureOptions & { gate: (good: number) => boolean }): Metrics | null;
export function measure(stage: QueueStage, opt?: MeasureOptions): Metrics;
export function measure(stage: QueueStage, opt: MeasureOptions = {}): Metrics | null {
  const r = rng(opt.seed ?? 1);
  const runs = opt.runs ?? 200;
  const s0 = init(stage);

  // 見えている情報だけで勝てるか（見えない皿がどんな並びでも）
  const robust = new RobustSolver(opt.budget);
  const solver = new Solver(opt.budget);
  const solution = robust.wins(s0) ? solver.solve(s0) : null;
  const base = { plates: s0.items.length };
  if (!solution) {
    return { ...base, solvable: false, solution: [], distinct: 0, firstWin: 0, firstAll: 0, randomWin: 0, greedyWin: 0, trapDepth: 0, minSlack: 0, goodRatio: 0, nodes: solver.nodes };
  }

  // 正解の手の割合：見えている情報だけで勝てる手の中を無作為に歩き、各局面で「その手 / 打てる手」を集める
  let sum = 0, cnt = 0;
  for (let i = 0; i < 20; i++) {
    let s = s0;
    while (status(s) === 'playing') {
      const moves = legalMoves(s);
      const good = moves.filter((m) => robust.moveWins(s, m));
      if (moves.length > 1) { sum += good.length / moves.length; cnt++; }
      s = apply(s, r.pick(good))!;
    }
  }
  const goodRatio = cnt ? sum / cnt : 1;
  if (opt.gate && !opt.gate(goodRatio)) return null;

  // 素直な打ち手の勝率と、罠の深さ（素直な打ち手が詰みに入った局面から、負けるまでの最長手数）
  let gw = 0, trap = 0;
  const memo = new Map<string, number>();
  for (let i = 0; i < runs; i++) {
    const g = playout(stage, greedyPolicy, r);
    if (g.win) { gw++; continue; }
    const t = g.trail;
    let j = t.length - 1;
    while (j > 0 && !solver.solvable(t[j - 1])) j--;
    trap = Math.max(trap, longestSurvival(t[j], memo, solver));
  }

  // 異なる解法：手の順番を無作為にして何度も解き、置き台に通した皿の組を数える
  const sigs = new Set<string>();
  const sigOf = (moves: number[]) => {
    let s = s0; const used: number[] = [];
    for (const m of moves) {
      const id = topOf(s, m);
      const n = apply(s, m)!;
      if (n.bench.includes(id)) used.push(id);
      s = n;
    }
    return used.sort((a, b) => a - b).join(',');
  };
  sigs.add(sigOf(solution));
  const samples = opt.samples ?? 30;
  for (let i = 0; i < samples; i++) {
    const p = solver.solve(s0, shuffledOrder(r));
    if (p) sigs.add(sigOf(p));
  }

  const first = legalMoves(s0);
  const firstWin = first.filter((m) => robust.moveWins(s0, m)).length;

  let rw = 0;
  for (let i = 0; i < runs; i++) if (playout(stage, randomPolicy, r).win) rw++;

  let minSlack = Infinity;
  let s = s0;
  for (const m of solution) {
    s = apply(s, m)!;
    if (status(s) === 'playing') minSlack = Math.min(minSlack, stage.bench - s.bench.length);
  }

  return {
    ...base,
    solvable: true,
    solution,
    distinct: sigs.size,
    firstWin,
    firstAll: first.length,
    randomWin: rw / runs,
    greedyWin: gw / runs,
    trapDepth: trap,
    minSlack: minSlack === Infinity ? stage.bench : minSlack,
    goodRatio,
    nodes: solver.nodes + robust.nodes,
  };
}

function longestSurvival(s: QState, memo: Map<string, number>, solver: Solver): number {
  const moves = legalMoves(s);
  if (!moves.length) return 0;
  const k = stateKey(s);
  const m = memo.get(k);
  if (m !== undefined) return m;
  if (++solver.nodes > solver.budget) throw new SolverBudgetError();
  let best = 0;
  for (const mv of moves) best = Math.max(best, 1 + longestSurvival(apply(s, mv)!, memo, solver));
  memo.set(k, best);
  return best;
}
