// 第1章後半（31〜90日目）：潮計、予測、人々の選択、大潮の夜、エピローグ。ネタバレを含む。
import type { EnemyDef, EventDef, NpcDef, QuestDef, TopicDef } from '../engine/defs';
import type { GameState, Line } from '../engine/types';
import { n, say } from '../engine/text';
import { closeness, rel, remember } from '../engine/npc';
import { gain } from '../engine/growth';
import { log } from '../engine/game';
import { startCombat } from '../engine/combat';
import { chance } from '../engine/rng';

export const TIDE_DAY = 78;

const f = (s: GameState, k: string) => s.flags[k];
const num = (s: GameState, k: string) => (s.flags[k] as number | undefined) ?? 0;
const gauge = (s: GameState) => num(s, 'tideGauge');
const lyneHere = (s: GameState) => !s.flags.lyneLeft && s.npcs.lyne.met && s.npcs.lyne.away <= 0;
const garadAlive = (s: GameState) => s.npcs.garad.alive;

/** 大潮への備えの度合い（0〜4） */
export function preparedness(s: GameState) {
  return (f(s, 'guildPrepared') ? 1 : 0) + (f(s, 'garrisonPrepared') ? 1 : 0) + (f(s, 'ruleAdopted') ? 1 : 0) + (f(s, 'seraGaradReconciled') ? 1 : 0);
}

// ───────── 敵 ─────────

export const ENEMIES_1B: EnemyDef[] = [
  {
    id: 'serpent',
    name: '澱蛇',
    loreKey: 'serpent',
    level: 18,
    hp: 36,
    power: 11,
    speed: 15,
    armor: 2,
    intro: '崩れた石畳の隙間から、腕ほどの太さの蛇が鎌首をもたげた。鱗の間に、灰色の結晶が点々と光っている。',
    intents: [
      { id: 'strike', tell: ['蛇が首を引いた。', '蛇が首をS字に縮めた。弾けるように噛みついてくる。'], read: '一直線に伸びてくる。半歩横にずれるだけでいい。', type: 'heavy', power: 1.4, range: 2, weight: (d) => (d <= 2 ? 3 : 0.5) },
      { id: 'coil', tell: ['蛇がとぐろを巻いた。', '蛇がとぐろを巻き、じっとこちらを見ている。'], read: '力を溜めている。今なら頭を狙える。', type: 'wait', range: 3, weight: () => 1.5 },
      { id: 'slide', tell: ['蛇が石の陰に消えた。', '蛇が石の陰を這って、横から回り込もうとしている。'], read: '石の隙間から出てくる場所は限られる。', type: 'reposition', range: 3, weight: () => 1.2 },
    ],
    state: (r) => (r > 0.6 ? '澱蛇は舌をちろちろと出している。' : r > 0.3 ? '澱蛇の鱗が何枚か剥がれ、動きが鈍った。' : '澱蛇はのたうっている。'),
    fleeAt: 0.2,
    loot: [{ item: 'core', chance: 0.7 }],
  },
  {
    id: 'alpha',
    name: '群れ長',
    loreKey: 'alpha',
    level: 27,
    hp: 60,
    power: 15,
    speed: 19,
    armor: 3,
    intro: '狼たちの後ろから、ひときわ大きな影が歩み出てきた。背中一面が灰色の結晶に覆われ、篝火を映して鈍く光っている。群れの長だ。',
    intents: [
      { id: 'leap', tell: ['群れ長が身を沈めた。', '群れ長が身を沈め、首筋の結晶を逆立てた。跳びかかってくる。'], read: '跳躍は大きいが、着地の瞬間に結晶の重みで体が流れる。かわせば脇腹が空く。', type: 'heavy', power: 1.5, range: 2, weight: (d) => (d <= 2 ? 3 : 0.5) },
      { id: 'maul', tell: ['群れ長が牙を剥いた。', '群れ長が牙を剥き、喉元を狙っている。'], read: '速い。剣を立てて受けろ。', type: 'light', power: 1.0, range: 1, weight: (d) => (d <= 1 ? 3 : 0) },
      { id: 'howl', tell: ['群れ長が顔を上げた。', '群れ長が天を仰ぎ、群れを呼んでいる。'], read: '仲間を呼ぶ間は無防備だ。打ち込め。', type: 'call', range: 3, weight: (_, r) => (r < 0.7 ? 1.3 : 0.4) },
      { id: 'circle', tell: ['群れ長が動いた。', '群れ長が円を描くように回り込む。'], read: '死角を取りに来る。目を離すな。', type: 'reposition', range: 3, weight: () => 1.2 },
    ],
    state: (r) => (r > 0.7 ? '群れ長はびくともしていない。' : r > 0.4 ? '群れ長の結晶が一枚、砕けて落ちた。' : r > 0.2 ? '群れ長の息が荒い。それでも、目の光は衰えない。' : '群れ長がよろめいた。'),
    loot: [{ item: 'core', chance: 1 }],
  },
];

// ───────── 依頼：旧街道の遺構 ─────────

export const QUEST_RUIN: QuestDef = {
  id: 'q_ruin',
  title: '旧街道の遺構調査',
  summary: '魔導院分室ノインより。旧街道の遺構にある古い標石の欠片を持ち帰ること。石級以上。報酬50銅貨。',
  rankMin: 1,
  reward: 50,
  days: 6,
  cond: (s) => !!s.flags.noinRuin,
  depart: 'q_ruin',
  giver: 'noin',
};

const qRuin: EventDef = {
  id: 'q_ruin',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [
        n('東門を出て、森の縁に沿って南東へ半日。草に埋もれた石畳が、ふいに足元に現れた。'),
        n('旧街道だ。大落日より前、この大陸の端から端までを結んでいたという道。'),
        n('石畳の脇に、人の背丈ほどの石柱が等間隔に並んでいる。ほとんどが倒れ、苔に覆われていた。'),
      ],
      choices: [
        { text: '石柱の刻印を調べる', next: 'glyph' },
        { text: 'まず周囲の安全を確かめる', next: 'scout' },
      ],
    },
    glyph: {
      lines: [
        n('苔を剥がすと、石柱の表面に細かな紋様が彫り込まれていた。'),
        (s) =>
          s.stats.magic_t + s.stats.lore > 26
            ? [
                n('術式だ。『術式の文法』で見たものに似ている。だが、もっと大きく、もっと複雑だ。'),
                n('紋様の流れを指でたどる。線はすべて同じ方向――北西を指していた。カルナスの方角だ。'),
              ]
            : n('紋様の意味は分からない。ただ、どの石柱の線も、同じ方向へ流れているように見えた。'),
      ],
      effect: (s) => {
        s.flags.ruinGlyph = true;
        gain(s, 'magic_t', 1.0, { difficulty: 26 });
        gain(s, 'lore', 0.8, { difficulty: 26 });
      },
      next: 'serpent',
    },
    scout: {
      lines: [
        (s) =>
          s.stats.survival_p + s.stats.beast_p > 24
            ? n('崩れた石畳の隙間に、脱皮した蛇の皮が引っかかっていた。それも、腕ほどの太さの。{I}は剣を抜いたまま進んだ。')
            : n('辺りは静まり返っている。鳥の声もしない。'),
      ],
      effect: (s) => {
        s.flags._ruinReady = s.stats.survival_p + s.stats.beast_p > 24 ? 1 : 0;
        gain(s, 'survival_p', 0.8, {});
      },
      next: 'serpent',
    },
    serpent: {
      lines: [n('一番大きな石柱の根元に、割れた欠片が転がっている。手を伸ばしかけた、そのとき――')],
      effect: (s) => {
        const ready = !!s.flags._ruinReady;
        delete s.flags._ruinReady;
        startCombat(s, {
          enemy: 'serpent',
          dist: ready ? 2 : 1,
          onWin: { ev: 'q_ruin', node: 'win' },
          onLose: { ev: 'q_ruin', node: 'lose' },
          onFlee: { ev: 'q_ruin', node: 'flee' },
          loseMeansDeath: (s.counters.rescued ?? 0) >= 1,
        });
        if (ready && s.combat) s.combat.edge = 1;
      },
    },
    win: {
      lines: [
        n('澱蛇が動かなくなった。'),
        n('石柱の欠片を拾い上げる。手のひらほどの大きさなのに、ずっしりと重い。断面に、髪の毛ほどの細い線が無数に走っていた。'),
        n('線の中を、何かがかすかに流れている気がした。'),
      ],
      effect: (s) => {
        s.items.stone = 1;
        if (s.quest) s.quest.data.done = true;
        log(s, '旧街道の遺構で、古い標石の欠片を手に入れた。');
      },
      end: { advance: true, slots: 3 },
    },
    lose: {
      lines: [
        n('蛇の牙が脚に食い込んだ。毒はないらしい。それでも、立っていられない。'),
        n('這うようにして遺構を離れ、日が暮れる頃、どうにか街道を通りかかった荷馬車に拾われた。'),
      ],
      effect: (s) => {
        s.counters.rescued = (s.counters.rescued ?? 0) + 1;
        log(s, '旧街道の遺構で澱蛇に敗れ、荷馬車に拾われた。');
      },
      end: { advance: true, slots: 3 },
    },
    flee: { lines: [n('欠片を諦めて、遺構から走り去った。振り返ると、蛇は石柱に巻きついたままこちらを見ていた。')], end: { advance: true, slots: 3 } },
  },
};

// ───────── ノイン：潮計 ─────────

