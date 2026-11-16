// ゲームモード共通の型。モード固有のロジック（modes/*）と、共通UI・ステージ管理・保存（core, ui）をつなぐ。

export type PlayStatus = 'playing' | 'cleared' | 'full' | 'stuck';

/** 失敗の種類。'full' 待ち席が満席 / 'stuck' 打てる手が無い */
export const isFailed = (s: PlayStatus) => s === 'full' || s === 'stuck';

export interface GameMode<Stage, State, Move> {
  id: string;
  name: string;
  init(stage: Stage): State;
  legalMoves(state: State): Move[];
  /** 不正な手なら null（状態は変わらない） */
  apply(state: State, move: Move): State | null;
  status(state: State): PlayStatus;
}

/** 決定的な乱数（ステージ生成・テスト用。プレイ中には使わない） */
export function rng(seed: number) {
  let a = seed >>> 0 || 0x9e3779b9;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
    shuffle<T>(arr: T[]) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}
export type Rng = ReturnType<typeof rng>;
