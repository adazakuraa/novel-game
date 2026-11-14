// 依頼。ギルドの掲示板で受け、出発するとイベントとして進行する。
import type { ActivityDef, EventDef, MethodDef, QuestDef } from '../engine/defs';
import type { GameState } from '../engine/types';
import { R } from '../engine/registry';
import { n, say } from '../engine/text';
import { rel, remember } from '../engine/npc';
import { gain } from '../engine/growth';
import { log } from '../engine/game';
import { startCombat } from '../engine/combat';
import { chance } from '../engine/rng';
import { canTakeTest } from './events';

export const QUESTS: QuestDef[] = [
  {
    id: 'q_rats',
    title: '倉庫の澱鼠退治',
    summary: 'ベルク商会の第三倉庫に、澱鼠が棲みついた。駆除してほしい。報酬35銅貨。',
    rankMin: 0,
    reward: 35,
    days: 3,
    depart: 'q_rats',
  },
  {
    id: 'q_moon',
    title: '月光草の採取',
    summary: '施療院より。森の縁で月光草を五株。夜にしか光らないため、夕方以降の採取を推奨。報酬30銅貨。',
    rankMin: 0,
    reward: 30,
    days: 4,
    depart: 'q_moon',
  },
  {
    id: 'q_sample',
    title: '澱溜まりの試料採取',
    summary: '魔導院分室ノインより。森の縁北の窪地付近の小さな澱溜まりから、泥を採取すること。報酬25銅貨。',
    rankMin: 0,
    reward: 25,
    days: 6,
    cond: (s) => !!s.flags.noinQuest,
    depart: 'q_sample',
    giver: 'noin',
  },
  {
    id: 'q_wolf',
    title: '澱狼の討伐',
    summary: '木こり組合より。森の縁の伐採場に、澱狼が出没している。一頭でよいので仕留めてほしい。報酬70銅貨。',
    rankMin: 1,
    reward: 70,
    days: 5,
    depart: 'q_wolf',
  },
  {
    id: 'q_boar',
    title: '棘猪の駆除',
    summary: '東の開拓村より。畑を荒らす棘猪を駆除してほしい。報酬85銅貨。',
    rankMin: 1,
    reward: 85,
    days: 5,
    cond: (s) => s.day >= 18,
    depart: 'q_boar',
  },
];

const done = (s: GameState, extra: Record<string, number | string | boolean> = {}) => {
  if (!s.quest) return;
  s.quest.data.done = true;
  Object.assign(s.quest.data, extra);
};

const boardOpen = (s: GameState) => !!s.flags.boardOpen;

function questAvailable(s: GameState, q: QuestDef) {
  if (s.rank < q.rankMin) return false;
  if (q.cond && !q.cond(s)) return false;
  // 達成済みの依頼は、しばらくすると再び貼り出される
  const last = s.flags[`questDone:${q.id}`] as number | undefined;
  if (last !== undefined && (q.id === 'q_sample' || q.id === 'q_ruin' || s.day - last < 6)) return false;
  return true;
}

export const QUEST_ACTIVITY: ActivityDef = {
  id: 'quest',
  loc: 'guild',
  label: '依頼',
  methods: [],
  dynamic: (s) => {
    const list: MethodDef[] = [];
    if (!boardOpen(s)) {
      list.push({
        id: 'look',
        label: '掲示板を眺める',
        desc: 'まだ依頼は受けられない。',
        slots: 0,
        run: () => [n('掲示板には依頼票がびっしりと貼られている。けれど、仮登録者が受けられるのは八日目からだ。')],
      });
      return list;
    }
    if (!s.quest) {
      for (const q of QUESTS.filter((q) => questAvailable(s, q))) {
        list.push({
          id: `accept:${q.id}`,
          label: `受ける：${q.title}`,
          desc: typeof q.summary === 'function' ? q.summary(s) : q.summary,
          slots: 0,
          run: (st) => {
            st.quest = { id: q.id, acceptedDay: st.day, deadline: st.day + q.days, stage: 0, data: {} };
            log(st, `依頼「${q.title}」を受けた。`);
            return [say('sera', `「${q.title}」ですね。期限は${q.days}日後です。……無理はしないように。`)];
          },
        });
      }
      if (list.length === 0) list.push({ id: 'none', label: '掲示板を眺める', desc: '', slots: 0, run: () => [n('今、受けられそうな依頼はない。')] });
      return list;
    }
    const q = R.quests.get(s.quest.id)!;
    if (s.quest.data.done) {
      list.push({
        id: 'report',
        label: `報告する：${q.title}`,
        desc: '依頼の結果をセラに報告し、報酬を受け取る。',
        slots: 0,
        run: (st) => report(st, q),
      });
    } else {
      list.push({
        id: 'depart',
        label: `出発する：${q.title}`,
        desc: q.id === 'q_moon' ? '夕方以降に出発するのがよさそうだ。' : '依頼に向かう。',
        cond: (st) => (q.id === 'q_rats' || st.slot <= 2) && st.cond.hp > 20,
        run: (st) => {
          st.flags._start = q.depart;
          return [];
        },
      });
      list.push({
        id: 'abandon',
        label: `取り下げる：${q.title}`,
        desc: '依頼を諦める。実績に傷がつく。',
        slots: 0,
        run: (st) => {
          st.quest = null;
          st.counters.questFail = (st.counters.questFail ?? 0) + 1;
          st.flags.lastQuestFailed = true;
          rel(st, 'sera', 'trust', -2);
          log(st, `依頼「${q.title}」を取り下げた。`);
          return [say('sera', '……承知しました。記録しておきます。')];
        },
      });
    }
    return list;
  },
};

