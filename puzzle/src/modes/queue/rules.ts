// Bus Jam型（行列整理）のルール本体。副作用のない純粋関数だけで書く。
// UI・ソルバー・テストはすべてこの実装を使う（表示と検証でルールがずれないように）。
//
// 寿司テーマでの見え方：盤面＝お寿司の皿、注文＝カウンターのお客さん（「このネタを n 皿ほしい」）、
// 置き台＝合わない皿を一時的に置く場所。皿は真上にしか動けない。
import type { GameMode, PlayStatus } from '../../core/mode';

export type Dir = 'u' | 'd' | 'l' | 'r';

/** ステージの1マス。null=空き */
export type StageCell =
  | null
  | { wall: true }
  | { c: number; lock?: number }          // 皿。lock=この人数の注文が済むまで取れない（予約札）
  | { tunnel: Dir; queue: number[] };     // のれん：隣のマスが空くと queue の順に皿が出てくる

/** 注文：色 c の皿を n 枚 */
export interface Order { c: number; n: number }

export interface QueueStage {
  id: number;
  w: number;
  h: number;
  cells: StageCell[];   // 行優先、0行目が出口側（上）
  orders: Order[];      // 注文の順番（お客さんの行列）
  bench: number;        // 置き台の数
  intro?: string;       // 新しい要素の説明
  seed?: number;        // 品質を計測したときの乱数シード（検証の再現用）
}

export interface Item { c: number; lock: number }

export interface Tunnel { cell: number; spawn: number; ids: number[]; next: number }

export const EMPTY = -1, WALL = -2, TUNNEL = -3;

export interface QState {
  stage: QueueStage;
  items: Item[];        // 全部の皿（のれんの中の皿を含む）。id=添字
  board: number[];      // マス→皿id / EMPTY / WALL / TUNNEL
  tunnels: Tunnel[];
  order: number;        // いまの注文の番号（= 済んだ注文の数）
  got: number[];        // いまのお客さんに渡した皿
  bench: number[];      // 置き台の皿（左から）
  moves: number;
}

/** 1手の中の小さな出来事。演出用 */
export type Step =
  | { k: 'walk'; id: number; path: number[]; to: 'serve' | 'bench' }
  | { k: 'spawn'; id: number; tunnel: number; cell: number }
  | { k: 'orderDone'; order: number; ids: number[] }
  | { k: 'pull'; id: number };

export interface Frame { step: Step; state: QState }

const DIRV: Record<Dir, [number, number]> = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

export function neighbor(w: number, h: number, cell: number, d: Dir): number {
  const x = (cell % w) + DIRV[d][0], y = Math.floor(cell / w) + DIRV[d][1];
  return x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x;
}

export function init(stage: QueueStage): QState {
  const items: Item[] = [];
  const board: number[] = [];
  const tunnels: Tunnel[] = [];
  stage.cells.forEach((cell, i) => {
    if (cell === null) board.push(EMPTY);
    else if ('wall' in cell) board.push(WALL);
    else if ('tunnel' in cell) {
      board.push(TUNNEL);
      const ids = cell.queue.map((c) => items.push({ c, lock: 0 }) - 1);
      tunnels.push({ cell: i, spawn: neighbor(stage.w, stage.h, i, cell.tunnel), ids, next: 0 });
    } else {
      board.push(items.push({ c: cell.c, lock: cell.lock ?? 0 }) - 1);
    }
  });
  const s: QState = { stage, items, board, tunnels, order: 0, got: [], bench: [], moves: 0 };
  spawnAll(s, null);
  return s;
}

function clone(s: QState): QState {
  return {
    ...s,
    board: s.board.slice(),
    tunnels: s.tunnels.map((t) => ({ ...t })),
    got: s.got.slice(),
    bench: s.bench.slice(),
  };
}

function spawnAll(s: QState, frames: Frame[] | null) {
  let again = true;
  while (again) {
    again = false;
    for (const t of s.tunnels) {
      if (t.spawn >= 0 && s.board[t.spawn] === EMPTY && t.next < t.ids.length) {
        const id = t.ids[t.next++];
        s.board[t.spawn] = id;
        again = true;
        frames?.push({ step: { k: 'spawn', id, tunnel: t.cell, cell: t.spawn }, state: clone(s) });
      }
    }
  }
}

/** 真上のマスがすべて空いているか（皿は上にしか動けない） */
export function clearAbove(s: QState, cell: number): boolean {
  const w = s.stage.w;
  for (let j = cell - w; j >= 0; j -= w) if (s.board[j] !== EMPTY) return false;
  return true;
}

/** その皿が出口へ向かう道（自分のマス→…→最上段のマス） */
export function pathUp(w: number, cell: number): number[] {
  const path: number[] = [];
  for (let j = cell; j >= 0; j -= w) path.push(j);
  return path;
}