const ruinThanks: EventDef = {
  id: 'noin_ruin_thanks',
  trigger: 'after',
  priority: 45,
  once: true,
  cond: (s) => !!s.flags.ruinDelivered && s.location === 'institute',
  nodes: {
    start: {
      lines: [
        n('標石の欠片を見たノインは、しばらく息をするのも忘れていた。'),
        say('noin', '……灯脈の標石だ。本物の。'),
        say('noin', '大落日の前、大陸中に魔力を流してた管。その道しるべ。断面の線、見える？　これが術式の回路。四百年経っても、まだ少し生きてる。'),
        (s) =>
          s.flags.ruinGlyph
            ? [n('石柱の紋様がすべて北西――カルナスの方角を向いていたことを話すと、ノインの手が止まった。'), say('noin', '……カルナスの方角？　全部？'), say('noin', 'ちょっと待って。それ、すごく大事なことかもしれない。')]
            : say('noin', 'これを潮計の芯に組み込めば、澱の脈動をずっと正確に拾える。'),
      ],
      effect: (s) => {
        s.flags.tideGauge = gauge(s) + 1;
        if (s.flags.ruinGlyph) s.flags.noinSuspectsCity = true;
        rel(s, 'noin', 'trust', 5);
        rel(s, 'noin', 'respect', 4);
        remember(s, 'noin', 'ruin:done', '灯脈の標石の欠片を届けた。');
      },
    },
  },
};

const calibrate: EventDef = {
  id: 'calibrate',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [
        n('日が沈む頃、ノインと二人で城壁に上った。'),
        n('ノインは、硝子と真鍮でできた奇妙な道具を胸壁の上に据えた。中心で、澱の泥がゆっくりと渦を巻いている。'),
        say('noin', '潮計。まだ半分だけど。森の脈動に合わせて、この針が揺れる……はず。'),
        say('noin', 'きみには、ここに手を当てて、魔力を少しだけ流してほしい。私一人だと、計りながら流すのが難しいんだ。'),
      ],
      choices: [
        { text: '手を当てて、魔力を流す', next: 'try' },
        { text: '「魔法はまだ自信がない」', next: 'decline' },
      ],
    },
    try: {
      lines: [
        (s) => {
          const ok = s.stats.magic_p + s.stats.focus * 0.6 >= 20 || (s.flags.magicIntro && chance(s, 0.35));
          s.flags._calibOk = ok ? 1 : 0;
          return ok
            ? [
                n('目を閉じ、指先に魔力を集める。真鍮の枠を通して、何かがこちらへ流れ込んでくる感覚があった。'),
                n('森の鼓動だ。ゆっくりと、大きく、脈打っている。'),
                n('針が揺れはじめた。ノインが息を呑むのが聞こえた。'),
              ]
            : [n('指先に意識を集める。だが、魔力はうまく流れない。針はぴくりとも動かなかった。'), say('noin', '……まだ早かったか。焦らなくていいよ。もう少し練習してから、また頼むね。')];
        },
      ],
      effect: (s) => {
        gain(s, 'magic_p', 1.2, { difficulty: 24, kind: 'mentor' });
        gain(s, 'focus', 0.8, { difficulty: 24 });
        if (s.flags._calibOk) {
          s.flags.calibrated = true;
          s.flags.tideGauge = gauge(s) + 1;
          rel(s, 'noin', 'trust', 4);
          rel(s, 'noin', 'affinity', 3);
          remember(s, 'noin', 'calib:done', '城壁の上で、潮計の調整を手伝った。');
          log(s, '城壁の上で、ノインの潮計の調整を手伝った。森の鼓動を感じた。');
        } else {
          s.flags.calibFailDay = s.day;
          log(s, 'ノインの潮計の調整を手伝おうとしたが、うまく魔力を流せなかった。');
        }
        delete s.flags._calibOk;
      },
      next: 'end',
    },
    decline: {
      lines: [say('noin', 'そっか。じゃあ、練習しておいて。また頼むから。')],
      effect: (s) => (s.flags.calibFailDay = s.day),
      next: 'end',
    },
    end: { lines: [n('夜風が冷たい。森の上の霞が、青白く明滅していた。')], end: { advance: true, slots: 2 } },
  },
};

const predictionCore: Record<string, EventDef['nodes'][string]> = {
  core: {
    lines: [
      (s) => {
        const g = gauge(s);
        s.flags.prediction = Math.max(1, Math.min(3, g));
        if (g >= 3)
          return [
            say('noin', '潮計が、はっきり答えを出した。'),
            say('noin', '大潮は若葉月の十八日、夜。規模は前回の、少なくとも倍。……外れる気がしない。'),
            say('noin', 'それにね、脈動の中心が森の奥じゃないんだ。もっとこっち側。'),
            n('ノインは、それ以上は言わなかった。'),
          ];
        if (g >= 2)
          return [
            say('noin', '潮計が、だいたいの答えを出した。'),
            say('noin', '大潮は若葉月の十八日前後、夜。規模は前回の倍近く。誤差はあるけど、大きくは外れないと思う。'),
          ];
        return [
          say('noin', '潮計は、まだ半分も動いてない。だから、これは私の計算だけ。'),
          say('noin', '大潮は若葉月の半ば過ぎ。たぶん十八日あたり。規模は……前回より大きい。それしか言えない。'),
          say('noin', 'これじゃ、誰も信じてくれないよね。'),
        ];
      },
    ],
    choices: [
      { text: '「ギルドに知らせよう」', effect: (s) => { s.flags.wantWarn = true; rel(s, 'noin', 'trust', 3); remember(s, 'noin', 'pred:warn', '大潮の予測をギルドに知らせようと言った。'); }, next: 'warn' },
      { text: '「信じる。準備をしておく」', effect: (s) => { rel(s, 'noin', 'affinity', 3); remember(s, 'noin', 'pred:believe', '大潮の予測を信じると言った。'); }, next: 'believe' },
      { text: '「本当に当たるのか」', effect: (s) => rel(s, 'noin', 'respect', 1), next: 'doubt' },
    ],
  },
  warn: { lines: [say('noin', '……うん。一人じゃ門前払いだったけど、きみがいれば話くらいは聞いてもらえるかも。'), say('noin', '準備ができたら声をかけて。ギルドの支部長に会いに行こう。')], end: { advance: true } },
  believe: { lines: [say('noin', 'ありがと。きみみたいな人が一人でも多く生き残ってくれたら、それで十分かな。'), say('noin', '……本当は、街ごと備えてほしいんだけどね。')], end: { advance: true } },
  doubt: { lines: [say('noin', '当たらなければいいと思ってるよ。私が一番。')], end: { advance: true } },
};

const prediction: EventDef = {
  id: 'prediction',
  trigger: 'after',
  priority: 48,
  once: true,
  cond: (s) => s.day >= 46 && s.npcs.noin.met && s.location === 'institute',
  nodes: {
    start: {
      lines: [n('分室に入ると、ノインが潮計の前で膝を抱えて座り込んでいた。目の下に濃い隈がある。'), say('noin', '……あ、きみか。ちょうどよかった。聞いてほしいことがある。')],
      next: 'core',
    },
    ...predictionCore,
  },
};

const predictionVisit: EventDef = {
  id: 'prediction_visit',
  trigger: 'slot',
  priority: 40,
  once: true,
  cond: (s) => s.day >= 52 && s.slot === 3 && s.npcs.noin.met && s.seen.prediction === undefined,
  nodes: {
    start: {
      lines: [n('灯り亭の食堂に、場違いな白衣の人影があった。ノインだ。'), say('noin', 'ここにいたんだ。探したよ。……聞いてほしいことがある。')],
      next: 'prediction/core',
    },
  },
};

const predictionRumor: EventDef = {
  id: 'prediction_rumor',
  trigger: 'slot',
  priority: 20,
  once: true,
  cond: (s) => s.day >= 55 && !s.npcs.noin.met && s.slot === 1,
  nodes: {
    start: {
      lines: [n('市場で、こんな噂を聞いた。'), say('露店の主人', '魔導院の森人が、今年の大潮は前の倍になるって触れ回ってるらしい。ギルドの支部長に追い返されたってさ。'), say('露店の主人', '森人ってのは、大げさなもんだね。')],
      effect: (s) => (s.flags.predictionIgnored = true),
    },
  },
};

// ───────── 警告：ギルドと守備隊 ─────────

