// ステージの設計表。生成ツールはこの表から候補を作り、品質基準を満たすものだけを採用する。
// 全ステージ検証テストも同じ基準で確認する。
import type { Metrics } from './solver';

export interface Spec {
  w: number; h: number;
  colors: number;
  bench: number;
  /** 客で埋めるマスの割合（柱・のれんを除く） */
  fill: number;
  walls?: number;
  tunnels?: number;     // のれんの数
  tunnelLen?: number;   // のれん1つに並ぶ客の数
  locks?: number;       // 予約札の客の数
  /** 素直な打ち手の勝率の目標範囲（難易度） */
  greedy: [number, number];
  intro?: string;
}

const S = (o: Spec) => o;

export const SPECS: Spec[] = [
  // 1〜10：基本ルール
  S({ w: 3, h: 4, colors: 2, bench: 5, fill: 1, greedy: [0.9, 1],
    intro: '出口（上）まで空いたマスを通って行けるお客さんをタップ。いまの皿と同じ注文ならカウンターへ、違えば待ち席へ。待ち席が満席になったら負けです。' }),
  S({ w: 4, h: 4, colors: 2, bench: 5, fill: 0.75, greedy: [0.8, 1] }),
  S({ w: 4, h: 5, colors: 3, bench: 5, fill: 0.9, greedy: [0.7, 1],
    intro: '皿が3席埋まると次の皿が出ます。待ち席に次の注文のお客さんがいれば、自動でカウンターへ移ります。' }),
  S({ w: 5, h: 5, colors: 3, bench: 5, fill: 0.84, greedy: [0.6, 0.95] }),
  S({ w: 5, h: 5, colors: 3, bench: 5, fill: 0.96, greedy: [0.5, 0.9] }),
  S({ w: 5, h: 6, colors: 4, bench: 5, fill: 0.9, greedy: [0.5, 0.85] }),
  S({ w: 5, h: 6, colors: 4, bench: 5, fill: 1, greedy: [0.4, 0.8] }),
  S({ w: 6, h: 6, colors: 4, bench: 5, fill: 0.92, greedy: [0.35, 0.75] }),
  S({ w: 6, h: 6, colors: 4, bench: 5, fill: 1, greedy: [0.3, 0.7] }),
  S({ w: 6, h: 6, colors: 5, bench: 5, fill: 1, greedy: [0.25, 0.6] }),
  // 11〜20：柱
  S({ w: 5, h: 5, colors: 3, bench: 5, fill: 1, walls: 3, greedy: [0.6, 1], intro: '柱のマスは通れません。' }),
  S({ w: 5, h: 6, colors: 3, bench: 5, fill: 1, walls: 3, greedy: [0.45, 0.9] }),
  S({ w: 6, h: 6, colors: 4, bench: 5, fill: 1, walls: 3, greedy: [0.35, 0.8] }),
  S({ w: 6, h: 6, colors: 4, bench: 5, fill: 1, walls: 4, greedy: [0.3, 0.7] }),
  S({ w: 6, h: 7, colors: 4, bench: 5, fill: 1, walls: 3, greedy: [0.25, 0.65] }),
  S({ w: 6, h: 7, colors: 5, bench: 5, fill: 1, walls: 4, greedy: [0.2, 0.6] }),
  S({ w: 6, h: 7, colors: 5, bench: 5, fill: 1, walls: 5, greedy: [0.15, 0.55] }),
  S({ w: 7, h: 7, colors: 5, bench: 5, fill: 1, walls: 4, greedy: [0.12, 0.5] }),
  S({ w: 7, h: 7, colors: 5, bench: 5, fill: 1, walls: 6, greedy: [0.1, 0.45] }),
  S({ w: 7, h: 7, colors: 6, bench: 5, fill: 1, walls: 5, greedy: [0.08, 0.4] }),
  // 21〜30：待ち席が4席
  S({ w: 5, h: 5, colors: 3, bench: 4, fill: 1, greedy: [0.5, 1], intro: 'このステージから待ち席は4席。4席目が埋まると負けです。' }),
  S({ w: 5, h: 6, colors: 3, bench: 4, fill: 1, walls: 2, greedy: [0.4, 0.85] }),
  S({ w: 6, h: 6, colors: 4, bench: 4, fill: 1, walls: 2, greedy: [0.3, 0.75] }),
  S({ w: 6, h: 6, colors: 4, bench: 4, fill: 1, walls: 3, greedy: [0.25, 0.65] }),
  S({ w: 6, h: 7, colors: 4, bench: 4, fill: 1, walls: 3, greedy: [0.2, 0.6] }),
  S({ w: 6, h: 7, colors: 5, bench: 4, fill: 1, walls: 3, greedy: [0.15, 0.55] }),
  S({ w: 6, h: 7, colors: 5, bench: 4, fill: 1, walls: 4, greedy: [0.12, 0.5] }),
  S({ w: 7, h: 7, colors: 5, bench: 4, fill: 1, walls: 4, greedy: [0.1, 0.45] }),
  S({ w: 7, h: 7, colors: 5, bench: 4, fill: 1, walls: 5, greedy: [0.08, 0.4] }),
  S({ w: 7, h: 8, colors: 5, bench: 4, fill: 1, walls: 5, greedy: [0.05, 0.35] }),
  // 31〜40：のれん
  S({ w: 5, h: 5, colors: 3, bench: 5, fill: 1, tunnels: 1, tunnelLen: 3, greedy: [0.5, 1],
    intro: 'のれんの前のマスが空くと、のれんに見えている順番でお客さんが出てきます。' }),
  S({ w: 5, h: 6, colors: 3, bench: 5, fill: 1, tunnels: 1, tunnelLen: 4, walls: 1, greedy: [0.4, 0.9] }),
  S({ w: 6, h: 6, colors: 4, bench: 5, fill: 1, tunnels: 1, tunnelLen: 4, walls: 2, greedy: [0.3, 0.8] }),
  S({ w: 6, h: 6, colors: 4, bench: 5, fill: 1, tunnels: 2, tunnelLen: 3, walls: 2, greedy: [0.25, 0.7] }),
  S({ w: 6, h: 7, colors: 4, bench: 5, fill: 1, tunnels: 2, tunnelLen: 4, walls: 2, greedy: [0.2, 0.6] }),
  S({ w: 6, h: 7, colors: 5, bench: 5, fill: 1, tunnels: 2, tunnelLen: 4, walls: 3, greedy: [0.15, 0.55] }),
  S({ w: 6, h: 7, colors: 5, bench: 4, fill: 1, tunnels: 1, tunnelLen: 4, walls: 3, greedy: [0.12, 0.5] }),
  S({ w: 7, h: 7, colors: 5, bench: 5, fill: 1, tunnels: 2, tunnelLen: 4, walls: 4, greedy: [0.1, 0.45] }),
  S({ w: 7, h: 7, colors: 5, bench: 5, fill: 1, tunnels: 2, tunnelLen: 3, walls: 5, greedy: [0.08, 0.4] }),
  S({ w: 7, h: 8, colors: 6, bench: 5, fill: 1, tunnels: 2, tunnelLen: 4, walls: 4, greedy: [0.05, 0.35] }),
  // 41〜50：予約札
  S({ w: 5, h: 5, colors: 3, bench: 5, fill: 1, locks: 2, greedy: [0.5, 1],
    intro: '札のついたお客さんは、札の数だけ皿が下がるまで動けません。' }),
  S({ w: 5, h: 6, colors: 3, bench: 5, fill: 1, locks: 3, walls: 1, greedy: [0.4, 0.9] }),
  S({ w: 6, h: 6, colors: 4, bench: 5, fill: 1, locks: 3, walls: 2, greedy: [0.3, 0.8] }),
  S({ w: 6, h: 6, colors: 4, bench: 5, fill: 1, locks: 4, walls: 2, greedy: [0.25, 0.7] }),
  S({ w: 6, h: 7, colors: 4, bench: 4, fill: 1, locks: 3, walls: 3, greedy: [0.2, 0.6] }),
  S({ w: 6, h: 7, colors: 5, bench: 5, fill: 1, locks: 4, walls: 3, tunnels: 1, tunnelLen: 3, greedy: [0.15, 0.55] }),
  S({ w: 6, h: 7, colors: 5, bench: 4, fill: 1, locks: 4, walls: 3, greedy: [0.12, 0.5] }),
  S({ w: 7, h: 7, colors: 5, bench: 5, fill: 1, locks: 5, walls: 4, tunnels: 1, tunnelLen: 4, greedy: [0.1, 0.45] }),
  S({ w: 7, h: 7, colors: 5, bench: 4, fill: 1, locks: 4, walls: 4, greedy: [0.08, 0.4] }),
  S({ w: 7, h: 8, colors: 6, bench: 5, fill: 1, locks: 5, walls: 4, tunnels: 1, tunnelLen: 4, greedy: [0.05, 0.35] }),
  // 51〜60：総仕上げ（高難易度）
  S({ w: 7, h: 8, colors: 5, bench: 5, fill: 1, walls: 5, tunnels: 1, tunnelLen: 4, locks: 2, greedy: [0.05, 0.3] }),
  S({ w: 7, h: 8, colors: 6, bench: 5, fill: 1, walls: 5, tunnels: 2, tunnelLen: 3, greedy: [0.04, 0.3] }),
  S({ w: 7, h: 8, colors: 6, bench: 4, fill: 1, walls: 5, locks: 3, greedy: [0.03, 0.25] }),
  S({ w: 7, h: 8, colors: 6, bench: 5, fill: 1, walls: 6, tunnels: 2, tunnelLen: 4, locks: 3, greedy: [0.03, 0.25] }),
  S({ w: 7, h: 9, colors: 6, bench: 5, fill: 1, walls: 6, tunnels: 1, tunnelLen: 4, locks: 3, greedy: [0.02, 0.2] }),
  S({ w: 7, h: 8, colors: 6, bench: 5, fill: 1, walls: 6, tunnels: 2, tunnelLen: 3, locks: 2, greedy: [0.006, 0.12] }),
  S({ w: 7, h: 8, colors: 6, bench: 5, fill: 1, walls: 5, tunnels: 2, tunnelLen: 4, locks: 3, greedy: [0.006, 0.12] }),
  S({ w: 7, h: 9, colors: 6, bench: 5, fill: 1, walls: 6, tunnels: 1, tunnelLen: 4, locks: 3, greedy: [0.006, 0.1] }),
  S({ w: 7, h: 9, colors: 6, bench: 5, fill: 1, walls: 7, tunnels: 2, tunnelLen: 3, locks: 3, greedy: [0.006, 0.1] }),
  S({ w: 7, h: 9, colors: 6, bench: 5, fill: 1, walls: 6, tunnels: 2, tunnelLen: 3, locks: 4, greedy: [0.006, 0.1] }),
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
