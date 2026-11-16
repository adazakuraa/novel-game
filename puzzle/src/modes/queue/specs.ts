// ステージの設計表。生成ツールはこの表から候補を作り、品質基準を満たすものだけを採用する。
// 全ステージ検証テストも同じ基準で確認する。
import type { Metrics } from './solver';

export interface Spec {
  w: number;            // 列の数
  rows: number;         // 盤面に大きく見せる段数
  depth: number;        // 1列あたりの皿の数（±1）。rows を超える分は見えない（下から出てくる）
  colors: number;
  bench: number;
  seats?: number;       // カウンターに同時に座るお客さん（既定1）
  /** 1人のお客さんが注文する皿数の候補（既定は3） */
  sizes?: number[];
  locks?: number;       // 予約札の皿の数
  /** 難易度の目標：正解の手の割合（低いほど難しい）。この値の ±GOOD_TOL の範囲で採用する */
  good: number;
  intro?: string;
}

export const GOOD_TOL = 0.03;

const S = (o: Spec) => o;
const V = [2, 3, 4];

export const SPECS: Spec[] = [
  // 1〜10：基本（注文はいつも3皿、お客さんは1人ずつ）
  S({ w: 3, rows: 3, depth: 3, colors: 2, bench: 3, good: 0.95,
    intro: 'カウンターのお客さんが「このお皿を○枚ほしい」と待っています。各列のいちばん上のお皿をタップすると、注文に合えばお客さんへ、合わなければ置き台へ。置き台がいっぱいのときは、注文に合うお皿しか取れません。打てる手がなくなったらゲームオーバーです。' }),
  S({ w: 4, rows: 3, depth: 3, colors: 2, bench: 3, good: 0.92 }),
  S({ w: 4, rows: 3, depth: 4, colors: 3, bench: 3, good: 0.92,
    intro: 'お皿を取ると列が1段上がり、下から次のお皿が出てきます。何が出てくるかは分かりませんが、見えているお皿だけで考えれば、必ずクリアできるように作ってあります。' }),
  S({ w: 4, rows: 4, depth: 5, colors: 3, bench: 3, good: 0.9 }),
  S({ w: 4, rows: 4, depth: 5, colors: 3, bench: 3, good: 0.88 }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 4, good: 0.87 }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 4, good: 0.85 }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 3, good: 0.84 }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 4, good: 0.83 }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 3, good: 0.82 }),
  // 11〜20：注文の皿数がいろいろ（2〜4枚）
  S({ w: 4, rows: 4, depth: 5, colors: 3, bench: 3, sizes: V, good: 0.88,
    intro: 'これからは、お客さんによって注文する枚数が違います。' }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 4, sizes: V, good: 0.86 }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 4, sizes: V, good: 0.85 }),
  S({ w: 5, rows: 5, depth: 6, colors: 4, bench: 4, sizes: V, good: 0.84 }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 3, sizes: V, good: 0.83 }),
  S({ w: 5, rows: 5, depth: 6, colors: 4, bench: 4, sizes: V, good: 0.82 }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 3, sizes: V, good: 0.81 }),
  S({ w: 5, rows: 5, depth: 6, colors: 4, bench: 4, sizes: V, good: 0.8 }),
  S({ w: 5, rows: 5, depth: 6, colors: 4, bench: 3, sizes: V, good: 0.79 }),
  S({ w: 5, rows: 5, depth: 6, colors: 4, bench: 3, sizes: V, good: 0.78 }),
  // 21〜30：お客さんが2人同時に座る
  S({ w: 4, rows: 4, depth: 5, colors: 3, bench: 3, seats: 2, sizes: V, good: 0.88,
    intro: 'カウンターにお客さんが2人座ります。取ったお皿は、注文の合うお客さんへ渡ります（2人とも同じなら左の人へ）。' }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 3, seats: 2, sizes: V, good: 0.86 }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 3, seats: 2, sizes: V, good: 0.84 }),
  S({ w: 5, rows: 4, depth: 5, colors: 5, bench: 3, seats: 2, sizes: V, good: 0.83 }),
  S({ w: 5, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, good: 0.82 }),
  S({ w: 5, rows: 4, depth: 5, colors: 5, bench: 3, seats: 2, sizes: V, good: 0.81 }),
  S({ w: 5, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, good: 0.8 }),
  S({ w: 5, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, good: 0.79 }),
  S({ w: 5, rows: 4, depth: 5, colors: 5, bench: 3, seats: 2, sizes: V, good: 0.78 }),
  S({ w: 5, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, good: 0.77 }),
  // 31〜40：予約札
  S({ w: 4, rows: 4, depth: 5, colors: 3, bench: 3, locks: 2, good: 0.87,
    intro: '札のついたお皿は、札の人数だけお客さんが帰るまで取れません。' }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 4, sizes: V, locks: 2, good: 0.85 }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 3, seats: 2, sizes: V, locks: 2, good: 0.84 }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 4, sizes: V, locks: 3, good: 0.83 }),
  S({ w: 5, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 3, good: 0.82 }),
  S({ w: 5, rows: 4, depth: 5, colors: 4, bench: 3, sizes: V, locks: 2, good: 0.81 }),
  S({ w: 5, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 3, good: 0.8 }),
  S({ w: 5, rows: 5, depth: 6, colors: 4, bench: 4, sizes: V, locks: 3, good: 0.79 }),
  S({ w: 5, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 4, good: 0.78 }),
  S({ w: 5, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 4, good: 0.77 }),
  // 41〜50：6列
  S({ w: 6, rows: 4, depth: 5, colors: 4, bench: 3, seats: 2, sizes: V, good: 0.85,
    intro: 'お皿の列が6列になります。' }),
  S({ w: 6, rows: 4, depth: 5, colors: 5, bench: 3, seats: 2, sizes: V, good: 0.83 }),
  S({ w: 6, rows: 4, depth: 5, colors: 4, bench: 4, sizes: V, good: 0.82 }),
  S({ w: 6, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, good: 0.81 }),
  S({ w: 6, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 2, good: 0.8 }),
  S({ w: 6, rows: 4, depth: 5, colors: 5, bench: 3, seats: 2, sizes: V, good: 0.79 }),
  S({ w: 6, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 3, good: 0.78 }),
  S({ w: 6, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, good: 0.77 }),
  S({ w: 6, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 3, good: 0.76 }),
  S({ w: 6, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 3, good: 0.75 }),
  // 51〜60：総仕上げ
  S({ w: 5, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 3, good: 0.76 }),
  S({ w: 6, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 3, good: 0.75 }),
  S({ w: 5, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 4, good: 0.75 }),
  S({ w: 6, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 4, good: 0.74 }),
  S({ w: 6, rows: 5, depth: 6, colors: 6, bench: 3, seats: 2, sizes: V, locks: 3, good: 0.74 }),
  S({ w: 5, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 4, good: 0.73 }),
  S({ w: 6, rows: 5, depth: 6, colors: 6, bench: 3, seats: 2, sizes: V, locks: 4, good: 0.73 }),
  S({ w: 6, rows: 5, depth: 6, colors: 5, bench: 3, seats: 2, sizes: V, locks: 4, good: 0.72 }),
  S({ w: 6, rows: 5, depth: 6, colors: 6, bench: 3, seats: 2, sizes: V, locks: 4, good: 0.72 }),
  S({ w: 6, rows: 5, depth: 6, colors: 6, bench: 3, seats: 2, sizes: V, locks: 5, good: 0.71 }),
  // 61〜200：新しいギミックは足さず、これまでの要素の組み合わせを10面ずつの帯で回す
  ...moreStages(),
];

