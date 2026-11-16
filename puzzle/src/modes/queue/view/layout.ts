// 画面上の配置。カウンター・お客さんの行列・置き台・盤面をひとつの座標系に置くことで、
// 皿やお客さんがどこからどこへ移っても同じ要素のまま滑らかに動かせる。
import type { QState, QueueStage } from '../rules';

export interface Pt { x: number; y: number; scale?: number; opacity?: number }

export interface Layout {
  W: number; H: number;
  s: number;                     // マス1つの大きさ(px)
  maxN: number;                  // 1人の注文の最大皿数
  counter: { x: number; y: number; w: number; h: number };
  guest: Pt;                     // いまのお客さんの位置（左上）
  guestSize: number;
  seat(i: number): Pt;           // お客さんの前に置く皿 i 枚目
  chip(k: number): Pt;           // このあとのお客さん k 人目（0=次）
  chipSize: number;
  strip: { x: number; y: number; w: number; h: number };
  benchBox: { x: number; y: number; w: number; h: number };
  bench(j: number): Pt;
  board: { x: number; y: number; w: number; h: number };
  cell(i: number): Pt;
  gone: Pt;                      // 帰ったお客さん・食べ終えた皿の行き先
}

const PAD = 12;
const GAP = 1.06;                // 席どうしの間隔（s 倍）

export function computeLayout(st: QueueStage, W: number, H: number): Layout {
  const maxN = Math.max(...st.orders.map((o) => o.n));
  const cols = Math.max(st.w, st.bench * GAP + 0.3, 1.5 + maxN * GAP + 0.3);
  const total = st.orders.length;
  let s = 76;
  let chipSize = 0, perRow = 1, stripH = 0;
  for (; s > 22; s--) {
    if (s * cols > W - PAD * 2) continue;
    chipSize = Math.max(26, Math.round(s * 0.62));
    perRow = Math.max(1, Math.floor((W - PAD * 2) / (chipSize + 4)));
    const rows = Math.ceil(Math.max(1, total - 1) / perRow);
    stripH = 16 + rows * (chipSize + 4);
    const need = s * 1.5 + 8 + stripH + 28 + s * 1.3 + 12 + s * 0.42 + st.h * s + PAD;
    if (need <= H) break;
  }

  let y = 4;
  const counter = { x: PAD, y, w: W - PAD * 2, h: s * 1.5 };
  const guestSize = s * 1.3;
  const rowW = guestSize + s * 0.25 + maxN * s * GAP;
  const rowX = (W - rowW) / 2;
  const guest = { x: rowX, y: y + (counter.h - guestSize) / 2 };
  const seatX = rowX + guestSize + s * 0.25;
  const seatY = y + (counter.h - s) / 2;
  y += counter.h + 8;

  const strip = { x: PAD, y, w: W - PAD * 2, h: stripH };
  const stripRowW = Math.min(Math.max(1, total - 1), perRow) * (chipSize + 4) - 4;
  const chipX0 = (W - stripRowW) / 2;
  y += stripH + 28;   // 置き台の見出しの分もあける

  const benchW = st.bench * s * GAP - (GAP - 1) * s;
  const benchBox = { x: (W - benchW) / 2 - 8, y, w: benchW + 16, h: s * 1.3 };
  const benchX = (W - benchW) / 2;
  const benchY = y + s * 0.15;
  y += s * 1.3 + 12;

  const exitH = s * 0.42;
  const board = { x: (W - st.w * s) / 2, y: y + exitH, w: st.w * s, h: st.h * s };

  return {
    W, H, s, maxN,
    counter, guest, guestSize,
    seat: (i) => ({ x: seatX + i * s * GAP, y: seatY }),
    chip: (k) => ({ x: chipX0 + (k % perRow) * (chipSize + 4), y: strip.y + 16 + Math.floor(k / perRow) * (chipSize + 4) }),
    chipSize,
    strip,
    benchBox,
    bench: (j) => ({ x: benchX + j * s * GAP, y: benchY }),
    board,
    cell: (i) => ({ x: board.x + (i % st.w) * s, y: board.y + Math.floor(i / st.w) * s }),
    gone: { x: W + s, y: seatY, opacity: 0 },
  };
}

export type Where =
  | { k: 'board'; cell: number }
  | { k: 'seat'; i: number }
  | { k: 'bench'; i: number }
  | { k: 'hidden'; tunnel: number }   // のれんの中（まだ出てきていない）
  | { k: 'done' };

/** 各皿がいまどこにあるか */
export function whereAll(s: QState): Where[] {
  const out: Where[] = s.items.map(() => ({ k: 'done' }) as Where);
  s.board.forEach((id, cell) => { if (id >= 0) out[id] = { k: 'board', cell }; });
  s.got.forEach((id, i) => { out[id] = { k: 'seat', i }; });
  s.bench.forEach((id, i) => { out[id] = { k: 'bench', i }; });
  for (const t of s.tunnels) for (let j = t.next; j < t.ids.length; j++) out[t.ids[j]] = { k: 'hidden', tunnel: t.cell };
  return out;
}

export function ptOf(L: Layout, w: Where): Pt {
  switch (w.k) {
    case 'board': return L.cell(w.cell);
    case 'seat': return L.seat(w.i);
    case 'bench': return L.bench(w.i);
    case 'hidden': return { ...L.cell(w.tunnel), scale: 0.3, opacity: 0 };
    case 'done': return L.gone;
  }
}
