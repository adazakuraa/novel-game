import { describe, expect, it } from 'vitest';
import {
  apply, init, legalMoves, movable, pathUp, status, validateStage, stateKey,
  type Frame, type Order, type QueueStage, type StageCell,
} from '../src/modes/queue/rules';
import { Solver } from '../src/modes/queue/solver';

/** 文字で盤面を書く： '.' 空き '#' 柱  数字=皿の色。注文は [色, 皿数] */
function parse(rows: string[], orders: [number, number][], bench = 5, extra: Record<number, StageCell> = {}): QueueStage {
  const h = rows.length, w = rows[0].length;
  const cells: StageCell[] = [];
  rows.join('').split('').forEach((ch, i) => {
    if (extra[i] !== undefined) cells.push(extra[i]);
    else if (ch === '.') cells.push(null);
    else if (ch === '#') cells.push({ wall: true });
    else cells.push({ c: Number(ch) });
  });
  return { id: 0, w, h, cells, orders: orders.map(([c, n]): Order => ({ c, n })), bench };
}

describe('取れる皿（真上にしか動けない）', () => {
  it('真上がすべて空いている皿だけ取れる。横に空きがあっても回り込めない', () => {
    const s = init(parse(['0.1', '010', '111'], [[0, 3], [1, 5]]));
    // 0行目: 0 空 1 / 1行目: 0 1 0 / 2行目: 1 1 1
    // 列1の(1,1)は真上が空き → 取れる。(0,1)(2,1)は真上に皿 → 取れない
    expect(movable(s).sort((a, b) => a - b)).toEqual([0, 2, 4]);
  });
  it('柱の下の皿は取れない', () => {
    const s = init(parse(['#0', '00'], [[0, 3]]));
    expect(movable(s)).toEqual([1]);
  });
  it('道は自分のマスから真上の最上段まで', () => {
    expect(pathUp(3, 7)).toEqual([7, 4, 1]);
  });
});

describe('注文・置き台・連鎖', () => {
  it('注文に合う皿はお客さんへ、合わない皿は置き台へ', () => {
    let s = init(parse(['01', '00'], [[0, 3], [1, 1]]));
    s = apply(s, 1)!; // 色1 → 置き台
    expect(s.bench.length).toBe(1);
    s = apply(s, 0)!; // 色0 → お客さん
    expect(s.got.length).toBe(1);
  });
  it('注文の皿数がそろうと次のお客さんへ。置き台の合う皿は自動で渡る（連鎖）', () => {
    const st = parse(['1111', '0000'], [[0, 4], [1, 2], [1, 2]]);
    let s = init(st);
    for (const c of [0, 1, 2, 3]) s = apply(s, c)!;
    expect(s.bench.length).toBe(4);
    s = apply(s, 4)!; s = apply(s, 5)!; s = apply(s, 6)!;
    const frames: Frame[] = [];
    s = apply(s, 7, frames)!;
    expect(status(s)).toBe('cleared');
    expect(frames.map((f) => f.step.k)).toEqual(['walk', 'orderDone', 'pull', 'pull', 'orderDone', 'pull', 'pull', 'orderDone']);
  });
  it('置き台がいっぱいでも、注文に合う皿は取れる。合わない皿は取れない', () => {
    const st = parse(['120', '000'], [[0, 4], [1, 1], [2, 1]], 2);
    let s = init(st);
    s = apply(s, 0)!; s = apply(s, 1)!;
    expect(s.bench.length).toBe(2);
    expect(status(s)).toBe('playing');
    expect(legalMoves(s).sort()).toEqual([2, 3, 4]);
    s = apply(s, 3)!;
    expect(s.got.length).toBe(1);
  });
  it('打てる手が無くなったらゲームオーバー（置き台がいっぱいで、注文に合う皿が取れない）', () => {
    const st = parse(['12', '33', '00'], [[0, 2], [1, 1], [2, 1], [3, 2]], 2);
    let s = init(st);
    s = apply(s, 0)!; s = apply(s, 1)!;
    // 置き台いっぱい、取れるのは色3（注文は色0）→ 打てる手が無い
    expect(movable(s).length).toBe(2);
    expect(legalMoves(s)).toEqual([]);
    expect(status(s)).toBe('stuck');
    expect(apply(s, 2)).toBeNull();
  });
  it('取れる皿が1枚も無ければゲームオーバー', () => {
    const st = parse(['1#', '0#', '0#', '0#'], [[0, 3], [1, 1]], 5, { 0: { c: 1, lock: 1 } });
    expect(status(init(st))).toBe('stuck');
  });
  it('取れない皿をタップしても何も起きない', () => {
    const s = init(parse(['0', '0', '0'], [[0, 3]]));
    expect(apply(s, 1)).toBeNull();
    expect(apply(s, 0)).not.toBeNull();
  });
});