function report(s: GameState, q: QuestDef) {
  const quality = (s.quest!.data.quality as number) ?? 1;
  const pay = Math.round(q.reward * quality);
  s.money += pay;
  s.counters.questDone = (s.counters.questDone ?? 0) + 1;
  s.flags[`questDone:${q.id}`] = s.day;
  s.flags.lastQuestHurt = s.cond.injuries.length > 0;
  s.flags.lastQuestFailed = false;
  rel(s, 'sera', 'trust', quality >= 1 ? 2.5 : 0.5);
  rel(s, 'sera', 'respect', 1);
  if (q.id === 'q_sample') s.flags.sampleDelivered = true;
  if (q.id === 'q_ruin') s.flags.ruinDelivered = true;
  const lines = [
    n(`「${q.title}」の報告をして、${pay}銅貨を受け取った。`),
    quality < 1
      ? say('sera', (s.quest!.data.note as string) ?? '依頼主から、少し苦情が来ています。報酬は減額です。')
      : s.cond.injuries.length
        ? say('sera', 'ご苦労さまでした。……その傷、施療院で診てもらってください。')
        : say('sera', 'ご苦労さまでした。依頼主も満足しています。'),
  ];
  log(s, `依頼「${q.title}」を達成した。`);
  s.quest = null;
  return lines;
}

export const TEST_ACTIVITY: ActivityDef = {
  id: 'ranktest',
  loc: 'training',
  label: '昇級審査',
  cond: (s) => !!s.flags.testOpen && s.rank === 0,
  methods: [
    {
      id: 'apply',
      label: '審査を申し込む',
      desc: 'ガラドとの立ち合いで力を示す。',
      cond: (s) => canTakeTest(s) && (R.npcs.get('garad')!.where(s) === 'training' || (!!s.flags.garadQuit && s.slot <= 2)),
      run: (s) => {
        s.flags._start = 'rank_test';
        return [];
      },
    },
    {
      id: 'ask',
      label: '審査の条件を確かめる',
      desc: '',
      cond: (s) => !canTakeTest(s),
      slots: 0,
      run: (s) => {
        const out = [];
        if ((s.counters.questDone ?? 0) < 1) out.push(n('まだ依頼を一件も達成していない。'));
        if (s.flags.testFailDay !== undefined && s.day - (s.flags.testFailDay as number) < 7) out.push(n('前回の審査から、まだ七日経っていない。'));
        if (s.flags.dutyFailed && s.day < 21) out.push(n('仮登録の延長期間中は、審査を受けられない。'));
        if (out.length === 0) out.push(n('今は審査を受けられない。'));
        return out;
      },
    },
  ],
};

export const CORE_ACTIVITY: ActivityDef = {
  id: 'cores',
  loc: 'guild',
  label: '魔核を売る',
  cond: (s) => (s.items.core ?? 0) > 0,
  methods: [
    {
      id: 'sell',
      label: '買い取り窓口に出す',
      desc: 'ギルドの買い取り価格で売る。',
      slots: 0,
      run: (s) => {
        const cnt = s.items.core;
        const price = s.flags.smallTide ? 22 : 25;
        s.money += cnt * price;
        s.items.core = 0;
        log(s, `魔核を${cnt}個売った。`);
        return [n(`魔核を${cnt}個売って、${cnt * price}銅貨になった。`)];
      },
    },
  ],
};

