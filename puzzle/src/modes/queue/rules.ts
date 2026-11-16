// Bus Jam型（行列整理）のルール本体。副作用のない純粋関数だけで書く。
// UI・ソルバー・テストはすべてこの実装を使う（表示と検証でルールがずれないように）。
//
// 寿司テーマでの見え方：
//  - 盤面＝皿の列。各列の一番上の皿だけ取れる。取ると列が1段上がり、下（厨房）から次の皿が出てくる
//  - カウンター＝お客さん（1〜2人同時）。「このネタを n 皿ほしい」
//  - 置き台＝注文に合わない皿を一時的に置く場所
import type { GameMode, PlayStatus } from '../../core/mode';

/** 皿。lock=この人数のお客さんが帰るまで取れない（予約札） */
export interface Plate { c: number; lock?: number }

/** 注文：色 c の皿を n 枚 */
export interface Order { c: number; n: number }

export interface QueueStage {
  id: number;
  cols: Plate[][];      // 列ごとの皿（上から順）
  rows: number;         // 盤面に大きく見せる段数（それより下は厨房に小さく見せる）
  orders: Order[];      // お客さんの行列（来る順）
  seats: number;        // カウンターに同時に座るお客さんの数（1〜2）
  bench: number;        // 置き台の数
  intro?: string;       // 新しい要素の説明
  seed?: number;        // 品質を計測したときの乱数シード（検証の再現用）
}

export interface Item { c: number; lock: number; col: number; idx: number }

/** カウンターの席。order=座っているお客さん（注文の番号、-1=空席）、got=渡した皿 */
export interface Seat { order: number; got: number[] }

export interface QState {
  stage: QueueStage;
  items: Item[];        // 全部の皿。id=添字
  colIds: number[][];   // 列ごとの皿id（上から）
  top: number[];        // 列ごとの、いま一番上にある皿の位置（=取った枚数）
  seats: Seat[];
  next: number;         // 次に座るお客さん（注文の番号）
  served: number;       // 帰ったお客さんの数
  bench: number[];      // 置き台の皿（左から）
  moves: number;
}

/** 1手の中の小さな出来事。演出用 */
export type Step =
  | { k: 'take'; id: number; col: number; to: 'seat' | 'bench'; seat: number }
  | { k: 'leave'; seat: number; order: number; ids: number[] }
  | { k: 'sit'; seat: number; order: number }
  | { k: 'pull'; id: number; seat: number };

export interface Frame { step: Step; state: QState }

export function init(stage: QueueStage): QState {
  const items: Item[] = [];
  const colIds = stage.cols.map((col, ci) => col.map((p, idx) => items.push({ c: p.c, lock: p.lock ?? 0, col: ci, idx }) - 1));
  const seats: Seat[] = [];
  for (let i = 0; i < stage.seats; i++) seats.push({ order: i < stage.orders.length ? i : -1, got: [] });
  return {
    stage, items, colIds,
    top: stage.cols.map(() => 0),
    seats,
    next: Math.min(stage.seats, stage.orders.length),
    served: 0,
    bench: [],
    moves: 0,
  };
}

function clone(s: QState): QState {
  return {
    ...s,
    top: s.top.slice(),
    seats: s.seats.map((x) => ({ order: x.order, got: x.got.slice() })),
    bench: s.bench.slice(),
  };
}

export const isLocked = (s: QState, id: number) => s.items[id].lock > s.served;

/** 列の一番上の皿（無ければ -1） */
export function topOf(s: QState, col: number): number {
  const ids = s.colIds[col];
  return s.top[col] < ids.length ? ids[s.top[col]] : -1;
}

/** 色 c の皿を受け取れる席（左から最初の1つ。無ければ -1） */
export function seatFor(s: QState, c: number): number {
  return s.seats.findIndex((x) => x.order >= 0 && s.stage.orders[x.order].c === c && x.got.length < s.stage.orders[x.order].n);
}

/** 取り出せる列（一番上の皿があり、予約札が外れている） */
export function movable(s: QState): number[] {
  const out: number[] = [];
  for (let col = 0; col < s.colIds.length; col++) {
    const id = topOf(s, col);
    if (id >= 0 && !isLocked(s, id)) out.push(col);
  }
  return out;
}