const warnGuild: EventDef = {
  id: 'warn_guild',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [
        n('ノインと二人で、ギルドの窓口を訪ねた。'),
        (s) =>
          s.npcs.sera.rel.trust >= 15
            ? [n('事情を話すと、セラは黙って立ち上がり、奥の扉を叩いてくれた。'), say('sera', '支部長。……聞いていただきたい話があります。')]
            : [say('sera', '支部長との面会ですか。……ご用件を伺っても？'), n('長い説明の後、セラはしぶしぶ奥へ取り次いだ。')],
        n('支部長のボルドは、太い指で机を叩きながら、ノインの数字の並んだ紙を眺めていた。'),
        (s) => (s.flags.edgarNoin ? [n('紙の束の中には、エドガーの魔核の記録も挟まっていた。ベルク商会の帳場の数字だ。ボルドの指が、その頁で止まった。')] : null),
        say('ボルド', '倍、ねえ。七年前の倍の魔物が来ると。それで、俺に何をしろと？'),
        say('ボルド', '冒険者を森から引き上げさせろってのか。潮の時期は魔核の書き入れどきだ。商会が黙っちゃいない。'),
      ],
      choices: [
        { text: 'ノインの記録の規則性を説明する', cond: (s) => (s.counters.tideStudy ?? 0) >= 3, effect: (s) => (s.flags._warnBonus = num(s, '_warnBonus') + 12), next: 'judge' },
        { text: '自分が森で見たことを話す', effect: (s) => (s.flags._warnBonus = num(s, '_warnBonus') + Math.min(12, (s.counters.wins ?? 0) * 2)), next: 'judge' },
        { text: '七年前の被害を思い出させる', effect: (s) => (s.flags._warnBonus = num(s, '_warnBonus') + (s.flags.knowLeon ? 10 : 5)), next: 'judge' },
      ],
    },
    judge: {
      lines: [],
      next: (s) => {
        const score =
          num(s, 'prediction') * 10 + s.npcs.sera.rel.trust * 0.4 + (s.counters.questDone ?? 0) * 3 + (s.flags.supportDraft ? 5 : 0) + s.rank * 5 + s.stats.speech * 0.4 + num(s, '_warnBonus') + (s.flags.edgarNoin ? 8 : 0);
        delete s.flags._warnBonus;
        return score >= 42 ? 'yes' : 'no';
      },
    },
    yes: {
      lines: [
        n('ボルドは長い間、紙を睨んでいた。'),
        say('ボルド', '……潮の時期は、森の奥での狩りを禁止する。若葉月の十日から二十日まで。門の前に柵と油を用意させる。'),
        say('ボルド', '外れたら、損した分はお前らの給金から引くからな。'),
        n('部屋を出ると、ノインが{I}の袖を引いた。何も言わなかった。けれど、袖をつかむ指に力がこもっていた。'),
      ],
      effect: (s) => {
        s.flags.guildPrepared = true;
        rel(s, 'noin', 'trust', 6, { big: true });
        rel(s, 'sera', 'respect', 3);
        log(s, 'ノインと一緒に支部長を説得した。ギルドが大潮に備えることになった。');
      },
      next: 'garrison',
    },
    no: {
      lines: [
        say('ボルド', '話は分かった。分かったが、数字だけで街は動かせん。'),
        say('ボルド', '潮の時期に門の警備を増やすよう、守備隊には伝えておく。それで勘弁してくれ。'),
        n('廊下に出ると、ノインは小さく笑った。'),
        say('noin', 'いつものことだよ。……でも、一緒に来てくれて、ありがと。'),
      ],
      effect: (s) => {
        rel(s, 'noin', 'trust', 3);
        log(s, 'ノインと一緒に支部長に掛け合ったが、聞き入れられなかった。');
      },
      next: 'garrison',
    },
    garrison: {
      lines: [n('門を守るのは、ギルドではなく守備隊だ。守備隊が動かなければ、街は守れない。')],
      choices: [
        { text: 'ガラドに口利きを頼む', cond: (s) => garadAlive(s) && (s.npcs.garad.rel.trust >= 22 || !!s.flags.tagRevealed), next: 'garad' },
        { text: '自分で守備隊の詰所へ行く', next: 'self' },
        { text: '今日はここまでにする', next: 'stop' },
      ],
    },
    garad: {
      lines: [
        n('話を聞いたガラドは、しばらく黙っていた。'),
        say('garad', '……あの森人の言うことか。'),
        n('ガラドはノインを一瞥した。ノインは、まっすぐにガラドを見返した。'),
        say('garad', '研究者は嫌いだ。だが、七年前に誰かがこれを言ってくれていたら、と思ったことはある。'),
        n('ガラドは杖代わりの木剣をつかんで立ち上がった。'),
        n('守備隊の詰所で、隊長のハンスはガラドの顔を見るなり姿勢を正した。かつて、同じ門の前で戦った仲だという。'),
        say('ハンス', 'ガラドさんがそこまで言うなら。潮の夜は、門と開拓村の両方に兵を置きましょう。'),
      ],
      effect: (s) => {
        s.flags.garrisonPrepared = true;
        rel(s, 'garad', 'trust', 4);
        s.flags.garadNoinTruce = true;
        log(s, 'ガラドの口利きで、守備隊が大潮に備えることになった。');
      },
      end: { advance: true, slots: 2 },
    },
    self: {
      lines: [
        n('守備隊の詰所で、隊長のハンスは{I}の話を最後まで聞いてくれた。'),
        (s) => {
          const ok = s.stats.speech + s.stats.empathy * 0.5 + s.rank * 6 + num(s, 'prediction') * 4 >= 34;
          s.flags._garrisonOk = ok ? 1 : 0;
          return ok
            ? say('ハンス', '……冒険者の新人が、ここまで調べて来たか。いいだろう。潮の夜は、開拓村にも兵を回す。')
            : say('ハンス', '気持ちは受け取った。だが、新人の話で兵は動かせん。悪く思うな。');
        },
      ],
      effect: (s) => {
        if (s.flags._garrisonOk) {
          s.flags.garrisonPrepared = true;
          log(s, '守備隊の隊長ハンスを説得した。');
        }
        delete s.flags._garrisonOk;
      },
      end: { advance: true, slots: 2 },
    },
    stop: { lines: [n('ノインと別れて、灯り亭へ戻った。')], end: { advance: true, slots: 2 } },
  },
};

// ───────── リーネ：家からの手紙 ─────────

const lyneLetter: EventDef = {
  id: 'lyne_letter',
  trigger: 'slot',
  priority: 35,
  once: true,
  cond: (s) => s.day >= 40 && s.slot === 3 && lyneHere(s) && !!s.flags.lynePassed,
  nodes: {
    start: {
      lines: [
        n('食堂の隅で、リーネが一通の手紙を握りしめていた。封蝋には、見覚えのない紋章が押されている。'),
        n('{I}に気づくと、リーネは手紙を差し出した。読んでいい、ということらしい。'),
        n('「ベルク商会の次男との縁談が整った。若葉月の内に王都へ戻ること。冒険者の真似事は、今季限りとせよ」'),
        say('lyne', '父の字じゃないわ。家令の字よ。父は、自分で書く手間もかけなかった。'),
        say('lyne', '……商会がアーデル家に金を貸してるの。私はその利子みたいなものね。'),
        n('リーネは笑おうとして、うまくいかなかった。'),
      ],
      choices: [
        { text: '「帰らなくていい。ここに残れ」', effect: (s) => { s.flags.lyneAdvice = 'stay'; rel(s, 'lyne', 'affinity', 3); remember(s, 'lyne', 'letter:stay', '縁談の手紙に「帰るな、ここに残れ」と言った。'); }, next: 'stay' },
        { text: '「リーネが決めることだ」', effect: (s) => { s.flags.lyneAdvice = 'decide'; rel(s, 'lyne', 'respect', 3); remember(s, 'lyne', 'letter:decide', '縁談の手紙に「リーネが決めることだ」と言った。'); }, next: 'decide' },
        { text: '「家に戻ったほうが、安全じゃないか」', effect: (s) => { s.flags.lyneAdvice = 'go'; rel(s, 'lyne', 'affinity', -3); remember(s, 'lyne', 'letter:go', '縁談の手紙に「戻ったほうが安全だ」と言った。'); }, next: 'go' },
      ],
    },
    stay: { lines: [say('lyne', '……簡単に言わないでよ。'), n('リーネは手紙を折りたたんだ。その手が、少しだけ震えていた。'), say('lyne', '少し、考える。')] },
    decide: { lines: [say('lyne', '……そうよね。私が決めることよね。'), say('lyne', '誰かにそう言われたの、初めてかもしれない。')] },
    go: { lines: [say('lyne', 'そうね。安全ね。'), say('lyne', '安全に、商会の家の奥で、刺繍でもしてればいいのよね。'), n('リーネは席を立った。')] },
  },
};

const lyneDecide: EventDef = {
  id: 'lyne_decide',
  trigger: 'slot',
  priority: 35,
  once: true,
  cond: (s) => s.seen.lyne_letter !== undefined && s.day >= (s.seen.lyne_letter as number) + 3 && s.slot === 0 && !s.flags.lyneLeft,
  nodes: {
    start: {
      lines: [],
      next: (s) => {
        const r = s.npcs.lyne.rel;
        const adv = s.flags.lyneAdvice;
        const score = r.trust + r.affinity * 0.5 + r.respect * 0.3 + (adv === 'stay' ? 10 : adv === 'decide' ? 8 : adv === 'go' ? -12 : 0) - (s.flags.lyneInjured && r.trust < 10 ? 8 : 0);
        return score >= 22 ? 'stays' : 'leaves';
      },
    },
    stays: {
      lines: [
        n('朝、宿の前でリーネが待っていた。'),
        say('lyne', '断りの手紙を書いたわ。家令宛てに。父には書かなかった。'),
        say('lyne', '縁を切られるかもしれない。仕送りもなくなる。……でも、いいの。'),
        n('リーネは{I}をまっすぐに見た。'),
        say('lyne', 'ねえ。私と組まない？　パーティーよ。二人だけだけど。'),
        say('lyne', '一人で突っ走るのは、もうやめたの。あなたが隣にいると、ちょっとだけ周りが見える気がするから。'),
      ],
      choices: [
        { text: '「組もう」', effect: (s) => { s.flags.lyneParty = true; rel(s, 'lyne', 'trust', 8, { big: true }); rel(s, 'lyne', 'affinity', 6, { big: true }); remember(s, 'lyne', 'party:yes', 'リーネとパーティーを組んだ。'); log(s, 'リーネとパーティーを組んだ。'); }, next: 'party' },
        { text: '「まだ一人でやりたい」', effect: (s) => { rel(s, 'lyne', 'affinity', -2); remember(s, 'lyne', 'party:no', 'リーネからのパーティーの誘いを断った。'); }, next: 'solo' },
      ],
      effect: (s) => {
        s.flags.lyneStays = true;
        log(s, 'リーネは縁談を断り、カルナスに残ることにした。');
      },
    },
    party: { lines: [say('lyne', '決まりね。……よろしく、相棒。'), n('リーネは照れくさそうに手を差し出した。剣だこだらけの手だった。')], end: { advance: false } },
    solo: { lines: [say('lyne', 'そう。……まあ、気が変わったら言いなさいよ。'), n('リーネはそう言って、訓練場のほうへ歩いていった。')] },
    leaves: {
      lines: [
        n('朝、宿の前に荷馬車が止まっていた。リーネが、荷物を積み込んでいる。'),
        say('lyne', '……帰ることにしたわ。'),
        (s) =>
          s.flags.lyneInjured
            ? say('lyne', 'この腕じゃ、銅級なんて何年先になるか分からないもの。')
            : say('lyne', '剣で名を上げるなんて、最初から無理だったのよ。'),
        n('リーネは石の札を外して、少しの間見つめてから、懐にしまった。'),
        say('lyne', 'これは持っていく。……ここにいた証拠に。'),
        say('lyne', 'じゃあね。死なないでよ。'),
        n('荷馬車が南門のほうへ遠ざかっていく。リーネは、一度も振り返らなかった。'),
      ],
      effect: (s) => {
        s.flags.lyneLeft = true;
        s.npcs.lyne.away = 9999;
        log(s, 'リーネが、王都へ帰っていった。');
      },
    },
  },
};