// ───────── 依頼のイベント ─────────

const qRats: EventDef = {
  id: 'q_rats',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [
        n('ベルク商会の第三倉庫は、東市場の裏手にあった。'),
        n('重い扉を開けると、黴と獣の臭いが鼻をついた。積み上げられた木箱の陰で、何かがかさかさと動いている。'),
      ],
      choices: [
        { text: '灯りを掲げて、まっすぐ進む', next: 'fight' },
        { text: '息を殺して、物音の出所を探る', next: 'listen' },
      ],
    },
    listen: {
      lines: [
        (s) => {
          const ok = s.stats.focus + s.stats.wit > 26 || chance(s, 0.35);
          s.flags._ambush = ok ? 1 : 0;
          return ok ? n('積まれた麻袋の裏。そこから、齧る音がする。足音を殺して回り込んだ。') : n('音はあちこちから聞こえる。どこにいるのか、絞りきれない。');
        },
      ],
      effect: (s) => gain(s, 'focus', 0.6, {}),
      next: 'fight',
    },
    fight: {
      lines: [],
      effect: (s) => {
        startCombat(s, { enemy: 'rat', dist: s.flags._ambush ? 0 : 1, onWin: { ev: 'q_rats', node: 'win' }, onLose: { ev: 'q_rats', node: 'lose' }, onFlee: { ev: 'q_rats', node: 'flee' } });
        if (s.flags._ambush && s.combat) s.combat.edge = 2;
        delete s.flags._ambush;
      },
    },
    win: {
      lines: [
        n('澱鼠が動かなくなった。'),
        n('木箱の陰を調べると、齧られた魔核の木箱が見つかった。鼠たちは、魔核の欠片を食べて育っていたらしい。'),
        n('残りの小さな鼠は、灯りを向けると壁の穴へ逃げていった。穴を板で塞いで、仕事は終わりだ。'),
      ],
      effect: (s) => {
        done(s);
        log(s, 'ベルク商会の倉庫で、澱鼠を退治した。');
        s.flags.ratsAteCores = true;
      },
      end: { advance: true },
    },
    lose: {
      lines: [n('倉庫番の男が駆けつけて、鼠を箒で叩き出してくれた。'), say('倉庫番', 'おいおい、鼠に負ける冒険者なんて初めて見たぜ。'), n('今日はこれ以上は無理だ。')],
      end: { advance: true },
    },
    flee: { lines: [n('倉庫の外へ転がり出た。扉の向こうで、鼠がまだ鳴いている。')], end: { advance: true } },
  },
};

