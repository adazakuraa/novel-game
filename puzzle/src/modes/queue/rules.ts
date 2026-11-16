// Bus Jam型（行列整理）のルール本体。副作用のない純粋関数だけで書く。
// UI・ソルバー・テストはすべてこの実装を使う（表示と検証でルールがずれないように）。
import type { GameMode, PlayStatus } from '../../core/mode';

export const SEATS = 3;

export type Dir = 'u' | 'd' | 'l' | 'r';

/** ステージの1マス。null=空き */
export type StageCell =
  | null
  | { wall: true }
  | { c: number; lock?: number }          // 客。lock=この枚数の皿が下がるまで動けない（予約札）
  | { tunnel: Dir; queue: number[] };     // のれん：隣のマスが空くと queue の順に客が出てくる

export interface QueueStage {
  id: number;
  w: number;
  h: number;
  cells: StageCell[];   // 行優先、0行目が出口側（上）
  dishes: number[];     // 皿（注文）の順番。色番号
  bench: number;        // 待ち席の数。満席になったら負け
  intro?: string;       // 新しい要素の説明
  seed?: number;        // 品質を計測したときの乱数シード（検証の再現用）
}

export interface Cust { c: number; lock: number }

export interface Tunnel { cell: number; spawn: number; ids: number[]; next: number }

export const EMPTY = -1, WALL = -2, TUNNEL = -3;

export interface QState {
  stage: QueueStage;
  custs: Cust[];        // 全客（のれんの中の客を含む）。id=添字
  board: number[];      // マス→客id / EMPTY / WALL / TUNNEL
  tunnels: Tunnel[];
  dish: number;         // いま出ている皿の番号（= 下がった皿の枚数）
  seats: number[];      // いまの皿に座っている客id
  bench: number[];      // 待ち席の客id（左から）
  moves: number;
}

/** 1手の中の小さな出来事。演出用 */
export type Step =
  | { k: 'walk'; id: number; path: number[]; to: 'seat' | 'bench' }
  | { k: 'spawn'; id: number; tunnel: number; cell: number }
  | { k: 'dishDone'; dish: number; ids: number[] }
  | { k: 'pull'; id: number };

export interface Frame { step: Step; state: QState }

const DIRV: Record<Dir, [number, number]> = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

export function neighbor(w: number, h: number, cell: number, d: Dir): number {
  const x = (cell % w) + DIRV[d][0], y = Math.floor(cell / w) + DIRV[d][1];
  return x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x;
}

export function init(stage: QueueStage): QState {
  const custs: Cust[] = [];
  const board: number[] = [];
  const tunnels: Tunnel[] = [];
  stage.cells.forEach((cell, i) => {
    if (cell === null) board.push(EMPTY);
    else if ('wall' in cell) board.push(WALL);
    else if ('tunnel' in cell) {
      board.push(TUNNEL);
      const ids = cell.queue.map((c) => custs.push({ c, lock: 0 }) - 1);
      tunnels.push({ cell: i, spawn: neighbor(stage.w, stage.h, i, cell.tunnel), ids, next: 0 });
    } else {
      board.push(custs.push({ c: cell.c, lock: cell.lock ?? 0 }) - 1);
    }
  });
  const s: QState = { stage, custs, board, tunnels, dish: 0, seats: [], bench: [], moves: 0 };
  spawnAll(s, null);
  return s;
}

function clone(s: QState): QState {
  return {
    ...s,
    board: s.board.slice(),
    tunnels: s.tunnels.map((t) => ({ ...t })),
    seats: s.seats.slice(),
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

/**
 * 出口（上辺）から空きマスだけを通ってたどり着ける客のマスと、その道。
 * 戻り値 parent[cell]：その客／空きマスに入る直前のマス（-1=出口から直接）。到達不能は -2。
 */
export function reach(s: QState): Int16Array {
  const { w, h } = s.stage;
  const parent = new Int16Array(w * h).fill(-2);
  const queue: number[] = [];
  for (let x = 0; x < w; x++) {
    const v = s.board[x];
    if (v === WALL || v === TUNNEL) continue;
    parent[x] = -1;
    if (v === EMPTY) queue.push(x);
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi];
    const x = i % w, y = (i - x) / w;
    const ns = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of ns) {
      if (j < 0 || parent[j] !== -2) continue;
      const v = s.board[j];
      if (v === WALL || v === TUNNEL) continue;
      parent[j] = i;
      if (v === EMPTY) queue.push(j);
    }
  }
  return parent;
}