// ───────── セラ：新人保護規定 ─────────

const seraRule: EventDef = {
  id: 'sera_rule',
  trigger: 'slot',
  priority: 30,
  once: true,
  cond: (s) => s.day >= 52 && s.slot === 1,
  nodes: {
    start: {
      lines: [],
      next: (s) => {
        const score =
          (s.flags.supportDraft ? 10 : 0) +
          (s.counters.questDone ?? 0) * 2 +
          (s.flags.timoDead ? 8 : 0) +
          (s.flags.timoSaved ? 6 : 0) +
          s.npcs.sera.rel.trust * 0.3 -
          (s.counters.questFail ?? 0) * 3 -
          (s.counters.rescued ?? 0) * 2;
        return score >= 20 ? 'adopted' : 'rejected';
      },
    },
    adopted: {
      lines: [
        n('ギルドの掲示板に、新しい布告が貼り出されていた。'),
        n('「新人保護規定（試行）：仮登録の期間を三十日とし、期間中の訓練を義務とする。仮登録者は、潮の時期の森林への立ち入りを禁ずる」'),
        n('窓口のセラは、いつもと同じように帳簿をつけていた。けれど、{I}と目が合うと、ほんの少しだけ頷いた。'),
        (s) =>
          s.flags.supportDraft
            ? say('sera', '……あなたの記録を、添付資料にさせてもらいました。講習を守り、依頼を確実にこなした新人の例として。勝手にすみません。')
            : null,
      ],
      effect: (s) => {
        s.flags.ruleAdopted = true;
        rel(s, 'sera', 'trust', 5);
        rel(s, 'sera', 'affinity', 3);
        log(s, 'セラの新人保護規定が、試行という形で採用された。');
      },
    },
    rejected: {
      lines: [
        n('ギルドの窓口で、セラが分厚い紙の束を紐で縛っていた。'),
        say('sera', '新人保護規定は、四度目の差し戻しになりました。'),
        say('sera', '「現に新人は育っている。規定は不要」だそうです。'),
        n('セラは紙の束を引き出しの奥にしまった。'),
        say('sera', '……潮が終わったら、また書きます。'),
      ],
      effect: (s) => log(s, 'セラの新人保護規定は、また差し戻された。'),
    },
  },
};

// ───────── ガラド：去るか、残るか ─────────

const garadDecision: EventDef = {
  id: 'garad_decision',
  trigger: 'slot',
  priority: 32,
  once: true,
  cond: (s) => s.day >= 58 && s.slot === 3 && garadAlive(s) && !s.flags.garadStays,
  nodes: {
    start: {
      lines: [n('灯り亭の隅の席で、ガラドが一人で杯を傾けていた。足元に、使い込まれた木剣が立てかけてある。')],
      next: (s) => {
        const g = s.npcs.garad.rel;
        return s.flags.askedGaradStay && g.trust >= 26 && g.respect >= 20 ? 'stay' : 'quit';
      },
    },
    stay: {
      lines: [
        say('garad', '……辞めるのは、やめた。'),
        n('ガラドは杯を置いた。'),
        say('garad', 'お前に言われたからじゃない。'),
        say('garad', '……いや。お前に言われたからだ。'),
      ],
      effect: (s) => {
        s.flags.garadStays = true;
        rel(s, 'garad', 'trust', 6, { big: true });
        log(s, 'ガラドは、教官を続けることにした。');
      },
    },
    quit: {
      lines: [
        say('garad', '今日、教官を辞めてきた。'),
        n('ガラドは、それ以上説明しなかった。'),
        say('garad', '剣を捨てたわけじゃない。潮の夜には門に立つ。……七年前と同じ場所にな。'),
      ],
      effect: (s) => {
        s.flags.garadQuit = true;
        log(s, 'ガラドが、訓練場の教官を辞めた。');
      },
    },
  },
};

const reconcile: EventDef = {
  id: 'reconcile',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [
        n('夕暮れの訓練場。新人たちが帰った後の砂地に、ガラドが一人で立っていた。'),
        n('{I}の後ろから、セラが歩いてくる。来てくれるかどうか、最後まで分からなかった。'),
        n('ガラドが振り返った。二人の視線が、七年ぶりにまっすぐぶつかった。'),
        say('sera', '……弟は、最期に何か言っていましたか。'),
        n('長い沈黙。'),
        say('garad', '「門は任せろ」と。俺が門を離れると言ったとき、レオンがそう言った。あいつが一番若かった。'),
        say('garad', '俺が残っていれば、と、毎晩考える。'),
        say('sera', '私もです。あなたが残っていれば、と。'),
        say('sera', 'でも、あの村の子が、今ここにいるんでしょう。'),
        n('セラは{I}を見た。'),
      ],
      choices: [
        { text: '黙って二人を見守る', next: 'end' },
        { text: '「あの夜の選択がなければ、自分はここにいません」', cond: (s) => !!s.flags.tagRevealed, next: 'end' },
      ],
    },
    end: {
      lines: [
        say('sera', 'レオンが「任せろ」と言ったのなら、あの子は自分で選んだんです。'),
        say('sera', '……だから、もう、あなた一人で背負わないでください。'),
        n('ガラドは何も答えなかった。ただ、深く頭を下げた。セラも、同じだけ深く頭を下げた。'),
        n('夕陽が、二人の影を長く砂地に引いていた。'),
      ],
      effect: (s) => {
        s.flags.seraGaradReconciled = true;
        rel(s, 'sera', 'trust', 8, { big: true });
        rel(s, 'garad', 'trust', 8, { big: true });
        rel(s, 'sera', 'debt', 6, { big: true });
        rel(s, 'garad', 'debt', 6, { big: true });
        log(s, 'ガラドとセラが、七年ぶりに言葉を交わした。');
      },
      end: { advance: true },
    },
  },
};

// ───────── 潮 ─────────

const tideRise: EventDef = {
  id: 'tide_rise',
  trigger: 'slot',
  priority: 45,
  once: true,
  cond: (s) => s.day >= 60 && s.slot === 0,
  nodes: {
    start: {
      lines: [
        n('明け方、東門の鐘が三度鳴った。潮の満ちはじめを告げる鐘だ。'),
        n('城壁の上から見る森は、いつもと違っていた。灰色の霞が濃く、低く垂れ込め、ところどころが脈打つように青白く光っている。'),
        n('ギルドの掲示板には、森での単独行動を控えるようにとの布告が貼られた。夜警の募集も始まった。'),
      ],
      effect: (s) => {
        s.flags.tideRising = true;
        log(s, '澱潮が満ちはじめた。');
      },
    },
  },
};

const tidePrep: EventDef = {
  id: 'tide_prep',
  trigger: 'slot',
  priority: 40,
  once: true,
  cond: (s) => s.day >= 70 && s.slot === 0,
  nodes: {
    start: {
      lines: [
        (s): Line[] => {
          const out: Line[] = [];
          if (s.flags.guildPrepared) out.push(n('東門の前に、丸太の柵が二重に組まれていく。油の樽が城壁の上へ運び上げられていた。ギルドの冒険者たちが、組ごとに持ち場を割り振られている。'));
          else out.push(n('街はいつもと変わらない。森で稼ぐ冒険者たちの数は、むしろ増えていた。潮の時期は、魔核が高く売れるからだ。'));
          if (s.flags.garrisonPrepared) out.push(n('開拓村へ続く道を、守備隊の一隊が槍を担いで行進していった。'));
          if (s.flags.ruleAdopted) out.push(n('仮登録の新人たちは、城壁の内側での荷運びと伝令に回されていた。不満そうな顔の者もいる。'));
          if (s.flags.predictionIgnored || (!s.flags.guildPrepared && s.seen.prediction !== undefined))
            out.push(n('ノインは毎日、城壁の上で潮計を睨んでいる。通りすがりの兵士が、彼女を指さして笑っていた。'));
          return out;
        },
      ],
    },
  },
};

