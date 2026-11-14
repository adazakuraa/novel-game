// 追加の主要NPC：マルタ（灯り亭の女将）、エドガー（ベルク商会の次男）。ネタバレを含む。
import type { ActivityDef, EventDef, NpcDef, TopicDef } from '../engine/defs';
import type { GameState } from '../engine/types';
import { n, say } from '../engine/text';
import { closeness, meet, rel, remember } from '../engine/npc';
import { gain } from '../engine/growth';
import { log } from '../engine/game';
import { pick } from '../engine/rng';
import { clamp } from '../engine/stats';

const used = (s: GameState, npc: string, topic: string) => s.npcs[npc]?.topicsUsed[topic] !== undefined;
const R_ = (s: GameState, npc: string) => s.npcs[npc].rel;

function impression(s: GameState, id: string, name: string): string[] {
  const r = s.npcs[id].rel;
  const out: string[] = [];
  if (r.trust > 30) out.push(`${name}は、{I}を頼りにしてくれているようだ。`);
  else if (r.trust > 12) out.push(`${name}は、少しずつ{I}に心を開いてきている気がする。`);
  if (r.respect > 20) out.push(`${name}は、{I}のことを一人前と見てくれている。`);
  if (r.affinity > 25) out.push(`${name}と話していると、肩の力が抜ける。`);
  if (r.wariness > 15) out.push(`${name}は、{I}をどこか警戒している。`);
  if (r.debt > 12) out.push(`${name}には、返しきれない恩がある。あるいは、その逆か。`);
  if (out.length === 0) out.push(`${name}とは、まだ顔見知り程度だ。`);
  return out;
}

// ───────── マルタ ─────────

