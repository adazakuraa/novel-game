// 初期能力のランダム生成。「才能の型」を抽選し、細部を揺らし、総量を正規化する。
import type { GameState, Gender, Mode, NpcState, StatKey } from './types';
import { ALL_STATS, SKILLS } from './stats';
import { makeRng } from './rng';

export interface TalentDef {
  id: string;
  /** 主人公の生い立ちとして示す描写（数値は語らない） */
  hint: string;
  base: Partial<Record<StatKey, number>>; // 初期値への加算
  apt: Partial<Record<StatKey, number>>; // 伸び率への加算
  diligence?: number;
}

export const TALENTS: TalentDef[] = [
  {
    id: 'frame',
    hint: '村の誰より早く、大人と同じだけの麦束を担げるようになった。走り比べで負けた記憶もない。',
    base: { str: 9, end: 8, agi: 4 },
    apt: { str: 0.35, end: 0.3, sword_p: 0.1 },
  },
  {
    id: 'vessel',
    hint: '幼い頃、夜の畑で光る虫が{I}の周りにだけ集まってきた。祖母はそれを「澱に好かれる子」と呼んで、少し怖がった。',
    base: { focus: 5, will: 4, magic_p: 5 },
    apt: { magic_p: 0.55, magic_t: 0.3, focus: 0.2 },
  },
  {
    id: 'clever',
    hint: '村に一冊しかない暦の本を、{I}は三日で覚えてしまった。大人たちの帳簿の誤りを指摘して、困らせたこともある。',
    base: { wit: 9, lore: 8 },
    apt: { wit: 0.3, lore: 0.35, magic_t: 0.25, beast_t: 0.25, herb_t: 0.2 },
  },
  {
    id: 'stubborn',
    hint: '熱を出しても畑に出ようとして、母に何度も叱られた。泣き言を口にしたことは、ほとんどない。',
    base: { will: 10, end: 5 },
    apt: { will: 0.35, end: 0.2 },
  },
  {
    id: 'deft',
    hint: '壊れた農具を直すのも、罠を仕掛けるのも{I}の役目だった。手先の仕事なら、教わる前にだいたいできた。',
    base: { dex: 10, agi: 4 },
    apt: { dex: 0.35, bow_p: 0.35, herb_p: 0.2, survival_p: 0.2 },
  },
  {
    id: 'kind',
    hint: '喧嘩の仲裁はいつも{I}に回ってきた。誰が何に怒っているのか、なぜか分かってしまうのだ。',
    base: { empathy: 10, speech: 6 },
    apt: { empathy: 0.35, speech: 0.3 },
  },
  {
    id: 'wild',
    hint: '森の縁で迷った子供を見つけ出したのは、いつも{I}だった。獣の足跡や風の匂いを読むのが、なぜか得意だった。',
    base: { survival_p: 6, beast_p: 4, agi: 4 },
    apt: { survival_p: 0.4, survival_t: 0.2, beast_t: 0.25, wit: 0.1 },
  },
  {
    id: 'late',
    hint: '何をしても人並みか、それより少し遅かった。けれど一度身につけたことは、決して忘れなかった。',
    base: {},
    apt: {},
    diligence: 0.35,
  },
];

export interface NewGameInput {
  name: string;
  gender: Gender;
  pronoun: string;
  mode: Mode;
  seed: number;
}

export function rollTalents(seed: number): string[] {
  const r = makeRng(seed);
  const pool = [...TALENTS];
  const first = pool.splice(Math.floor(r() * pool.length), 1)[0];
  const ids = [first.id];
  // 3割の確率で二つ目の才能。大器晩成は単独のみ
  if (first.id !== 'late' && r() < 0.3) {
    const rest = pool.filter((t) => t.id !== 'late');
    ids.push(rest[Math.floor(r() * rest.length)].id);
  }
  return ids;
}

export function emptyNpc(): NpcState {
  return {
    met: false,
    rel: { trust: 0, affinity: 0, respect: 0, debt: 0, wariness: 0, rivalry: 0 },
    mood: 0,
    memories: [],
    topicsUsed: {},
    lastTalkDay: -1,
    dailyBudget: { day: 0, used: 0 },
    alive: true,
    away: 0,
  };
}

export function createGame(input: NewGameInput, npcIds: string[]): GameState {
  const r = makeRng(input.seed);
  const talents = rollTalents(input.seed);
  const defs = talents.map((id) => TALENTS.find((t) => t.id === id)!);

  const stats = {} as Record<StatKey, number>;
  const apt = {} as Record<StatKey, number>;
  for (const k of ALL_STATS) {
    const isAttr = !k.includes('_');
    stats[k] = isAttr ? 8 + r() * 8 : k.endsWith('_t') ? r() * 3 : r() * 4;
    apt[k] = 0.85 + r() * 0.3;
  }
  // 誰でも少しは剣を握ったことがある
  stats.sword_p += 3;
  for (const d of defs) {
    for (const [k, v] of Object.entries(d.base)) stats[k as StatKey] += v!;
    for (const [k, v] of Object.entries(d.apt)) apt[k as StatKey] += v!;
  }
  // 総量の正規化：初期値と伸び率の合計を一定の範囲に収める
  const attrSum = ALL_STATS.reduce((a, k) => a + stats[k], 0);
  const targetSum = 175;
  const scale = targetSum / attrSum;
  for (const k of ALL_STATS) stats[k] = Math.max(0, stats[k] * scale);
  const aptSum = ALL_STATS.reduce((a, k) => a + apt[k], 0);
  const aptScale = (ALL_STATS.length * 1.08) / aptSum;
  for (const k of ALL_STATS) apt[k] *= aptScale;

  let diligence = 1;
  for (const d of defs) diligence += d.diligence ?? 0;
  // 才能が一つだけの者は努力の効率で補う
  if (talents.length === 1) diligence += 0.05;

  const npcs: Record<string, NpcState> = {};
  for (const id of npcIds) npcs[id] = emptyNpc();

  const walls = {} as GameState['walls'];
  const wallsBroken = {} as GameState['wallsBroken'];
  for (const sk of SKILLS) {
    walls[sk] = [];
    wallsBroken[sk] = 0;
  }

  return {
    version: 1,
    id: `${Date.now().toString(36)}-${input.seed.toString(36)}`,
    rng: input.seed ^ 0x5bd1e995,
    mode: input.mode,
    hero: { name: input.name, gender: input.gender, pronoun: input.pronoun, talents },
    stats,
    apt,
    diligence,
    pending: {},
    walls,
    wallsBroken,
    cond: { fatigue: 10, hp: 100, stress: 10, fed: true, injuries: [] },
    money: 120,
    items: { bread: 2, salve: 1, oldtag: 1, oldsword: 1 },
    day: 1,
    slot: 0,
    location: 'gate',
    rank: 0,
    flags: {},
    counters: {},
    npcs,
    journal: [],
    today: [],
    repetition: {},
    seen: {},
    scene: null,
    combat: null,
    quest: null,
  };
}

export function talentHints(ids: string[], pronoun: string): string[] {
  return ids.map((id) => TALENTS.find((t) => t.id === id)!.hint.replaceAll('{I}', pronoun));
}

