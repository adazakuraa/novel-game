// 設計表（Spec）から、ステージの候補を1つ作る。品質の判定はしない（solver.measure と specs.check で行う）。
import type { Rng } from '../../core/mode';
import { neighbor, SEATS, type Dir, type QueueStage, type StageCell } from './rules';
import type { Spec } from './specs';

export function generate(spec: Spec, id: number, r: Rng): QueueStage {
  const { w, h } = spec;
  const n = w * h;
  const cells: (StageCell | 'free')[] = Array(n).fill('free');

  // 柱：最上段には置かない
  for (let k = 0, guard = 0; k < (spec.walls ?? 0) && guard < 1000; guard++) {
    const i = w + r.int(n - w);
    if (cells[i] !== 'free') continue;
    cells[i] = { wall: true };
    k++;
  }

  // のれん：最上段以外。出口のマスは柱・のれん以外
  const tunnelCells: { i: number; d: Dir }[] = [];
  for (let k = 0, guard = 0; k < (spec.tunnels ?? 0) && guard < 1000; guard++) {
    const i = w + r.int(n - w);
    if (cells[i] !== 'free' || tunnelCells.some((t) => neighbor(w, h, t.i, t.d) === i)) continue;
    const dirs = (['u', 'l', 'r', 'd'] as Dir[]).filter((d) => {
      const j = neighbor(w, h, i, d);
      return j >= 0 && cells[j] === 'free' && !tunnelCells.some((t) => neighbor(w, h, t.i, t.d) === j);
    });
    if (!dirs.length) continue;
    const d = r.pick(dirs);
    cells[i] = { tunnel: d, queue: [] };
    tunnelCells.push({ i, d });
    k++;
  }

  const free = cells.map((c, i) => (c === 'free' ? i : -1)).filter((i) => i >= 0);
  const tunnelSlots = tunnelCells.length * (spec.tunnelLen ?? 0);
  let total = Math.floor((free.length * spec.fill + tunnelSlots) / SEATS) * SEATS;
  total = Math.max(total, spec.colors * SEATS);

  // 色ごとの客数（3の倍数。なるべく均等）
  const counts = Array(spec.colors).fill(SEATS);
  for (let left = total - spec.colors * SEATS; left > 0; left -= SEATS) counts[r.int(spec.colors)] += SEATS;
  const pool: number[] = [];
  counts.forEach((k, c) => { for (let j = 0; j < k; j++) pool.push(c); });
  r.shuffle(pool);

  for (const t of tunnelCells) {
    const cell = cells[t.i] as { tunnel: Dir; queue: number[] };
    for (let j = 0; j < (spec.tunnelLen ?? 0) && pool.length; j++) cell.queue.push(pool.pop()!);
  }
  r.shuffle(free);
  const custCells: number[] = [];
  for (const i of free) {
    if (!pool.length) { cells[i] = null; continue; }
    cells[i] = { c: pool.pop()! };
    custCells.push(i);
  }

  // 皿の順番
  const dishes: number[] = [];
  counts.forEach((k, c) => { for (let j = 0; j < k / SEATS; j++) dishes.push(c); });
  r.shuffle(dishes);

  // 予約札：最上段から遠めの客に
  const lockable = custCells.filter((i) => i >= w);
  r.shuffle(lockable);
  for (const i of lockable.slice(0, spec.locks ?? 0)) {
    const c = cells[i] as { c: number; lock?: number };
    c.lock = 1 + r.int(Math.max(1, Math.floor(dishes.length / 2)));
  }

  return {
    id,
    w, h,
    cells: cells.map((c) => (c === 'free' ? null : c)),
    dishes,
    bench: spec.bench,
    ...(spec.intro ? { intro: spec.intro } : {}),
  };
}