const martaTopics: TopicDef[] = [
  {
    id: 'small',
    label: '世間話をする',
    node: {
      lines: [
        (s) =>
          pick(s, [
            [say('marta', '今日の煮込みはね、豆を一晩水に浸けといたんだよ。だから柔らかいだろ？'), n('食べてみると、たしかにいつもより柔らかかった。')],
            [say('marta', 'あの子たち、今日も森から帰ってきた。それだけで一日いい日さ。'), n('マルタは、食堂の若い冒険者たちを眺めて目を細めた。')],
            [say('marta', '冒険者ってのはね、靴を見ればだいたい分かるんだよ。あんたの靴は……まあ、もうちょっと手入れしな。')],
            [say('marta', 'ほら、これ。客が残していった干し果物。あんたにあげるよ。'), n('甘酸っぱい匂いがした。')],
          ]),
      ],
      effect: (s) => {
        rel(s, 'marta', 'affinity', 1.2);
        s.cond.stress = clamp(s.cond.stress - 4, 0, 100);
      },
    },
  },
  {
    id: 'husband',
    label: '亡くなったご主人のことを聞く',
    once: true,
    cond: (s) => R_(s, 'marta').affinity >= 7,
    node: {
      lines: [
        n('マルタは、カウンターの奥に掛けられた古い外套に目をやった。'),
        say('marta', 'トマスって言ってね。鉄級止まりの、ぱっとしない冒険者だった。'),
        say('marta', '十四年前の大潮で、帰ってこなかった。七年前の、その前のやつさ。'),
        say('marta', 'あの人の口癖がね、「新人が安く泊まれて、あったかい飯が食える宿があったらな」って。自分が新人のとき、ろくな宿がなくて苦労したんだって。'),
        say('marta', 'だから、あたしはこの宿をやってる。あの人の夢の、続きをね。'),
      ],
      choices: [
        { text: '「いい宿です。本当に」', effect: (s) => { rel(s, 'marta', 'affinity', 3); remember(s, 'marta', 'husband:praise', '灯り亭を「いい宿だ」と言った。'); }, next: 'menu' },
        { text: '黙って外套を見る', effect: (s) => { rel(s, 'marta', 'trust', 3); remember(s, 'marta', 'husband:quiet', 'トマスの外套を、黙って見ていた。'); }, next: 'menu' },
      ],
    },
  },
  {
    id: 'tab',
    label: 'カウンターの下の帳面のことを聞く',
    once: true,
    cond: (s) => R_(s, 'marta').trust >= 10 || (s.counters.tab ?? 0) > 0,
    node: {
      lines: [
        n('マルタは少し迷ってから、カウンターの下から分厚い帳面を取り出した。表紙に「ツケ帳」とある。'),
        say('marta', '金のない新人には、宿代を待ってやってるんだよ。稼げるようになったら返しな、ってね。'),
        n('ページをめくる。名前と金額が、何十人分も並んでいた。いくつかの名前には、細い線が一本引かれている。'),
        say('marta', '線が引いてあるのは、返しに来なかった子たち。……森から、帰ってこなかった子たちさ。'),
        say('marta', '捨てられないんだよね、この帳面。'),
      ],
      effect: (s) => {
        s.flags.knowTabBook = true;
        rel(s, 'marta', 'trust', 3);
      },
      choices: [
        { text: '「宿の手伝いをさせてください」', effect: (s) => { s.flags.martaHelp = true; rel(s, 'marta', 'affinity', 3); remember(s, 'marta', 'tab:help', '宿の手伝いを申し出た。'); log(s, '灯り亭の手伝いをさせてもらえることになった。'); }, next: 't:tab_help' },
        { text: '「自分は、必ず返しに来ます」', effect: (s) => { rel(s, 'marta', 'trust', 4); remember(s, 'marta', 'tab:promise', '「必ず返しに来る」と約束した。'); }, next: 'menu' },
      ],
    },
    extraNodes: {
      't:tab_help': { lines: [say('marta', '……物好きだねえ。じゃあ、夕方か夜に、皿洗いでも頼もうかね。駄賃と晩飯くらいは出すよ。')], next: 'menu' },
    },
  },
  {
    id: 'rent',
    label: '最近、元気がない理由を聞く',
    once: true,
    cond: (s) => used(s, 'marta', 'tab') && s.day >= 35,
    node: {
      lines: [
        say('marta', '……顔に出てたかい。年だねえ。'),
        say('marta', 'この建物、ベルク商会からの借り物なんだよ。魔核の景気がいいもんだから、家賃を倍にするって言ってきてね。'),
        say('marta', '払えなきゃ、出ていけってさ。この辺りに、魔核の倉庫を建てたいらしい。'),
        say('marta', 'ま、なんとかするさ。あんたは気にしなくていいよ。'),
        n('マルタは笑って、皿を拭く手を動かした。いつもより、手つきが速かった。'),
      ],
      effect: (s) => {
        s.flags.martaDebt = true;
        rel(s, 'marta', 'trust', 2);
        log(s, '灯り亭の家賃が、ベルク商会に倍に引き上げられようとしていると知った。');
      },
    },
  },
];

// ───────── エドガー ─────────

