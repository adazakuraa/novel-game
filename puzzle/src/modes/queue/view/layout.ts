// 画面上の配置。カウンター・お客さんの行列・置き台・盤面（列と厨房）をひとつの座標系に置くことで、
// 皿やお客さんがどこからどこへ移っても同じ要素のまま滑らかに動かせる。
import type { QState, QueueStage } from '../rules';

export interface Pt { x: number; y: number; scale?: number; opacity?: number }

export interface Layout {
  W: number; H: number;
  s: number;                     // 皿1枚（盤面の1マス）の大きさ(px)
  maxN: number;                  // 1人の注文の最大皿数
  counter: { x: number; y: number; w: number; h: number };
  guest(seat: number): Pt;       // 席に座っているお客さんの位置（左上）
  guestSize: number;
  slot(seat: number, i: number): Pt; // お客さんの前に置く皿 i 枚目
  chip(k: number): Pt;           // このあとのお客さん k 人目（0=次）
  chipSize: number;
  strip: { x: number; y: number; w: number; h: number };
  benchBox: { x: number; y: number; w: number; h: number };
  bench(j: number): Pt;
  board: { x: number; y: number; w: number; h: number };
  kitchen: { x: number; y: number; w: number; h: number } | null;
  /** 列 col の上から p 番目（0=一番上）の皿の位置。rows 段より下は見えない（盤面の下に隠す） */
  inCol(col: number, p: number): Pt;
  gone(seat: number): Pt;        // 帰ったお客さん・食べ終えた皿の行き先
}

const PAD = 12;
const GAP = 1.06;                // 席どうしの間隔（s 倍）

export function computeLayout(st: QueueStage, W: number, H: number): Layout {
  const maxN = Math.max(...st.orders.map((o) => o.n));
  const w = st.cols.length;
  const maxHidden = Math.max(0, ...st.cols.map((c) => c.length - st.rows));
  const cols = Math.max(w, st.bench * GAP + 0.3, 1.55 + maxN * GAP + 0.3);
  const waiting = Math.max(1, st.orders.length - st.seats);
  const rowH = 1.4;
  let s = 76;
  let chipSize = 0, perRow = 1, stripH = 0;
  for (; s > 22; s--) {
    if (s * cols > W - PAD * 2) continue;
    chipSize = Math.max(26, Math.round(s * 0.62));
    perRow = Math.max(1, Math.floor((W - PAD * 2) / (chipSize + 4)));
    stripH = 16 + Math.ceil(waiting / perRow) * (chipSize + 4);
    const kitchenH = maxHidden ? s * 0.45 : 0;
    const need = s * rowH * st.seats + 0.2 * s + 8 + stripH + 28 + s * 1.3 + 12 + s * 0.42 + st.rows * s + kitchenH + PAD;
    if (need <= H) break;
  }

  let y = 4;
  const counter = { x: PAD, y, w: W - PAD * 2, h: s * rowH * st.seats + 0.2 * s };
  const guestSize = s * 1.25;
  const rowW = guestSize + s * 0.3 + maxN * s * GAP;
  const rowX = (W - rowW) / 2;
  const counterY = y;
  const rowY = (seat: number) => counterY + 0.1 * s + seat * s * rowH;
  const guest = (seat: number) => ({ x: rowX, y: rowY(seat) + (s * rowH - guestSize) / 2 });
  const slot = (seat: number, i: number) => ({ x: rowX + guestSize + s * 0.3 + i * s * GAP, y: rowY(seat) + (s * rowH - s) / 2 });
  y += counter.h + 8;

  const strip = { x: PAD, y, w: W - PAD * 2, h: stripH };
  const stripRowW = Math.min(waiting, perRow) * (chipSize + 4) - 4;
  const chipX0 = (W - stripRowW) / 2;
  y += stripH + 28;   // 置き台の見出しの分もあける

  const benchW = st.bench * s * GAP - (GAP - 1) * s;
  const benchBox = { x: (W - benchW) / 2 - 8, y, w: benchW + 16, h: s * 1.3 };
  const benchX = (W - benchW) / 2;
  const benchY = y + s * 0.15;
  y += s * 1.3 + 12;

  const exitH = s * 0.42;
  const board = { x: (W - w * s) / 2, y: y + exitH, w: w * s, h: st.rows * s };
  const kitchen = maxHidden ? { x: board.x, y: board.y + board.h, w: board.w, h: s * 0.45 } : null;

  return {
    W, H, s, maxN,
    counter, guest, guestSize, slot,
    chip: (k) => ({ x: chipX0 + (k % perRow) * (chipSize + 4), y: strip.y + 16 + Math.floor(k / perRow) * (chipSize + 4) }),
    chipSize,
    strip,
    benchBox,
    bench: (j) => ({ x: benchX + j * s * GAP, y: benchY }),
    board,
    kitchen,
    inCol: (col, p) => p < st.rows
      ? { x: board.x + col * s, y: board.y + p * s }
      : { x: board.x + col * s + s * 0.2, y: board.y + board.h - s * 0.4, scale: 0.6, opacity: 0 },
    gone: (seat) => ({ x: W + s, y: rowY(seat), opacity: 0 }),
  };
}

export type Where =
  | { k: 'col'; col: number; p: number }
  | { k: 'seat'; seat: number; i: number }
  | { k: 'bench'; i: number }
  | { k: 'done' };

/** 各皿がいまどこにあるか */
export function whereAll(s: QState): Where[] {
  const out: Where[] = s.items.map(() => ({ k: 'done' }) as Where);
  s.colIds.forEach((ids, col) => { for (let j = s.top[col]; j < ids.length; j++) out[ids[j]] = { k: 'col', col, p: j - s.top[col] }; });
  s.seats.forEach((x, seat) => x.got.forEach((id, i) => { out[id] = { k: 'seat', seat, i }; }));
  s.bench.forEach((id, i) => { out[id] = { k: 'bench', i }; });
  return out;
}

export function ptOf(L: Layout, w: Where): Pt {
  switch (w.k) {
    case 'col': return L.inCol(w.col, w.p);
    case 'seat': return L.slot(w.seat, w.i);
    case 'bench': return L.bench(w.i);
    case 'done': return L.gone(0);
  }
}