const tideEve: EventDef = {
  id: 'tide_eve',
  trigger: 'slot',
  priority: 40,
  once: true,
  cond: (s) => s.day >= TIDE_DAY - 1 && s.slot === 3,
  nodes: {
    start: {
      lines: [
        n('大潮の前の夜。'),
        n('灯り亭の食堂は、いつもより静かだった。誰もが、明日のことを考えている。'),
        n('今夜は、誰と過ごそうか。'),
      ],
      choices: [
        { text: 'リーネと話す', cond: lyneHere, next: 'lyne' },
        { text: 'ガラドの席へ行く', cond: garadAlive, next: 'garad' },
        { text: '分室のノインを訪ねる', cond: (s) => s.npcs.noin.met, next: 'noin' },
        { text: 'ギルドのセラを訪ねる', next: 'sera' },
        { text: '一人で剣の手入れをする', next: 'alone' },
      ],
    },
    lyne: {
      lines: [
        n('リーネは、剣を膝に乗せて砥石を当てていた。'),
        say('lyne', '明日、怖くないの？'),
        n('{I}が答える前に、リーネは自分で言葉を継いだ。'),
        say('lyne', '私は怖い。……前は、怖いなんて思ったことなかった。熊に会うまでは。'),
        say('lyne', 'でも、怖いって分かってるほうが、たぶん長生きするのよね。ガラド教官の受け売りだけど。'),
        n('リーネは砥石を置いて、{I}の拳に自分の拳を軽くぶつけた。'),
        say('lyne', '明日、背中は任せたわよ。'),
      ],
      effect: (s) => {
        s.flags.eveWith = 'lyne';
        rel(s, 'lyne', 'trust', 5, { big: true });
        rel(s, 'lyne', 'affinity', 4, { big: true });
      },
      end: { advance: true },
    },
    garad: {
      lines: [
        n('ガラドは黙って、向かいの椅子を足で押し出した。'),
        say('garad', '七年前の今夜も、こうして飲んでいた。仲間とな。'),
        say('garad', '明日、お前はどこかで選ばなきゃならなくなる。門か、それ以外か。目の前の一人か、見えない十人か。'),
        say('garad', '正しい答えなんてない。選んだほうを背負うだけだ。'),
        n('ガラドは杯を干した。'),
        say('garad', '……背負える分だけ、強くなっておけ。それだけだ。'),
      ],
      effect: (s) => {
        s.flags.eveWith = 'garad';
        rel(s, 'garad', 'trust', 5, { big: true });
        rel(s, 'garad', 'affinity', 4, { big: true });
      },
      end: { advance: true },
    },
    noin: {
      lines: [
        n('分室の明かりは、まだ灯っていた。ノインは潮計の前で、針の揺れを書き留めている。'),
        say('noin', 'あ、来たんだ。……ちょうど今、脈動が最大になるところ。'),
        say('noin', 'ねえ、きみ。もし私の予測が当たったら、嬉しいと思う？'),
        say('noin', '私は、ずっと外れてほしかった。でも、外れたら、私がここにいた意味もなくなる気がして。……変だよね。'),
        n('ノインは潮計の硝子を、指でそっとなぞった。'),
        say('noin', '明日、死なないでね。きみがいないと、この記録の続きを誰に話せばいいか分からない。'),
      ],
      effect: (s) => {
        s.flags.eveWith = 'noin';
        rel(s, 'noin', 'trust', 5, { big: true });
        rel(s, 'noin', 'affinity', 4, { big: true });
      },
      end: { advance: true },
    },
    sera: {
      lines: [
        n('閉まったギルドの窓口で、セラが一人、名簿に目を通していた。明日、門の前に立つ冒険者たちの名簿だ。'),
        say('sera', '……全員の名前を覚えておこうと思って。七年前は、覚えていなかったので。'),
        n('セラの指が、名簿の一行で止まった。{name}。{I}の名前だ。'),
        say('sera', 'この名前は、明後日も名簿に残っていてください。規則です。'),
        n('セラは、少しだけ笑った。初めて見る顔だった。'),
      ],
      effect: (s) => {
        s.flags.eveWith = 'sera';
        rel(s, 'sera', 'trust', 5, { big: true });
        rel(s, 'sera', 'affinity', 5, { big: true });
      },
      end: { advance: true },
    },
    alone: {
      lines: [
        n('部屋に戻り、剣を抜いて、刃こぼれを一つずつ確かめる。'),
        n('懐から、古い認識票を取り出した。七年前の夜も、こんなふうに静かだったのだろうか。'),
      ],
      effect: (s) => {
        s.flags.eveWith = 'alone';
        gain(s, 'will', 1.0, {});
        s.cond.stress = Math.max(0, s.cond.stress - 15);
      },
      end: { advance: true },
    },
  },
};

// ───────── 大潮の夜 ─────────

const lyneWithMe = (s: GameState) =>
  lyneHere(s) && (!!s.flags.lyneParty || s.npcs.lyne.rel.trust >= 15 || s.flags.eveWith === 'lyne');
const garadAtGate = (s: GameState) => garadAlive(s) && !s.flags.garadKneeWorse;

