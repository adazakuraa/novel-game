import { describe, expect, it } from 'vitest';
import {
  apply, init, legalMoves, movable, status, validateStage, stateKey, topOf,
  type Frame, type QueueStage,
} from '../src/modes/queue/rules';
import { Solver } from '../src/modes/queue/solver';

/** 列を文字で書く（上から）。数字=皿の色、'L数' は書けないので locks で指定。注文は [色, 皿数] */
function mk(cols: string[], orders: [number, number][], opt: { bench?: number; seats?: number; rows?: number; locks?: Record<string, number> } = {}): QueueStage {
  return {
    id: 0,
    cols: cols.map((c, ci) => c.split('').map((ch, j) => {
      const lock = opt.locks?.[`${ci},${j}`];
      return lock ? { c: Number(ch), lock } : { c: Number(ch) };
    })),
    rows: opt.rows ?? 3,
    orders: orders.map(([c, n]) => ({ c, n })),
    seats: opt.seats ?? 1,
    bench: opt.bench ?? 5,
  };
}

describe('列（いちばん上だけ取れる。取ると下から次が出る）', () => {
  it('各列のいちばん上の皿だけ取れる', () => {
    const s = init(mk(['01', '10', '0'], [[0, 3], [1, 2]]));
    expect(movable(s)).toEqual([0, 1, 2]);
    expect(topOf(s, 0)).toBe(0);
  });
  it('取ると列が1段上がり、次の皿が一番上になる。空の列からは取れない', () => {
    let s = init(mk(['01', '1'], [[0, 1], [1, 2]]));
    s = apply(s, 0)!;
    expect(s.items[topOf(s, 0)].c).toBe(1);
    s = apply(s, 1)!;
    expect(topOf(s, 1)).toBe(-1);
    expect(apply(s, 1)).toBeNull();
  });
});

describe('注文・置き台・連鎖', () => {
  it('注文に合う皿はお客さんへ、合わない皿は置き台へ', () => {
    let s = init(mk(['1', '0', '00'], [[0, 3], [1, 1]]));
    s = apply(s, 0)!;
    expect(s.bench.length).toBe(1);
    s = apply(s, 1)!;
    expect(s.seats[0].got.length).toBe(1);
  });
  it('注文がそろうと次のお客さんが座り、置き台の合う皿が自動で渡る（連鎖）', () => {
    const st = mk(['1111', '0000'], [[0, 4], [1, 2], [1, 2]]);
    let s = init(st);
    for (let i = 0; i < 4; i++) s = apply(s, 0)!;
    expect(s.bench.length).toBe(4);
    for (let i = 0; i < 3; i++) s = apply(s, 1)!;
    const frames: Frame[] = [];
    s = apply(s, 1, frames)!;
    expect(status(s)).toBe('cleared');
    expect(frames.map((f) => f.step.k)).toEqual(['take', 'leave', 'sit', 'pull', 'pull', 'leave', 'sit', 'pull', 'pull', 'leave']);
  });
  it('置き台がいっぱいでも、注文に合う皿は取れる。合わない皿は取れない', () => {
    let s = init(mk(['12', '0', '000'], [[0, 4], [1, 1], [2, 1]], { bench: 2 }));
    s = apply(s, 0)!; s = apply(s, 0)!;
    expect(s.bench.length).toBe(2);
    expect(legalMoves(s)).toEqual([1, 2]);
    s = apply(s, 1)!;
    expect(s.seats[0].got.length).toBe(1);
  });
  it('打てる手が無くなったらゲームオーバー（置き台がいっぱいで、注文に合う皿が一番上にない）', () => {
    let s = init(mk(['12', '30', '30'], [[0, 2], [1, 1], [2, 1], [3, 2]], { bench: 2 }));
    s = apply(s, 0)!; s = apply(s, 0)!;
    expect(movable(s)).toEqual([1, 2]);
    expect(legalMoves(s)).toEqual([]);
    expect(status(s)).toBe('stuck');
    expect(apply(s, 1)).toBeNull();
  });
  it('お客さんが2人：合う皿は左の人から。どちらかがそろうと次の人が座る', () => {
    const st = mk(['0001', '11', '2'], [[0, 2], [0, 1], [1, 3], [2, 1]], { seats: 2 });
    let s = init(st);
    expect(s.seats.map((x) => x.order)).toEqual([0, 1]);
    s = apply(s, 0)!;                       // 色0 → 左の人
    expect(s.seats[0].got.length).toBe(1);
    s = apply(s, 0)!;                       // 色0 → 左の人がそろって帰り、次（色1×3）が座る
    expect(s.seats[0].order).toBe(2);
    s = apply(s, 0)!;                       // 色0 → 右の人（色0×1）がそろう → 次（色2×1）が座る
    expect(s.seats[1].order).toBe(3);
    expect(s.served).toBe(2);
  });
});

describe('ギミック', () => {
  it('予約札：札の人数だけお客さんが帰るまで取れない', () => {
    const st = mk(['1', '000', '11'], [[0, 3], [1, 3]], { locks: { '0,0': 1 } });
    let s = init(st);
    expect(apply(s, 0)).toBeNull();
    for (let i = 0; i < 3; i++) s = apply(s, 1)!;
    expect(s.served).toBe(1);
    expect(apply(s, 0)).not.toBeNull();
  });
  it('一番上が予約札で、ほかに手が無ければゲームオーバー', () => {
    expect(status(init(mk(['10', '00'], [[0, 3], [1, 1]], { locks: { '0,0': 1, '1,0': 1 } })))).toBe('stuck');
  });
});

describe('ステージデータの検証', () => {
  it('皿の数と注文の合計が合わなければ指摘する', () => {
    expect(validateStage(mk(['00', '01'], [[0, 3]]))).not.toEqual([]);
    expect(validateStage(mk(['000', '11'], [[1, 2], [0, 3]]))).toEqual([]);
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
    const boards: QueueStage[] = [
      mk(['011', '100'], [[0, 3], [1, 3]], { bench: 1 }),
      mk(['011', '100'], [[1, 3], [0, 3]], { bench: 2 }),
      mk(['0122', '2012', '1202'], [[2, 3], [0, 3], [1, 3], [2, 3]], { bench: 2 }),
      mk(['0122', '2012', '1202'], [[0, 3], [1, 3], [2, 6]], { bench: 2 }),
      mk(['1122', '2010', '2202'], [[1, 2], [2, 4], [0, 3], [1, 1], [2, 2]], { bench: 2 }),
      mk(['012', '120', '201'], [[2, 2], [1, 3], [0, 3], [2, 1]], { bench: 1 }),
      mk(['012', '120', '201'], [[2, 3], [1, 3], [0, 3]], { bench: 1, seats: 2 }),
      mk(['0122', '2012', '1202'], [[0, 3], [1, 3], [2, 6]], { bench: 1, seats: 2 }),
    ];
    let solvable = 0;
    for (const st of boards) {
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
    const st = mk(['1', '2', '000', '12', '12'], [[0, 3], [1, 3], [2, 3]]);
    const a = apply(apply(init(st), 0)!, 1)!;
    const b = apply(apply(init(st), 1)!, 0)!;
    expect(stateKey(a)).toBe(stateKey(b));
  });
});
