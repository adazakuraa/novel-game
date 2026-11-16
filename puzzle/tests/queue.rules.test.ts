import { describe, expect, it } from 'vitest';
import {
  apply, init, legalMoves, movable, reach, pathFrom, status, validateStage, stateKey,
  type Frame, type QueueStage, type StageCell,
} from '../src/modes/queue/rules';
import { Solver } from '../src/modes/queue/solver';

/** 文字で盤面を書く： '.' 空き '#' 柱  数字=客の色  'L数字' は書けないので locks で指定 */
function parse(rows: string[], dishes: number[], bench = 5, extra: Record<number, StageCell> = {}): QueueStage {
  const h = rows.length, w = rows[0].length;
  const cells: StageCell[] = [];
  rows.join('').split('').forEach((ch, i) => {
    if (extra[i] !== undefined) cells.push(extra[i]);
    else if (ch === '.') cells.push(null);
    else if (ch === '#') cells.push({ wall: true });
    else cells.push({ c: Number(ch) });
  });
  return { id: 0, w, h, cells, dishes, bench };
}

describe('道の判定', () => {
  it('最上段の客はいつでも出られる。空きマスを通って行ける客だけが動ける', () => {
    const s = init(parse(['0.1', '#20', '111'], [0, 1, 1]));
    // 0行目: 0(0) 空き(1) 1(2) / 1行目: 柱(3) 2(4) 0(5) / 2行目: 1 1 1
    // 色2は皿に無いので validate は通らないが、道の判定だけ見る
    expect(movable(s).sort((a, b) => a - b)).toEqual([0, 2, 4]);
  });
  it('道は自分のマスから最上段へ向かう', () => {
    const s = init(parse(['0..', '#.#', '#.0'], [0]));
    const p = reach(s);
    const path = pathFrom(p, 8);
    expect(path[0]).toBe(8);
    expect(path[path.length - 1]).toBeLessThan(3);
    // 隣り合うマスだけでつながっている
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      expect(Math.abs(a - b) === 1 || Math.abs(a - b) === 3).toBe(true);
    }
  });
  it('柱に囲まれた客は動けない', () => {
    const s = init(parse(['0#0', '#0#'], [0]));
    expect(movable(s)).toEqual([0, 2]);
  });
});

describe('着席・待ち席・連鎖', () => {
  it('同じ注文はカウンター、違う注文は待ち席へ', () => {
    let s = init(parse(['01', '00', '11'], [0, 1]));
    s = apply(s, 1)!; // 色1 → 待ち席
    expect(s.bench.length).toBe(1);
    s = apply(s, 0)!; // 色0 → 席
    expect(s.seats.length).toBe(1);
  });
  it('皿が埋まると次の皿が出て、待ち席の合う客が自動で移る（連鎖）', () => {
    // 先に色1を3人待ち席に入れてから色0の皿を埋めると、次の皿（色1）が一気に埋まる
    const st = parse(['111', '000'], [0, 1], 5);
    let s = init(st);
    s = apply(s, 0)!; s = apply(s, 1)!; s = apply(s, 2)!;
    expect(s.bench.length).toBe(3);
    expect(status(s)).toBe('playing');
    s = apply(s, 3)!; s = apply(s, 4)!;
    const frames: Frame[] = [];
    s = apply(s, 5, frames)!;
    expect(status(s)).toBe('cleared');
    expect(frames.map((f) => f.step.k)).toEqual(['walk', 'dishDone', 'pull', 'pull', 'pull', 'dishDone']);
  });
  it('待ち席が満席になったら負け', () => {
    const st = parse(['1112', '0000', '0022'], [0, 0, 1, 2], 3);
    let s = init(st);
    s = apply(s, 0)!; s = apply(s, 1)!;
    expect(status(s)).toBe('playing');
    s = apply(s, 2)!;
    expect(status(s)).toBe('full');
    expect(legalMoves(s)).toEqual([]);
    expect(apply(s, 3)).toBeNull();
  });
  it('動かせる客がいなければ手詰まり', () => {
    // 色0の客は柱の奥。出口にいるのは予約札の客だけ
    const st = parse(['1#', '0#', '0#', '0#'], [0, 1], 5, { 0: { c: 1, lock: 1 } });
    // 色1が3人いないので validate は通らないが、手詰まり判定だけ見る
    const s = init(st);
    expect(status(s)).toBe('stuck');
  });
  it('動けない客をタップしても何も起きない', () => {
    const s = init(parse(['0', '0', '0'], [0]));
    expect(apply(s, 1)).toBeNull();
    expect(apply(s, 0)).not.toBeNull();
  });
});

describe('ギミック', () => {
  it('予約札：札の枚数だけ皿が下がるまで動けない', () => {
    const st = parse(['1000', '1111'], [0, 1, 1], 5, { 0: { c: 1, lock: 1 } });
    // 0: 予約札つき色1 / 1,2,3: 色0 / 4..7: 色1
    let s = init(st);
    expect(apply(s, 0)).toBeNull();
    s = apply(s, 1)!; s = apply(s, 2)!; s = apply(s, 3)!;
    expect(s.dish).toBe(1);
    expect(apply(s, 0)).not.toBeNull();
  });
  it('のれん：前のマスが空くと順番に客が出てくる', () => {
    const st = parse(['.0', '.0'], [0, 1], 5, { 0: null, 2: { tunnel: 'u', queue: [1, 1, 1] } });
    let s = init(st);
    // 出口マス(0)は最初から空なので、すぐ1人目が出る
    expect(s.custs[s.board[0]].c).toBe(1);
    expect(s.tunnels[0].next).toBe(1);
    s = apply(s, 0)!; // 色1 → 待ち席。次の客が出る
    expect(s.tunnels[0].next).toBe(2);
    expect(s.board[0]).toBeGreaterThanOrEqual(0);
  });
});

describe('ステージデータの検証', () => {
  it('客の数と皿の数が合わなければ指摘する', () => {
    expect(validateStage(parse(['00', '01'], [0]))).not.toEqual([]);
    expect(validateStage(parse(['000'], [0]))).toEqual([]);
  });
});

describe('ソルバー', () => {
  it('総当たりで確かめた小さな盤面と結果が一致する', () => {
    // 総当たり（記憶なし）と比べる
    const brute = (s: ReturnType<typeof init>): boolean => {
      const st = status(s);
      if (st === 'cleared') return true;
      if (st !== 'playing') return false;
      return legalMoves(s).some((m) => brute(apply(s, m)!));
    };
    const boards: [string[], number[], number][] = [
      [['011', '100'], [0, 1], 2],
      [['011', '100'], [1, 0], 2],
      [['012', '201', '120', '222'], [2, 0, 1, 2], 3],
      [['012', '201', '120', '222'], [0, 1, 2, 2], 2],
      [['112', '201', '020', '222'], [1, 2, 0, 2], 2],
      [['012', '120', '201'], [2, 1, 0], 3],
      [['012', '120', '201'], [2, 1, 0], 2],
    ];
    for (const [rows, dishes, bench] of boards) {
      const st = parse(rows, dishes, bench);
      expect(validateStage(st)).toEqual([]);
      const s = init(st);
      expect(new Solver().solvable(s)).toBe(brute(s));
    }
  });
  it('局面キーは待ち席の並び順に依存しない', () => {
    const st = parse(['12', '00', '0.', '12', '12'], [0, 1, 2], 5);
    const a = apply(apply(init(st), 0)!, 1)!;
    const b = apply(apply(init(st), 1)!, 0)!;
    expect(stateKey(a)).toBe(stateKey(b));
  });
});