const greatTide: EventDef = {
  id: 'great_tide',
  trigger: 'slot',
  priority: 200,
  once: true,
  interrupt: true,
  cond: (s) => (s.day === TIDE_DAY && s.slot === 3) || s.day > TIDE_DAY,
  nodes: {
    start: {
      lines: [
        n('日が沈むと同時に、東門の鐘が鳴りはじめた。三度ではない。鳴り止まない。'),
        n('城壁の上から見る森は、もはや森ではなかった。灰色の霞全体が青白く脈打ち、その下で、無数の目が光っている。'),
        (s): Line[] => {
          const p = preparedness(s);
          if (p >= 3) return [n('門の前には二重の柵。城壁の上には油の樽と弓兵。冒険者と兵士が、持ち場ごとに整然と並んでいる。'), n('誰かが言った。「七年前とは違う」')];
          if (p >= 1) return [n('門の前には急ごしらえの柵。冒険者と兵士が、ぎこちなく持ち場を分け合っている。')];
          return [n('門の前に集まった冒険者たちは、てんでばらばらに剣を抜いていた。兵士たちは城壁の上で、何が起きているのか分からないという顔をしている。'), n('城壁の上の白衣の人影が、ひとり、唇を噛んでいた。')];
        },
        (s) => (s.flags.ruleAdopted ? n('仮登録の新人たちは、城壁の内側で伝令と負傷者の運搬に回されている。ティモの姿もあった。') : null),
        (s) => (lyneWithMe(s) ? [n('隣で、リーネが剣を抜いた。'), say('lyne', '行くわよ。')] : null),
        (s) =>
          garadAlive(s)
            ? garadAtGate(s)
              ? n('門の真ん中に、ガラドが立っていた。右足を引きずりながら、それでも誰よりも前に。')
              : n('城壁の上で、ガラドが杖をついて指示を飛ばしている。あの夜に壊した膝では、もう門の前には立てない。')
            : null,
        n('森の縁から、灰色の波が押し寄せてきた。'),
      ],
      choices: [
        {
          text: '剣を構える',
          effect: (s) => {
            s.flags.tideFought = true;
            startCombat(s, {
              enemy: 'wolf',
              dist: 2,
              companion: lyneWithMe(s) ? 'lyne' : undefined,
              onWin: { ev: 'great_tide', node: 'wave2' },
              onLose: { ev: 'great_tide', node: 'down' },
              onFlee: { ev: 'great_tide', node: 'fallback' },
            });
            if (s.combat && s.flags.guildPrepared) s.combat.edge = 1;
          },
        },
      ],
    },
    fallback: {
      lines: [
        n('柵の内側まで下がり、息を整える。'),
        n('隣で誰かが倒れ、誰かが引きずられていく。下がった分だけ、別の誰かが前に出ていた。'),
        n('もう一度、前へ出るしかない。'),
      ],
      next: 'wave2',
    },
    wave2: {
      lines: [
        n('どれだけ斬ったか分からない。腕が鉛のように重い。'),
        n('そのとき、狼たちの動きが変わった。一斉に左右に分かれ、道を空ける。'),
      ],
      choices: [
        {
          text: '前に出る',
          effect: (s) => {
            startCombat(s, {
              enemy: 'alpha',
              dist: 2,
              companion: lyneWithMe(s) ? 'lyne' : garadAtGate(s) ? 'garad' : undefined,
              onWin: { ev: 'great_tide', node: 'alpha_down' },
              onLose: { ev: 'great_tide', node: 'down' },
              onFlee: { ev: 'great_tide', node: 'alpha_held' },
            });
            if (s.combat && s.flags.garrisonPrepared) s.combat.edge = 1;
          },
        },
      ],
    },
    alpha_down: {
      lines: [
        n('群れ長が倒れた。'),
        n('一瞬、戦場が静まり返った。それから、門の前の冒険者たちが吠えるような声を上げた。'),
        (s) => (garadAtGate(s) ? [n('ガラドが、{I}を見ていた。何も言わない。ただ、小さく頷いた。')] : null),
      ],
      effect: (s) => {
        s.flags.alphaSlain = true;
        log(s, '大潮の夜、群れ長を倒した。');
      },
      next: 'choice',
    },
    alpha_held: {
      lines: [n('群れ長の前から退いた{I}の代わりに、兵士たちが槍衾を作った。群れ長は唸り声を上げ、闇の中へ退いていった。')],
      next: 'choice',
    },
    choice: {
      lines: [
        say('伝令', '南だ！　群れの一部が、南へ回り込んでる！　開拓村のほうだ！'),
        n('城壁の上から、松明の光の筋が見えた。灰色の影が十数頭、門を迂回して、闇の中を南へ走っていく。'),
        n('開拓村には柵しかない。'),
        (s) =>
          s.flags.garrisonPrepared
            ? n('開拓村には、守備隊の一隊がいるはずだ。だが、あの数を相手に持ちこたえられるだろうか。')
            : n('開拓村に、兵はいない。'),
        n('門の前では、まだ戦いが続いている。ここを離れれば、門の守りが一人分薄くなる。'),
        (s) => (garadAlive(s) ? n('ガラドの姿が目に入った。彼も、南を見ていた。七年前と、同じ顔で。') : null),
      ],
      choices: [
        { text: '南へ走る', effect: (s) => { s.flags.tideChoice = 'chase'; }, next: 'chase' },
        { text: '門を守る', effect: (s) => { s.flags.tideChoice = 'hold'; }, next: 'hold' },
        { text: '「リーネ、南を頼む」', cond: lyneWithMe, effect: (s) => { s.flags.tideChoice = 'lyne'; }, next: 'trust_lyne' },
      ],
    },
    chase: {
      lines: [
        n('{I}は門を離れ、闇の中を南へ走った。'),
        n('背後で、誰かが名前を呼んだ気がした。振り返らなかった。'),
        n('開拓村の柵が見えたとき、最初の狼が柵を飛び越えるところだった。'),
      ],
      effect: (s) =>
        startCombat(s, {
          enemy: 'wolf',
          dist: 1,
          onWin: { ev: 'great_tide', node: 'village_saved' },
          onLose: { ev: 'great_tide', node: 'village_down' },
          onFlee: { ev: 'great_tide', node: 'village_down' },
        }),
    },
    village_saved: {
      lines: [
        n('最後の狼が、畑の畝に倒れた。'),
        n('松明を持った村人たちが、恐る恐る家から出てきた。柵の陰から、子供たちが{I}を見ている。'),
        (s) => (s.flags['questDone:q_boar'] !== undefined ? n('前に棘猪を追い払ったときに、柵の陰からこちらを見ていた子供たちだった。') : null),
      ],
      effect: (s) => (s.flags.villageSaved = 'hero'),
      next: 'dawn',
    },
    village_down: {
      lines: [
        n('狼の牙が肩に食い込んだ。膝をつく。'),
        n('そのとき、南の道から松明の列が現れた。'),
        (s) => (s.flags.garrisonPrepared ? n('守備隊の一隊だ。ハンスの号令で、槍が一斉に狼たちへ向けられた。') : n('門から駆けつけた冒険者たちだった。誰かが、{I}の後を追ってきてくれたのだ。')),
      ],
      effect: (s) => {
        s.flags.villageSaved = s.flags.garrisonPrepared ? 'garrison' : 'others';
        s.cond.injuries.push({ id: 'tide', label: '狼に噛まれた肩', severity: 2, days: 10 });
      },
      next: 'dawn',
    },
    hold: {
      lines: [
        n('{I}は南に背を向け、門の前に踏みとどまった。'),
        n('目の前の一頭を斬る。また一頭。南の空が、どうなっているのか分からない。分からないまま、剣を振り続けた。'),
      ],
      effect: (s) => {
        s.flags.villageSaved = s.flags.garrisonPrepared ? 'garrison' : '';
        gain(s, 'will', 1.5, { difficulty: 40 });
      },
      next: 'dawn',
    },
    trust_lyne: {
      lines: [
        n('リーネは一瞬、{I}の顔を見た。それから、口の端を上げた。'),
        say('lyne', '任せなさい。'),
        n('金茶色の髪が、闇の中へ駆けていく。'),
        n('{I}は門の前に残った。リーネの背中を、一度だけ振り返って。'),
      ],
      effect: (s) => {
        s.flags.villageSaved = 'lyne';
        rel(s, 'lyne', 'trust', 10, { big: true });
        rel(s, 'lyne', 'respect', 8, { big: true });
        remember(s, 'lyne', 'tide:trusted', '大潮の夜、開拓村をリーネに任せた。');
      },
      next: 'dawn',
    },
    down: {
      lines: [
        n('衝撃。視界が回る。砂と血の味。'),
        n('誰かに襟首をつかまれ、柵の内側へ引きずり込まれた。'),
        (s) => (lyneWithMe(s) ? say('lyne', '寝てなさい！　あとは、私がやる！') : say('伝令', '下がれ！　もう十分だ！')),
        n('そこから先のことは、切れ切れにしか覚えていない。'),
      ],
      effect: (s) => {
        s.flags.tideDown = true;
        s.flags.tideChoice = 'none';
        s.flags.villageSaved = s.flags.garrisonPrepared ? 'garrison' : lyneWithMe(s) ? 'lyne' : '';
      },
      next: 'dawn',
    },
    dawn: {
      lines: [n('長い夜だった。'), n('東の空が白みはじめたとき、森の上の霞は、嘘のように薄くなっていた。潮が引いたのだ。')],
      effect: (s) => resolveTide(s),
      next: 'outcome',
    },
    outcome: {
      lines: [(s) => tideOutcomeLines(s)],
      end: { advance: true },
    },
  },
};

/** 大潮の結果を確定させる */
function resolveTide(s: GameState) {
  const p = preparedness(s);
  const choice = s.flags.tideChoice as string;
  const heroAtGate = choice !== 'chase';
  let gateHeavy: boolean;
  if (heroAtGate && !s.flags.tideDown) gateHeavy = p === 0;
  else gateHeavy = p <= 1 && !(garadAtGate(s) && lyneWithMe(s) && choice !== 'lyne');
  s.flags.gateHeavy = gateHeavy;

  // 最悪の場合：備えがなく、門が手薄になり、ガラドが門に立っていた
  if (choice === 'chase' && p === 0 && garadAtGate(s) && !lyneWithMe(s)) {
    s.npcs.garad.alive = false;
    s.flags.garadDied = true;
  } else if (gateHeavy && garadAtGate(s)) {
    s.flags.garadWoundedTide = true;
  }
  if (s.flags.villageSaved === 'lyne') s.flags.lyneHero = true;
  if (!s.flags.villageSaved) s.flags.villageBurned = true;
  if (s.flags.timoSaved && gateHeavy && !s.flags.ruleAdopted) s.flags.timoWounded = true;
  log(s, '大潮の夜を越えた。');
}

function tideOutcomeLines(s: GameState): Line[] {
  const out: Line[] = [];
  if (s.flags.gateHeavy) out.push(n('門は破られなかった。だが、門の前の砂地には、動かなくなった者たちが何人も横たわっていた。冒険者が五人、兵士が八人。七年前より、多かった。'));
  else out.push(n('門は持ちこたえた。負傷者は数えきれないほどいたが、死者は二人だけだった。七年前の夜を知る兵士が、信じられないという顔で何度も数え直していた。'));
  if (s.flags.ruleAdopted) out.push(n('城壁の内側に回されていた仮登録の新人たちは、一人も欠けなかった。'));
  if (s.flags.timoWounded) out.push(n('ティモは門の前に立っていた。腕を深く裂かれたが、命は助かった。'));
  const v = s.flags.villageSaved;
  if (v === 'hero') out.push(n('開拓村は、家一軒焼かれずに済んだ。'));
  else if (v === 'lyne') out.push(n('朝日の中を、リーネが南の道から歩いてきた。鎧は傷だらけで、左腕から血を流している。それでも、背筋はまっすぐ伸びていた。'), say('lyne', '村は無事よ。……一人で、やったわ。'));
  else if (v === 'garrison') out.push(n('開拓村は、守備隊の一隊が守りきった。畑は踏み荒らされたが、死者は出なかった。'));
  else if (v === 'others') out.push(n('開拓村は、駆けつけた冒険者たちのおかげで、どうにか持ちこたえた。'));
  else out.push(n('南の空が、赤く染まっていた。開拓村の家々が、何軒も焼け落ちていた。'));
  if (s.flags.garadDied) {
    out.push(
      n('門の真ん中で、ガラドが倒れていた。右膝を砂につき、木剣ではない本物の剣を握ったまま。'),
      n('彼の前には、狼たちの骸が積み重なっていた。最後まで、一歩も退かなかったのだと、兵士たちが言った。'),
      n('七年前とは逆の選択をして、ガラドは逝った。'),
    );
  } else if (s.flags.garadWoundedTide) {
    out.push(n('ガラドは門の前で深手を負い、担架で運ばれていった。それでも、運ばれながら兵士たちに指示を飛ばしていた。'));
  }
  return out;
}

// ───────── 大潮の後 ─────────