const qMoon: EventDef = {
  id: 'q_moon',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [
        (s) =>
          s.slot >= 2
            ? n('日が傾きはじめた頃、東門を出た。森の縁の草地が、夕闇に沈んでいく。')
            : n('明るいうちに東門を出た。森の縁の草地を歩き回ったが、昼の草はどれも同じ緑に見える。'),
      ],
      next: (s) => (s.slot >= 2 ? 'glow' : 'day'),
    },
    day: {
      lines: [n('月光草は夜にしか光らない。昼に探しても、見分けがつかない。'), n('夕方まで待つしかなさそうだ。')],
      choices: [
        { text: '夕方まで森の縁で待つ', next: 'glow', effect: (s) => { s.slot = 2; } },
        { text: '一度街へ戻る', next: 'back' },
      ],
    },
    back: { lines: [n('{I}は東門へ引き返した。')], end: { advance: true } },
    glow: {
      lines: [
        n('暗くなるにつれて、草むらのあちこちで、淡い銀色の光が灯りはじめた。'),
        n('だが、光る草は二種類あるように見える。'),
      ],
      choices: [
        { text: '葉の裏を一つずつ確かめる', next: 'check' },
        { text: '光っているものを手早く摘む', next: 'grab' },
      ],
    },
    check: {
      lines: [
        (s) => {
          const ok = s.stats.herb_t >= 6 || !!s.items.book_herb || chance(s, 0.25);
          s.flags._herbOk = ok ? 1 : 0;
          return ok
            ? n('葉の裏に、銀色の筋が三本走っているものが本物の月光草だ。筋が一本しかないものは偽月草。時間はかかったが、本物だけを五株摘めた。')
            : n('葉の裏を見比べたが、違いがよく分からない。似たような草を五株摘んだ。');
        },
      ],
      effect: (s) => {
        gain(s, 'herb_t', 1.2, { difficulty: 18 });
        gain(s, 'herb_p', 1.0, { difficulty: 18 });
      },
      next: 'howl',
    },
    grab: {
      lines: [
        n('光る草を手早く摘んでいく。あっという間に五株集まった。'),
      ],
      effect: (s) => {
        s.flags._herbOk = s.stats.herb_t >= 10 ? 1 : 0;
        gain(s, 'herb_p', 0.8, { difficulty: 16 });
      },
      next: 'howl',
    },
    howl: {
      lines: [n('そのとき、森の奥で遠吠えが響いた。一つ。少し遅れて、もう一つ。')],
      choices: [
        { text: '急いで街へ戻る', next: 'run' },
        { text: '身を伏せて、様子をうかがう', next: 'hide' },
      ],
    },
    run: {
      lines: [
        (s) => {
          const met = chance(s, s.stats.agi > 18 ? 0.25 : 0.5);
          s.flags._wolf = met ? 1 : 0;
          return met ? n('走り出した足音に気づかれたらしい。背後の茂みが揺れた。') : n('暗い草地を駆け抜け、東門の灯りの中に飛び込んだ。');
        },
      ],
      next: (s) => (s.flags._wolf ? 'wolf' : 'finish'),
    },
    hide: {
      lines: [
        (s) => {
          const ok = s.stats.survival_p + s.stats.beast_t > 14 || chance(s, 0.4);
          s.flags._wolf = ok ? 0 : 1;
          return ok
            ? n('草の中に身を伏せ、風下に回る。しばらくして、遠吠えは森の奥へ遠ざかっていった。')
            : n('身を伏せたが、風向きが悪かった。茂みの向こうで、獣が鼻を鳴らす音がする。');
        },
      ],
      effect: (s) => gain(s, 'survival_p', 1.0, { difficulty: 20 }),
      next: (s) => (s.flags._wolf ? 'wolf' : 'finish'),
    },
    wolf: {
      lines: [],
      effect: (s) =>
        startCombat(s, {
          enemy: 'wolf',
          dist: 2,
          onWin: { ev: 'q_moon', node: 'finish' },
          onLose: { ev: 'q_moon', node: 'lose' },
          onFlee: { ev: 'q_moon', node: 'finish' },
          loseMeansDeath: (s.counters.rescued ?? 0) >= 1,
        }),
    },
    lose: {
      lines: [n('気がつくと、守備隊の巡回兵に担がれていた。'), say('巡回兵', '夜の森の縁を一人でうろつくな、新人。次は誰も来ないぞ。'), n('月光草は、どこかで落としてしまった。')],
      effect: (s) => {
        s.counters.rescued = (s.counters.rescued ?? 0) + 1;
        log(s, '月光草を摘んだ帰りに狼に襲われ、守備隊に助けられた。月光草は失くした。');
      },
      end: { advance: true },
    },
    finish: {
      lines: [n('東門の灯りの下で、摘んだ月光草を確かめた。淡い銀色の光が、まだ葉の上に残っている。')],
      effect: (s) => {
        const ok = !!s.flags._herbOk;
        if (!ok) s.flags.moonFake = true;
        done(s, ok ? {} : { quality: 0.5, note: '依頼主の施療院から、半分が偽月草だったと連絡がありました。報酬は半額です。' });
        s.items.moonherb = 5;
        delete s.flags._herbOk;
        delete s.flags._wolf;
        log(s, '森の縁で月光草を摘んだ。');
      },
      end: { advance: true },
    },
  },
};