export const isLocked = (s: QState, id: number) => s.items[id].lock > s.order;

export const currentOrder = (s: QState): Order | undefined => s.stage.orders[s.order];

/** 取り出せる皿のマス（真上が空いていて、予約札が外れている） */
export function movable(s: QState): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.board.length; i++) {
    const id = s.board[i];
    if (id >= 0 && !isLocked(s, id) && clearAbove(s, i)) out.push(i);
  }
  return out;
}

/** いま打てる手（取り出せる皿のうち、注文に合う皿。置き台に空きがあれば合わない皿も） */
export function legalMoves(s: QState): number[] {
  const o = currentOrder(s);
  if (!o) return [];
  const room = s.bench.length < s.stage.bench;
  return movable(s).filter((i) => room || s.items[s.board[i]].c === o.c);
}

/** 'stuck'＝打てる手が無い（ゲームオーバー） */
export function status(s: QState): PlayStatus {
  if (s.order >= s.stage.orders.length) return 'cleared';
  return legalMoves(s).length ? 'playing' : 'stuck';
}

/**
 * マス cell の皿を取る。打てない手なら null。
 * frames を渡すと、演出用に途中の状態を順に積む。
 */
export function apply(s0: QState, cell: number, frames: Frame[] | null = null): QState | null {
  const o = currentOrder(s0);
  if (!o) return null;
  const id = s0.board[cell];
  if (id === undefined || id < 0 || isLocked(s0, id) || !clearAbove(s0, cell)) return null;
  const toServe = s0.items[id].c === o.c;
  if (!toServe && s0.bench.length >= s0.stage.bench) return null;

  const s = clone(s0);
  s.moves++;
  s.board[cell] = EMPTY;
  if (toServe) s.got.push(id); else s.bench.push(id);
  frames?.push({ step: { k: 'walk', id, path: pathUp(s.stage.w, cell), to: toServe ? 'serve' : 'bench' }, state: clone(s) });

  spawnAll(s, frames);

  // 注文の数がそろったらお客さんが帰り、次のお客さんへ。置き台に合う皿があれば自動で渡す（連鎖）
  const { orders } = s.stage;
  while (s.order < orders.length && s.got.length >= orders[s.order].n) {
    const done = s.got;
    s.got = [];
    s.order++;
    frames?.push({ step: { k: 'orderDone', order: s.order - 1, ids: done }, state: clone(s) });
    if (s.order >= orders.length) break;
    const want = orders[s.order];
    for (let i = 0; i < s.bench.length && s.got.length < want.n; ) {
      const b = s.bench[i];
      if (s.items[b].c === want.c) {
        s.bench.splice(i, 1);
        s.got.push(b);
        frames?.push({ step: { k: 'pull', id: b }, state: clone(s) });
      } else i++;
    }
  }
  return s;
}

/** 探索用の局面キー（同じ盤面・注文・置き台の色構成なら同じ局面） */
export function stateKey(s: QState): string {
  let k = '';
  for (const v of s.board) k += String.fromCharCode(v + 4);
  const b = s.bench.map((id) => s.items[id].c).sort();
  return k + '|' + s.order + '|' + s.got.length + '|' + b.join('');
}

/** ステージデータの整合性（各色の皿の数が注文の合計と一致するか など）。問題の一覧を返す */
export function validateStage(st: QueueStage): string[] {
  const errs: string[] = [];
  if (st.cells.length !== st.w * st.h) errs.push('cells の数が w*h と違う');
  const count = new Map<number, number>();
  const add = (c: number) => count.set(c, (count.get(c) ?? 0) + 1);
  st.cells.forEach((cell, i) => {
    if (!cell || 'wall' in cell) return;
    if ('tunnel' in cell) {
      cell.queue.forEach(add);
      const sp = neighbor(st.w, st.h, i, cell.tunnel);
      if (sp < 0) errs.push(`のれん ${i} の出口が盤面の外`);
      else if (st.cells[sp] && ('wall' in st.cells[sp]! || 'tunnel' in st.cells[sp]!)) errs.push(`のれん ${i} の出口がふさがっている`);
    } else add(cell.c);
  });
  const need = new Map<number, number>();
  for (const o of st.orders) {
    if (!(o.n >= 1)) errs.push(`注文の皿数が不正 ${o.n}`);
    need.set(o.c, (need.get(o.c) ?? 0) + o.n);
  }
  for (const c of new Set([...count.keys(), ...need.keys()])) {
    if ((count.get(c) ?? 0) !== (need.get(c) ?? 0)) errs.push(`色${c}: 皿${count.get(c) ?? 0}枚 / 注文${need.get(c) ?? 0}枚`);
  }
  if (st.bench < 1) errs.push('置き台が無い');
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