const tideAfter: EventDef = {
  id: 'tide_after',
  trigger: 'slot',
  priority: 60,
  once: true,
  cond: (s) => s.seen.great_tide !== undefined && s.day > (s.seen.great_tide as number) && s.slot <= 1,
  nodes: {
    start: {
      lines: [
        n('翌日、ギルドの広間は負傷者の手当てと、魔核の山の仕分けでごった返していた。'),
        (s) =>
          s.flags.guildPrepared
            ? [say('ボルド', '……あの森人の言った通りだった。日付も、規模も。'), say('ボルド', '分室の予算、王都にかけあってやる。それくらいしかできんがな。')]
            : [n('ボルド支部長は、窓の外を見たまま誰とも口をきかなかった。森人の予言を追い返したことは、もう街中が知っている。')],
      ],
      next: (s) => (s.rank >= 1 && s.flags.tideFought && !s.flags.tideDown ? 'promote' : 'after'),
    },
    promote: {
      lines: [
        n('セラに呼ばれて窓口へ行くと、一枚の札が差し出された。赤みを帯びた銅の札だ。'),
        say('sera', '大潮の夜の働きにより、銅級への昇格が認められました。審査は免除です。'),
        (s) => (s.flags.alphaSlain ? say('sera', '群れ長を倒した新人がいると、守備隊からも報告が来ています。') : null),
        say('sera', '……生きて、ここに来てくれてよかった。'),
      ],
      effect: (s) => {
        s.rank = Math.max(s.rank, 2);
        log(s, '大潮の夜の働きで、銅級に昇格した。');
      },
      next: 'after',
    },
    after: {
      lines: [
        (s) =>
          lyneHere(s) && s.flags.lyneStays
            ? [
                n('広間の隅で、リーネが手紙を書いていた。'),
                say('lyne', s.flags.lyneHero || s.flags.tideFought ? '銅級になったの。……家に手紙を書いてるところ。' : '家に、手紙を書いてるところ。'),
                say('lyne', '「アーデルの名に恥じない働きを」じゃなくて、「私は元気です」って書くことにしたわ。'),
              ]
            : null,
      ],
      effect: (s) => {
        if (s.flags.lyneHero || (lyneHere(s) && s.flags.tideFought)) s.flags.lyneCopper = true;
      },
    },
  },
};

const noinPulse: EventDef = {
  id: 'noin_pulse',
  trigger: 'after',
  priority: 50,
  once: true,
  cond: (s) => s.seen.great_tide !== undefined && s.location === 'institute' && s.npcs.noin.met,
  nodes: {
    start: {
      lines: [
        n('分室の壁に、新しい紙が一枚増えていた。大潮の夜の、潮計の記録だ。'),
        (s) =>
          gauge(s) >= 2
            ? [
                say('noin', '見て。脈動の波形。森の奥から来てるんじゃない。'),
                n('ノインは、地図の一点を指で叩いた。カルナスの、真ん中だった。'),
                say('noin', '澱の脈動の中心は、この街の真下にある。'),
                say('noin', '旧街道の標石が全部こっちを向いてたのも、たぶんそのせい。カルナスの下には、灯脈の「節」が眠ってる。四百年前に断ち切れた、管の結び目が。'),
                say('noin', '……潮は、森から来てたんじゃない。ずっと、ここから呼ばれてたんだ。'),
              ]
            : [say('noin', '潮計の記録、途中で針が振り切れちゃった。精度が足りなかったんだ。'), say('noin', 'でも、脈動の中心が森の奥じゃないってことだけは分かる。もっと近い。……もっと調べなきゃ。')],
      ],
      effect: (s) => {
        s.flags.knowNode = gauge(s) >= 2;
        rel(s, 'noin', 'trust', 4);
        log(s, s.flags.knowNode ? 'ノインが、澱の脈動の中心がカルナスの真下にあることを突き止めた。' : 'ノインは、澱の脈動の中心が森の奥ではないと言った。');
      },
    },
  },
};

const garadAfter: EventDef = {
  id: 'garad_after',
  trigger: 'slot',
  priority: 30,
  once: true,
  cond: (s) => s.seen.great_tide !== undefined && s.day >= (s.seen.great_tide as number) + 3 && s.slot === 3 && garadAlive(s),
  nodes: {
    start: {
      lines: [
        n('灯り亭の隅の席で、ガラドが杯を前にしていた。今夜は、中身が減っていない。'),
        (s) => {
          const c = s.flags.tideChoice;
          if (c === 'chase')
            return [
              say('garad', 'お前は南へ走ったな。'),
              say('garad', '七年前の俺と同じだ。……あの後、門がどうなったか、お前も見ただろう。'),
              n('ガラドは杯を見つめた。'),
              say('garad', '俺はお前を責めん。責められるのは、俺だけだ。'),
            ];
          if (c === 'hold')
            return [
              say('garad', 'お前は門に残ったな。'),
              say('garad', '俺がしなかった選択だ。'),
              s.flags.villageBurned ? say('garad', '……南の村は焼けた。それも、お前が背負うものだ。俺が門の仲間を背負ってきたようにな。') : say('garad', '村も無事だった。運がよかったのか、備えがよかったのか。'),
            ];
          if (c === 'lyne')
            return [say('garad', 'あの娘に南を任せたな。'), say('garad', '一人で両方を背負おうとしなかった。……俺には、それができなかった。')];
          return [say('garad', '倒れても、生きて帰ってきた。それでいい。')];
        },
        say('garad', '答えは出たか、とお前は聞くか。'),
        say('garad', '出ていない。たぶん、一生出ない。……だが、背負って立っていることはできる。それが分かった。'),
        (s) =>
          s.flags.garadQuit
            ? s.flags.askedGaradStay || s.flags.tagRevealed || s.flags.seraGaradReconciled
              ? [say('garad', '……訓練場に戻ることにした。新人どもに、門の前の立ち方を教える奴が要る。'), n('ガラドは、ようやく杯に口をつけた。')]
              : [say('garad', '俺は南の開拓村へ行く。柵の作り方と、剣の握り方くらいは教えられる。'), n('数日後、ガラドは荷物ひとつを担いで、南門から出ていった。')]
            : null,
      ],
      effect: (s) => {
        if (s.flags.garadQuit) {
          if (s.flags.askedGaradStay || s.flags.tagRevealed || s.flags.seraGaradReconciled) s.flags.garadReturned = true;
          else {
            s.flags.garadLeftCity = true;
            s.npcs.garad.away = 9999;
          }
        }
        rel(s, 'garad', 'trust', 4, { big: true });
      },
    },
  },
};

const garadMourning: EventDef = {
  id: 'garad_mourning',
  trigger: 'slot',
  priority: 55,
  once: true,
  cond: (s) => !!s.flags.garadDied && s.seen.great_tide !== undefined && s.day >= (s.seen.great_tide as number) + 2 && s.slot === 2,
  nodes: {
    start: {
      lines: [
        n('東門の外の墓地に、新しい墓標が十三本並んだ。'),
        n('その中の一本に、セラが花を手向けていた。白い花だった。'),
        say('sera', '……七年前、弟の墓にも、同じ花を置きました。'),
        say('sera', 'あの人は、門に残ったんですね。今度は。'),
        n('セラの肩が、小さく震えていた。'),
        (s) => (s.items.oldtag ? n('懐の中で、古い認識票が重かった。') : null),
      ],
      choices: [
        { text: '墓標の前に、古い認識票を置く', cond: (s) => !!s.items.oldtag, effect: (s) => { s.items.oldtag = 0; s.flags.tagLeftAtGrave = true; log(s, 'ガラドの墓標の前に、古い認識票を置いた。'); }, next: 'end' },
        { text: '黙って手を合わせる', next: 'end' },
      ],
    },
    end: { lines: [n('風が、墓地の草を揺らしていった。森の上の霞は、もう薄い。')] },
  },
};

// ───────── エピローグ ─────────

function heroTitle(s: GameState): string {
  const c = (k: string) => s.counters[k] ?? 0;
  const talk = Object.entries(s.counters).filter(([k]) => k.startsWith('talk:')).reduce((a, [, v]) => a + v, 0);
  const scores: [string, number][] = [
    ['訓練場で毎日のように剣を振っている、生真面目な新人', c('act:sword') + c('act:body') * 0.5 + c('act:selftrain') * 0.3],
    ['魔導院の分室に入り浸っている、変わり者の新人', c('act:magic') * 1.5 + c('act:library') + c('act:study') * 0.5],
    ['森の縁の薬草に詳しい新人', c('act:forest') * 0.6 + c('act:sell') * 2],
    ['依頼を確実にこなす、手堅い新人', (s.counters.questDone ?? 0) * 4 + (s.counters.wins ?? 0)],
    ['誰とでも話す、顔の広い新人', talk * 1.2],
    ['商会の倉庫でよく見かける、働き者の新人', c('act:work') * 1.2],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][0];
}

