// ゲーム全体の型定義。数値はすべて内部用で、UIには直接表示しない。

export type AttrKey =
  | 'str' // 筋力
  | 'end' // 持久
  | 'agi' // 敏捷
  | 'dex' // 器用
  | 'will' // 意志
  | 'focus' // 集中
  | 'wit' // 分析・洞察
  | 'lore' // 知識・記憶
  | 'empathy' // 共感
  | 'speech'; // 弁舌

export type SkillKey = 'sword' | 'bow' | 'magic' | 'herb' | 'beast' | 'survival';
export type SkillAspect = 'p' | 't'; // practice（実技） / theory（理論）
export type SkillStat = `${SkillKey}_${SkillAspect}`;
export type StatKey = AttrKey | SkillStat;

export type LearnKind = 'practice' | 'theory' | 'combat' | 'mentor';

export type RelAxis = 'trust' | 'affinity' | 'respect' | 'debt' | 'wariness' | 'rivalry';

export type Gender = 'm' | 'f' | 'x';
export type Mode = 'standard' | 'ironman';

export interface Injury {
  id: string;
  label: string; // 「左腕の裂傷」など
  severity: 1 | 2 | 3; // 1軽傷 2重傷 3深手
  days: number; // 自然治癒までの残日数
  lasting?: boolean; // 後遺症（治療で解消可能）
}

export interface Memory {
  day: number;
  tag: string;
  note: string; // 主人公側の日誌に残る短い記述
}

export interface NpcState {
  met: boolean;
  rel: Record<RelAxis, number>;
  mood: number; // -50..50 その日の機嫌
  memories: Memory[];
  topicsUsed: Record<string, number>; // topicId -> day
  lastTalkDay: number;
  dailyBudget: { day: number; used: number };
  alive: boolean;
  away: number; // >0 の間は街にいない（日数）
}

export interface Line {
  who?: string; // 話者（NPC id か表示名）。未指定は地の文
  text: string;
}

export interface JournalEntry {
  day: number;
  text: string[];
  kind?: 'day' | 'insight' | 'event';
}

export interface CombatState {
  enemyId: string;
  enemyHp: number;
  enemyMaxHp: number;
  dist: number; // 0密着 1近 2中 3遠
  turn: number;
  intent: string; // 敵の次の行動
  observed: boolean; // 観察済み（予兆が鮮明になる）
  edge: number; // +なら主人公が有利、-なら敵が有利
  read?: number; // 予兆の読み取り段階
  buff?: number; // 敵の強化
  log: string[];
  companion?: string;
  onWin: SceneRef;
  onLose: SceneRef;
  onFlee: SceneRef;
  loseMeansDeath: boolean;
  spar?: boolean; // 稽古試合（負けても大怪我しない）
  lastStand?: boolean; // 死の手前で一度だけ踏みとどまった
  fled?: boolean;
}

export interface SceneRef {
  ev: string;
  node: string;
}

export type SceneState =
  | { kind: 'event'; ev: string; node: string }
  | { kind: 'inline'; lines: Line[]; then: 'advance' | 'stay' | 'none'; slots?: number };

export interface QuestState {
  id: string;
  acceptedDay: number;
  deadline: number;
  stage: number;
  data: Record<string, number | string | boolean>;
}

export interface AffState {
  joined: number; // 加入した日
  standing: number; // 組織内での評価
  duty: number; // 今週こなした義務（時間帯の数）
  missed: number; // 義務を果たせなかった週の数（連続）
}

export interface ExploreState {
  dungeon: string;
  node: string;
  torch: number; // 松明の残り（移動ごとに減る）
  visited: string[];
  searched: string[];
  moves: number;
  companion?: string;
}

export interface GameState {
  version: 1;
  id: string;
  rng: number;
  mode: Mode;
  hero: {
    name: string;
    gender: Gender;
    pronoun: string; // 一人称
    talents: string[];
  };
  stats: Record<StatKey, number>;
  apt: Record<StatKey, number>;
  diligence: number; // 定着の効率（努力型ほど高い）
  pending: Partial<Record<StatKey, number>>;
  walls: Record<SkillKey, LearnKind[]>;
  wallsBroken: Record<SkillKey, number>;
  cond: { fatigue: number; hp: number; stress: number; fed: boolean; injuries: Injury[] };
  money: number; // 銅貨
  items: Record<string, number>;
  day: number; // 1始まり
  slot: number; // 0朝 1昼 2夕 3夜
  location: string;
  rank: number; // 0仮登録 1石 2銅 3鉄 4銀 5金 6星
  flags: Record<string, number | string | boolean>;
  counters: Record<string, number>;
  npcs: Record<string, NpcState>;
  journal: JournalEntry[];
  today: string[]; // 今日の出来事（就寝時に日誌へ）
  repetition: Record<string, number[]>; // 行動キー -> 実行した日
  seen: Record<string, number>; // イベントID -> 最後に発生した日
  scene: SceneState | null;
  combat: CombatState | null;
  quest: QuestState | null;
  affil?: Record<string, AffState>; // 所属（後から追加された項目のため省略可）
  explore?: ExploreState | null;
  lastAction?: string;
  dead?: boolean;
  ended?: boolean;
}

export type Txt = string | ((s: GameState) => string);
