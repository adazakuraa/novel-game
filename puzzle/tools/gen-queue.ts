// ステージ生成ツール。
//   npx tsx puzzle/tools/gen-queue.ts [開始番号] [終了番号]        … 生成して puzzle/stages/queue.json を更新
//   PART=1 npx tsx puzzle/tools/gen-queue.ts 11 20                 … 範囲だけ生成して部分ファイルに書く（並列実行用）
//   npx tsx puzzle/tools/gen-queue.ts merge                         … 部分ファイルを queue.json にまとめる
// 設計表の各行について、シードを変えながら候補を作り、品質基準を満たした候補のうち
// 難易度（正解の手の割合）が目標に最も近いものを採用する。
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { rng } from '../src/core/mode';
import { generate } from '../src/modes/queue/generator';
import { validateStage, type QueueStage } from '../src/modes/queue/rules';
import { measure, SolverBudgetError, type Metrics } from '../src/modes/queue/solver';
import { check, GOOD_TOL, MEASURE, SPECS } from '../src/modes/queue/specs';

const DIR = new URL('../stages/', import.meta.url);
const OUT = new URL('queue.json', DIR);
const WANT = 3;          // 合格候補をいくつ集めてから選ぶか
const TRIES = 1500;

const load = (): (QueueStage | null)[] => (existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : []);
const write = (stages: (QueueStage | null)[]) =>
  writeFileSync(OUT, '[\n' + Array.from(stages, (s) => JSON.stringify(s ?? null)).join(',\n') + '\n]\n');

if (process.argv[2] === 'merge') {
  const stages = load();
  for (const f of readdirSync(DIR).filter((x) => x.startsWith('queue.part-'))) {
    const part: Record<string, QueueStage> = JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
    for (const [i, st] of Object.entries(part)) stages[Number(i)] = st;
    unlinkSync(new URL(f, DIR));
  }
  write(stages.slice(0, SPECS.length));
  process.exit(stages.slice(0, SPECS.length).some((s) => !s) ? 1 : 0);
}

const from = Number(process.argv[2] ?? 1), to = Number(process.argv[3] ?? SPECS.length);
const out: Record<number, QueueStage> = {};
let failed = false;

for (let idx = from - 1; idx < to; idx++) {
  const spec = SPECS[idx];
  let best: { st: QueueStage; m: Metrics; seed: number } | null = null;
  let ok = 0;
  const why = new Map<string, number>();
  const bump = (k: string) => why.set(k, (why.get(k) ?? 0) + 1);
  const t0 = Date.now();
  for (let t = 0; t < TRIES && ok < WANT; t++) {
    const st = generate(spec, idx + 1, rng((idx + 1) * 100_003 + t));
    if (validateStage(st).length) { bump('不正'); continue; }
    let m: Metrics | null;
    const gate = (g: number) => Math.abs(g - spec.good) <= GOOD_TOL;
    try { m = measure(st, { ...MEASURE, seed: t, gate }); }
    catch (e) { if (e instanceof SolverBudgetError) { bump('探索上限'); continue; } throw e; }
    if (!m) { bump('難易度'); continue; }
    const errs = check(spec, m, idx);
    if (errs.length) { for (const x of errs) bump(x.replace(/[\d.]+/g, '#')); continue; }
    ok++;
    if (!best || Math.abs(m.goodRatio - spec.good) < Math.abs(best.m.goodRatio - spec.good)) best = { st, m, seed: t };
  }
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  const reasons = [...why].map(([k, v]) => `${k}:${v}`).join(' / ');
  if (!best) {
    failed = true;
    console.log(`#${idx + 1} 失敗 (${sec}s) ${reasons}`);
  } else {
    out[idx] = { ...best.st, seed: best.seed };
    const m = best.m;
    console.log(`#${idx + 1} ok (${sec}s) 皿${m.plates} 正解率${m.goodRatio.toFixed(3)} 解法${m.distinct} 初手${m.firstWin}/${m.firstAll} 素直${m.greedyWin.toFixed(2)} 無作為${m.randomWin.toFixed(2)} 罠${m.trapDepth} 余裕${m.minSlack}  [${reasons}]`);
  }
}

if (process.env.PART) {
  writeFileSync(new URL(`queue.part-${from}.json`, DIR), JSON.stringify(out));
} else {
  const stages = load();
  for (const [i, st] of Object.entries(out)) stages[Number(i)] = st;
  write(stages);
}
if (failed) process.exitCode = 1;