function epilogueLines(s: GameState): Line[] {
  const out: Line[] = [];
  out.push(n('若葉月の終わり。カルナスに来て、九十日が過ぎた。'));
  out.push(n(`街の人々は、{I}のことを「${heroTitle(s)}」と呼んでいるらしい。`));
  if (s.flags.villageSaved === 'hero') out.push(n('開拓村の子供たちは、大潮の夜に南へ走ってきた冒険者の話を、もう歌にして歌っている。'));
  if (s.flags.alphaSlain) out.push(n('群れ長の魔核は、ギルドの広間に飾られることになった。'));

  // ガラド
  if (s.flags.garadDied) out.push(n('ガラドの墓標は、東門の外にある。今も誰かが、白い花を絶やさない。'));
  else if (s.flags.garadLeftCity) out.push(n('ガラドは南の開拓村で、村人たちに剣を教えているという。ときどき、無愛想な手紙が届く。'));
  else if (s.flags.tagRevealed) out.push(n('ガラドは今日も訓練場で、新人たちを怒鳴りつけている。ときどき{I}の稽古を見ては、何も言わずに頷く。七年分の何かが、彼の背中から少しだけ降りたように見えた。'));
  else out.push(n('ガラドは今日も訓練場にいる。相変わらず、口数は少ない。'));

  // リーネ
  if (s.flags.lyneLeft) out.push(n('リーネからは、一度だけ手紙が来た。王都の消印。「元気です」とだけ書いてあった。封筒の中に、石の札の欠片が入っていた。'));
  else if (s.flags.lyneParty) out.push(n(s.flags.lyneCopper ? 'リーネは銅級になった。一年で、という約束を、半年もかけずに果たした。相棒として、今日も{I}の隣で剣を磨いている。' : 'リーネとは、今日も二人で森の縁へ出る。口喧嘩は絶えないが、背中を預けるのに迷いはない。'));
  else if (s.flags.lyneStays) out.push(n('リーネはカルナスに残った。訓練場で顔を合わせるたびに、「次は負けない」と言ってくる。'));

  // セラ
  if (s.flags.ruleAdopted) out.push(n('セラの新人保護規定は、大潮の夜の結果を受けて、正式に採用されることになった。窓口の引き出しの奥の紙の束は、ようやく役目を終えた。'));
  else out.push(n('セラは今日も、新しい草案を書いている。五度目の提出は、潮が引いた後になるだろう。'));
  if (s.flags.seraGaradReconciled && !s.flags.garadDied) out.push(n('最近、セラが訓練場に記録を取りに来る回数が増えた。ガラドと二人で、新人の育て方について言い争っているのをよく見かける。'));

  // ノイン
  if (s.flags.knowNode) out.push(n('ノインは、カルナスの地下に眠る灯脈の節について、王都への報告書を書いている。分室の壁の紙は、また増えた。'), n('「この街の下に、何があるのか。たぶん、まだ誰も知らないことが山ほどある」ノインはそう言って、楽しそうに笑った。'));
  else if (s.npcs.noin.met) out.push(n('ノインは、潮計の改良に取りかかっている。次の潮までに、もっと正確な答えを出すのだと言って。'));

  // マルタ
  if ((s.counters.tab ?? 0) > 0) out.push(n('灯り亭のツケ帳には、まだ{I}の名前が残っている。マルタは「いつでもいいよ」と言うけれど。'));
  else if (s.counters.tabPaid) out.push(n('灯り亭のツケ帳の{I}の名前の横には、丸が一つついている。マルタはときどきその頁を開いて、満足そうに眺めているらしい。'));
  if (s.flags.martaDebt) out.push(n(s.flags.martaKnowsEdgar ? '灯り亭の家賃の件は、まだ片づいていない。それでもマルタは、エドガーが来るたびに煮込みを大盛りにしている。' : '灯り亭の家賃の件は、まだ片づいていない。マルタは「なんとかするさ」と笑っている。'));

  // エドガー
  if (s.flags.edgarNoin) out.push(n('エドガーは、商会の仕事の合間に分室へ通っている。ノインと二人、魔核の大きさと力の関係を、一枚の表にまとめようとしているらしい。'));
  else if (s.npcs.edgar?.met) out.push(n('エドガーは今日も、商会の帳場で数字と睨み合っている。'));

  out.push(n('東の城壁の向こうで、灰縁の森は静かに霞をまとっている。'));
  out.push(n('――第1章　澱潮の春　完'));
  return out;
}

const epilogue: EventDef = {
  id: 'epilogue',
  trigger: 'slot',
  priority: 150,
  once: true,
  interrupt: true,
  cond: (s) => s.day >= 90 && s.slot === 3 && s.seen.great_tide !== undefined,
  nodes: {
    start: {
      lines: [(s) => epilogueLines(s)],
      next: 'note',
    },
    note: {
      lines: [n('（第2章は今後のアップデートで追加される予定です。この先も、カルナスでの日々を自由に続けられます。）')],
      effect: (s) => {
        s.flags.chapter1Done = true;
        s.journal.push({ day: s.day, text: epilogueLines(s).map((l) => l.text.replaceAll('{I}', s.hero.pronoun)), kind: 'event' });
      },
    },
  },
};

// ───────── 潮の時期の日常 ─────────

const tideNight: EventDef = {
  id: 'tide_marta',
  trigger: 'slot',
  priority: 1,
  cooldown: 4,
  cond: (s) => !!s.flags.tideRising && s.slot === 3 && s.seen.great_tide === undefined,
  nodes: {
    start: {
      lines: [
        n('食堂の窓から、城壁の上の篝火が見える。'),
        (s) =>
          say(
            'マルタ',
            s.flags.guildPrepared
              ? 'ギルドが備えてくれてるって話だね。……七年前に、それがあったらねえ。'
              : '潮の夜はね、亭主が帰ってこなかった夜なんだよ。あんたは帰ってきな。必ずだよ。',
          ),
      ],
    },
  },
};

export const EVENTS_1B: EventDef[] = [
  qRuin,
  ruinThanks,
  calibrate,
  prediction,
  predictionVisit,
  predictionRumor,
  warnGuild,
  lyneLetter,
  lyneDecide,
  seraRule,
  garadDecision,
  reconcile,
  tideRise,
  tidePrep,
  tideEve,
  greatTide,
  tideAfter,
  noinPulse,
  garadAfter,
  garadMourning,
  epilogue,
  tideNight,
];

// ───────── 追加の話題 ─────────

const TOPICS_1B: Record<string, TopicDef[]> = {
  garad: [
    {
      id: 'stay',
      label: '教官を辞めないでほしいと頼む',
      once: true,
      cond: (s) => !!s.flags.heardGaradQuit && !s.flags.garadStays && !s.flags.garadQuit,
      node: {
        lines: [
          n('ガラドは、{I}の顔をじっと見た。'),
          say('garad', '……マルタか。あいつは口が軽い。'),
          (s) =>
            closeness(s, 'garad') > 18
              ? [say('garad', '考えておく。'), n('それだけ言って、ガラドは視線を逸らした。けれど、追い払われはしなかった。')]
              : say('garad', 'お前に頼まれる筋合いはない。'),
        ],
        effect: (s) => {
          s.flags.askedGaradStay = true;
          remember(s, 'garad', 'ask:stay', '教官を辞めないでほしいと頼んだ。');
        },
      },
    },
  ],
  sera: [
    {
      id: 'reconcile',
      label: 'ガラドと話をしてみないかと勧める',
      once: true,
      cond: (s) => !!s.flags.seraGaradKnot && garadAlive(s) && !s.flags.garadLeftCity && (!!s.flags.tagRevealed || s.npcs.garad.rel.trust >= 25) && s.seen.great_tide === undefined,
      node: {
        lines: [
          n('セラは長い間、黙っていた。'),
          say('sera', '……七年、避けてきました。'),
          say('sera', '今さら何を話せばいいのか、分かりません。'),
          n('それでも、セラはペンを置いた。'),
          say('sera', '夕方、訓練場に行きます。……あなたも、来てください。'),
        ],
        next: 'reconcile/start',
      },
    },
  ],
  noin: [
    {
      id: 'ruin',
      label: '潮計の続きについて聞く',
      once: true,
      cond: (s) => gauge(s) >= 1 && s.day >= 30,
      node: {
        lines: [
          say('noin', '潮計の芯は、きみの泥のおかげでだいぶ良くなった。次に要るのは、「流れの向き」を測る部品。'),
          say('noin', '旧街道の遺構に、古い標石が残ってる。灯脈――大落日の前の、魔力の通り道の道しるべ。その欠片が欲しい。'),
          say('noin', 'ちょっと遠いし、遺構には蛇が棲みついてるらしいから、石級以上じゃないとギルドが許可しないと思う。依頼は出しておくね。'),
        ],
        effect: (s) => {
          s.flags.noinRuin = true;
          log(s, 'ノインから、旧街道の遺構の標石の欠片を頼まれた。');
        },
      },
    },
    {
      id: 'calibrate',
      label: '潮計の調整を手伝う',
      cond: (s) =>
        gauge(s) >= 1 && !s.flags.calibrated && s.day >= 35 && !!s.flags.magicIntro && (s.flags.calibFailDay === undefined || s.day - (s.flags.calibFailDay as number) >= 5) && s.seen.great_tide === undefined,
      node: {
        lines: [say('noin', '本当？　助かる。じゃあ、夕方になったら城壁の上に来て。')],
        next: 'calibrate/start',
      },
    },
    {
      id: 'warn',
      label: '大潮の予測をギルドに伝えに行く',
      once: true,
      cond: (s) => s.flags.prediction !== undefined && s.day < TIDE_DAY,
      node: {
        lines: [say('noin', '……うん。行こう。'), n('ノインは白衣を脱いで、少しだけましな上着に袖を通した。')],
        next: 'warn_guild/start',
      },
    },
  ],
  lyne: [
    {
      id: 'party_late',
      label: 'パーティーを組もうと誘う',
      once: true,
      cond: (s) => !!s.flags.lyneStays && !s.flags.lyneParty && s.npcs.lyne.rel.trust >= 18,
      node: {
        lines: [say('lyne', '……今さら？'), n('リーネは呆れたように笑った。'), say('lyne', 'いいわよ。待ってたんだから。')],
        effect: (s) => {
          s.flags.lyneParty = true;
          rel(s, 'lyne', 'affinity', 5);
          log(s, 'リーネとパーティーを組んだ。');
        },
      },
    },
  ],
};

export function extendNpcs(npcs: NpcDef[]) {
  for (const npc of npcs) npc.topics.push(...(TOPICS_1B[npc.id] ?? []));
}
