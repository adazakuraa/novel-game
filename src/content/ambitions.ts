// 志（長期目標）と、その道のりの到達点。
import type { ActivityDef, EventDef } from '../engine/defs';
import type { GameState, StatKey } from '../engine/types';
import { n, say } from '../engine/text';
import { gain } from '../engine/growth';
import { log } from '../engine/game';
import { startCombat } from '../engine/combat';
import { merit, RANKS } from '../engine/progress';
import { rel } from '../engine/npc';

export interface Milestone {
  id: string;
  label: string;
  done: (s: GameState) => boolean;
  /** 達成したときのごほうび（経験と、日誌の一文） */
  reward?: { stat: StatKey; amount: number };
}

export interface Ambition {
  id: string;
  name: string;
  desc: string;
  title: string; // 全て達成したときの呼び名
  milestones: Milestone[];
}

const c = (s: GameState, k: string) => s.counters[k] ?? 0;
const kills = (s: GameState) => Object.entries(s.counters).filter(([k]) => k.startsWith('kill:')).reduce((a, [, v]) => a + v, 0);

export const AMBITIONS: Ambition[] = [
  {
    id: 'blade',
    name: '剣の道',
    desc: 'ガラドに認められる剣士になる。',
    title: '剣士',
    milestones: [
      { id: 'b1', label: '剣の型の「意味」が分かってくる', done: (s) => s.stats.sword_t >= 12, reward: { stat: 'sword_p', amount: 1.5 } },
      { id: 'b2', label: '剣の最初の壁を越える', done: (s) => s.wallsBroken.sword >= 1, reward: { stat: 'sword_t', amount: 1.5 } },
      { id: 'b3', label: 'リーネとの手合わせで勝つ', done: (s) => c(s, 'lyneWins') >= 1, reward: { stat: 'agi', amount: 1.5 } },
      { id: 'b4', label: 'ガラドから「相手の読み方」を教わる', done: (s) => c(s, 'lessons') >= 5 && s.npcs.garad.rel.respect >= 10, reward: { stat: 'beast_p', amount: 1.5 } },
      { id: 'b5', label: '剣で「会心」の一撃を三度放つ', done: (s) => c(s, 'crits') >= 3, reward: { stat: 'sword_p', amount: 2 } },
      { id: 'b6', label: '剣の二つ目の壁を越える', done: (s) => s.wallsBroken.sword >= 2, reward: { stat: 'will', amount: 2 } },
    ],
  },
  {
    id: 'arcane',
    name: '術の道',
    desc: '魔法の原理を理解し、術を使いこなす。',
    title: '術者',
    milestones: [
      { id: 'a1', label: 'ノインから魔法の手ほどきを受ける', done: (s) => !!s.flags.magicIntro, reward: { stat: 'focus', amount: 1.5 } },
      { id: 'a2', label: '『術式の文法』の内容が分かってくる', done: (s) => s.stats.magic_t >= 12, reward: { stat: 'magic_p', amount: 1.5 } },
      { id: 'a3', label: '火花の術を身につける', done: (s) => !!s.flags.knowsSpark, reward: { stat: 'magic_t', amount: 1.5 } },
      { id: 'a4', label: '魔法の最初の壁を越える', done: (s) => s.wallsBroken.magic >= 1, reward: { stat: 'wit', amount: 1.5 } },
      { id: 'a5', label: 'ノインの潮計の調整を手伝う', done: (s) => !!s.flags.calibrated, reward: { stat: 'magic_p', amount: 2 } },
      { id: 'a6', label: '古い術式の扉を、自分の力で開く', done: (s) => !!s.flags.doorOpen, reward: { stat: 'magic_t', amount: 2 } },
    ],
  },
  {
    id: 'adventurer',
    name: '冒険者の道',
    desc: 'ギルドの等級を上げ、頼られる冒険者になる。',
    title: '頼れる冒険者',
    milestones: [
      { id: 'v1', label: '石級になる', done: (s) => s.rank >= 1, reward: { stat: 'will', amount: 1 } },
      { id: 'v2', label: '依頼を五件こなす', done: (s) => c(s, 'questDone') >= 5, reward: { stat: 'survival_p', amount: 1.5 } },
      { id: 'v3', label: '魔物を十体倒す', done: (s) => kills(s) >= 10, reward: { stat: 'beast_p', amount: 1.5 } },
      { id: 'v4', label: '銅級になる', done: (s) => s.rank >= 2, reward: { stat: 'speech', amount: 1.5 } },
      { id: 'v5', label: '依頼を一度も投げ出さずに十件こなす', done: (s) => c(s, 'questDone') >= 10 && c(s, 'questFail') === 0, reward: { stat: 'will', amount: 2 } },
      { id: 'v6', label: '鉄級になる', done: (s) => s.rank >= 3, reward: { stat: 'end', amount: 2 } },
    ],
  },
  {
    id: 'herbalist',
    name: '薬師の道',
    desc: '薬草に通じ、人の傷を癒やす知恵を身につける。',
    title: '薬草師',
    milestones: [
      { id: 'h1', label: '薬草の見分け方を学ぶ', done: (s) => s.stats.herb_t >= 10, reward: { stat: 'herb_p', amount: 1.5 } },
      { id: 'h2', label: '薬草を三十束摘む', done: (s) => c(s, 'act:forest') >= 12 || c(s, 'herbTotal') >= 30, reward: { stat: 'survival_p', amount: 1.5 } },
      { id: 'h3', label: '月光草を、偽物と見分けて納める', done: (s) => s.flags['questDone:q_moon'] !== undefined && !s.flags.moonFake, reward: { stat: 'herb_t', amount: 1.5 } },
      { id: 'h4', label: '薬草の最初の壁を越える', done: (s) => s.wallsBroken.herb >= 1, reward: { stat: 'dex', amount: 1.5 } },
      { id: 'h5', label: '澱に咲く花を、毒に当たらずに摘む', done: (s) => !!s.items.glowbloom, reward: { stat: 'herb_t', amount: 2 } },
    ],
  },
  {
    id: 'guardian',
    name: '守る者',
    desc: '剣を、誰かを守るために振るう。',
    title: '守り手',
    milestones: [
      { id: 'g1', label: '困っている誰かに手を差し伸べる', done: (s) => s.seen.gd_cheat !== undefined || s.seen.mk_lost_child !== undefined || !!s.flags.catDone, reward: { stat: 'empathy', amount: 1.5 } },
      { id: 'g2', label: '新人に剣を教える', done: (s) => !!s.flags.taughtRookie, reward: { stat: 'sword_t', amount: 1.5 } },
      { id: 'g3', label: '夜警に五回立つ', done: (s) => c(s, 'nightwatch') + c(s, 'act:aff_garrison') >= 5, reward: { stat: 'will', amount: 1.5 } },
      { id: 'g4', label: '危険に向かう仲間を、止めるか守るかする', done: (s) => !!s.flags.lyneStopped || s.seen.lyne_reported_after !== undefined, reward: { stat: 'speech', amount: 1.5 } },
      { id: 'g5', label: '大潮の夜を、生きて越える', done: (s) => s.seen.great_tide !== undefined && !s.dead, reward: { stat: 'end', amount: 2 } },
      { id: 'g6', label: '大潮の夜、誰かの暮らしを守り抜く', done: (s) => s.flags.villageSaved === 'hero' || (s.flags.tideChoice === 'hold' && !s.flags.gateHeavy), reward: { stat: 'will', amount: 2.5 } },
    ],
  },
];