/**
 * 61〜200面の設計表。帯の種類は「お客さん1人」「お客さん2人」「予約札」「6列」。
 * 周回（lap）が進むほど予約札・色・段数を増やし、各帯の中では目標の難しさを少しずつ上げる（帯の最初は少しやさしい）。
 * 目標の下限は、見えている情報だけで解ける盤面が作れる範囲（生成時の計測による）に合わせている。
 */
function moreStages(): Spec[] {
  const order = ['solo', 'duo', 'lock', 'wide', 'solo', 'duo', 'lock', 'wide', 'solo', 'duo', 'lock', 'wide', 'lock', 'wide'] as const;
  const out: Spec[] = [];
  order.forEach((kind, band) => {
    const lap = Math.floor(band / 4);              // 0〜3
    for (let k = 0; k < 10; k++) {
      const t = k / 9;                             // 帯の中の進み具合 0→1
      const rows = k % 2 === 0 || lap >= 2 ? 5 : 4;
      const base = { rows, depth: rows + 1, sizes: V };
      const good = (hi: number, lo: number) => Math.round((hi - (hi - lo) * t - lap * 0.003) * 1000) / 1000;
      switch (kind) {
        case 'solo':
          out.push(S({ ...base, w: 5, colors: 4, bench: k % 3 === 2 ? 4 : 3, locks: Math.min(3, lap + (k >= 5 ? 1 : 0)), good: good(0.86, 0.78) }));
          break;
        case 'duo':
          out.push(S({ ...base, w: 5, colors: lap >= 2 && k >= 5 ? 6 : 5, bench: 3, seats: 2, locks: lap, good: good(0.85, 0.73) }));
          break;
        case 'lock':
          out.push(S({ ...base, w: k % 2 ? 6 : 5, colors: 5, bench: 3, seats: 2, locks: Math.min(6, 3 + lap + (k >= 5 ? 1 : 0)), good: good(0.84, 0.72) }));
          break;
        case 'wide':
          out.push(S({ ...base, rows: 5, depth: 6, w: 6, colors: k >= 5 || lap >= 2 ? 6 : 5, bench: 3, seats: 2, locks: Math.min(5, 1 + lap + (k >= 5 ? 1 : 0)), good: good(0.83, 0.7) }));
          break;
      }
    }
  });
  return out;
}

/** 品質の計測条件（生成と全ステージ検証で同じにする） */
export const MEASURE = { runs: 100, budget: 300_000 };

/** 品質基準。満たさない項目の一覧を返す（空なら合格） */
export function check(spec: Spec, m: Metrics, index: number): string[] {
  const e: string[] = [];
  if (!m.solvable) return ['見えている情報だけでは解けない'];
  const minDistinct = index < 2 ? 1 : index < 10 ? 2 : 3;
  if (m.distinct < minDistinct) e.push(`解法が${m.distinct}通り（${minDistinct}以上が必要）`);
  if (m.firstAll > 1 && m.firstWin < 2) e.push(`最初の一手で勝ち筋に残れる手が${m.firstWin}つだけ`);
  if (Math.abs(m.goodRatio - spec.good) > GOOD_TOL) e.push(`難易度（正解の手の割合 ${m.goodRatio.toFixed(3)}）が目標 ${spec.good}±${GOOD_TOL} の範囲外`);
  const maxTrap = index < 20 ? 10 : index < 50 ? 15 : 20;
  if (m.trapDepth > maxTrap) e.push(`罠が深すぎる（詰みが確定してから${m.trapDepth}手打てる。上限${maxTrap}）`);
  return e;
}
