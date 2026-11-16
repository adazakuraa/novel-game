// UI・操作性の自動テスト（Playwright、スマホ画面）。
// 先に `npm run build` してから `npm run puzzle:e2e`。ビルド済みの dist/puzzle を配信して確かめる。
import { chromium, devices, type Page } from 'playwright';
import { preview } from 'vite';
import { fileURLToPath } from 'node:url';
import { rng } from '../src/core/mode';
import { apply, init, legalMoves, status, topOf, type QueueStage } from '../src/modes/queue/rules';
import { Solver } from '../src/modes/queue/solver';
import data from '../stages/queue.json';

const stages = data as QueueStage[];
const only = process.env.E2E_STAGES ? Number(process.env.E2E_STAGES) : stages.length;

let failed = 0;
async function test(name: string, fn: () => Promise<void>) {
  const t = Date.now();
  try { await fn(); console.log(`✓ ${name} (${Date.now() - t}ms)`); }
  catch (e) { failed++; console.log(`✗ ${name}\n  ${(e as Error).message}`); }
}
function assert(cond: unknown, msg: string): asserts cond { if (!cond) throw new Error(msg); }

const server = await preview({ configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)), preview: { port: 0, strictPort: false } });
const url = server.resolvedUrls!.local[0];
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function newPage(device = devices['iPhone 13']) {
  const page = await browser.newPage({ ...device });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { page, errors };
}
async function setProgress(page: Page, cleared: number[], current?: unknown) {
  await page.evaluate(([c, cur]) => localStorage.setItem('omachido.v1', JSON.stringify({ v: 1, modes: { queue: { cleared: c, current: cur } }, settings: { speed: 'normal' } })), [cleared, current] as const);
}
/** 列 col のいちばん上のお皿をタップする */
const tapCell = (page: Page, col: number) => page.locator(`.item[data-top][data-col="${col}"]`).dispatchEvent('pointerdown');
const visiblePlates = (st: QueueStage) => st.cols.reduce((a, c) => a + Math.min(c.length, st.rows), 0);
async function startStage(page: Page, n: number, q = '?anim=0') {
  await page.goto(url + q);
  await setProgress(page, Array.from({ length: n - 1 }, (_, i) => i + 1));
  await page.reload();
  await page.getByRole('button', { name: `ステージ ${n} から` }).click();
  if (stages[n - 1].intro) await page.getByRole('button', { name: 'はじめる' }).click();
}

await test('タイトル：エラーなく表示され、横にはみ出さない（320/390/412px）', async () => {
  for (const dev of [devices['iPhone SE'], devices['iPhone 13'], devices['Pixel 7']]) {
    const { page, errors } = await newPage(dev);
    await page.goto(url);
    await page.getByText('おまちどう').first().waitFor();
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert(w[0] <= w[1], `横スクロールが出ている ${w}`);
    assert(errors.length === 0, errors.join('\n'));
    await page.close();
  }
});

await test('最大のステージでも盤面が画面内に収まり、ボタンは押しやすい大きさ', async () => {
  for (const dev of [devices['iPhone SE'], devices['iPhone 13'], devices['Galaxy S9+']]) {
    const { page } = await newPage(dev);
    await startStage(page, stages.length);
    const r = await page.evaluate(() => {
      const vis = [...document.querySelectorAll('.item[data-col]')].map((e) => e.getBoundingClientRect());
      const btn = [...document.querySelectorAll('button')].map((e) => e.getBoundingClientRect());
      return {
        maxRight: Math.max(...vis.map((b) => b.right)), maxBottom: Math.max(...vis.map((b) => b.bottom)),
        minCust: Math.min(...vis.map((b) => b.width)), minBtn: Math.min(...btn.map((b) => Math.min(b.width, b.height))),
        W: innerWidth, H: innerHeight,
      };
    });
    assert(r.maxRight <= r.W && r.maxBottom <= r.H, `盤面がはみ出している ${JSON.stringify(r)}`);
    assert(r.minCust >= 30, `お皿が小さすぎる ${r.minCust}px`);
    assert(r.minBtn >= 44, `ボタンが小さすぎる ${r.minBtn}px`);
    await page.close();
  }
});

await test('遊び方の説明 → いちばん上のお皿をタップすると取れて列が上がる → 下のお皿は取れない', async () => {
  const { page, errors } = await newPage();
  await page.goto(url + '?anim=0');
  await page.getByRole('button', { name: 'ステージ 1 から' }).click();
  await page.getByText('あそびかた').waitFor();
  await page.getByRole('button', { name: 'はじめる' }).click();
  const s0 = init(stages[0]);
  // いちばん上でないお皿は取れない
  const under = s0.colIds[0][1];
  await page.locator(`.item[data-id="${under}"]`).dispatchEvent('pointerdown');
  assert(await page.locator(`.item[data-id="${under}"][data-col="0"]`).count() === 1, '取れないお皿が動いた');
  const mv = legalMoves(s0)[0];
  const topId = topOf(s0, mv);
  await tapCell(page, mv);
  assert(await page.locator(`.item[data-id="${topId}"][data-col]`).count() === 0, 'タップしたお皿が盤面に残っている');
  assert(await page.locator(`.item[data-id="${s0.colIds[mv][1]}"][data-top]`).count() === 1, '列が1段上がっていない');
  assert(errors.length === 0, errors.join('\n'));
  await page.close();
});

