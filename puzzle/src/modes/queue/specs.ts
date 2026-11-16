// ステージの設計表。生成ツールはこの表から候補を作り、品質基準を満たすものだけを採用する。
// 全ステージ検証テストも同じ基準で確認する。
import type { Metrics } from './solver';

export interface Spec {
  w: number; h: number;
  colors: number;
  bench: number;
  /** 皿で埋めるマスの割合（のれんを除く） */
  fill: number;
  /** 1人のお客さんが注文する皿数の候補（既定は3） */
  sizes?: number[];
  tunnels?: number;     // のれんの数
  tunnelLen?: number;   // のれん1つに並ぶ皿の数
  locks?: number;       // 予約札の皿の数
  /** 素直な打ち手の勝率の目標範囲（難易度） */
  greedy: [number, number];
  intro?: string;
}

const S = (o: Spec) => o;
const V = [2, 3, 4];

export const SPECS: Spec[] = [
  // 1〜10：基本ルール（注文はいつも3皿）
  S({ w: 3, h: 3, colors: 2, bench: 4, fill: 1, greedy: [0.9, 1],
    intro: 'カウンターのお客さんが「このお寿司を○皿ほしい」と待っています。上が空いているお皿をタップすると、注文に合えばお客さんへ、合わなければ置き台へ。お皿は真上にしか動けません。打てる手がなくなったらゲームオーバーです。' }),
  S({ w: 4, h: 3, colors: 2, bench: 4, fill: 1, greedy: [0.8, 1] }),
  S({ w: 4, h: 4, colors: 3, bench: 4, fill: 0.95, greedy: [0.7, 1],
    intro: '注文がそろうとお客さんが帰り、次のお客さんが座ります。置き台に注文どおりのお皿があれば、自動で渡します。' }),
  S({ w: 5, h: 4, colors: 3, bench: 4, fill: 0.95, greedy: [0.6, 0.95] }),
  S({ w: 5, h: 4, colors: 3, bench: 4, fill: 1, greedy: [0.5, 0.9] }),
  S({ w: 5, h: 5, colors: 3, bench: 5, fill: 1, greedy: [0.4, 0.85] }),
  S({ w: 5, h: 5, colors: 4, bench: 5, fill: 1, greedy: [0.3, 0.7] }),
  S({ w: 6, h: 4, colors: 4, bench: 5, fill: 1, greedy: [0.25, 0.65] }),
  S({ w: 5, h: 5, colors: 4, bench: 5, fill: 1, greedy: [0.2, 0.55] }),
  S({ w: 6, h: 5, colors: 4, bench: 5, fill: 1, greedy: [0.1, 0.45] }),
  // 11〜20：注文の皿数がいろいろ（2〜4皿）
  S({ w: 4, h: 4, colors: 3, bench: 4, fill: 1, sizes: V, greedy: [0.6, 1],
    intro: 'これからは、お客さんによって注文する皿数が違います。' }),
  S({ w: 5, h: 4, colors: 3, bench: 4, fill: 1, sizes: V, greedy: [0.45, 0.9] }),
  S({ w: 5, h: 5, colors: 3, bench: 5, fill: 1, sizes: V, greedy: [0.35, 0.8] }),
  S({ w: 5, h: 5, colors: 4, bench: 5, fill: 1, sizes: V, greedy: [0.25, 0.7] }),
  S({ w: 6, h: 4, colors: 4, bench: 5, fill: 1, sizes: V, greedy: [0.2, 0.6] }),
  S({ w: 6, h: 5, colors: 4, bench: 5, fill: 1, sizes: V, greedy: [0.12, 0.5] }),
  S({ w: 6, h: 5, colors: 4, bench: 5, fill: 1, sizes: V, greedy: [0.08, 0.4] }),
  S({ w: 6, h: 6, colors: 5, bench: 6, fill: 1, sizes: V, greedy: [0.05, 0.35] }),
  S({ w: 7, h: 5, colors: 5, bench: 6, fill: 1, sizes: V, greedy: [0.03, 0.3] }),
  S({ w: 7, h: 6, colors: 5, bench: 6, fill: 1, sizes: V, greedy: [0.02, 0.25] }),
  // 21〜30：置き台が少ない
  S({ w: 4, h: 4, colors: 3, bench: 3, fill: 1, greedy: [0.5, 1],
    intro: 'このステージから置き台は3つ。置き台がいっぱいのときは、注文に合うお皿しか取れません。' }),
  S({ w: 5, h: 4, colors: 3, bench: 3, fill: 1, sizes: V, greedy: [0.35, 0.85] }),
  S({ w: 5, h: 5, colors: 3, bench: 4, fill: 1, sizes: V, greedy: [0.25, 0.75] }),
  S({ w: 5, h: 5, colors: 4, bench: 4, fill: 1, sizes: V, greedy: [0.2, 0.65] }),
  S({ w: 6, h: 4, colors: 4, bench: 4, fill: 1, sizes: V, greedy: [0.15, 0.55] }),
  S({ w: 6, h: 5, colors: 4, bench: 4, fill: 1, sizes: V, greedy: [0.1, 0.45] }),
  S({ w: 6, h: 5, colors: 4, bench: 4, fill: 1, sizes: V, greedy: [0.06, 0.4] }),
  S({ w: 6, h: 6, colors: 5, bench: 5, fill: 1, sizes: V, greedy: [0.04, 0.3] }),
  S({ w: 7, h: 5, colors: 5, bench: 5, fill: 1, sizes: V, greedy: [0.02, 0.25] }),
  S({ w: 7, h: 6, colors: 5, bench: 5, fill: 1, sizes: V, greedy: [0.01, 0.2] }),
  // 31〜40：のれん
  S({ w: 4, h: 4, colors: 3, bench: 4, fill: 1, tunnels: 1, tunnelLen: 3, greedy: [0.5, 1],
    intro: 'のれんの上のマスが空くと、のれんに見えている順番でお皿が出てきます。' }),
  S({ w: 5, h: 4, colors: 3, bench: 4, fill: 1, sizes: V, tunnels: 1, tunnelLen: 3, greedy: [0.35, 0.9] }),
  S({ w: 5, h: 5, colors: 3, bench: 5, fill: 1, sizes: V, tunnels: 1, tunnelLen: 4, greedy: [0.25, 0.8] }),
  S({ w: 5, h: 5, colors: 4, bench: 5, fill: 1, sizes: V, tunnels: 2, tunnelLen: 3, greedy: [0.2, 0.7] }),
  S({ w: 6, h: 4, colors: 4, bench: 5, fill: 1, sizes: V, tunnels: 2, tunnelLen: 3, greedy: [0.15, 0.6] }),
  S({ w: 6, h: 5, colors: 4, bench: 5, fill: 1, sizes: V, tunnels: 2, tunnelLen: 4, greedy: [0.1, 0.5] }),
  S({ w: 6, h: 5, colors: 4, bench: 4, fill: 1, sizes: V, tunnels: 1, tunnelLen: 4, greedy: [0.06, 0.4] }),
  S({ w: 6, h: 6, colors: 5, bench: 6, fill: 1, sizes: V, tunnels: 2, tunnelLen: 4, greedy: [0.04, 0.3] }),
  S({ w: 7, h: 5, colors: 5, bench: 6, fill: 1, sizes: V, tunnels: 2, tunnelLen: 3, greedy: [0.02, 0.25] }),
  S({ w: 7, h: 6, colors: 5, bench: 6, fill: 1, sizes: V, tunnels: 3, tunnelLen: 3, greedy: [0.01, 0.2] }),
  // 41〜50：予約札
  S({ w: 4, h: 4, colors: 3, bench: 4, fill: 1, locks: 2, greedy: [0.5, 1],
    intro: '札のついたお皿は、札の数だけお客さんが帰るまで取れません。' }),
  S({ w: 5, h: 4, colors: 3, bench: 4, fill: 1, sizes: V, locks: 2, greedy: [0.35, 0.9] }),
  S({ w: 5, h: 5, colors: 3, bench: 5, fill: 1, sizes: V, locks: 3, greedy: [0.25, 0.8] }),
  S({ w: 5, h: 5, colors: 4, bench: 5, fill: 1, sizes: V, locks: 3, greedy: [0.2, 0.7] }),
  S({ w: 6, h: 4, colors: 4, bench: 5, fill: 1, sizes: V, locks: 3, greedy: [0.15, 0.6] }),
  S({ w: 6, h: 5, colors: 4, bench: 5, fill: 1, sizes: V, tunnels: 1, tunnelLen: 3, locks: 3, greedy: [0.1, 0.5] }),
  S({ w: 6, h: 5, colors: 4, bench: 4, fill: 1, sizes: V, locks: 3, greedy: [0.06, 0.4] }),
  S({ w: 6, h: 6, colors: 5, bench: 6, fill: 1, sizes: V, tunnels: 1, tunnelLen: 4, locks: 4, greedy: [0.04, 0.3] }),
  S({ w: 7, h: 5, colors: 5, bench: 6, fill: 1, sizes: V, locks: 4, greedy: [0.02, 0.25] }),
  S({ w: 7, h: 6, colors: 5, bench: 6, fill: 1, sizes: V, tunnels: 1, tunnelLen: 4, locks: 4, greedy: [0.01, 0.2] }),
  // 51〜60：総仕上げ（素直に打つだけではほぼ勝てない。解けること・複数解法・罠の上限は保証）
  S({ w: 6, h: 6, colors: 5, bench: 6, fill: 1, sizes: V, tunnels: 1, tunnelLen: 4, locks: 2, greedy: [0, 0.15] }),
  S({ w: 7, h: 5, colors: 5, bench: 5, fill: 1, sizes: V, tunnels: 2, tunnelLen: 3, locks: 2, greedy: [0, 0.15] }),
  S({ w: 7, h: 6, colors: 5, bench: 6, fill: 1, sizes: V, tunnels: 2, tunnelLen: 3, locks: 3, greedy: [0, 0.12] }),
  S({ w: 7, h: 6, colors: 5, bench: 5, fill: 1, sizes: V, tunnels: 1, tunnelLen: 4, locks: 3, greedy: [0, 0.12] }),
  S({ w: 7, h: 6, colors: 6, bench: 6, fill: 1, sizes: V, tunnels: 2, tunnelLen: 4, locks: 3, greedy: [0, 0.1] }),
  S({ w: 7, h: 7, colors: 5, bench: 6, fill: 1, sizes: V, tunnels: 1, tunnelLen: 4, locks: 3, greedy: [0, 0.1] }),
  S({ w: 7, h: 7, colors: 5, bench: 6, fill: 1, sizes: V, tunnels: 2, tunnelLen: 3, locks: 4, greedy: [0, 0.08] }),
  S({ w: 7, h: 7, colors: 6, bench: 6, fill: 1, sizes: V, tunnels: 2, tunnelLen: 4, locks: 3, greedy: [0, 0.08] }),
  S({ w: 7, h: 7, colors: 6, bench: 6, fill: 1, sizes: V, tunnels: 2, tunnelLen: 4, locks: 4, greedy: [0, 0.06] }),
  S({ w: 7, h: 7, colors: 6, bench: 6, fill: 1, sizes: V, tunnels: 3, tunnelLen: 3, locks: 4, greedy: [0, 0.05] }),
];

/** 品質の計測条件（生成と全ステージ検証で同じにする） */
export const MEASURE = { runs: 150, budget: 200_000 };

/** 品質基準。満たさない項目の一覧を返す（空なら合格） */
export function check(spec: Spec, m: Metrics, index: number): string[] {
  const e: string[] = [];
  if (!m.solvable) return ['解けない'];
  const minDistinct = index < 2 ? 1 : index < 10 ? 2 : 3;
  if (m.distinct < minDistinct) e.push(`解法が${m.distinct}通り（${minDistinct}以上が必要）`);
  if (m.firstAll > 1 && m.firstWin < 2) e.push(`最初の一手で勝ち筋に残れる手が${m.firstWin}つだけ`);
  if (m.greedyWin < spec.greedy[0] || m.greedyWin > spec.greedy[1]) e.push(`難易度（素直な打ち手の勝率 ${m.greedyWin}）が範囲外 [${spec.greedy}]`);
  const maxTrap = index < 20 ? 8 : index < 50 ? 12 : 16;
  if (m.trapDepth > maxTrap) e.push(`罠が深すぎる（詰みが確定してから${m.trapDepth}手打てる。上限${maxTrap}）`);
  return e;
}