const qSample: EventDef = {
  id: 'q_sample',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [
        n('ノインに渡された硝子瓶を懐に、森の縁を北へ向かう。'),
        n('いつもの薬草地を過ぎると、空気が変わった。肌がちりちりする。鼻の奥に、鉄のような匂い。'),
        n('窪地の手前の岩陰に、小さな水たまりのようなものがあった。水ではない。とろりと濁った、灰色の泥。その表面が、かすかに青白く光っている。'),
        n('澱溜まりだ。'),
      ],
      choices: [
        { text: '素手で慎重にすくう', next: 'hand' },
        { text: '木の枝を使ってすくう', next: 'stick' },
        { text: '周囲を見回してから作業する', next: 'look' },
      ],
    },
    look: {
      lines: [
        (s) => {
          const saw = s.stats.wit + s.stats.survival_p > 22 || chance(s, 0.4);
          s.flags._ratNest = saw ? 0 : 1;
          return saw
            ? n('岩の裏に、齧られた骨と、鼠の糞が散らばっていた。巣がある。{I}は音を立てないよう、風下から澱溜まりに近づいた。')
            : n('特に変わったものは見えない。');
        },
      ],
      effect: (s) => gain(s, 'survival_p', 0.8, {}),
      next: 'stick',
    },
    hand: {
      lines: [n('指先が泥に触れた瞬間、痺れるような感覚が腕を駆け上がった。'), n('慌てて手を引く。指先が、しばらく青白く光っていた。'), n('どうにか瓶は満たしたが、指の痺れが取れない。')],
      effect: (s) => {
        s.cond.injuries.push({ id: 'sludge', label: '澱に触れた右手の痺れ', severity: 1, days: 3 });
        gain(s, 'magic_p', 0.8, { difficulty: 20 });
        s.flags.touchedSludge = true;
      },
      next: 'rats',
    },
    stick: {
      lines: [n('枝の先で泥をすくい、瓶に落とし込む。泥は枝を伝ってゆっくりと流れ落ち、瓶の中で静かに光った。')],
      effect: (s) => gain(s, 'dex', 0.6, {}),
      next: 'rats',
    },
    rats: {
      lines: [],
      next: (s) => (s.flags._ratNest === 0 ? 'finish' : 'ratfight'),
    },
    ratfight: {
      lines: [n('背後で、甲高い鳴き声がした。岩の裏から、澱鼠が這い出してくる。')],
      choices: [
        {
          text: '迎え撃つ',
          effect: (s) =>
            startCombat(s, { enemy: 'rat', dist: 1, onWin: { ev: 'q_sample', node: 'finish' }, onLose: { ev: 'q_sample', node: 'lose' }, onFlee: { ev: 'q_sample', node: 'finish' } }),
        },
      ],
    },
    lose: { lines: [n('鼠に噛まれ、瓶を抱えたまま転がるように逃げ帰った。瓶だけは割らずに済んだ。')], next: 'finish' },
    finish: {
      lines: [n('瓶の栓を固く閉め、来た道を戻った。懐の中で、瓶がかすかに温かい。')],
      effect: (s) => {
        delete s.flags._ratNest;
        s.items.sample = 1;
        done(s);
        log(s, '森の北の窪地で、澱溜まりの泥を採取した。');
      },
      end: { advance: true, slots: 2 },
    },
  },
};

const qWolf: EventDef = {
  id: 'q_wolf',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [
        n('伐採場は、森の縁の東寄りにあった。切り株が並ぶ空き地の真ん中で、木こりたちが焚き火を囲んでいる。'),
        say('木こり', 'あんたが冒険者か。……若いな。'),
        say('木こり', '狼は、夕方になると決まって西の沢から上がってくる。昨日は若いのが一人、腕を噛まれた。'),
      ],
      choices: [
        { text: '西の沢へ足跡を追う', next: 'track' },
        { text: '伐採場で待ち伏せる', next: 'wait' },
      ],
    },
    track: {
      lines: [
        (s) => {
          const ok = s.stats.survival_p + s.stats.beast_p > 18;
          s.flags._edge = ok ? 1 : -1;
          return ok
            ? n('沢沿いの泥に、新しい足跡が続いていた。風下から近づく。茂みの向こうに、灰色の背中が見えた。まだこちらに気づいていない。')
            : n('沢沿いを歩き回ったが、足跡が見つからない。気づいたときには、背後から唸り声が聞こえていた。');
        },
      ],
      effect: (s) => gain(s, 'survival_p', 1.2, { difficulty: 22 }),
      next: 'fight',
    },
    wait: {
      lines: [
        n('切り株の陰に身を潜め、日が傾くのを待った。'),
        n('夕暮れ。沢のほうから、灰色の影が一つ、するりと空き地に入ってきた。'),
      ],
      effect: (s) => {
        s.flags._edge = 0;
        gain(s, 'will', 0.5, {});
      },
      next: 'fight',
    },
    fight: {
      lines: [],
      effect: (s) => {
        const e = (s.flags._edge as number) ?? 0;
        delete s.flags._edge;
        startCombat(s, {
          enemy: 'wolf',
          dist: e > 0 ? 1 : 2,
          onWin: { ev: 'q_wolf', node: 'win' },
          onLose: { ev: 'q_wolf', node: 'lose' },
          onFlee: { ev: 'q_wolf', node: 'flee' },
          loseMeansDeath: (s.counters.rescued ?? 0) >= 1,
        });
        if (s.combat) s.combat.edge = e;
      },
    },
    win: {
      lines: [n('澱狼が倒れると、木こりたちが斧を手に駆け寄ってきた。'), say('木こり', 'やったか！　……あんた、若いのにやるじゃないか。'), n('木こりたちは、焼いた干し肉を分けてくれた。')],
      effect: (s) => {
        done(s);
        s.cond.fed = true;
        log(s, '伐採場を荒らす澱狼を仕留めた。');
      },
      end: { advance: true, slots: 2 },
    },
    lose: {
      lines: [n('木こりたちが斧を振り回して、狼を追い払ってくれた。'), say('木こり', '……冒険者ってのは、これでも金を取るのかい。'), n('悔しさより先に、体の痛みが来た。')],
      effect: (s) => {
        s.counters.rescued = (s.counters.rescued ?? 0) + 1;
        log(s, '澱狼に敗れ、木こりたちに助けられた。');
      },
      end: { advance: true, slots: 2 },
    },
    flee: { lines: [n('狼を振り切り、伐採場まで逃げ戻った。木こりたちの視線が痛い。')], end: { advance: true, slots: 2 } },
  },
};