await test('演出ありで素早く連打してもクリアできる（演出の早送り）', async () => {
  const { page, errors } = await newPage();
  await startStage(page, 5, '');
  const sol = new Solver().solve(init(stages[4]))!;
  for (const c of sol) { await tapCell(page, c); await page.waitForTimeout(30); }
  await page.getByText('ごちそうさま！').waitFor({ timeout: 5000 });
  assert(errors.length === 0, errors.join('\n'));
  await page.close();
});

/** 打てる手が無くなるまで進む手順（無作為に打って、負ける手順が見つかるまで探す） */
function losingMoves(st: QueueStage): number[] {
  for (let seed = 1; seed < 500; seed++) {
    const r = rng(seed);
    let s = init(st);
    const out: number[] = [];
    for (let moves = legalMoves(s); moves.length; moves = legalMoves(s)) {
      const m = r.pick(moves);
      out.push(m);
      s = apply(s, m)!;
    }
    if (status(s) === 'stuck') return out;
  }
  throw new Error('負ける手順が見つからない');
}

await test('打てる手が無くなるとゲームオーバー → 「最初からやり直す」で初期の盤面に戻る', async () => {
  const { page } = await newPage();
  await startStage(page, 8);
  const st = stages[7];
  for (const m of losingMoves(st)) await tapCell(page, m);
  await page.getByText('ゲームオーバー').waitFor();
  await page.locator('.card').getByRole('button', { name: '最初からやり直す' }).click();
  const n = await page.locator('.item[data-col]').count();
  assert(n === visiblePlates(st), `やり直し後のお皿の数が違う ${n}`);
  await page.close();
});

await test('演出中に連打しても、打てる手が無くなればゲームオーバーになる', async () => {
  const { page } = await newPage();
  await startStage(page, 8, '');
  const moves = losingMoves(stages[7]);
  for (const m of moves) { await tapCell(page, m); await page.waitForTimeout(20); }
  // 最後の手の演出中に、取れないお皿をさらにタップする
  await page.locator('.item.blocked').first().dispatchEvent('pointerdown').catch(() => {});
  await page.getByText('ゲームオーバー').waitFor({ timeout: 4000 });
  await page.close();
});

await test('途中で閉じても続きから再開できる / クリアすると次のステージが開く', async () => {
  const { page } = await newPage();
  await startStage(page, 2);
  const sol = new Solver().solve(init(stages[1]))!;
  await tapCell(page, sol[0]); await tapCell(page, sol[1]);
  await page.reload();
  await page.getByRole('button', { name: 'つづきから（ステージ 2）' }).click();
  const first = init(stages[1]).colIds[sol[0]][0];
  assert(await page.locator(`.item[data-id="${first}"][data-col]`).count() === 0, '再開時に手順が戻っていない');
  for (const c of sol.slice(2)) await tapCell(page, c);
  await page.getByText('ごちそうさま！').waitFor();
  await page.locator('.card').getByRole('button', { name: 'ステージ選択' }).click();
  assert(await page.locator('.stage.done').count() === 2, 'クリア済みの数が違う');
  assert(await page.getByRole('button', { name: 'ステージ3', exact: true }).isEnabled(), '次のステージが開いていない');
  assert(await page.getByRole('button', { name: 'ステージ4（未解放）' }).isDisabled(), '先のステージが開いている');
  await page.close();
});

await test(`全ステージを画面の操作でクリアできる（${only}面）`, async () => {
  const { page, errors } = await newPage();
  await startStage(page, 1);
  for (let n = 1; n <= only; n++) {
    const sol = new Solver().solve(init(stages[n - 1]))!;
    for (const c of sol) await tapCell(page, c);
    await page.getByText('ごちそうさま！').waitFor({ timeout: 3000 }).catch(() => { throw new Error(`ステージ${n}がクリアにならない`); });
    if (n < only) {
      await page.getByRole('button', { name: '次のステージへ' }).click();
      if (stages[n].intro) await page.getByRole('button', { name: 'はじめる' }).click();
    }
  }
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('omachido.v1')!).modes.queue.cleared.length);
  assert(saved === only, `保存されたクリア数 ${saved}`);
  assert(errors.length === 0, errors.join('\n'));
  await page.close();
});

await browser.close();
await new Promise<void>((r) => server.httpServer.close(() => r()));
console.log(failed ? `\n${failed} 件失敗` : '\nすべて成功');
process.exit(failed ? 1 : 0);