describe('ギミック', () => {
  it('予約札：札の人数だけお客さんが帰るまで取れない', () => {
    const st = parse(['1000', '1111'], [[0, 3], [1, 3], [1, 2]], 5, { 0: { c: 1, lock: 1 } });
    let s = init(st);
    expect(apply(s, 0)).toBeNull();
    s = apply(s, 1)!; s = apply(s, 2)!; s = apply(s, 3)!;
    expect(s.order).toBe(1);
    expect(apply(s, 0)).not.toBeNull();
  });
  it('のれん：上のマスが空くと順番に皿が出てくる', () => {
    const st = parse(['.0', '.0'], [[0, 2], [1, 3]], 5, { 0: null, 2: { tunnel: 'u', queue: [1, 1, 1] } });
    let s = init(st);
    expect(s.items[s.board[0]].c).toBe(1);   // 上のマスは最初から空なので、すぐ1枚目が出る
    expect(s.tunnels[0].next).toBe(1);
    s = apply(s, 0)!;
    expect(s.tunnels[0].next).toBe(2);
    expect(s.board[0]).toBeGreaterThanOrEqual(0);
  });
});

describe('ステージデータの検証', () => {
  it('皿の数と注文の合計が合わなければ指摘する', () => {
    expect(validateStage(parse(['00', '01'], [[0, 3]]))).not.toEqual([]);
    expect(validateStage(parse(['000', '11.'], [[1, 2], [0, 3]]))).toEqual([]);
  });
});

describe('ソルバー', () => {
  it('総当たりで確かめた小さな盤面と結果が一致する', () => {
    const brute = (s: ReturnType<typeof init>): boolean => {
      const st = status(s);
      if (st === 'cleared') return true;
      if (st !== 'playing') return false;
      return legalMoves(s).some((m) => brute(apply(s, m)!));
    };
    const boards: [string[], [number, number][], number][] = [
      [['011', '100'], [[0, 3], [1, 3]], 1],
      [['011', '100'], [[1, 3], [0, 3]], 2],
      [['012', '201', '120', '222'], [[2, 3], [0, 3], [1, 3], [2, 3]], 2],
      [['012', '201', '120', '222'], [[0, 3], [1, 3], [2, 6]], 2],
      [['112', '201', '020', '222'], [[1, 2], [2, 4], [0, 3], [1, 1], [2, 2]], 2],
      [['012', '120', '201'], [[2, 2], [1, 3], [0, 3], [2, 1]], 1],
      [['012', '120', '201'], [[2, 3], [1, 3], [0, 3]], 3],
    ];
    let solvable = 0;
    for (const [rows, orders, bench] of boards) {
      const st = parse(rows, orders, bench);
      expect(validateStage(st)).toEqual([]);
      const s = init(st);
      const b = brute(s);
      if (b) solvable++;
      expect(new Solver().solvable(s)).toBe(b);
    }
    // 解ける盤面と解けない盤面の両方を確かめている
    expect(solvable).toBeGreaterThan(0);
    expect(solvable).toBeLessThan(boards.length);
  });
  it('局面キーは置き台の並び順に依存しない', () => {
    const st = parse(['12', '00', '00', '12', '12'], [[0, 4], [1, 3], [2, 3]], 5);
    const a = apply(apply(init(st), 0)!, 1)!;
    const b = apply(apply(init(st), 1)!, 0)!;
    expect(stateKey(a)).toBe(stateKey(b));
  });
});
