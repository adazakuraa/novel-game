// 画面上の配置。カウンター・お客さんの行列・置き台・盤面（列と厨房）をひとつの座標系に置くことで、
// 皿やお客さんがどこからどこへ移っても同じ要素のまま滑らかに動かせる。
import type { QState, QueueStage } from '../rules';

export interface Pt { x: number; y: number; scale?: number; opacity?: number }

export interface Layout {
  W: number; H: number;
  s: number;                     // 皿1枚（盤面の1マス）の大きさ(px)
  u: number;                     // カウンター・置き台の席の大きさ(px)。盤面を大きくするため s より小さめ
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
  inSlot(p: { x: number; y: number }): Pt; // 席（大きさ u）の左上 p に、皿の要素（大きさ s）を置く位置
}

const PAD = 12;
const GAP = 1.06;                // 席どうしの間隔（s 倍）

export function computeLayout(st: QueueStage, W: number, H: number): Layout {
  const maxN = Math.max(...st.orders.map((o) => o.n));
  const w = st.cols.length;
  const maxHidden = Math.max(0, ...st.cols.map((c) => c.length - st.rows));
  const waiting = Math.max(1, st.orders.length - st.seats);
  const rowH = 1.4;
  // 盤面の皿の大きさ s を、幅と高さに収まる最大にする。カウンター・置き台・行列は u（s より小さめ）で描き、
  // 高さが足りない端末（上下にバーが出るブラウザなど）でも盤面が小さくなりすぎないようにする
  const unit = (s: number) => Math.max(26, Math.min(s * 0.78, 54));
  const upperCols = Math.max(st.bench * GAP + 0.3, 1.55 + maxN * GAP + 0.3);
  let s = 80, u = unit(s);
  let chipSize = 0, perRow = 1, stripH = 0;
  for (; s > 22; s--) {
    u = unit(s);
    if (s * w > W - PAD * 2 || u * upperCols > W - PAD * 2) continue;
    chipSize = Math.max(26, Math.round(u * 0.62));
    perRow = Math.max(1, Math.floor((W - PAD * 2) / (chipSize + 4)));
    stripH = 16 + Math.ceil(waiting / perRow) * (chipSize + 4);
    const kitchenH = maxHidden ? Math.max(18, s * 0.4) : 0;
    const need = u * rowH * st.seats + 0.2 * u + 6 + stripH + 24 + u * 1.3 + 8 + s * 0.42 + st.rows * s + kitchenH + 8;
    if (need <= H) break;
  }

  let y = 4;
  const counter = { x: PAD, y, w: W - PAD * 2, h: u * rowH * st.seats + 0.2 * u };
  const guestSize = u * 1.25;
  const rowW = guestSize + u * 0.3 + maxN * u * GAP;
  const rowX = (W - rowW) / 2;
  const counterY = y;
  const rowY = (seat: number) => counterY + 0.1 * u + seat * u * rowH;
  const guest = (seat: number) => ({ x: rowX, y: rowY(seat) + (u * rowH - guestSize) / 2 });
  const slot = (seat: number, i: number) => ({ x: rowX + guestSize + u * 0.3 + i * u * GAP, y: rowY(seat) + (u * rowH - u) / 2 });
  y += counter.h + 6;

  const strip = { x: PAD, y, w: W - PAD * 2, h: stripH };
  const stripRowW = Math.min(waiting, perRow) * (chipSize + 4) - 4;
  const chipX0 = (W - stripRowW) / 2;
  y += stripH + 24;   // 置き台の見出しの分もあける

  const benchW = st.bench * u * GAP - (GAP - 1) * u;
  const benchBox = { x: (W - benchW) / 2 - 8, y, w: benchW + 16, h: u * 1.3 };
  const benchX = (W - benchW) / 2;
  const benchY = y + u * 0.15;
  y += u * 1.3 + 8;

  const exitH = s * 0.42;
  const board = { x: (W - w * s) / 2, y: y + exitH, w: w * s, h: st.rows * s };
  const kitchen = maxHidden ? { x: board.x, y: board.y + board.h, w: board.w, h: Math.max(18, s * 0.4) } : null;
  // 皿の要素は大きさ s。席（大きさ u）に置くときは中心を合わせて縮める
  const inSlot = (p: { x: number; y: number }): Pt => ({ x: p.x + (u - s) / 2, y: p.y + (u - s) / 2, scale: u / s });

  return {
    W, H, s, u, maxN,
    counter, guest, guestSize, slot,
    chip: (k) => ({ x: chipX0 + (k % perRow) * (chipSize + 4), y: strip.y + 16 + Math.floor(k / perRow) * (chipSize + 4) }),
    chipSize,
    strip,
    benchBox,
    bench: (j) => ({ x: benchX + j * u * GAP, y: benchY }),
    board,
    kitchen,
    inCol: (col, p) => p < st.rows
      ? { x: board.x + col * s, y: board.y + p * s }
      : { x: board.x + col * s + s * 0.2, y: board.y + board.h - s * 0.4, scale: 0.6, opacity: 0 },
    gone: (seat) => ({ ...inSlot({ x: W + s, y: rowY(seat) }), opacity: 0 }),
    inSlot,
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
    case 'seat': return L.inSlot(L.slot(w.seat, w.i));
    case 'bench': return L.inSlot(L.bench(w.i));
    case 'done': return L.gone(0);
  }
}
