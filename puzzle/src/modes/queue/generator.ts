// 設計表（Spec）から、ステージの候補を1つ作る。品質の判定はしない（solver.measure と specs.check で行う）。
// 皿は真上にしか動けないので、各列の皿は下に詰めて置く（列＝皿の山）。
import type { Rng } from '../../core/mode';
import type { Order, QueueStage, StageCell } from './rules';
import type { Spec } from './specs';

export function generate(spec: Spec, id: number, r: Rng): QueueStage {
  const { w, h } = spec;
  const n = w * h;
  const cells: StageCell[] = Array(n).fill(null);

  // のれん：最下段に置き、真上へ皿を出す（その列の山の続きになる）
  const tunnelCols = r.shuffle(Array.from({ length: w }, (_, x) => x)).slice(0, spec.tunnels ?? 0);
  for (const x of tunnelCols) cells[(h - 1) * w + x] = { tunnel: 'u', queue: [] };

  const freeCount = n - tunnelCols.length;
  const tunnelSlots = tunnelCols.length * (spec.tunnelLen ?? 0);
  const target = Math.round(freeCount * spec.fill) + tunnelSlots;

  // 注文（お客さん）：皿数は spec.sizes から。全部の色が少なくとも1回は出る
  const sizes = spec.sizes ?? [3];
  const orders: Order[] = [];
  let sum = 0;
  for (let guard = 0; guard < 500; guard++) {
    const fits = sizes.filter((k) => sum + k <= target);
    if (!fits.length) break;
    const k = r.pick(fits);
    const c = orders.length < spec.colors ? orders.length : r.int(spec.colors);
    orders.push({ c, n: k });
    sum += k;
  }
  r.shuffle(orders);

  const pool: number[] = [];
  for (const o of orders) for (let j = 0; j < o.n; j++) pool.push(o.c);
  r.shuffle(pool);

  for (const x of tunnelCols) {
    const t = cells[(h - 1) * w + x] as { tunnel: 'u'; queue: number[] };
    for (let j = 0; j < (spec.tunnelLen ?? 0) && pool.length > 0; j++) t.queue.push(pool.pop()!);
  }

  // 残りの皿を列ごとの山にする：各列の高さを無作為に決めて下から詰める
  const heights = Array.from({ length: w }, (_, x) => (tunnelCols.includes(x) ? h - 1 : h));
  const fill = Array(w).fill(0);
  for (let left = pool.length; left > 0; left--) {
    const cols = heights.map((hh, x) => (fill[x] < hh ? x : -1)).filter((x) => x >= 0);
    if (!cols.length) break;
    fill[r.pick(cols)]++;
  }
  const itemCells: number[] = [];
  for (let x = 0; x < w; x++) {
    for (let k = 0; k < fill[x]; k++) {
      const y = heights[x] - 1 - k;
      const i = y * w + x;
      cells[i] = { c: pool.pop()! };
      itemCells.push(i);
    }
  }

  // 予約札：最上段以外の皿に
  const lockable = r.shuffle(itemCells.filter((i) => i >= w));
  for (const i of lockable.slice(0, spec.locks ?? 0)) {
    (cells[i] as { c: number; lock?: number }).lock = 1 + r.int(Math.max(1, Math.floor(orders.length / 2)));
  }

  return {
    id,
    w, h,
    cells,
    orders,
    bench: spec.bench,
    ...(spec.intro ? { intro: spec.intro } : {}),
  };
}