export const ambitionOf = (s: GameState) => AMBITIONS.find((a) => a.id === s.flags.ambition);

/** 新しく達成した到達点を確かめ、ごほうびを与える。日誌に書く文を返す */
export function checkMilestones(s: GameState): string[] {
  const a = ambitionOf(s);
  if (!a) return [];
  const out: string[] = [];
  for (const m of a.milestones) {
    const key = `ms:${m.id}`;
    if (s.flags[key] !== undefined || !m.done(s)) continue;
    s.flags[key] = s.day;
    if (m.reward) gain(s, m.reward.stat, m.reward.amount * 2, { quality: 1.2 });
    s.cond.stress = Math.max(0, s.cond.stress - 8);
    out.push(`【${a.name}】「${m.label}」――ひとつ、前に進んだ。`);
  }
  const all = a.milestones.every((m) => s.flags[`ms:${m.id}`] !== undefined);
  if (all && !s.flags[`title:${a.id}`]) {
    s.flags[`title:${a.id}`] = s.day;
    out.push(`【${a.name}】すべての道のりを歩みきった。人々は{I}を「${a.title}」と呼ぶようになった。`);
  }
  return out;
}

// ───────── 志を選ぶ場面 ─────────

const chooseAmbition: EventDef = {
  id: 'ambition_choose',
  trigger: 'slot',
  priority: 35,
  once: true,
  cond: (s) => s.day >= 4 && s.slot === 3 && !s.flags.ambition,
  nodes: {
    start: {
      lines: [
        n('部屋の窓から、東の城壁が見える。その向こうの森は、夜の中で青白く霞んでいた。'),
        n('カルナスに来て、何日かが過ぎた。毎日、何かを繰り返している。けれど、何のために？'),
        n('{I}は、何を目指してここにいるのだろう。'),
      ],
      choices: [
        { text: '剣を極めたい。あの夜の男のように', effect: (s) => (s.flags.ambition = 'blade'), next: 'end' },
        { text: '魔法の原理を知りたい', effect: (s) => (s.flags.ambition = 'arcane'), next: 'end' },
        { text: '冒険者として、上を目指したい', effect: (s) => (s.flags.ambition = 'adventurer'), next: 'end' },
        { text: '薬草の知恵で、人を助けたい', effect: (s) => (s.flags.ambition = 'herbalist'), next: 'end' },
        { text: '誰かを守れる人になりたい', effect: (s) => (s.flags.ambition = 'guardian'), next: 'end' },
        { text: 'まだ決めない', next: 'later' },
      ],
    },
    end: {
      lines: [n('口に出してみると、少しだけ、足元が定まった気がした。'), n('（志は「成長」タブで確かめられる。あとから変えることもできる。）')],
      effect: (s) => log(s, `志を定めた：${AMBITIONS.find((a) => a.id === s.flags.ambition)?.name}`),
    },
    later: { lines: [n('答えは、まだ出ない。それでもいい。（志は「成長」タブから、いつでも定められる。）')] },
  },
};

