// ステージ生成ツール。 npx tsx puzzle/tools/gen-queue.ts [開始番号] [終了番号]
// 設計表の各行について、シードを変えながら候補を作り、品質基準を満たした候補のうち
// 難易度の目標範囲の中央に最も近いものを採用して puzzle/stages/queue.json に書き出す。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { rng } from '../src/core/mode';
import { generate } from '../src/modes/queue/generator';
import { validateStage, type QueueStage } from '../src/modes/queue/rules';
import { measure, SolverBudgetError, type Metrics } from '../src/modes/queue/solver';
import { check, MEASURE, SPECS } from '../src/modes/queue/specs';

const OUT = new URL('../stages/queue.json', import.meta.url);
const from = Number(process.argv[2] ?? 1), to = Number(process.argv[3] ?? SPECS.length);
const WANT = 4;          // 合格候補をいくつ集めてから選ぶか
const TRIES = 400;

const stages: QueueStage[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).filter(Boolean) : [];
const report: string[] = [];

for (let idx = from - 1; idx < to; idx++) {
  const spec = SPECS[idx];
  const mid = (spec.greedy[0] + spec.greedy[1]) / 2;
  let best: { st: QueueStage; m: Metrics; seed: number } | null = null;
  let ok = 0;
  const why = new Map<string, number>();
  const t0 = Date.now();
  for (let t = 0; t < TRIES && ok < WANT; t++) {
    const st = generate(spec, idx + 1, rng((idx + 1) * 100_003 + t));
    if (validateStage(st).length) { why.set('不正', (why.get('不正') ?? 0) + 1); continue; }
    let m: Metrics | null;
    const gate = (g: number) => g >= spec.greedy[0] && g <= spec.greedy[1];
    try { m = measure(st, { ...MEASURE, seed: t, gate }); }
    catch (e) { if (e instanceof SolverBudgetError) { why.set('探索上限', (why.get('探索上限') ?? 0) + 1); continue; } throw e; }
    if (!m) { why.set('難易度', (why.get('難易度') ?? 0) + 1); continue; }
    const errs = check(spec, m, idx);
    if (errs.length) { for (const x of errs) { const k = x.replace(/[\d.]+/g, '#'); why.set(k, (why.get(k) ?? 0) + 1); } continue; }
    ok++;
    if (!best || Math.abs(m.greedyWin - mid) < Math.abs(best.m.greedyWin - mid)) best = { st, m, seed: t };
  }
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  if (!best) {
    report.push(`#${idx + 1} 失敗 (${sec}s) ${[...why].map(([k, v]) => `${k}:${v}`).join(' / ')}`);
  } else {
    stages[idx] = { ...best.st, seed: best.seed };
    const m = best.m;
    report.push(`#${idx + 1} ok (${sec}s) [${[...why].map(([k, v]) => `${k}:${v}`).join(" / ")}] 客${m.customers} 解法${m.distinct} 初手${m.firstWin}/${m.firstAll} 素直${m.greedyWin.toFixed(2)} 無作為${m.randomWin.toFixed(2)} 罠${m.trapDepth} 余裕${m.minSlack}`);
  }
  console.log(report[report.length - 1]);
}

writeFileSync(OUT, '[\n' + Array.from(stages, (s) => JSON.stringify(s ?? null)).join(',\n') + '\n]\n');
if (report.some((x) => x.includes('失敗'))) process.exitCode = 1;