const edgarTopics: TopicDef[] = [
  {
    id: 'small',
    label: '世間話をする',
    node: {
      lines: [
        (s) =>
          pick(s, [
            [say('edgar', 'き、今日は荷が三箱多く届きました。いえ、多いのは悪いことじゃないんですけど、帳簿が合わないのは……落ち着かなくて。')],
            [say('edgar', 'この街の人は、魔導灯を一晩に何刻灯すと思います？　……平均で四刻です。十年前は三刻でした。'), n('エドガーは、それがとても面白いことのように目を輝かせた。')],
            [n('エドガーは帳簿から顔を上げずに、それでも{I}の話に丁寧に相槌を打った。'), say('edgar', '……あ、すみません。ちゃんと聞いてます。数字を見ながらのほうが、落ち着くんです。')],
            [say('edgar', '父には、数字ばかり見ていないで人を見ろと言われます。でも、人を見ても、僕には何も分からないんです。')],
          ]),
      ],
      effect: (s) => rel(s, 'edgar', 'affinity', 1.2),
    },
  },
  {
    id: 'numbers',
    label: '何を記録しているのか聞く',
    once: true,
    cond: (s) => R_(s, 'edgar').affinity >= 4,
    node: {
      lines: [
        n('エドガーは、帳簿とは別の、手垢で黒ずんだ冊子を取り出した。'),
        say('edgar', '商会が買い取った魔核の記録です。重さと、大きさと、取れた魔物の種類。十二年分。'),
        say('edgar', '……魔核が、毎年少しずつ大きくなってるんです。同じ種類の魔物から取れたものでも。'),
        say('edgar', 'それなのに、一つの魔核で魔導灯が灯せる時間は、年々短くなってる。大きいのに、中身が薄いんです。'),
        say('edgar', '父は、魔核が大きくなるのは儲かることだと言いました。でも僕には、何かが……減っているように見える。'),
      ],
      effect: (s) => {
        s.flags.edgarData = true;
        rel(s, 'edgar', 'trust', 3);
        log(s, 'エドガーから、魔核が年々大きくなっているのに、力は弱くなっているという話を聞いた。');
      },
      choices: [
        { text: '「魔導院のノインに見せてみては」', cond: (s) => s.npcs.noin.met, effect: (s) => { s.flags.edgarNoinLink = true; rel(s, 'edgar', 'trust', 2); remember(s, 'edgar', 'numbers:noin', '魔核の記録をノインに見せるよう勧めた。'); }, next: 't:numbers_noin' },
        { text: '「その記録、すごいことかもしれない」', effect: (s) => { rel(s, 'edgar', 'respect', 4); remember(s, 'edgar', 'numbers:praise', '魔核の記録を「すごい」と言った。'); }, next: 'menu' },
        { text: '「難しくてよく分からない」', effect: (s) => rel(s, 'edgar', 'affinity', 1), next: 'menu' },
      ],
    },
    extraNodes: {
      't:numbers_noin': {
        lines: [say('edgar', '魔導院の……森人の方ですか？　僕なんかが行っても、迷惑じゃ……'), n('エドガーは冊子を胸に抱えて、しばらく黙っていた。'), say('edgar', '……あなたが、一緒に来てくれるなら。')],
        next: 'menu',
      },
    },
  },
  {
    id: 'engagement',
    label: 'リーネとの縁談のことを聞く',
    once: true,
    cond: (s) => s.seen.lyne_letter !== undefined && s.npcs.lyne.met,
    node: {
      lines: [
        n('エドガーの顔から、血の気が引いた。'),
        say('edgar', '……ご存じなんですね。'),
        say('edgar', 'アーデル家は、うちの商会に大きな借りがあります。父はその利子の代わりに、家名を買おうとした。僕は、その道具です。'),
        (s) =>
          s.flags.lyneLeft
            ? [say('edgar', 'あの方は、王都へ帰られたと聞きました。……僕のせいで。'), n('エドガーは帳簿の端を、指が白くなるほど握っていた。')]
            : s.flags.lyneStays
              ? [say('edgar', 'あの方が断ってくれて、ほっとしました。……ひどい言い方ですね。でも、本当なんです。'), say('edgar', '人を、利子みたいに扱いたくなかった。僕には、それを父に言う勇気がなかったけど。')]
              : say('edgar', 'まだ、返事は来ていません。……来なければいいと、思ってしまっています。'),
      ],
      effect: (s) => {
        rel(s, 'edgar', 'trust', 3);
        remember(s, 'edgar', 'engagement:asked', 'リーネとの縁談について聞いた。');
      },
    },
  },
  {
    id: 'father',
    label: '父親のことを聞く',
    once: true,
    cond: (s) => R_(s, 'edgar').trust >= 14,
    node: {
      lines: [
        say('edgar', '父は……ゴドウィン・ベルクは、王都の裏通りの荷運びから、一代で商会を作った人です。'),
        say('edgar', '尊敬はしています。でも、父にとって世の中は全部、帳簿の上の数字なんです。人も、街も、森も。'),
        say('edgar', '兄は父にそっくりです。僕は……そうなれなかった。だからこんな辺境の支店に回されてるんです。'),
        n('エドガーは少し笑った。'),
        say('edgar', 'でも、ここに来てよかったと思ってます。数字の向こうに、人がいるのが見えるから。'),
      ],
      effect: (s) => {
        rel(s, 'edgar', 'trust', 3);
        rel(s, 'edgar', 'affinity', 2);
        remember(s, 'edgar', 'father:listened', '父ゴドウィンの話を聞いた。');
      },
    },
  },
  {
    id: 'marta_rent',
    label: '灯り亭の家賃のことを聞く',
    once: true,
    cond: (s) => !!s.flags.martaDebt && R_(s, 'edgar').trust >= 8,
    node: {
      lines: [
        n('エドガーは、困ったように周りを見回した。'),
        say('edgar', '……灯り亭の件は、本店の決定です。僕には止められません。'),
        say('edgar', 'でも、書類の処理を、少し遅らせることはできます。手違いで。……もう二か月、遅らせてます。'),
        say('edgar', 'マルタさんには、言わないでください。あの人は、施しを嫌うから。'),
      ],
      choices: [
        { text: '「分かった。黙っておく」', effect: (s) => { s.flags.keepEdgarSecret = true; rel(s, 'edgar', 'trust', 5); remember(s, 'edgar', 'rent:secret', '家賃の件を、マルタに黙っておくと約束した。'); }, next: 'menu' },
        { text: '「マルタさんには、知る権利があると思う」', effect: (s) => { s.flags.tellMarta = true; rel(s, 'edgar', 'respect', 3); rel(s, 'edgar', 'wariness', 3); remember(s, 'edgar', 'rent:tell', '家賃の件をマルタに話すべきだと言った。'); }, next: 't:rent_tell' },
      ],
    },
    extraNodes: {
      't:rent_tell': { lines: [say('edgar', '……そう、ですよね。'), say('edgar', 'でも、僕が言ったら、あの人はきっと怒ります。あなたから、伝えてもらえませんか。')], next: 'menu' },
    },
  },
];

