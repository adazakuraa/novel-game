// 解法探索と品質指標。ステージ生成（tools）と全ステージ検証（tests）で使う。
import { rng, type Rng } from '../../core/mode';
import { apply, init, legalMoves, losesNow, status, stateKey, type QState, type QueueStage } from './rules';

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
    if (s.dish >= s.stage.dishes.length) return true;
    if (s.bench.length >= s.stage.bench) return false;
    const k = stateKey(s);
    const m = this.memo.get(k);
    if (m === false) return false;
    // m===true でも手順を得るために降りる（記録済みなので速い）
    if (++this.nodes > this.budget) throw new SolverBudgetError();
    let moves = legalMoves(s);
    // 満席になる手は打っても負けるだけなので探索しない
    moves = moves.filter((m) => !losesNow(s, m));
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

export class SolverBudgetError extends Error {
  constructor() { super('solver budget exceeded'); }
}

/** 合う客を先に、待ち席へ送るなら早く出番が来る色を先に */
function defaultOrder(s: QState, moves: number[]): number[] {
  const d = s.stage.dishes;
  const soon = (c: number) => { const i = d.indexOf(c, s.dish); return i < 0 ? 999 : i - s.dish; };
  return moves
    .map((m) => ({ m, v: soon(s.custs[s.board[m]].c) }))
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

/** 何も考えない：動かせる客から無作為に選ぶ */
export const randomPolicy: Policy = (_s, moves, r) => r.pick(moves);

/** 素直な打ち手：合う客がいればその中から、いなければ待ち席へ（負けが確定する手は避ける） */
export const greedyPolicy: Policy = (s, moves, r) => {
  const want = s.stage.dishes[s.dish];
  const match = moves.filter((m) => s.custs[s.board[m]].c === want);
  if (match.length) return r.pick(match);
  const safe = moves.filter((m) => !losesNow(s, m));
  return r.pick(safe.length ? safe : moves);
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
  solvable: boolean;
  solution: number[];
  customers: number;
  /** 本質的に異なる解法の数（どの客を待ち席に通したかの組が違う解法）。上限 cap まで */
  distinct: number;
  /** 最初の一手のうち、クリア可能なまま進める手の数 / 全部の手 */
  firstWin: number;
  firstAll: number;
  randomWin: number;
  greedyWin: number;
  /** 「詰みが確定してから、実際に負けるまで」に打てる最大の手数（罠の深さ） */
  trapDepth: number;
  /** 最善手順で待ち席の空きが最も少なくなったときの空き席数（負けになる最後の1席は数えない） */
  minSlack: number;
  nodes: number;
}

export interface MeasureOptions {
  seed?: number;
  runs?: number;
  samples?: number;
  budget?: number;
  /** 素直な打ち手の勝率を見た時点で打ち切るか（生成の高速化用）。false を返すと null */
  gate?: (greedyWin: number) => boolean;
}

export function measure(stage: QueueStage, opt: MeasureOptions & { gate: (g: number) => boolean }): Metrics | null;
export function measure(stage: QueueStage, opt?: MeasureOptions): Metrics;
export function measure(stage: QueueStage, opt: MeasureOptions = {}): Metrics | null {
  const r = rng(opt.seed ?? 1);
  const runs = opt.runs ?? 200;
  const s0 = init(stage);

  // 安い指標から：素直な打ち手の勝率
  const losses: QState[][] = [];
  let gw = 0;
  for (let i = 0; i < runs; i++) {
    const g = playout(stage, greedyPolicy, r);
    if (g.win) gw++; else losses.push(g.trail);
  }
  const greedyWin = gw / runs;
  if (opt.gate && !opt.gate(greedyWin)) return null;

  const solver = new Solver(opt.budget);
  const solution = solver.solve(s0);
  const base = { customers: s0.custs.length, greedyWin };
  if (!solution) {
    return { ...base, solvable: false, solution: [], distinct: 0, firstWin: 0, firstAll: 0, randomWin: 0, trapDepth: 0, minSlack: 0, nodes: solver.nodes };
  }

  // 罠の深さ：素直な打ち手が詰みに入った局面から、負けるまでの最長手数
  let trap = 0;
  const memo = new Map<string, number>();
  for (const t of losses) {
    let j = t.length - 1;
    while (j > 0 && !solver.solvable(t[j - 1])) j--;
    trap = Math.max(trap, longestSurvival(t[j], memo, solver));
  }

  // 異なる解法：手の順番を無作為にして何度も解き、待ち席に通した客の組を数える
  const sigs = new Set<string>();
  const sigOf = (moves: number[]) => {
    let s = s0; const used: number[] = [];
    for (const m of moves) {
      const id = s.board[m];
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
  const firstWin = first.filter((m) => solver.solvable(apply(s0, m)!)).length;

  let rw = 0;
  for (let i = 0; i < runs; i++) if (playout(stage, randomPolicy, r).win) rw++;

  let minSlack = Infinity;
  let s = s0;
  for (const m of solution) {
    s = apply(s, m)!;
    if (status(s) === 'playing') minSlack = Math.min(minSlack, stage.bench - 1 - s.bench.length);
  }

  return {
    ...base,
    solvable: true,
    solution,
    distinct: sigs.size,
    firstWin,
    firstAll: first.length,
    randomWin: rw / runs,
    trapDepth: trap,
    minSlack: minSlack === Infinity ? stage.bench - 1 : minSlack,
    nodes: solver.nodes,
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
  for (const mv of moves) best = Math.max(best, losesNow(s, mv) ? 1 : 1 + longestSurvival(apply(s, mv)!, memo, solver));
  memo.set(k, best);
  return best;
}