const qBoar: EventDef = {
  id: 'q_boar',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [
        n('東の開拓村は、城壁の外に張りつくように広がる小さな村だった。'),
        n('畑の半分が、掘り返されたように荒れている。'),
        say('村長', '棘猪です。夜明け前に、決まって東の畑に来る。柵なんて紙みたいに破られちまう。'),
        (s) => (s.stats.beast_t > 12 ? n('棘猪は一直線にしか走れない、と魔物誌にあった。突進を横へかわせば、背中の棘の付け根が狙える。') : null),
      ],
      choices: [
        { text: '畑の真ん中で待ち構える', next: 'fight' },
        { text: '柵の裏に隠れて、突進の向きを読む', next: 'read' },
      ],
    },
    read: {
      lines: [n('柵の裏で、夜明けを待つ。やがて、地鳴りのような足音が近づいてきた。')],
      effect: (s) => {
        s.flags._observed = 1;
        gain(s, 'beast_p', 0.8, {});
      },
      next: 'fight',
    },
    fight: {
      lines: [],
      effect: (s) => {
        const ob = !!s.flags._observed;
        delete s.flags._observed;
        startCombat(s, {
          enemy: 'boar',
          dist: 3,
          onWin: { ev: 'q_boar', node: 'win' },
          onLose: { ev: 'q_boar', node: 'lose' },
          onFlee: { ev: 'q_boar', node: 'flee' },
          loseMeansDeath: (s.counters.rescued ?? 0) >= 1,
        });
        if (s.combat && ob) s.combat.observed = true;
      },
    },
    win: {
      lines: [n('棘猪の巨体が、畑の畝に沈んだ。'), say('村長', '助かった……。これで、今年の麦が守れる。'), n('村の子供たちが、柵の陰から遠巻きに{I}を見ていた。')],
      effect: (s) => {
        done(s);
        remember(s, 'sera', 'quest:boar', '開拓村の棘猪を駆除した。');
        log(s, '開拓村の畑を荒らす棘猪を駆除した。');
      },
      end: { advance: true, slots: 2 },
    },
    lose: {
      lines: [n('猪の牙に跳ね飛ばされ、柵に叩きつけられた。村人たちが松明を振って猪を追い払った。'), say('村長', '……無理を言って、すまなかった。')],
      effect: (s) => {
        s.counters.rescued = (s.counters.rescued ?? 0) + 1;
        log(s, '棘猪に敗れ、村人たちに助けられた。');
      },
      end: { advance: true, slots: 2 },
    },
    flee: { lines: [n('突進をかわしざま、村の外れまで走った。猪は荒らした畑の上で、勝ち誇ったように鼻を鳴らしていた。')], end: { advance: true, slots: 2 } },
  },
};

export const QUEST_EVENTS: EventDef[] = [qRats, qMoon, qSample, qWolf, qBoar];