// ───────── 昇級審査（銅級・鉄級） ─────────

function exam(id: string, rank: number, enemy: string, intro: string[]): EventDef {
  return {
    id,
    trigger: 'manual',
    nodes: {
      start: {
        lines: [
          n('窓口で昇級審査を申し込むと、セラは貢献の記録を確かめてから、一枚の依頼票を差し出した。'),
          say('sera', `${RANKS[rank]}への審査は、試験依頼です。審査官が同行し、あなたの戦い方を見ます。逃げずに、最後まで。`),
          ...intro.map((t) => n(t)),
        ],
        choices: [
          {
            text: '剣を抜く',
            effect: (s) => startCombat(s, { enemy, dist: 2, onWin: { ev: id, node: 'win' }, onLose: { ev: id, node: 'fail' }, onFlee: { ev: id, node: 'fail' } }),
          },
          { text: '今日はやめておく', next: 'cancel' },
        ],
      },
      cancel: { lines: [say('sera', '承知しました。準備ができたら、また。')] },
      win: {
        lines: [
          n('審査官の老冒険者は、帳面に何かを書きつけると、ぼそりと言った。'),
          say('審査官', '……合格だ。踏み込みに迷いがない。'),
          n(`ギルドに戻ると、セラが新しい札を用意して待っていた。${RANKS[rank]}の札だ。`),
          say('sera', 'おめでとうございます。……次の等級の条件も、窓口で確かめられます。'),
        ],
        effect: (s) => {
          s.rank = Math.max(s.rank, rank);
          s.counters.rankUps = (s.counters.rankUps ?? 0) + 1;
          rel(s, 'sera', 'respect', 3);
          log(s, `昇級審査に合格し、${RANKS[rank]}になった。`);
        },
        end: { advance: true, slots: 2 },
      },
      fail: {
        lines: [n('審査官は首を横に振った。'), say('審査官', '今日は、ここまでだ。七日後にまた来い。'), n('悔しさが、喉の奥に残った。')],
        effect: (s) => {
          s.flags[`examFail:${rank}`] = s.day;
          log(s, `${RANKS[rank]}の昇級審査に落ちた。`);
        },
        end: { advance: true, slots: 2 },
      },
    },
  };
}

