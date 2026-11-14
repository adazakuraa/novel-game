// コンテンツ（イベント・行動・NPC・敵・依頼）のデータ形式。
import type { GameState, Line, RelAxis, Txt } from './types';

export type Cond = (s: GameState) => boolean;
export type Effect = (s: GameState) => void;

/** 台詞・地の文。関数なら状態に応じて変化する。null を返す行は表示しない */
export type LineDef = Line | ((s: GameState) => Line | Line[] | null);

export interface ChoiceDef {
  text: Txt;
  cond?: Cond;
  effect?: Effect;
  next?: string | ((s: GameState) => string);
  /** 選ぶとその場で表示される一言（主人公の発言として地の文に残す） */
  say?: Txt;
}

export interface NodeDef {
  lines: LineDef[];
  effect?: Effect; // ノード表示時に一度だけ
  choices?: ChoiceDef[];
  next?: string | ((s: GameState) => string);
  /** イベントを終える。advance で時間帯を進める。slots で消費する時間帯の数 */
  end?: { advance?: boolean; slots?: number };
}

export interface EventDef {
  id: string;
  /** slot: 時間帯の開始時 / after: 行動の後 / manual: 他から呼ばれる */
  trigger: 'slot' | 'after' | 'manual';
  cond?: Cond;
  priority?: number; // 高いほど優先。同順位は抽選
  weight?: number;
  once?: boolean;
  cooldown?: number; // 日数
  /** 複数の時間帯を使う行動の途中でも割り込んで発生する（大事件用） */
  interrupt?: boolean;
  start?: string;
  nodes: Record<string, NodeDef>;
}

export interface FocusDef {
  id: string;
  label: string;
  cond?: Cond;
}

export interface MethodDef {
  id: string;
  label: string;
  desc: string;
  cond?: Cond;
  slots?: number; // 消費する時間帯（既定1）
  focuses?: FocusDef[];
  companions?: boolean;
  /** 夜に行うと睡眠の質が下がる */
  late?: boolean;
  run: (s: GameState, ctx: { focus?: string; companion?: string }) => Line[];
}

export interface ActivityDef {
  id: string;
  loc: string;
  label: string;
  cond?: Cond;
  methods: MethodDef[];
  /** 状況によって変わる方法（依頼の掲示板、店の品揃えなど） */
  dynamic?: (s: GameState) => MethodDef[];
}

export interface LocationDef {
  id: string;
  name: string;
  desc: Txt;
  cond?: Cond;
  /** 時間帯ごとに開いているか */
  open?: (slot: number, s: GameState) => boolean;
}

export interface TopicDef {
  id: string;
  label: Txt;
  cond?: Cond;
  /** 一度きり（それ以外は日をおけば繰り返し可） */
  once?: boolean;
  /** 話題を選んだときの内容。イベントノードとして再生される */
  node: NodeDef;
  extraNodes?: Record<string, NodeDef>;
}

export interface NpcDef {
  id: string;
  name: string;
  /** 主人公からの呼び方が変化する場合 */
  displayName?: (s: GameState) => string;
  where: (s: GameState) => string | null; // 現在いる場所
  profile: (s: GameState) => string[]; // 主人公が知っている範囲の人物像
  topics: TopicDef[];
  /** 会話開始時の一言 */
  greet: (s: GameState) => Line[];
}

export interface EnemyIntent {
  id: string;
  /** 予兆の描写 [曖昧, はっきり] */
  tell: [string, string];
  /** 正体（予兆がはっきり読めた場合に添える） */
  read: string;
  type: 'heavy' | 'light' | 'reposition' | 'retreat' | 'call' | 'wait';
  power?: number; // 威力係数
  range: number; // この距離以内で有効
  weight: (dist: number, hpRatio: number) => number;
}

export interface EnemyDef {
  id: string;
  name: string;
  loreKey: string; // 魔物学の経験記録キー
  level: number; // 難しさ（成長の難易度評価に使う）
  hp: number;
  power: number;
  speed: number;
  armor: number;
  intro: string;
  intents: EnemyIntent[];
  /** 体力の割合に応じた描写 */
  state: (ratio: number) => string;
  fleeAt?: number; // 体力の割合がこれを下回ると逃げることがある
  loot?: { item: string; chance: number }[];
}

export interface QuestDef {
  id: string;
  title: string;
  summary: Txt;
  rankMin: number;
  reward: number;
  days: number; // 期限
  cond?: Cond;
  /** 出発時に再生するイベントID */
  depart: string;
  giver?: string;
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  price?: number;
  use?: { label: string; inCombat?: boolean; run: (s: GameState) => string };
}

export type { RelAxis };