// マルタへの話題（エドガーの秘密を伝える）
martaTopics.push({
  id: 'edgar_secret',
  label: 'エドガーが家賃の件を遅らせていたことを話す',
  once: true,
  cond: (s) => !!s.flags.tellMarta,
  node: {
    lines: [
      n('マルタは、しばらく何も言わなかった。'),
      say('marta', '……あの、ひょろっとした坊ちゃんがかい。'),
      say('marta', '余計なことを。まったく、余計なことを。'),
      n('マルタは前掛けで目元を拭った。'),
      say('marta', '今度来たら、煮込みを大盛りにしてやらなきゃね。'),
    ],
    effect: (s) => {
      s.flags.martaKnowsEdgar = true;
      rel(s, 'marta', 'trust', 4);
      rel(s, 'edgar', 'trust', 2);
      log(s, 'マルタに、エドガーが家賃の件を遅らせていたことを話した。');
    },
  },
});

// ───────── NPC定義 ─────────

export const NPCS2: NpcDef[] = [
  {
    id: 'marta',
    name: 'マルタ',
    where: (s) => (s.slot === 1 ? 'market' : 'inn'),
    profile: (s) => [
      '灯り亭の女将。新人冒険者たちの母親代わり。',
      ...(used(s, 'marta', 'husband') ? ['夫のトマスは、十四年前の大潮で帰らなかった。宿は、夫の夢の続きだという。'] : []),
      ...(s.flags.knowTabBook ? ['金のない新人に宿代を待つ「ツケ帳」をつけている。'] : []),
      ...(s.flags.martaDebt ? ['ベルク商会から、家賃を倍にすると迫られている。'] : []),
      ...((s.counters.tab ?? 0) > 0 ? [`宿代を${s.counters.tab}銅貨、待ってもらっている。`] : []),
      ...impression(s, 'marta', 'マルタ'),
    ],
    greet: (s) => [
      s.slot === 1
        ? say('marta', 'おや、あんたも買い物かい。')
        : say('marta', closeness(s, 'marta') > 15 ? 'おかえり。今日は無事だったかい。' : 'はいよ、何か用かい。'),
    ],
    topics: martaTopics,
  },
  {
    id: 'edgar',
    name: 'エドガー',
    where: (s) => {
      if (!s.npcs.edgar.met) return null;
      if (s.slot === 1 || s.slot === 2) return s.day % 6 === 0 ? null : 'market';
      if (s.slot === 3 && s.day % 4 === 0) return 'inn';
      return null;
    },
    profile: (s) => [
      'ベルク商会カルナス支店の帳場を任されている青年。商会主ゴドウィン・ベルクの次男。',
      ...(s.flags.edgarData ? ['十二年分の魔核の記録をつけている。魔核は大きくなっているのに、力は弱まっていると考えている。'] : []),
      ...(used(s, 'edgar', 'engagement') ? ['リーネとの縁談は、父が決めたものだった。'] : []),
      ...(used(s, 'edgar', 'marta_rent') ? ['灯り亭の家賃の値上げを、こっそり遅らせている。'] : []),
      ...impression(s, 'edgar', 'エドガー'),
    ],
    greet: (s) => [say('edgar', closeness(s, 'edgar') > 12 ? 'あ、{name}さん。よかった、ちょうど誰かと話したかったんです。' : 'あ……こ、こんにちは。何かご用でしょうか。')],
    topics: edgarTopics,
  },
];