export const AMBITION_EVENTS: EventDef[] = [
  chooseAmbition,
  exam('exam_copper', 2, 'wolf', ['森の縁の伐採場に、澱狼が出るという。審査官の老冒険者と二人で、日が傾くのを待った。', '茂みが揺れた。']),
  exam('exam_iron', 3, 'boar', ['東の開拓村の外れに、棘猪が出るという。審査官は柵の外に立ち、腕を組んだまま動かない。', '地鳴りのような足音が近づいてきた。']),
];

/** 昇級審査を受けられるか */
export function canExam(s: GameState, rank: number) {
  const reqMerit = rank === 2 ? 50 : rank === 3 ? 130 : Infinity;
  const fail = s.flags[`examFail:${rank}`] as number | undefined;
  return s.rank === rank - 1 && merit(s) >= reqMerit && (fail === undefined || s.day - fail >= 7);
}

export const EXAM_ACTIVITY: ActivityDef = {
  id: 'exam',
  loc: 'guild',
  label: '昇級審査',
  cond: (s) => s.rank === 1 || s.rank === 2,
  methods: [
    {
      id: 'copper',
      label: '銅級の審査を申し込む',
      desc: '試験依頼。審査官の前で澱狼を討つ。2つの時間帯を使う。',
      cond: (s) => canExam(s, 2) && s.slot <= 1,
      run: (s) => {
        s.flags._start = 'exam_copper';
        return [];
      },
    },
    {
      id: 'iron',
      label: '鉄級の審査を申し込む',
      desc: '試験依頼。審査官の前で棘猪を討つ。2つの時間帯を使う。',
      cond: (s) => canExam(s, 3) && s.slot <= 1,
      run: (s) => {
        s.flags._start = 'exam_iron';
        return [];
      },
    },
    {
      id: 'check',
      label: '次の等級の条件を確かめる',
      desc: '',
      slots: 0,
      run: (s) => {
        const next = s.rank + 1;
        const need = next === 2 ? 50 : 130;
        const m = merit(s);
        const fail = s.flags[`examFail:${next}`] as number | undefined;
        return [
          say('sera', `${RANKS[next]}への昇級には、ギルドへの貢献が${need}以上必要です。今のあなたの記録では、${m}です。`),
          say('sera', m >= need ? (fail !== undefined && s.day - fail < 7 ? '前回の審査から七日経てば、また受けられます。' : '条件は満たしています。審査は午前中に申し込んでください。') : '依頼をこなすこと、魔物を討つこと、夜警に立つこと。どれも記録に残ります。'),
        ];
      },
    },
  ],
};

export function registerAmbitions(R: { progressHooks: ((s: GameState) => string[])[] }) {
  R.progressHooks.push(checkMilestones);
}
