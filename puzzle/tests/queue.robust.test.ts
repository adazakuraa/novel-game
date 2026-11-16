import { describe, expect, it } from 'vitest';
import { rng } from '../src/core/mode';
import { apply, init, legalMoves, status, type QState, type QueueStage } from '../src/modes/queue/rules';
import { RobustSolver, visibleKey } from '../src/modes/queue/robust';
import { Solver } from '../src/modes/queue/solver';

function mk(cols: string[], orders: [number, number][], rows: number, bench: number): QueueStage {
  return { id: 0, cols: cols.map((c) => c.split('').map((ch) => ({ c: Number(ch) }))), rows, orders: orders.map(([c, n]) => ({ c, n })), seats: 1, bench };
}

/** 見えない皿の並びをすべて試して、「見えている情報だけで決まる打ち方」で全部に勝てるかを素朴に調べる */
function bruteRobust(st: QueueStage): boolean {
  // 見えない皿の位置と色の全並び
  const hiddenPos: [number, number][] = [];
  st.cols.forEach((col, ci) => col.forEach((_, j) => { if (j >= st.rows) hiddenPos.push([ci, j]); }));
  const colors = hiddenPos.map(([ci, j]) => st.cols[ci][j].c);
  const perms = new Set<string>();
  const permute = (a: number[], k: number) => {
    if (k === a.length) { perms.add(a.join(',')); return; }
    for (let i = k; i < a.length; i++) { [a[k], a[i]] = [a[i], a[k]]; permute(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  };
  permute(colors.slice(), 0);
  const worlds = [...perms].map((p) => {
    const cs = p.split(',').map(Number);
    const cols = st.cols.map((col) => col.map((x) => ({ ...x })));
    hiddenPos.forEach(([ci, j], i) => { cols[ci][j].c = cs[i]; });
    return init({ ...st, cols });
  });
  // 情報集合（見えているものが同じ世界の集まり）ごとに、同じ手を選んで全部の世界で勝てるか
  const win = (ws: QState[]): boolean => {
    if (ws.every((s) => status(s) === 'cleared')) return true;
    if (ws.some((s) => status(s) !== 'playing')) return false;
    return legalMoves(ws[0]).some((mv) => {
      const next = ws.map((s) => apply(s, mv)!);
      const groups = new Map<string, QState[]>();
      for (const n of next) { const k = visibleKey(n); groups.set(k, [...(groups.get(k) ?? []), n]); }
      return [...groups.values()].every(win);
    });
  };
  return win(worlds);
}

describe('見えている情報だけで解けるか', () => {
  it('見えない皿が無ければ、ふつうの解けるかどうかと同じ', () => {
    const st = mk(['01', '10', '01'], [[0, 3], [1, 3]], 2, 1);
    const s = init(st);
    expect(new RobustSolver().wins(s)).toBe(new Solver().solvable(s));
  });
  it('実際の並びなら解けても、見えない皿の運しだいなら「解けない」と判定する', () => {
    // 小さな盤面を順に試し、「実際の並びなら解けるが、見えている情報だけでは運しだい」の例を探す
    const r = rng(7);
    let found = 0;
    for (let t = 0; t < 300 && found < 3; t++) {
      const colors = r.shuffle([0, 0, 0, 1, 1, 1, 2, 2, 2]);
      const cols = [colors.slice(0, 3), colors.slice(3, 6), colors.slice(6)].map((c) => c.join(''));
      const st = mk(cols, r.shuffle([[0, 3], [1, 3], [2, 3]] as [number, number][]), 1, 1);
      if (!new Solver().solvable(init(st)) || bruteRobust(st)) continue;
      found++;
      expect(new RobustSolver().wins(init(st))).toBe(false);
    }
    expect(found).toBeGreaterThan(0);
  });
  it('小さな盤面で、素朴な全並びの総当たりと結果が一致する', () => {
    const boards: QueueStage[] = [
      mk(['012', '120', '201'], [[0, 3], [1, 3], [2, 3]], 2, 2),
      mk(['012', '120', '201'], [[2, 3], [1, 3], [0, 3]], 2, 1),
      mk(['0120', '1201', '20'], [[0, 4], [1, 3], [2, 3]], 2, 2),
      mk(['0120', '1201', '20'], [[2, 3], [0, 4], [1, 3]], 2, 2),
      mk(['01', '10', '0011'], [[1, 3], [0, 3]], 2, 2),
      mk(['20', '21'], [[2, 2], [0, 1], [1, 1]], 1, 2),
    ];
    let yes = 0;
    for (const st of boards) {
      const b = bruteRobust(st);
      if (b) yes++;
      expect(new RobustSolver().wins(init(st))).toBe(b);
    }
    expect(yes).toBeGreaterThan(0);
    expect(yes).toBeLessThan(boards.length);
  });
  it('局面キーには見えない皿の並びが入らない（色の内訳だけ）', () => {
    const a = init(mk(['0', '1', '01', '10'], [[0, 3], [1, 3]], 1, 2));
    const b = init(mk(['0', '1', '00', '11'], [[0, 3], [1, 3]], 1, 2));
    expect(visibleKey(a)).toBe(visibleKey(b));
  });
});