// ───────── 行動 ─────────

export const ACTIVITIES2: ActivityDef[] = [
  {
    id: 'inn_help',
    loc: 'inn',
    label: '宿の手伝い',
    cond: (s) => !!s.flags.martaHelp && s.slot >= 2,
    methods: [
      {
        id: 'dishes',
        label: '皿洗いと給仕（8銅貨と晩飯）',
        desc: 'マルタの手伝いをする。宿の客たちの話が聞こえてくる。',
        run: (s) => {
          s.money += 8;
          s.cond.fed = true;
          gain(s, 'empathy', 0.8, { difficulty: 22, key: 'social:innhelp' });
          gain(s, 'speech', 0.5, { difficulty: 20, key: 'social:innhelp' });
          gain(s, 'end', 0.3, {});
          s.cond.fatigue = clamp(s.cond.fatigue + 8, 0, 100);
          rel(s, 'marta', 'affinity', 1.5);
          rel(s, 'marta', 'trust', 1);
          log(s, '灯り亭で、皿洗いと給仕を手伝った。');
          return [
            n('前掛けを締めて、食堂と厨房の間を行き来する。'),
            n(
              pick(s, [
                '銅級の冒険者たちが、今日の狩りの自慢話をしている。どこの沢に狼が多いか、という話が耳に残った。',
                '新人の一人が、故郷の母親に手紙を書いていた。文字が分からないところを、{I}が教えた。',
                '酔った客が喧嘩を始めかけたが、マルタが一睨みで黙らせた。',
                '厨房の隅で、マルタが鼻歌を歌っていた。古い、知らない歌だった。',
              ]),
            ),
            say('marta', 'ご苦労さん。ほら、晩飯だよ。'),
          ];
        },
      },
    ],
  },
  {
    id: 'pay_tab',
    loc: 'inn',
    label: 'ツケを払う',
    cond: (s) => (s.counters.tab ?? 0) > 0,
    methods: [
      {
        id: 'pay',
        label: '待ってもらっていた宿代を払う',
        desc: '',
        slots: 0,
        cond: (s) => s.money >= (s.counters.tab ?? 0),
        run: (s) => {
          const t = s.counters.tab ?? 0;
          s.money -= t;
          s.counters.tab = 0;
          s.counters.tabPaid = (s.counters.tabPaid ?? 0) + 1;
          rel(s, 'marta', 'trust', 4);
          rel(s, 'marta', 'respect', 3);
          log(s, `マルタに、待ってもらっていた宿代${t}銅貨を返した。`);
          return [
            n(`待ってもらっていた${t}銅貨を、カウンターに置いた。`),
            n('マルタはツケ帳を開き、{I}の名前の横に、丸を一つ書いた。線ではなく、丸を。'),
            say('marta', '……はいよ。確かに。'),
          ];
        },
      },
    ],
  },
];

// ───────── イベント ─────────