/** その客が出口へ向かう道（自分のマス→…→最上段のマス） */
export function pathFrom(parent: Int16Array, cell: number): number[] {
  const path = [cell];
  let p = parent[cell];
  while (p >= 0) { path.push(p); p = parent[p]; }
  return path;
}

export const isLocked = (s: QState, id: number) => s.custs[id].lock > s.dish;

/** 動かせる客のマス（道があり、予約札が外れている） */
export function movable(s: QState, parent = reach(s)): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.board.length; i++) {
    const id = s.board[i];
    if (id >= 0 && parent[i] !== -2 && !isLocked(s, id)) out.push(i);
  }
  return out;
}

export function status(s: QState): PlayStatus {
  if (s.dish >= s.stage.dishes.length) return 'cleared';
  if (s.bench.length >= s.stage.bench) return 'full';
  if (movable(s).length === 0) return 'stuck';
  return 'playing';
}

/** 打てる手（終局していれば空）。道の判定は1回だけ行う */
export function legalMoves(s: QState): number[] {
  if (s.dish >= s.stage.dishes.length || s.bench.length >= s.stage.bench) return [];
  return movable(s);
}

/** この手で待ち席へ行き、満席（負け）になるか */
export function losesNow(s: QState, cell: number): boolean {
  return s.custs[s.board[cell]].c !== s.stage.dishes[s.dish] && s.bench.length + 1 >= s.stage.bench;
}

/**
 * マス cell の客を動かす。動かせなければ null。
 * frames を渡すと、演出用に途中の状態を順に積む。
 */
export function apply(s0: QState, cell: number, frames: Frame[] | null = null): QState | null {
  if (s0.dish >= s0.stage.dishes.length || s0.bench.length >= s0.stage.bench) return null;
  const id = s0.board[cell];
  if (id === undefined || id < 0 || isLocked(s0, id)) return null;
  const parent = reach(s0);
  if (parent[cell] === -2) return null;

  const s = clone(s0);
  s.moves++;
  s.board[cell] = EMPTY;
  const { dishes } = s.stage;
  const toSeat = s.custs[id].c === dishes[s.dish];
  if (toSeat) s.seats.push(id); else s.bench.push(id);
  frames?.push({ step: { k: 'walk', id, path: pathFrom(parent, cell), to: toSeat ? 'seat' : 'bench' }, state: clone(s) });

  spawnAll(s, frames);

  // 皿が埋まったら下げて次の皿へ。待ち席から合う客が自動で移る（連鎖）
  while (s.seats.length >= SEATS) {
    const done = s.seats;
    s.seats = [];
    s.dish++;
    frames?.push({ step: { k: 'dishDone', dish: s.dish - 1, ids: done }, state: clone(s) });
    if (s.dish >= dishes.length) break;
    const want = dishes[s.dish];
    for (let i = 0; i < s.bench.length && s.seats.length < SEATS; ) {
      const b = s.bench[i];
      if (s.custs[b].c === want) {
        s.bench.splice(i, 1);
        s.seats.push(b);
        frames?.push({ step: { k: 'pull', id: b }, state: clone(s) });
      } else i++;
    }
  }
  return s;
}

/** 探索用の局面キー（同じ盤面・皿・待ち席の色構成なら同じ局面） */
export function stateKey(s: QState): string {
  let k = '';
  for (const v of s.board) k += String.fromCharCode(v + 4);
  const b = s.bench.map((id) => s.custs[id].c).sort();
  return k + '|' + s.dish + '|' + s.seats.length + '|' + b.join('');
}

/** ステージデータの整合性（各色の客数が皿の数×3 と一致するか など）。問題の一覧を返す */
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
  st.dishes.forEach((c) => need.set(c, (need.get(c) ?? 0) + SEATS));
  for (const c of new Set([...count.keys(), ...need.keys()])) {
    if ((count.get(c) ?? 0) !== (need.get(c) ?? 0)) errs.push(`色${c}: 客${count.get(c) ?? 0}人 / 皿${(need.get(c) ?? 0) / SEATS}枚`);
  }
  if (st.bench < 1) errs.push('待ち席が無い');
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