/** いま打てる手＝列の番号（注文に合う皿。置き台に空きがあれば合わない皿も） */
export function legalMoves(s: QState): number[] {
  if (s.served >= s.stage.orders.length) return [];
  const room = s.bench.length < s.stage.bench;
  return movable(s).filter((col) => room || seatFor(s, s.items[topOf(s, col)].c) >= 0);
}

/** 'stuck'＝打てる手が無い（ゲームオーバー） */
export function status(s: QState): PlayStatus {
  if (s.served >= s.stage.orders.length) return 'cleared';
  return legalMoves(s).length ? 'playing' : 'stuck';
}

/**
 * 列 col の一番上の皿を取る。打てない手なら null。
 * frames を渡すと、演出用に途中の状態を順に積む。
 */
export function apply(s0: QState, col: number, frames: Frame[] | null = null): QState | null {
  if (s0.served >= s0.stage.orders.length) return null;
  const id = topOf(s0, col);
  if (id < 0 || isLocked(s0, id)) return null;
  const seat = seatFor(s0, s0.items[id].c);
  if (seat < 0 && s0.bench.length >= s0.stage.bench) return null;

  const s = clone(s0);
  s.moves++;
  s.top[col]++;
  if (seat >= 0) s.seats[seat].got.push(id); else s.bench.push(id);
  frames?.push({ step: { k: 'take', id, col, to: seat >= 0 ? 'seat' : 'bench', seat }, state: clone(s) });
  settle(s, frames);
  return s;
}

/** 注文がそろったお客さんを帰し、次のお客さんを座らせ、置き台から合う皿を渡す（連鎖）。落ち着くまで繰り返す */
function settle(s: QState, frames: Frame[] | null) {
  const { orders } = s.stage;
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < s.seats.length; i++) {
      const seat = s.seats[i];
      if (seat.order < 0 || seat.got.length < orders[seat.order].n) continue;
      const done = { order: seat.order, ids: seat.got };
      s.served++;
      s.seats[i] = { order: -1, got: [] };
      frames?.push({ step: { k: 'leave', seat: i, order: done.order, ids: done.ids }, state: clone(s) });
      if (s.next < orders.length) {
        s.seats[i] = { order: s.next++, got: [] };
        frames?.push({ step: { k: 'sit', seat: i, order: s.seats[i].order }, state: clone(s) });
      }
      changed = true;
    }
    for (let j = 0; j < s.bench.length; ) {
      const b = s.bench[j];
      const to = seatFor(s, s.items[b].c);
      if (to >= 0) {
        s.bench.splice(j, 1);
        s.seats[to].got.push(b);
        frames?.push({ step: { k: 'pull', id: b, seat: to }, state: clone(s) });
        changed = true;
      } else j++;
    }
  }
}

/** 探索用の局面キー（同じ列の残り・席・置き台の色構成なら同じ局面） */
export function stateKey(s: QState): string {
  const b = s.bench.map((id) => s.items[id].c).sort();
  const seats = s.seats.map((x) => `${x.order}.${x.got.length}`).join(',');
  return s.top.join(',') + '|' + seats + '|' + s.next + '|' + b.join('');
}

/** ステージデータの整合性（各色の皿の数が注文の合計と一致するか など）。問題の一覧を返す */
export function validateStage(st: QueueStage): string[] {
  const errs: string[] = [];
  if (!(st.rows >= 1)) errs.push('rows が不正');
  if (!(st.seats >= 1)) errs.push('seats が不正');
  if (st.bench < 1) errs.push('置き台が無い');
  const count = new Map<number, number>();
  for (const col of st.cols) for (const p of col) count.set(p.c, (count.get(p.c) ?? 0) + 1);
  const need = new Map<number, number>();
  for (const o of st.orders) {
    if (!(o.n >= 1)) errs.push(`注文の皿数が不正 ${o.n}`);
    need.set(o.c, (need.get(o.c) ?? 0) + o.n);
  }
  for (const c of new Set([...count.keys(), ...need.keys()])) {
    if ((count.get(c) ?? 0) !== (need.get(c) ?? 0)) errs.push(`色${c}: 皿${count.get(c) ?? 0}枚 / 注文${need.get(c) ?? 0}枚`);
  }
  return errs;
}

export const queueMode: GameMode<QueueStage, QState, number> = {
  id: 'queue',
  name: '行列整理',
  init,
  legalMoves,
  apply: (s, m) => apply(s, m),
  status,
};