const edgarMeet: EventDef = {
  id: 'edgar_meet',
  trigger: 'after',
  priority: 45,
  once: true,
  cond: (s) => s.day >= 24 && !s.npcs.edgar.met && s.location === 'market',
  nodes: {
    start: {
      lines: [
        n('ベルク商会の荷捌き場の前で、細身の青年が人足たちに囲まれていた。'),
        say('人足', 'だから、箱は二十あったって言ってんだろ、坊ちゃん。'),
        say('青年', 'で、でも、帳簿では二十二箱なんです。積み込みのときに、確かに……'),
        n('青年は帳簿を抱えたまま、人足たちの勢いに押されて後ずさっている。'),
        (s) => ((s.counters['act:work'] ?? 0) > 0 ? n('荷運びの仕事で見かけたことのある顔だった。商会の帳場にいる人だ。') : null),
      ],
      choices: [
        { text: '荷車の木箱を数え直す', next: 'count' },
        { text: '「話を聞かせてください」と割って入る', next: 'mediate' },
        { text: '関わらずに通り過ぎる', next: 'pass' },
      ],
    },
    count: {
      lines: [
        (s) =>
          s.stats.wit + s.stats.focus > 28
            ? [
                n('荷車の木箱を数える。二十箱。だが、荷台の下を覗くと、縄で吊るされた木箱が二つ、隠れていた。'),
                n('人足たちが、ばつの悪そうな顔で目を逸らした。'),
                say('青年', '……あ。二十二。'),
              ]
            : [n('荷車の木箱を数える。二十箱だ。青年の帳簿とは合わない。'), n('人足たちは笑いながら去っていった。青年は、帳簿を見つめたまま首を傾げていた。')],
      ],
      effect: (s) => {
        if (s.stats.wit + s.stats.focus > 28) {
          s.flags.edgarHelped = true;
          rel(s, 'edgar', 'respect', 5);
          rel(s, 'edgar', 'trust', 3);
        }
        gain(s, 'wit', 0.6, {});
      },
      next: 'intro',
    },
    mediate: {
      lines: [
        (s) =>
          s.stats.speech + s.stats.empathy > 28
            ? [n('人足たちと青年の間に入り、話を順に聞く。人足の一人が、言い訳の途中で口ごもった。'), say('人足', '……ちっ。下に吊ってあるよ、二箱。冗談だよ、冗談。')]
            : [n('間に入ってみたが、人足たちは{I}を一瞥して鼻で笑った。'), say('人足', 'ガキが口出すんじゃねえよ。'), n('人足たちが去った後、青年は申し訳なさそうに頭を下げた。')],
      ],
      effect: (s) => {
        if (s.stats.speech + s.stats.empathy > 28) {
          s.flags.edgarHelped = true;
          rel(s, 'edgar', 'trust', 5);
        } else rel(s, 'edgar', 'affinity', 3);
        gain(s, 'speech', 0.6, {});
      },
      next: 'intro',
    },
    pass: {
      lines: [n('通り過ぎようとしたとき、青年と目が合った。'), n('青年は、助けを求めるでもなく、ただ申し訳なさそうに小さく会釈した。')],
      next: 'intro',
    },
    intro: {
      lines: [
        say('青年', 'あの……エドガーです。ベルク商会の、帳場の。'),
        (s) =>
          s.flags.edgarHelped
            ? say('edgar', 'ありがとうございました。僕、数字は数えられても、人と話すのは本当に駄目で……。')
            : say('edgar', 'お見苦しいところを。……数字は数えられても、人と話すのは駄目なんです。'),
        n('ベルク。灯り亭の建物の持ち主であり、この街の魔核の商いを握る大商会の名だ。'),
      ],
      effect: (s) => {
        meet(s, 'edgar');
        log(s, '東市場で、ベルク商会のエドガーという青年に出会った。');
      },
      end: { advance: true },
    },
  },
};

