// 設計表（Spec）から、ステージの候補を1つ作る。品質の判定はしない（solver.measure と specs.check で行う）。
import type { Rng } from '../../core/mode';
import type { Order, Plate, QueueStage } from './rules';
import type { Spec } from './specs';

export function generate(spec: Spec, id: number, r: Rng): QueueStage {
  // 列ごとの皿の枚数：depth ±1
  const sizes = spec.sizes ?? [3];
  const min = Math.min(...sizes);
  const heights = Array.from({ length: spec.w }, () => Math.max(1, spec.depth - 1 + r.int(3)));
  // 皿の総数を、注文の皿数の組み合わせで作れる数にそろえる（3皿だけなら3の倍数）
  const unit = sizes.reduce((a, b) => gcd(a, b));
  while (heights.reduce((a, b) => a + b, 0) % unit !== 0) heights[r.int(heights.length)]++;
  const total = heights.reduce((a, b) => a + b, 0);

  // 注文（お客さん）：皿数は spec.sizes から。合計がちょうど total になるように
  const orders: Order[] = [];
  let left = total;
  while (left > 0) {
    const fits = sizes.filter((k) => k === left || (k < left && left - k >= min));
    if (!fits.length) throw new Error(`注文の皿数で ${total} 枚を分けられない`);
    const k = r.pick(fits);
    const c = orders.length < spec.colors ? orders.length : r.int(spec.colors);
    orders.push({ c, n: k });
    left -= k;
  }
  r.shuffle(orders);

  const pool: number[] = [];
  for (const o of orders) for (let j = 0; j < o.n; j++) pool.push(o.c);
  r.shuffle(pool);
  const cols: Plate[][] = heights.map((hh) => pool.splice(0, hh).map((c) => ({ c })));

  // 予約札：最初から見えている皿（一番上を除く）にだけ付ける。見えない皿の札は分からないので使わない
  const lockable: Plate[] = [];
  for (const col of cols) lockable.push(...col.slice(1, spec.rows));
  r.shuffle(lockable);
  for (const p of lockable.slice(0, spec.locks ?? 0)) p.lock = 1 + r.int(Math.max(1, Math.floor(orders.length / 2)));

  return {
    id,
    cols,
    rows: spec.rows,
    orders,
    seats: spec.seats ?? 1,
    bench: spec.bench,
    ...(spec.intro ? { intro: spec.intro } : {}),
  };
}

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }
