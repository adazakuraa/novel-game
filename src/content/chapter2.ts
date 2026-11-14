// 第2章「灯脈の節」序盤（91〜110日目ごろ）。ネタバレを含む。
import type { ActivityDef, AffiliationDef, DungeonDef, EventDef, LocationDef, MethodDef, NpcDef, TopicDef } from '../engine/defs';
import type { GameState, Line } from '../engine/types';
import { n, say } from '../engine/text';
import { closeness, meet, rel, remember } from '../engine/npc';
import { gain } from '../engine/growth';
import { log } from '../engine/game';
import { pick } from '../engine/rng';
import { clamp } from '../engine/stats';
import { doDuty, isMember, join, leave } from '../engine/affil';
import { enterDungeon } from '../engine/explore';
import { R } from '../engine/registry';

const ch2 = (s: GameState) => !!s.flags.chapter1Done;
const offer = (s: GameState, id: string) => s.flags[`offer:${id}`];

// ───────── 所属 ─────────

export const AFFILIATIONS: AffiliationDef[] = [
  {
    id: 'institute',
    name: '魔導院分室',
    desc: 'ノインの助手。週に2回の研究補助が務め。分室の書庫の奥と、術の指導が受けられる。',
    dutyPerWeek: 2,
    dutyLabel: '研究補助',
    pay: 30,
    dismissAfter: 3,
  },
  {
    id: 'berg',
    name: 'ベルク商会',
    desc: '調査隊の護衛と荷の検品。週に2回の務め。報酬は高いが、商会の思惑に関わることになる。',
    dutyPerWeek: 2,
    dutyLabel: '護衛と検品',
    pay: 60,
    dismissAfter: 2,
  },
  {
    id: 'garrison',
    name: '守備隊',
    desc: '臨時兵。週に2回の巡回が務め（門の夜警か、地下水道の巡回）。地下水道への立ち入りが許される。',
    dutyPerWeek: 2,
    dutyLabel: '巡回',
    pay: 40,
    dismissAfter: 2,
  },
];

/** 地下水道に入れるか */
export const canEnterAqueduct = (s: GameState) => isMember(s, 'garrison') || isMember(s, 'institute') || isMember(s, 'berg') || s.rank >= 2;

// ───────── 場所 ─────────

export const LOCATIONS2: LocationDef[] = [
  {
    id: 'undercity',
    name: '旧水道の入口',
    desc: '東区の外れ、古い井戸小屋の奥に、石の階段が地下へ口を開けている。階段の下から、青白い光が漏れていた。',
    cond: (s) => !!s.flags.aqueductOpen,
    open: (slot) => slot <= 2,
  },
];

// ───────── 行動 ─────────

function dutyMethod(id: string, label: string, desc: string, run: MethodDef['run'], cond?: MethodDef['cond']): MethodDef {
  return {
    id: `duty_${id}`,
    label: `【務め】${label}`,
    desc,
    cond: (s) => isMember(s, id) && (!cond || cond(s)),
    run: (s, ctx) => {
      doDuty(s, id);
      return run(s, ctx);
    },
  };
}

export const ACTIVITIES_2: ActivityDef[] = [
  {
    id: 'aff_institute',
    loc: 'institute',
    label: '分室の務め',
    cond: (s) => isMember(s, 'institute') || offer(s, 'institute') === 'pending',
    methods: [
      dutyMethod('institute', '研究補助', 'ノインの記録の整理や、試料の分析を手伝う。', (s) => {
        gain(s, 'magic_t', 1.2, { difficulty: 28, key: 'magic:duty', quality: 1.2, kind: 'mentor' });
        gain(s, 'lore', 0.8, { difficulty: 28, key: 'lore:duty' });
        gain(s, 'wit', 0.6, { difficulty: 26 });
        rel(s, 'noin', 'trust', 1);
        log(s, '分室で、ノインの研究を手伝った。');
        return [
          n('分室の机に向かい、ノインの書き散らした記録を清書していく。'),
          n(
            pick(s, [
              '潮計の針の揺れを、一刻ごとに書き留める。夏の澱は、春よりも脈が速い。',
              'エドガーの魔核の表と、ノインの潮の記録を突き合わせる。二つの線が、同じ形で揺れている箇所があった。',
              'ノインが、清林の古い歌を書き留めた紙を見せてくれた。「澱は眠る森の血」という一節があった。',
              '本院から来た書類の山を、ノインと二人で仕分ける。ノインは一枚ごとにため息をついた。',
            ]),
          ),
        ];
      }),
      {
        id: 'join',
        label: '分室の助手になる',
        desc: AFFILIATIONS[0].desc,
        cond: (s) => offer(s, 'institute') === 'pending' && !isMember(s, 'institute'),
        slots: 0,
        run: (s) => {
          join(s, 'institute');
          rel(s, 'noin', 'trust', 4);
          log(s, '魔導院分室の、ノインの助手になった。');
          return [say('noin', 'ほんとに？　……やった。じゃあ、今日からきみは「魔導院分室付き助手」。肩書きは偉そうだけど、給金は安いよ。')];
        },
      },
      {
        id: 'leave',
        label: '助手をやめる',
        desc: '',
        cond: (s) => isMember(s, 'institute'),
        slots: 0,
        run: (s) => {
          leave(s, 'institute');
          rel(s, 'noin', 'affinity', -3);
          return [say('noin', '……そっか。うん、分かった。いつでも遊びには来てね。')];
        },
      },
    ],
  },
  {
    id: 'aff_berg',
    loc: 'market',
    label: 'ベルク商会の務め',
    cond: (s) => isMember(s, 'berg') || offer(s, 'berg') === 'pending',
    methods: [
      dutyMethod('berg', '荷の護衛と検品', '商会の荷車に付き添い、魔核の木箱を数える。', (s) => {
        gain(s, 'str', 0.6, { difficulty: 26, key: 'body:berg' });
        gain(s, 'wit', 0.7, { difficulty: 26, key: 'social:berg' });
        gain(s, 'speech', 0.5, { difficulty: 24 });
        rel(s, 'edgar', 'affinity', 1);
        if (s.flags.martaDebt) rel(s, 'marta', 'wariness', 0.6);
        log(s, 'ベルク商会の荷の護衛と検品をした。');
        return [
          n('商会の荷車に付き添って、東区の倉庫と門の間を往復する。'),
          n(
            pick(s, [
              '倉庫の奥に、見慣れない形の掘削道具が積まれていた。王都から運ばれてきたものらしい。',
              'エドガーが帳簿を手に、木箱の数を一つずつ確かめている。目が合うと、困ったように笑った。',
              '東区の家々の扉に、商会の買い上げの通知が貼られていた。灯り亭の扉にも。',
              '人足たちが「旦那は地下に何があるって言ってるんだ」と噂していた。',
            ]),
          ),
        ];
      }),
      {
        id: 'join',
        label: '商会の調査役になる',
        desc: AFFILIATIONS[1].desc,
        cond: (s) => offer(s, 'berg') === 'pending' && !isMember(s, 'berg'),
        slots: 0,
        run: (s) => {
          join(s, 'berg');
          rel(s, 'edgar', 'wariness', 2);
          if (s.flags.martaDebt) rel(s, 'marta', 'wariness', 3);
          log(s, 'ベルク商会の調査役になった。');
          return [n('商会の帳場で契約書に名前を書いた。署名欄の上に、ゴドウィン・ベルクの太い字が並んでいた。'), say('edgar', '……本当に、いいんですか。いえ、僕が言うことじゃないですね。')];
        },
      },
      {
        id: 'leave',
        label: '商会との契約を切る',
        desc: '',
        cond: (s) => isMember(s, 'berg'),
        slots: 0,
        run: (s) => {
          leave(s, 'berg');
          if (s.flags.martaDebt) rel(s, 'marta', 'wariness', -2);
          return [n('契約書を返すと、帳場の番頭は肩をすくめただけだった。')];
        },
      },
    ],
  },
  {
    id: 'aff_garrison',
    loc: 'gate',
    label: '守備隊の務め',
    cond: (s) => isMember(s, 'garrison') || offer(s, 'garrison') === 'pending',
    methods: [
      dutyMethod(
        'garrison',
        '門の夜警',
        '城壁の上で夜の森を見張る。寝不足になる。',
        (s) => {
          gain(s, 'will', 0.8, { difficulty: 26, key: 'mind:garrison' });
          gain(s, 'survival_t', 0.6, { difficulty: 24 });
          s.cond.fatigue = clamp(s.cond.fatigue + 14, 0, 100);
          s.flags._late = true;
          log(s, '守備隊の夜警に立った。');
          return [n('篝火の脇で、兵士たちと並んで夜の森を見張る。'), n('夏の森は、春より静かだった。けれど、足元の街の下から、時おり低い唸りのようなものが響いてくる気がした。')];
        },
        (s) => s.slot === 3,
      ),
      {
        id: 'join',
        label: '守備隊の臨時兵になる',
        desc: AFFILIATIONS[2].desc,
        cond: (s) => offer(s, 'garrison') === 'pending' && !isMember(s, 'garrison'),
        slots: 0,
        run: (s) => {
          join(s, 'garrison');
          log(s, '守備隊の臨時兵になった。');
          return [say('ハンス', 'よし。今日からお前は臨時兵だ。巡回は週に二回。地下に潜るときは、必ず詰所に一声かけろ。')];
        },
      },
      {
        id: 'leave',
        label: '臨時兵をやめる',
        desc: '',
        cond: (s) => isMember(s, 'garrison'),
        slots: 0,
        run: (s) => {
          leave(s, 'garrison');
          return [say('ハンス', 'そうか。まあ、門の前で会うこともあるだろう。')];
        },
      },
    ],
  },
  {
    id: 'aqueduct',
    loc: 'undercity',
    label: '旧水道',
    methods: [
      {
        id: 'enter',
        label: '地下へ降りる',
        desc: '松明を持って旧水道を探索する。三歩進むごとに時間が過ぎる。夜になる前に戻ること。',
        companions: true,
        cond: canEnterAqueduct,
        warn: (s, { companion }) =>
          !(s.items.torch ?? 0)
            ? '松明を持っていない。市場で買っておいたほうがいい。'
            : (s.counters.rescued ?? 0) >= 1 && !companion
              ? '地下では、倒れても誰も来ない。'
              : null,
        run: (s, { companion }) => {
          if (isMember(s, 'garrison')) doDuty(s, 'garrison');
          if (companion) rel(s, companion, 'affinity', 1);
          enterDungeon(s, 'aqueduct', companion);
          return [];
        },
      },
      {
        id: 'denied',
        label: '地下へ降りようとする',
        desc: '入口には守備隊の兵が立っている。',
        cond: (s) => !canEnterAqueduct(s),
        slots: 0,
        run: () => [
          say('守備隊の兵士', '悪いな。ここは許可のある者しか通せない。'),
          n('守備隊、魔導院分室、ベルク商会のいずれかに属しているか、銅級以上の冒険者でなければ入れないらしい。'),
        ],
      },
    ],
  },
];

// ───────── 地下水道 ─────────

export const AQUEDUCT: DungeonDef = {
  id: 'aqueduct',
  name: '旧水道',
  start: 'stairs',
  surface: 'undercity',
  nodes: {
    stairs: {
      name: '入口の階段',
      desc: '苔むした石段が、闇の底へ続いている。足元を、細い水の流れが光りながら下っていく。地上の光が、背中の上で小さな四角になっていた。',
      links: [{ to: 'channel', label: '水路の通路へ降りる' }],
      exit: true,
    },
    channel: {
      name: '水路の通路',
      desc: '人がすれ違える程度の幅の通路。脇の水路を、澱の混じった水がゆっくりと流れている。水面がところどころ、青白く脈打つように光る。',
      links: [
        { to: 'stairs', label: '階段へ戻る' },
        { to: 'junction', label: '奥へ進む' },
      ],
      encounter: { enemy: 'rat', chance: 0.2 },
      search: (s) => {
        s.money += 6;
        return '水路の底の泥の中に、古い銅貨が何枚か沈んでいた。刻印は、見たことのない王の横顔だ。6銅貨ぶんにはなるだろう。';
      },
    },
    junction: {
      name: '三叉の分岐',
      desc: '通路が三つに分かれている。どの通路の奥からも、低い水音が響いてくる。天井の石組みは、地上のどの建物よりも精巧だった。',
      story: 'aq_junction',
      links: [
        { to: 'channel', label: '入口の方へ戻る' },
        { to: 'sunken', label: '左の、水に沈みかけた回廊へ' },
        { to: 'gallery', label: '中央の、壁に絵のある回廊へ' },
        { to: 'cistern', label: '右の、広い空間へ' },
      ],
    },
    sunken: {
      name: '沈んだ回廊',
      desc: '膝まで水に浸かった回廊。水は冷たく、ときどき何かが足首をかすめていく。壁の窪みに、齧られた骨が積まれていた。',
      links: [{ to: 'junction', label: '分岐へ戻る' }],
      encounter: { enemy: 'rat', chance: 0.5 },
      search: (s) => {
        s.items.core = (s.items.core ?? 0) + 2;
        gain(s, 'beast_t', 0.8, {});
        return '鼠の巣の奥に、小さな魔核が二つ転がっていた。鼠たちは、水に溶けた澱を飲んで育っているらしい。';
      },
    },
    gallery: {
      name: '壁画の回廊',
      desc: (s) =>
        s.flags.sawMural
          ? '壁一面の壁画。大きな心臓のような円から、無数の線が大陸中へ伸びている。'
          : '壁一面に、色褪せた絵が描かれている。松明をかざすと、絵が闇の中から浮かび上がった。',
      story: 'aq_mural',
      links: [{ to: 'junction', label: '分岐へ戻る' }],
      search: (s) => {
        s.explore!.torch += 6;
        return '壁の燭台に、固まった古い油が残っていた。松明に移すと、炎が勢いを取り戻した。';
      },
    },
    cistern: {
      name: '大貯水槽',
      desc: '天井の高い、巨大な石の空間。床の大部分は黒い水に覆われ、その中心で、澱が渦を巻いて光っている。水面の上に、細い石の通路が一本だけ渡されていた。',
      links: [
        { to: 'junction', label: '分岐へ戻る' },
        { to: 'door', label: '石の通路を渡って、奥の扉へ' },
      ],
      encounter: { enemy: 'serpent', chance: 0.35 },
      search: (s) => {
        s.flags.aqRecord = true;
        gain(s, 'lore', 1.0, { difficulty: 28 });
        return (s.stats.lore + s.stats.magic_t > 28)
          ? '壁に、水位を刻んだ目盛りの板があった。古い文字で、日付らしきものが並んでいる。……水位の線は、七年ごとに一段ずつ高くなっていた。'
          : '壁に、目盛りの刻まれた石板があった。古い文字で何か書かれているが、読めない。書き写しておいた。';
      },
    },
    door: {
      name: '封じられた扉',
      desc: (s) =>
        s.flags.doorOpen
          ? '青銅の扉は、今は開いている。扉の向こうから、温かい風が吹いてくる。'
          : '巨大な青銅の扉。表面には、旧街道の標石と同じ紋様がびっしりと刻まれている。取っ手はない。紋様の一部が、かすかに光っている。',
      action: { label: '扉を調べる', event: 'aq_door', cond: (s) => !s.flags.doorOpen },
      links: [
        { to: 'cistern', label: '貯水槽へ戻る' },
        { to: 'hall', label: '扉の奥へ', cond: (s) => !!s.flags.doorOpen, blocked: '扉は閉ざされている' },
      ],
    },
    hall: {
      name: '標石の間',
      desc: '円形の広間。中央に、旧街道のものとは比べものにならない大きさの石柱がそびえている。石柱の表面を、光の筋が絶え間なく流れ、床へ、壁へ、さらに地の底へと潜っていく。',
      story: 'aq_hall',
      links: [
        { to: 'door', label: '扉へ戻る' },
        { to: 'collapse', label: '石柱の裏の、さらに下る通路へ', cond: () => false, blocked: '崩れた瓦礫で塞がれている（第2章の続きは今後の更新で）' },
      ],
    },
    collapse: {
      name: '崩落した通路',
      desc: '瓦礫で塞がれている。',
      links: [{ to: 'hall', label: '戻る' }],
    },
  },
};

// ───────── 新しい主要人物：アウレリア ─────────

const aureliaTopics: TopicDef[] = [
  {
    id: 'small',
    label: '世間話をする',
    node: {
      lines: [
        (s) =>
          pick(s, [
            [say('aurelia', '辺境の夏は湿気が多いですね。紙が波打ちます。……あなたに言っても仕方のないことですが。')],
            [say('aurelia', '世間話、ですか。私はあまり得意ではありません。用件がないなら、仕事に戻ってもよろしいですか。'), n('そう言いながら、アウレリアは書類から目を上げて{I}の話を最後まで聞いた。')],
            [say('aurelia', 'この街の人は、魔導灯を明るくしすぎます。王都の半分の明るさで、十分に本は読めるのに。')],
          ]),
      ],
      effect: (s) => rel(s, 'aurelia', 'affinity', 1),
    },
  },
  {
    id: 'noin',
    label: 'ノインとの関係を聞く',
    once: true,
    cond: (s) => s.npcs.aurelia.rel.trust >= 6 || s.npcs.aurelia.rel.respect >= 8,
    node: {
      lines: [
        n('アウレリアは、手元のペンを置いた。'),
        say('aurelia', '二十年前、私は本院の見習いでした。ノインは、すでに名の知れた研究者だった。'),
        say('aurelia', '彼女は「世界の魔力は薄まり続けている」という論文を出しました。本院はそれを退けた。反論書を書いたのは、私です。'),
        say('aurelia', '若い見習いが、名のある森人の誤りを正す。出世には、ちょうどいい題材でした。'),
        n('アウレリアは、窓の外の分室の蔦を見た。'),
        say('aurelia', '……彼女が本院を去ったのは、その翌年です。'),
      ],
      effect: (s) => {
        s.flags.knowAureliaPast = true;
        rel(s, 'aurelia', 'trust', 3);
        log(s, 'アウレリアが、二十年前にノインの論文を退ける反論書を書いたことを聞いた。');
      },
      choices: [
        { text: '「今は、どう思っているんですか」', effect: (s) => remember(s, 'aurelia', 'noin:now', 'ノインの論文を今どう思っているか尋ねた。'), next: 't:noin_now' },
        { text: '黙って聞く', effect: (s) => rel(s, 'aurelia', 'trust', 2), next: 'menu' },
      ],
    },
    extraNodes: {
      't:noin_now': {
        lines: [say('aurelia', '……私は、確かめに来たのです。それ以上は、言えません。'), n('アウレリアの手袋の指先が、書類の端をきつく押さえていた。')],
        next: 'menu',
      },
    },
  },
  {
    id: 'theory',
    label: '術式について教えを請う',
    cond: (s) => !!s.flags.magicIntro && s.npcs.aurelia.rel.respect >= 4,
    node: {
      lines: [
        say('aurelia', '……よろしいでしょう。ただし、私は本院の流儀で教えます。ノインのような、感覚頼みの教え方はしません。'),
        n('アウレリアは紙の上に、術式の構造を一本の線も無駄にせず書いていく。それは、ノインの書き込みだらけの教本とは正反対の、冷たいほど整った美しさだった。'),
      ],
      effect: (s) => {
        gain(s, 'magic_t', 1.6, { difficulty: s.stats.magic_t + 14, quality: 1.4, kind: 'mentor', key: 'magic:aurelia' });
        gain(s, 'lore', 0.6, {});
        rel(s, 'aurelia', 'respect', 1.5);
        s.counters.aureliaLessons = (s.counters.aureliaLessons ?? 0) + 1;
      },
    },
  },
  {
    id: 'seal',
    label: '節を封じる考えについて聞く',
    once: true,
    cond: (s) => s.seen.town_meeting !== undefined,
    node: {
      lines: [
        say('aurelia', '潮は、節が流れを取り戻そうとする脈動です。ならば、節を封じれば潮は止まる。単純な理屈です。'),
        say('aurelia', '魔物は減り、魔核は取れなくなるでしょう。この街は貧しくなる。それでも、七年ごとに門の前で人が死ぬよりはいい。'),
        say('aurelia', '……それに、節に残った魔力は、本院の管理のもとに置ける。薄まりつつある魔力を、これ以上無駄に燃やさずに済む。'),
        n('アウレリアは「薄まりつつある」と言った。二十年前に退けた言葉を、自分の口で。'),
      ],
      effect: (s) => rel(s, 'aurelia', 'trust', 2),
    },
  },
];

export const NPCS_CH2: NpcDef[] = [
  {
    id: 'aurelia',
    name: 'アウレリア',
    where: (s) => {
      if (!s.npcs.aurelia?.met) return null;
      if (s.slot === 0) return 'guild';
      if (s.slot === 1 || s.slot === 2) return 'institute';
      return null;
    },
    profile: (s) => [
      '王立魔導院本院から派遣された調査官。冷静で、言葉に無駄がない。',
      ...(s.flags.knowAureliaPast ? ['二十年前、ノインの「魔力は薄まり続けている」という論文に反論書を書いた。'] : []),
      ...(s.seen.town_meeting !== undefined ? ['街の下の節を「封じる」べきだと主張している。'] : []),
    ],
    greet: (s) => [say('aurelia', closeness(s, 'aurelia') > 12 ? '{name}さん。ちょうど、意見を聞きたいことがありました。' : 'ご用件は。手短にお願いします。')],
    topics: aureliaTopics,
  },
];

// ノインへの話題
export const NOIN_TOPICS_CH2: TopicDef[] = [
  {
    id: 'door',
    label: '地下の封じられた扉のことを話す',
    once: true,
    cond: (s) => !!s.flags.needDoorHelp && !s.flags.doorOpen,
    node: {
      lines: [
        say('noin', '青銅の扉？　標石と同じ紋様の？'),
        n('ノインは、{I}が書き写してきた紋様を見て、しばらく黙っていた。'),
        say('noin', '……これ、鍵じゃない。「名乗り」だ。灯脈の管理者が、自分の魔力を流して名乗るための術式。'),
        say('noin', 'つまり、魔力を正しい順番で流せば開く。順番は、ここに書いてある。……書き写してくれて、ほんとにありがと。'),
        say('noin', 'この紙を持っていって。この通りに、指先で紋様をなぞればいい。'),
      ],
      effect: (s) => {
        s.flags.doorKey = true;
        rel(s, 'noin', 'trust', 3);
        log(s, 'ノインが、地下の扉の紋様を読み解いてくれた。');
      },
    },
  },
];

// ───────── イベント ─────────

const ch2Start: EventDef = {
  id: 'ch2_start',
  trigger: 'slot',
  priority: 80,
  once: true,
  cond: (s) => ch2(s) && s.day >= 91 && s.slot === 0,
  nodes: {
    start: {
      lines: [
        n('――第2章　灯脈の節'),
        n('陽月。カルナスに夏が来た。'),
        n('森の上の霞は薄く、昼の日差しは容赦がない。大潮の夜の傷跡は、門の前の柵の焦げ跡と、東門の外の墓標にだけ残っていた。'),
        (s): Line[] =>
          s.flags.knowNode
            ? [
                n('朝、灯り亭の食堂に、ノインが駆け込んできた。手に一通の封書を握っている。'),
                say('noin', '本院から返事が来た。潮計の記録を送ったんだ。……「調査官を派遣する」って。'),
                say('noin', '誰が来るかは書いてない。でも、たぶん、私の知ってる人だ。'),
                n('ノインの声は、喜んでいるようにも、怯えているようにも聞こえた。'),
              ]
            : [n('朝、ギルドの掲示板に貼り紙があった。「王立魔導院本院より調査官来訪。大潮の記録について聞き取りを行う」'), n('大潮の被害の報告が、王都まで届いたらしい。')],
      ],
      effect: (s) => log(s, '夏が来た。王都の魔導院から、調査官が来るという。'),
    },
  },
};

const aureliaArrive: EventDef = {
  id: 'aurelia_arrive',
  trigger: 'slot',
  priority: 50,
  once: true,
  cond: (s) => s.seen.ch2_start !== undefined && s.day >= 94 && s.slot === 1,
  nodes: {
    start: {
      lines: [
        n('昼過ぎ、魔導院分室の前に、王都の紋章をつけた馬車が止まった。'),
        n('降りてきたのは、灰色の外套に銀の徽章をつけた女性だった。髪をきつく結い上げ、薄手の手袋をはめている。歳は三十の半ばだろうか。'),
        n('蔦の扉から出てきたノインが、その場で足を止めた。'),
        say('noin', '……アウレリア。'),
        say('女性', 'お久しぶりです、ノイン。二十年ぶりでしょうか。'),
        say('aurelia', '王立魔導院本院、調査官アウレリア・ヴェイルです。本日より、この分室と、潮計の記録を本院の管理下に置きます。'),
        n('ノインの顔から、表情が消えた。'),
        say('aurelia', '……あなたは？'),
        n('アウレリアの視線が、{I}に向いた。'),
      ],
      effect: (s) => meet(s, 'aurelia'),
      choices: [
        { text: '「ノインの助手です」', cond: (s) => s.npcs.noin.rel.trust >= 10, effect: (s) => { s.flags.claimedAssistant = true; rel(s, 'noin', 'trust', 4); rel(s, 'aurelia', 'wariness', 3); remember(s, 'aurelia', 'first:assistant', '初対面で「ノインの助手だ」と名乗った。'); }, next: 'assistant' },
        { text: '「冒険者です。大潮の夜、門の前にいました」', effect: (s) => { rel(s, 'aurelia', 'respect', 3); remember(s, 'aurelia', 'first:adventurer', '初対面で、大潮の夜に門の前にいたと名乗った。'); }, next: 'adventurer' },
        { text: '黙って会釈する', effect: (s) => remember(s, 'aurelia', 'first:quiet', '初対面で、黙って会釈した。'), next: 'quiet' },
      ],
    },
    assistant: {
      lines: [
        say('aurelia', '助手。……分室に正式な助手がいるという記録は、本院にはありませんが。'),
        say('noin', 'これから届け出るところ。'),
        n('ノインが、{I}の隣に一歩踏み出した。'),
        say('aurelia', '……そうですか。では、届け出が受理されるまでは、記録の閲覧は私の許可のもとで行ってください。'),
      ],
      effect: (s) => (s.flags['offer:institute'] = 'pending'),
      next: 'end',
    },
    adventurer: {
      lines: [say('aurelia', '大潮の夜の。……そうですか。では、あとであなたにも話を聞かせていただきます。記録には、数字しか残りませんから。')],
      next: 'end',
    },
    quiet: { lines: [n('アウレリアは小さく頷き、それ以上は何も言わずに分室の中へ入っていった。')], next: 'end' },
    end: {
      lines: [n('馬車から、書類の詰まった木箱が次々と運び込まれていく。蔦の扉の前で、ノインは長い間、立ち尽くしていた。')],
      effect: (s) => log(s, '王都の魔導院から、調査官アウレリアが来た。ノインとは旧知の仲らしい。'),
      end: { advance: true },
    },
  },
};

const godwinArrive: EventDef = {
  id: 'godwin_arrive',
  trigger: 'slot',
  priority: 45,
  once: true,
  cond: (s) => s.seen.aurelia_arrive !== undefined && s.day >= 96 && s.slot === 1,
  nodes: {
    start: {
      lines: [
        n('東市場が、朝からざわついていた。'),
        n('ベルク商会の店先に、大柄な男が立っていた。白髪交じりの短い髪。上等な外套の袖から覗く手は、節くれだって傷だらけだ。荷運びの手だ、と思った。'),
        say('男', 'エドガー！　よくやった。お前の帳簿は、王都の本店のどの帳簿より正確だ。'),
        n('男は人目もはばからず、エドガーの肩を叩いた。エドガーは、どう反応していいか分からないという顔で立ち尽くしている。'),
        say('男', 'ゴドウィン・ベルクだ。この街の皆さんには、いつも世話になっている。'),
        n('男は市場の人々に向き直り、よく通る声で言った。'),
        say('ゴドウィン', '今日は、いい知らせを持ってきた。この街の真下には、大陸一の魔核の鉱脈が眠っている。商会はそれを掘る。東区の土地をまとめて買い上げ、倉庫と坑道を作る。この街は、王都より豊かになるぞ。'),
        n('歓声と、戸惑いの声が入り混じった。'),
        (s) => (s.flags.martaDebt ? n('人だかりの外れで、マルタが前掛けを握りしめていた。東区には、灯り亭がある。') : null),
      ],
      effect: (s) => {
        s.flags.godwinArrived = true;
        s.flags.martaDebt = true;
        log(s, 'ベルク商会の主、ゴドウィン・ベルクがカルナスに来た。街の下を掘ると宣言した。');
      },
      next: (s) => (s.rank >= 2 || s.flags.alphaSlain || (s.npcs.edgar?.rel.trust ?? 0) >= 12 ? 'offer' : 'end'),
    },
    offer: {
      lines: [
        n('人だかりが散った後、ゴドウィンが{I}の前で足を止めた。'),
        (s) =>
          s.flags.alphaSlain
            ? say('ゴドウィン', '大潮の夜に群れ長を斬った冒険者というのは、君か。噂より若いな。')
            : say('ゴドウィン', '息子が世話になっていると聞いた。'),
        say('ゴドウィン', 'うちの調査隊に、腕の立つ護衛が要る。報酬は、ギルドの依頼の三倍出そう。気が向いたら、店の帳場に来てくれ。'),
        n('ゴドウィンの後ろで、エドガーが何か言いたそうに口を開いて、また閉じた。'),
      ],
      effect: (s) => {
        s.flags['offer:berg'] = 'pending';
        log(s, 'ゴドウィンから、商会の調査隊の護衛に誘われた。');
      },
      next: 'end',
    },
    end: { lines: [], end: { advance: true } },
  },
};

const noinOffer: EventDef = {
  id: 'noin_offer',
  trigger: 'after',
  priority: 46,
  once: true,
  cond: (s) => s.seen.aurelia_arrive !== undefined && s.location === 'institute' && offer(s, 'institute') === undefined && s.npcs.noin.rel.trust >= 8,
  nodes: {
    start: {
      lines: [
        n('分室の奥の、物置のような小部屋で、ノインが本と試料の瓶に埋もれていた。自分の部屋をアウレリアに明け渡したらしい。'),
        say('noin', 'ねえ、きみ。お願いがある。'),
        say('noin', '分室の助手になってくれないかな。正式に。本院の規則だと、分室に正式な職員が二人以上いれば、研究の継続を申し立てられるんだ。'),
        say('noin', '給金は安いし、週に二回は手伝ってもらうことになる。……でも、きみがいてくれたら、私はまだここで戦える。'),
      ],
      choices: [
        { text: '「なる」', effect: (s) => { join(s, 'institute'); rel(s, 'noin', 'trust', 6, { big: true }); log(s, '魔導院分室の、ノインの助手になった。'); }, next: 'yes' },
        { text: '「少し考えさせて」', effect: (s) => { s.flags['offer:institute'] = 'pending'; }, next: 'later' },
      ],
    },
    yes: { lines: [say('noin', '……ありがと。'), n('ノインは、試料の瓶を抱えたまま、少しだけ泣きそうな顔で笑った。')] },
    later: { lines: [say('noin', 'うん。決まったら、分室で声をかけて。')] },
  },
};

const hansOffer: EventDef = {
  id: 'hans_offer',
  trigger: 'slot',
  priority: 44,
  once: true,
  cond: (s) => s.seen.godwin_arrive !== undefined && s.day >= 99 && s.slot === 0,
  nodes: {
    start: {
      lines: [
        n('朝、灯り亭に守備隊の隊長ハンスが訪ねてきた。'),
        say('ハンス', '東区の古井戸から、夜な夜な青い光が漏れてる。調べたら、井戸の底が、旧い水道につながってた。四百年前の、誰も知らなかった水道だ。'),
        say('ハンス', '商会も魔導院も、我先に潜りたがってる。守備隊としては、街の真下を好き勝手に掘り返されちゃ困る。……信用できる人手が欲しい。'),
        (s) =>
          s.flags.garrisonPrepared || (s.counters.nightwatch ?? 0) >= 2 || s.flags.alphaSlain
            ? say('ハンス', 'お前は大潮の夜に門の前で踏ん張った。臨時兵として、守備隊に来てくれないか。')
            : say('ハンス', '新人に頼む話じゃないのは分かってる。だが、ギルドの連中は商会に雇われ始めてる。臨時兵として、守備隊に来てくれないか。'),
        say('ハンス', '週に二回、門の夜警か、地下の巡回をしてもらう。給金は商会ほどじゃないが、地下に入る許可は出せる。'),
      ],
      choices: [
        { text: '「引き受けます」', effect: (s) => { join(s, 'garrison'); log(s, '守備隊の臨時兵になった。'); }, next: 'yes' },
        { text: '「考えさせてください」', effect: (s) => { s.flags['offer:garrison'] = 'pending'; }, next: 'later' },
      ],
      effect: (s) => {
        s.flags.aqueductOpen = true;
        log(s, '東区の古井戸の底に、四百年前の水道が見つかった。');
      },
    },
    yes: { lines: [say('ハンス', '助かる。入口は東区の井戸小屋だ。降りるときは、松明を忘れるなよ。')] },
    later: { lines: [say('ハンス', '気が変わったら、東門の詰所に来てくれ。')] },
  },
};

const aqJunction: EventDef = {
  id: 'aq_junction',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [
        n('分岐の真ん中に立ったとき、足元から、低い振動が伝わってきた。'),
        n('どくん。どくん。'),
        n('心臓の音に似ている。けれど、ゆっくりすぎる。一つの鼓動の間に、十は息ができる。'),
        (s) => (s.flags.calibrated ? n('城壁の上で、潮計に手を当てたときと同じ感覚だった。森の鼓動。いや、違う。これは、もっと近くから来ている。') : null),
        (s) => (s.explore?.companion === 'lyne' ? say('lyne', '……ねえ、今の、聞こえた？　気のせいじゃないわよね。') : null),
      ],
    },
  },
};

const aqMural: EventDef = {
  id: 'aq_mural',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [
        n('壁画は、回廊の端から端まで続いていた。'),
        n('中央に、大きな円。心臓のようにも、花のようにも見える。そこから無数の線が、四方へ、大陸の果てまで伸びている。線の先には、街や、畑や、笑う人々が描かれていた。'),
        n('回廊の奥へ進むと、絵が変わった。'),
        n('線が、途切れている。円がひび割れ、そこから灰色のものが滲み出している。街は暗く、人々は地に伏している。'),
        n('最後の一枚。ひび割れた円の前に、一人の人物が立っていた。両手を円に当てている。その人物の足元から、細い、細い線が一本だけ、再び伸びはじめていた。'),
      ],
      effect: (s) => {
        s.flags.sawMural = true;
        gain(s, 'lore', 1.0, { difficulty: 30 });
        log(s, '旧水道の回廊で、灯脈を描いた古い壁画を見た。');
      },
    },
  },
};

const aqDoor: EventDef = {
  id: 'aq_door',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [n('青銅の扉の前に立つ。紋様の光が、{I}の気配に応じるように、わずかに強まった気がした。')],
      next: (s) => (s.flags.doorOpen ? 'already' : 'choose'),
    },
    already: { lines: [n('扉は開いたままだ。')] },
    choose: {
      lines: [],
      choices: [
        { text: 'ノインに教わった通りに紋様をなぞる', cond: (s) => !!s.flags.doorKey, next: 'open' },
        { text: '紋様を自分で読み解こうとする', next: 'read' },
        { text: '紋様を書き写して持ち帰る', next: 'copy' },
        { text: '今は立ち去る', next: 'leave' },
      ],
    },
    read: {
      lines: [
        (s) => {
          const ok = s.stats.magic_t + s.stats.lore * 0.5 >= 30 && !!s.flags.magicIntro;
          s.flags._doorRead = ok ? 1 : 0;
          return ok
            ? n('紋様の流れを目でたどる。これは鍵ではない。名乗りだ。魔力を流す順番が、紋様そのものに書かれている。……指先に魔力を集め、紋様をなぞった。')
            : n('紋様を目で追う。旧街道の標石と同じ系統の術式だということは分かる。だが、それ以上は読めなかった。');
        },
      ],
      effect: (s) => gain(s, 'magic_t', 1.2, { difficulty: 34 }),
      next: (s) => (s.flags._doorRead ? 'open' : 'copy'),
    },
    copy: {
      lines: [n('松明の明かりを頼りに、紋様を紙に書き写した。ノインなら、何か分かるかもしれない。')],
      effect: (s) => {
        s.flags.needDoorHelp = true;
        delete s.flags._doorRead;
      },
    },
    open: {
      lines: [
        n('指先が紋様の最後の一画をなぞり終えた瞬間、扉全体が淡く光った。'),
        n('重い音を立てて、青銅の扉がひとりでに開いていく。'),
        n('扉の向こうから、温かい風が吹いてきた。澱の匂いではない。もっと澄んだ、雨上がりの森のような匂いだった。'),
      ],
      effect: (s) => {
        s.flags.doorOpen = true;
        delete s.flags._doorRead;
        log(s, '旧水道の奥の、青銅の扉を開いた。');
      },
    },
    leave: { lines: [n('扉に背を向けた。')] },
  },
};

const aqHall: EventDef = {
  id: 'aq_hall',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [
        n('石柱の前に立つと、鼓動がはっきりと聞こえた。'),
        n('どくん。……どくん。'),
        n('石柱の表面を流れる光の筋が、鼓動に合わせて明滅している。地の底へ潜っていく光と、地の底から昇ってくる光。どちらも、ひどく細く、弱々しい。'),
        n('手を伸ばせば、触れられる距離だった。'),
      ],
      choices: [
        { text: '石柱に手を当てる', next: 'touch' },
        { text: '触れずに、よく観察する', next: 'watch' },
      ],
    },
    touch: {
      lines: [
        n('冷たい石の感触。次の瞬間、手のひらから腕へ、胸へ、何かが流れ込んできた。'),
        n('森。街。畑。人々の笑い声。そして、それが少しずつ、少しずつ遠ざかっていく感覚。誰かが、ずっと遠くで、名前を呼び続けている。'),
        n('気がつくと、石柱から手を離して、床に座り込んでいた。手のひらが、まだ温かい。'),
      ],
      effect: (s) => {
        s.flags.touchedNode = true;
        gain(s, 'magic_p', 1.5, { difficulty: 30, kind: 'practice' });
        gain(s, 'will', 1.0, { difficulty: 30 });
      },
      next: 'end',
    },
    watch: {
      lines: [
        n('石柱の根元を調べる。光の筋は、床の溝を通って四方へ伸びている。だが、その大半は途中で途切れ、溝の中に灰色の澱が溜まっていた。'),
        n('流れが、詰まっている。'),
        n('あの壁画の、ひび割れた円と同じだ。'),
      ],
      effect: (s) => {
        s.flags.sawClog = true;
        gain(s, 'wit', 1.0, { difficulty: 30 });
      },
      next: 'end',
    },
    end: {
      lines: [
        n('ここが、ノインの言っていた「節」なのだろうか。'),
        n('石柱の裏に、さらに地の底へ下る通路があった。だが、崩れた瓦礫に塞がれている。'),
        n('（第2章の続き――地下の深部と、この節をめぐる物語――は、今後のアップデートで追加されます。）'),
      ],
      effect: (s) => {
        s.flags.foundHall = true;
        log(s, '旧水道の最奥で、巨大な標石の立つ広間を見つけた。地の底から、鼓動が聞こえた。');
      },
    },
  },
};

const exploreFight: EventDef = {
  id: 'explore_fight',
  trigger: 'manual',
  nodes: {
    win: { lines: [n('静けさが戻った。水の流れる音だけが、闇の中に響いている。')] },
    flee: { lines: [n('闇の中を走り、どうにか振り切った。息を整えて、辺りを見回す。')] },
    lose: {
      lines: [
        n('倒れた{I}の上を、何かが通り過ぎていった。'),
        n('どれくらい気を失っていたのか分からない。松明は消えかけていた。壁を伝い、這うようにして、地上の光を目指した。'),
      ],
      effect: (s) => {
        s.explore = null;
        s.location = 'undercity';
        log(s, '旧水道で魔物に敗れ、這うようにして地上へ戻った。');
      },
      end: { advance: true },
    },
  },
};

const townMeeting: EventDef = {
  id: 'town_meeting',
  trigger: 'slot',
  priority: 55,
  once: true,
  cond: (s) => s.seen.hans_offer !== undefined && s.day >= 108 && s.slot === 1,
  nodes: {
    start: {
      lines: [
        n('ギルドの広間に、街の主だった者たちが集められた。'),
        n('支部長ボルド。守備隊長ハンス。調査官アウレリア。商会主ゴドウィン。そして、壁際に、ノインとエドガー。'),
        say('ボルド', '街の下に、旧い水道がある。その奥に、灯脈の「節」とかいうものがあるらしい。……で、それをどうするか、だ。'),
        say('aurelia', '封じるべきです。潮は節の脈動によるもの。節を封じれば、潮は止まります。本院が管理します。'),
        say('ゴドウィン', '掘るべきだ。節とやらには、大陸一の魔核が眠っている。それを燃やせば、この街は百年食っていける。'),
        n('広間の空気が、二つに割れた。'),
        (s): Line[] =>
          s.flags.edgarNoin
            ? [
                say('noin', '……どっちも違う。'),
                n('ノインが一歩前に出た。隣で、エドガーが帳簿の束を抱えて青い顔をしている。'),
                say('noin', '節は、詰まってるだけなんだ。流れを「還せ」ば、潮は暴れなくなる。魔力も、この土地に戻ってくる。'),
                say('edgar', 'ぼ、僕の数字も、それを……示しています。魔核は大きくなっているのに、中身は薄くなっている。燃やせば燃やすほど、です。'),
                n('ゴドウィンが、息子を見た。長い、長い沈黙だった。'),
              ]
            : [say('noin', '……どっちも、違うと思う。'), n('ノインの小さな声は、誰の耳にも届かなかった。')],
        say('ボルド', '結論は、地下の調査が進んでからだ。それまで、誰も勝手に掘るな。勝手に封じるな。'),
        n('散会の後、何人もの視線が{I}に向いた。地下に潜ったことのある、数少ない一人として。'),
      ],
      choices: [
        { text: '（封じる、というアウレリアの考えに傾く）', effect: (s) => { s.flags.ch2Lean = 'seal'; rel(s, 'aurelia', 'trust', 3); } },
        { text: '（掘る、というゴドウィンの考えに傾く）', effect: (s) => { s.flags.ch2Lean = 'dig'; rel(s, 'edgar', 'wariness', 2); } },
        { text: '（還す、というノインの考えに傾く）', cond: (s) => !!s.flags.edgarNoin || !!s.flags.sawMural, effect: (s) => { s.flags.ch2Lean = 'return'; rel(s, 'noin', 'trust', 3); } },
        { text: '（まだ分からない）', effect: (s) => { s.flags.ch2Lean = 'none'; } },
      ],
      effect: (s) => log(s, '街の下の「節」をどうするか、ギルドの広間で話し合いが開かれた。封じるか、掘るか。'),
      next: 'note',
    },
    note: {
      lines: [n('自分の考えは、まだ誰にも言っていない。決めるのは、もっと地下を知ってからだ。'), n('（第2章は、ここから先を今後のアップデートで追加していきます。）')],
      end: { advance: true },
    },
  },
};

export const EVENTS_CH2: EventDef[] = [ch2Start, aureliaArrive, godwinArrive, noinOffer, hansOffer, aqJunction, aqMural, aqDoor, aqHall, exploreFight, townMeeting];

export function registerCh2() {
  for (const a of AFFILIATIONS) R.affiliations.set(a.id, a);
  R.dungeons.set(AQUEDUCT.id, AQUEDUCT);
  for (const l of LOCATIONS2) R.locations.set(l.id, l);
  R.npcs.get('noin')?.topics.push(...NOIN_TOPICS_CH2);
}