const lyneEdgar: EventDef = {
  id: 'lyne_edgar',
  trigger: 'slot',
  priority: 25,
  once: true,
  cond: (s) => s.day >= 46 && s.slot === 3 && !!s.flags.lyneStays && s.npcs.edgar.met && !s.flags.lyneLeft,
  nodes: {
    start: {
      lines: [
        n('灯り亭の食堂に、エドガーが来ていた。マルタに頼まれた帳簿の計算を手伝っているらしい。'),
        n('そこへ、リーネが入ってきた。'),
        say('marta', 'ああ、リーネ。こっちは商会のエドガー坊ちゃん。'),
        n('二人が、凍りついた。'),
        say('lyne', '……ベルク商会の、エドガー？'),
        say('edgar', 'リ、リーネ・アーデル……さん。'),
        n('長い沈黙。マルタが、何事かという顔で二人を見比べている。'),
      ],
      choices: [
        { text: '二人の間に座る', next: 'sit' },
        { text: '黙って見守る', next: 'watch' },
      ],
    },
    sit: {
      lines: [
        n('{I}が二人の間の椅子を引くと、張りつめた空気が少しだけ緩んだ。'),
        say('edgar', 'あの……縁談のこと、申し訳ありませんでした。僕が、父に逆らえなかったせいで。'),
        say('lyne', '……あなたも、嫌だったの？'),
        say('edgar', 'はい。とても。'),
        n('リーネが吹き出した。'),
        say('lyne', '正直ね、あなた。……座りなさいよ。煮込み、豆ばっかりだけど美味しいから。'),
      ],
      next: 'end',
    },
    watch: {
      lines: [
        say('edgar', 'あの……縁談のこと、申し訳ありませんでした。'),
        say('lyne', '謝られる筋合いはないわ。断ったのは私よ。'),
        say('edgar', 'はい。……ありがとうございました。断ってくれて。'),
        n('リーネは目を丸くした。それから、ゆっくりと笑い出した。'),
      ],
      next: 'end',
    },
    end: {
      lines: [n('その夜、食堂の隅のテーブルでは、遅くまで笑い声が絶えなかった。マルタが、煮込みのお代わりを三度運んだ。')],
      effect: (s) => {
        s.flags.lyneEdgar = true;
        rel(s, 'edgar', 'affinity', 3);
        rel(s, 'lyne', 'affinity', 2);
        log(s, 'リーネとエドガーが、灯り亭で顔を合わせた。縁談の相手同士だった。');
      },
    },
  },
};

const edgarNoin: EventDef = {
  id: 'edgar_noin',
  trigger: 'after',
  priority: 44,
  once: true,
  cond: (s) => !!s.flags.edgarNoinLink && s.location === 'institute' && s.npcs.noin.met,
  nodes: {
    start: {
      lines: [
        n('約束の日、エドガーは冊子を抱えて、分室の扉の前で立ち尽くしていた。'),
        n('扉を開けたのは、ノインだった。'),
        say('noin', '誰？　……商会の人？　うちには払うお金ないよ。'),
        say('edgar', 'ち、違います！　これを、見てほしくて。'),
        n('ノインは冊子を受け取り、ぱらぱらとめくった。めくる速さが、だんだん遅くなっていった。'),
        say('noin', '……十二年分？　全部、自分で？'),
        say('edgar', 'は、はい。'),
        say('noin', '魔核の大きさと、灯せる時間の比。……これ、私が百年かけても取れなかった数字だよ。'),
        n('ノインは顔を上げた。目が、潮計を前にしたときと同じ光り方をしていた。'),
        say('noin', 'ねえ、きみ。明日も来られる？'),
      ],
      effect: (s) => {
        s.flags.edgarNoin = true;
        rel(s, 'edgar', 'trust', 5, { big: true });
        rel(s, 'noin', 'trust', 4);
        log(s, 'エドガーを、ノインに引き合わせた。二人は、夜遅くまで数字の話をしていた。');
      },
    },
  },
};

const martaMeetFix: EventDef = {
  id: 'marta_meet',
  trigger: 'slot',
  priority: 3,
  once: true,
  cond: (s) => s.day >= 2 && s.slot === 0 && !s.npcs.marta.met,
  nodes: {
    start: {
      lines: [n('朝、食堂に降りると、マルタが湯気の立つ椀を差し出した。'), say('marta', 'ほら、朝飯。新人は食べなきゃ始まらないよ。')],
      effect: (s) => meet(s, 'marta'),
    },
  },
};

export const EVENTS2: EventDef[] = [edgarMeet, lyneEdgar, edgarNoin, martaMeetFix];
