// 日常の小さな出来事（ストーリーレット）。大きな物語の合間を埋め、街と人に厚みを持たせる。ネタバレを含む。
import type { EventDef } from '../engine/defs';
import type { GameState } from '../engine/types';
import { n, say } from '../engine/text';
import { rel, remember } from '../engine/npc';
import { gain } from '../engine/growth';
import { log } from '../engine/game';
import { chance, pick } from '../engine/rng';
import { clamp } from '../engine/stats';

const at = (s: GameState, loc: string) => s.location === loc;
const did = (s: GameState, prefix: string) => (s.lastAction ?? '').startsWith(prefix);
const here = (s: GameState, id: string) => {
  const st = s.npcs[id];
  return !!st && st.met && st.alive && st.away <= 0;
};
const calm = (s: GameState) => !s.flags.tideRising || s.seen.great_tide !== undefined;

/** 日常の出来事を簡単に書くための型 */
function daily(id: string, trigger: 'slot' | 'after', cond: (s: GameState) => boolean, nodes: EventDef['nodes'], opt: Partial<EventDef> = {}): EventDef {
  return { id, trigger, cond, priority: 0, cooldown: 9999, once: true, nodes, ...opt };
}

export const STORYLETS: EventDef[] = [
  // ───────── 訓練場 ─────────
  daily('tr_rookie_ask', 'after', (s) => at(s, 'training') && s.day >= 12 && did(s, 'sword:'), {
    start: {
      lines: [
        n('木剣を戻そうとしたとき、ひょろりとした少年が声をかけてきた。'),
        say('新人', 'あの……先輩、ですよね。剣の握り方、これで合ってますか。'),
        n('少年は、両手で柄の端を握りしめていた。あれでは振るたびに手首を痛める。'),
      ],
      choices: [
        { text: '握り方を教える', next: 'teach' },
        { text: '「ガラド教官に聞くといい」', next: 'refer' },
        { text: '「自分も新人だから」と断る', next: 'decline' },
      ],
    },
    teach: {
      lines: [
        n('少年の手を取り、指の位置を一本ずつ直していく。'),
        n('説明しながら、{I}は気づいた。自分が何となくやっていたことを、言葉にするのは難しい。言葉にしてみて初めて、なぜそうするのかが分かることもある。'),
        say('新人', 'あ……振りやすい！　ありがとうございます！'),
      ],
      effect: (s) => {
        gain(s, 'sword_t', 1.2, { difficulty: 24, kind: 'mentor' });
        gain(s, 'empathy', 0.6, {});
        s.flags.taughtRookie = s.day;
        log(s, '訓練場で、新人の少年に剣の握り方を教えた。');
      },
    },
    refer: { lines: [say('新人', 'き、教官は怖くて……。'), n('少年はしょんぼりと肩を落として、訓練場の隅へ戻っていった。')] },
    decline: { lines: [n('少年は頭を下げて去っていった。訓練場の隅で、一人で木剣を振り続けていた。')] },
  }),
  daily('tr_rookie_thanks', 'after', (s) => at(s, 'training') && typeof s.flags.taughtRookie === 'number' && s.day >= (s.flags.taughtRookie as number) + 7, {
    start: {
      lines: [
        n('訓練場の入口で、見覚えのある少年が手を振っていた。剣の握り方を教えた、あの少年だ。'),
        say('新人', '先輩！　今日、初めて依頼をこなしたんです。鼠退治ですけど。'),
        say('新人', '先輩に教わった握り方、ガラド教官に「誰に習った」って聞かれました。'),
        n('少年は、照れくさそうに笑った。'),
      ],
      effect: (s) => {
        s.cond.stress = clamp(s.cond.stress - 10, 0, 100);
        rel(s, 'garad', 'respect', 2);
        log(s, '剣を教えた新人の少年が、初めての依頼をこなしたと報告に来た。');
      },
    },
  }),
  daily('tr_garad_tip', 'after', (s) => at(s, 'training') && here(s, 'garad') && !s.flags.garadQuit && did(s, 'sword:') && s.day >= 5, {
    start: {
      lines: [
        n('ふと視線を感じて振り返ると、訓練場の柵にもたれて、ガラドがこちらを見ていた。'),
        (s) =>
          s.stats.sword_p < 18
            ? say('garad', '振り終わりで気を抜くな。そこを狙われる。')
            : s.stats.sword_p < 32
              ? say('garad', '……悪くない。だが、右に逃げる癖がある。相手はそれを見てる。')
              : say('garad', '……ふん。'),
        n('それだけ言って、ガラドは去っていった。'),
      ],
      effect: (s) => gain(s, 'sword_p', 1.0, { kind: 'mentor', quality: 1.3 }),
    },
  }, { once: false, cooldown: 8 }),
  daily('tr_lyne_dawn', 'slot', (s) => s.slot === 0 && here(s, 'lyne') && !s.flags.lyneLeft && s.day >= 6 && s.npcs.lyne.rel.affinity >= 3, {
    start: {
      lines: [
        n('夜明け前に目が覚めた。窓の外がまだ青い。'),
        n('ふと見下ろすと、宿の裏庭で誰かが木剣を振っていた。金茶色の髪。リーネだ。'),
        n('誰も見ていないところで、リーネは同じ型を、何十回も、何百回も繰り返していた。'),
      ],
      choices: [
        { text: '裏庭に降りて、隣で剣を振る', next: 'join' },
        { text: '窓から見ているだけにする', next: 'watch' },
      ],
    },
    join: {
      lines: [
        n('裏庭に降りると、リーネは一瞬だけ驚いた顔をして、すぐに目を逸らした。'),
        say('lyne', '……見てたの？　別に、毎朝やってるわけじゃないから。'),
        n('二人で黙って剣を振った。朝日が昇るまで、どちらも口をきかなかった。'),
      ],
      effect: (s) => {
        rel(s, 'lyne', 'affinity', 3);
        rel(s, 'lyne', 'trust', 2);
        gain(s, 'sword_p', 1.0, { difficulty: 22 });
        s.cond.fatigue = clamp(s.cond.fatigue + 8, 0, 100);
        remember(s, 'lyne', 'dawn:joined', '夜明け前の裏庭で、リーネと黙って剣を振った。');
      },
    },
    watch: {
      lines: [n('リーネが「天才」と呼ばれるのを、{I}は何度か聞いたことがある。'), n('その「天才」は、夜明け前の誰もいない裏庭で、汗だくになって同じ型を繰り返していた。')],
      effect: (s) => remember(s, 'lyne', 'dawn:watched', '夜明け前の裏庭で剣を振るリーネを、窓から見ていた。'),
    },
  }),
  daily('tr_armwrestle', 'after', (s) => at(s, 'training') && s.day >= 8, {
    start: {
      lines: [
        n('訓練場の隅の樽の上で、冒険者たちが腕相撲をしていた。銅貨が賭けられている。'),
        say('髭面の冒険者', 'おう、そこの新人。やってくか？　勝ったら十銅貨、負けたら五銅貨だ。'),
      ],
      choices: [
        { text: '挑戦する', cond: (s) => s.money >= 5, next: 'try' },
        { text: '見物する', next: 'watch' },
      ],
    },
    try: {
      lines: [
        (s) => {
          const win = s.stats.str + s.stats.will * 0.3 > 24 + (chance(s, 0.5) ? 4 : -4);
          s.flags._aw = win ? 1 : 0;
          return win
            ? [n('樽の上で手を組む。相手の腕が、じりじりと傾いていく。'), n('ごん、と相手の手の甲が樽を打った。周りから歓声が上がった。'), say('髭面の冒険者', 'ちっ、やるじゃねえか。')]
            : [n('樽の上で手を組む。ぴくりとも動かない。岩を押しているようだ。'), n('ごん、と{I}の手の甲が樽を打った。'), say('髭面の冒険者', 'まあ、新人にしちゃ粘ったほうだ。')];
        },
      ],
      effect: (s) => {
        s.money += s.flags._aw ? 10 : -5;
        gain(s, 'str', 0.6, { difficulty: 26 });
        log(s, s.flags._aw ? '訓練場の腕相撲で勝った。' : '訓練場の腕相撲で負けた。');
        delete s.flags._aw;
      },
    },
    watch: { lines: [n('腕相撲は、結局、一番体の小さな女の冒険者が勝ち抜いた。コツは腕じゃなくて手首だ、と彼女は笑っていた。')], effect: (s) => gain(s, 'wit', 0.3, {}) },
  }),

  // ───────── ギルド ─────────
  daily('gd_veteran', 'after', (s) => at(s, 'guild') && s.day >= 4, {
    start: {
      lines: [
        n('ギルドの酒場の隅で、片目に眼帯をした老冒険者が、新人たちに囲まれて話をしていた。'),
        say('老冒険者', '澱狼はな、跳ぶ前に必ず頭を下げる。それを見たら、横だ。前でも後ろでもない、横に跳べ。'),
        say('老冒険者', '棘猪は真っすぐしか走れん。木を背にして待って、ぶつかる寸前にかわしてみろ。勝手に木にめり込んでくれる。'),
        n('新人たちは笑っていたが、老冒険者の眼帯の下には、深い傷跡があった。'),
      ],
      effect: (s) => {
        gain(s, 'beast_t', 1.2, { difficulty: 22 });
        gain(s, 'beast_p', 0.6, { difficulty: 20 });
        log(s, 'ギルドの酒場で、老冒険者の魔物の話を聞いた。');
      },
    },
  }),
  daily('gd_sera_asleep', 'after', (s) => at(s, 'guild') && s.slot === 2 && here(s, 'sera') && s.npcs.sera.rel.trust >= 8, {
    start: {
      lines: [
        n('夕暮れのギルド。窓口の奥で、セラが書類に突っ伏して眠っていた。ペンを握ったままだ。'),
        n('机の上には、几帳面な字で埋まった紙の束が積み上がっている。'),
      ],
      choices: [
        { text: '自分の上着をそっと掛ける', next: 'coat' },
        { text: '起こさないように立ち去る', next: 'leave' },
        { text: '「風邪をひきますよ」と起こす', next: 'wake' },
      ],
    },
    coat: {
      lines: [n('上着を掛けて、足音を立てないように窓口を離れた。')],
      effect: (s) => {
        s.flags.coatOnSera = s.day;
        remember(s, 'sera', 'asleep:coat', '居眠りしていたセラに、上着を掛けた。');
      },
    },
    leave: { lines: [n('{I}は、静かにギルドを出た。')] },
    wake: {
      lines: [n('肩を叩くと、セラは跳ね起きた。'), say('sera', '……っ、寝てません。……寝てました。すみません。'), n('セラは乱れた髪を手早く直すと、何事もなかったように書類を揃えはじめた。耳が赤かった。')],
      effect: (s) => rel(s, 'sera', 'affinity', 2),
    },
  }),
  daily('gd_sera_coat_return', 'after', (s) => at(s, 'guild') && typeof s.flags.coatOnSera === 'number' && s.day > (s.flags.coatOnSera as number), {
    start: {
      lines: [
        n('窓口に行くと、セラが無言で、きちんと畳まれた上着を差し出した。'),
        say('sera', '……落とし物です。'),
        n('受け取ると、上着からかすかに石鹸の匂いがした。洗ってくれたらしい。'),
        say('sera', 'ありがとうございました。……落とし物を、届けてくださった方に。'),
      ],
      effect: (s) => {
        rel(s, 'sera', 'trust', 4);
        rel(s, 'sera', 'affinity', 3);
      },
    },
  }),
  daily('gd_cheat', 'after', (s) => at(s, 'guild') && s.day >= 10, {
    start: {
      lines: [
        n('報酬の窓口の前で、新人の少女が大柄な男に詰め寄られていた。'),
        say('大柄な男', '俺が狼を引きつけてやったから、お前は薬草を摘めたんだろうが。報酬は半分よこせ。'),
        n('少女は、今にも泣きそうな顔で、銅貨の袋を握りしめている。窓口のセラは、別の客の対応で手が離せない。'),
      ],
      choices: [
        { text: '間に割って入る', next: 'step' },
        { text: 'セラに知らせる', next: 'sera' },
        { text: '関わらない', next: 'ignore' },
      ],
    },
    step: {
      lines: [
        (s) => {
          const ok = s.stats.speech + s.stats.will * 0.5 + s.rank * 5 > 22;
          s.flags._cheat = ok ? 1 : 0;
          return ok
            ? [n('{I}は少女の前に立ち、男の目をまっすぐに見た。'), n('男はしばらく睨み返してきたが、やがて舌打ちをして背を向けた。'), say('少女', 'あ、ありがとうございます……！')]
            : [n('{I}は少女の前に立った。男は鼻で笑い、{I}の肩を突き飛ばした。'), n('騒ぎに気づいたセラが窓口から出てきて、ようやく男は引き下がった。')];
        },
      ],
      effect: (s) => {
        gain(s, 'will', 0.8, {});
        if (s.flags._cheat) {
          rel(s, 'sera', 'respect', 2);
          log(s, 'ギルドで、新人の少女の報酬を横取りしようとした男を追い払った。');
        }
        delete s.flags._cheat;
      },
    },
    sera: { lines: [n('セラに耳打ちすると、彼女は無言で窓口を出て、男の前に立った。'), say('sera', '共同での依頼の届け出はありません。報酬は、届け出た本人のものです。'), n('男は、すごすごと引き下がった。')], effect: (s) => rel(s, 'sera', 'trust', 2) },
    ignore: { lines: [n('{I}は目を逸らした。少女の泣き声が、背中に聞こえた気がした。')], effect: (s) => (s.cond.stress = clamp(s.cond.stress + 6, 0, 100)) },
  }),
  daily('gd_board_cat', 'after', (s) => at(s, 'guild') && s.day >= 9, {
    start: {
      lines: [
        n('掲示板の隅に、子供の字で書かれた紙が貼ってあった。'),
        n('「ねこを さがしています。はいいろで、しっぽが まがっています。なまえは ボタン。おれいは あめだま みっつ。　ミナ」'),
        n('正式な依頼ではない。ギルドの印も押されていない。'),
      ],
      choices: [
        { text: '探してみることにする', next: 'yes', effect: (s) => (s.flags.catHunt = s.day) },
        { text: 'そのままにしておく', next: 'no' },
      ],
    },
    yes: { lines: [n('紙を剥がして、懐にしまった。灰色で、しっぽの曲がった猫。街のどこかにいるはずだ。')], effect: (s) => log(s, '迷い猫「ボタン」を探すことにした。') },
    no: { lines: [n('{I}は掲示板を離れた。')] },
  }),
  daily('cat_clue', 'after', (s) => typeof s.flags.catHunt === 'number' && !s.flags.catClue && (at(s, 'market') || at(s, 'inn')), {
    start: {
      lines: [
        (s) =>
          at(s, 'market')
            ? [n('魚屋の主人に、灰色の猫のことを聞いてみた。'), say('魚屋', 'しっぽの曲がった灰色？　ああ、そいつなら毎朝ここで魚の頭をくすねていくよ。東門の方へ逃げてくな。')]
            : [n('マルタに、灰色の猫のことを聞いてみた。'), say('マルタ', 'しっぽの曲がった？　ああ、たまに裏口に来るよ。東門の見張り小屋のあたりで寝てるのを見たって客がいたね。')],
      ],
      effect: (s) => {
        s.flags.catClue = true;
        log(s, '迷い猫は、東門のあたりにいるらしい。');
      },
    },
  }),
  daily('cat_found', 'after', (s) => !!s.flags.catClue && at(s, 'gate'), {
    start: {
      lines: [
        n('東門の見張り小屋の屋根の上で、灰色の猫が丸くなっていた。しっぽが、くの字に曲がっている。'),
        n('手を伸ばすと、猫は警戒して背中を丸めた。'),
      ],
      choices: [
        { text: 'ゆっくり手を差し出して待つ', next: 'patient' },
        { text: 'さっと捕まえる', next: 'grab' },
      ],
    },
    patient: {
      lines: [
        (s) =>
          s.stats.empathy + s.stats.focus * 0.5 > 16 || chance(s, 0.5)
            ? n('じっと待つ。やがて猫は鼻先を指に近づけ、匂いを嗅ぎ、ごろりと腹を見せた。')
            : n('じっと待ったが、猫は屋根の向こうへ逃げてしまった。……と思ったら、すぐに戻ってきて、{I}の肩に飛び乗った。'),
      ],
      next: 'return',
    },
    grab: {
      lines: [n('さっと手を伸ばす。猫は鋭く鳴いて、{I}の手の甲に爪を立てた。'), n('引っかき傷だらけになりながら、どうにか抱きかかえた。')],
      effect: (s) => gain(s, 'agi', 0.4, {}),
      next: 'return',
    },
    return: {
      lines: [
        n('掲示板の紙に書かれていた家を訪ねると、小さな女の子が飛び出してきた。'),
        say('ミナ', 'ボタン！'),
        n('女の子は猫を抱きしめて、それから、握りしめていた小さな手を開いた。飴玉が三つ、汗でべたついていた。'),
        say('ミナ', 'おれい！　ぼうけんしゃさん、ありがとう！'),
      ],
      effect: (s) => {
        s.flags.catDone = true;
        s.items.candy = (s.items.candy ?? 0) + 3;
        s.cond.stress = clamp(s.cond.stress - 15, 0, 100);
        log(s, '迷い猫のボタンを見つけて、飼い主のミナに届けた。飴玉を三つもらった。');
      },
    },
  }),

  // ───────── 市場 ─────────
  daily('mk_thief', 'after', (s) => at(s, 'market') && s.money >= 25 && s.day >= 6, {
    start: {
      lines: [n('人混みの中で、腰のあたりが軽くなった。'), n('財布がない。振り返ると、小さな影が人の間をすり抜けていくのが見えた。')],
      choices: [
        { text: '追いかける', next: 'chase' },
        { text: '「泥棒！」と叫ぶ', next: 'shout' },
        { text: '諦める', next: 'give' },
      ],
    },
    chase: {
      lines: [
        (s) => {
          const ok = s.stats.agi + s.stats.end * 0.3 > 18 || chance(s, 0.3);
          s.flags._thief = ok ? 1 : 0;
          return ok
            ? [n('露店の間を駆け抜け、路地に飛び込む。行き止まりで、痩せた少年が財布を抱えて振り返った。十歳にもならないだろう。'), n('少年の腕は、枯れ枝のように細かった。')]
            : [n('人混みに阻まれて、すぐに見失った。'), n('財布の中身は、半分ほどが消えていた。')];
        },
      ],
      next: (s) => (s.flags._thief ? 'caught' : 'lost'),
    },
    caught: {
      lines: [say('少年', '……返すよ。返すから、衛兵には言わないで。')],
      choices: [
        { text: '財布を取り返して、見逃す', next: 'let' },
        { text: '黒パンを分けてやる', cond: (s) => (s.items.bread ?? 0) > 0, next: 'bread' },
        { text: '衛兵に突き出す', next: 'guard' },
      ],
      effect: (s) => delete s.flags._thief,
    },
    let: { lines: [n('少年は財布を放り出すと、礼も言わずに路地の奥へ消えた。')], effect: (s) => (s.flags.thiefBoy = 'let') },
    bread: {
      lines: [n('黒パンを差し出すと、少年は目を丸くした。'), n('少年はパンをひったくるようにして受け取り、走り去りかけて、一度だけ振り返った。'), say('少年', '……ダン。おれの名前。')],
      effect: (s) => {
        s.items.bread -= 1;
        s.flags.thiefBoy = 'kind';
        log(s, '財布を盗んだ少年ダンに、黒パンを分けてやった。');
      },
    },
    guard: { lines: [n('衛兵に引き渡すと、少年は一度も{I}の方を見なかった。')], effect: (s) => (s.flags.thiefBoy = 'guard') },
    lost: { effect: (s) => (s.money = Math.floor(s.money / 2)), lines: [n('路地の入口に、空になりかけた財布が落ちていた。')] },
    shout: {
      lines: [n('叫び声に、何人かが振り返った。だが、小さな影はもうどこにもいなかった。'), n('財布の中身は、半分ほどが消えていた。')],
      effect: (s) => (s.money = Math.floor(s.money / 2)),
    },
    give: { lines: [n('{I}は、ため息をついた。財布の中身の半分は、勉強代だと思うことにした。')], effect: (s) => (s.money = Math.floor(s.money / 2)) },
  }),
  daily('mk_dan_again', 'after', (s) => at(s, 'market') && s.flags.thiefBoy === 'kind' && (s.seen.mk_thief ?? 999) + 8 <= s.day, {
    start: {
      lines: [
        n('露店の陰から、見覚えのある痩せた少年が顔を出した。ダンだ。'),
        say('ダン', 'あんた、冒険者だろ。……これ。'),
        n('ダンが差し出したのは、薬草の束だった。根まできれいに掘り出してある。'),
        say('ダン', '森の縁で摘んできた。売れば、あのパンの分くらいにはなるだろ。'),
        say('ダン', '……おれも、いつか冒険者になれるかな。'),
      ],
      choices: [
        { text: '「なれる。訓練場に来い」', next: 'yes' },
        { text: '「森の縁に一人で行くな」', next: 'warn' },
      ],
      effect: (s) => (s.items.herb = (s.items.herb ?? 0) + 3),
    },
    yes: { lines: [n('ダンは返事をしなかった。ただ、少しだけ背筋を伸ばして、人混みに消えていった。')], effect: (s) => (s.flags.danHope = true) },
    warn: { lines: [say('ダン', '……分かってるよ。'), n('ダンはぷいと顔を背けたが、その耳は少し赤かった。')], effect: (s) => (s.flags.danWarned = true) },
  }),
  daily('mk_smith', 'after', (s) => at(s, 'market') && s.day >= 5, {
    start: {
      lines: [
        n('鍛冶屋の前を通りかかると、太い腕の親方が、{I}の腰の剣をじろりと見た。'),
        say('鍛冶屋の親方', 'おい、若いの。その剣、刃が泣いてるぞ。最後に研いだのはいつだ。'),
        say('鍛冶屋の親方', '十銅貨で研いでやる。七日は切れ味がもつ。'),
      ],
      choices: [
        { text: '研いでもらう（10銅貨）', cond: (s) => s.money >= 10, next: 'yes' },
        { text: '研ぎ方を教わる', next: 'learn' },
        { text: '断る', next: 'no' },
      ],
    },
    yes: {
      lines: [n('親方は砥石の前に座り、驚くほど静かな手つきで刃を研いでいく。'), n('返された剣は、光を受けて一本の線のように光った。'), say('鍛冶屋の親方', 'よし。これで斬れなかったら、そりゃお前の腕のせいだ。')],
      effect: (s) => {
        s.money -= 10;
        s.flags.sharpUntil = s.day + 7;
        log(s, '鍛冶屋で剣を研いでもらった。');
      },
    },
    learn: {
      lines: [say('鍛冶屋の親方', 'ほう。物好きだな。'), n('親方は砥石の角度と、水のかけ方を教えてくれた。剣の刃は、思っていたよりずっと繊細なものだった。')],
      effect: (s) => {
        gain(s, 'dex', 0.8, {});
        gain(s, 'sword_t', 0.6, {});
        s.flags.sharpUntil = s.day + 3;
      },
    },
    no: { lines: [say('鍛冶屋の親方', 'ふん。剣が折れてから泣きついてくるなよ。')] },
  }, { once: false, cooldown: 12 }),
  daily('mk_pipi', 'after', (s) => at(s, 'market') && s.day >= 3, {
    start: {
      lines: [
        n('市場の角で、小さな女の子が花かごを抱えて立っていた。'),
        say('花売りの女の子', 'お花、いりませんか。一本、一銅貨です。'),
        n('かごの中の花は、少ししおれかけていた。'),
      ],
      choices: [
        { text: '一本買う', cond: (s) => s.money >= 1, next: 'buy' },
        { text: '断る', next: 'no' },
      ],
    },
    buy: {
      lines: [say('花売りの女の子', 'ありがとうございます！'), n('黄色い小さな花だった。誰かにあげたら、喜ぶかもしれない。')],
      effect: (s) => {
        s.money -= 1;
        s.items.flower = (s.items.flower ?? 0) + 1;
      },
    },
    no: { lines: [n('女の子は小さく頭を下げて、次の客に声をかけに行った。')] },
  }, { once: false, cooldown: 6 }),
  daily('mk_lost_child', 'after', (s) => at(s, 'market') && s.day >= 4, {
    start: {
      lines: [n('人混みの真ん中で、小さな男の子が泣いていた。母親とはぐれたらしい。'), n('道行く人々は、ちらりと見るだけで通り過ぎていく。')],
      choices: [
        { text: '肩車して、母親を探す', next: 'lift' },
        { text: '一緒に、最後にいた場所を探す', next: 'think' },
        { text: '衛兵の詰所に連れていく', next: 'guard' },
      ],
    },
    lift: {
      lines: [n('男の子を肩に乗せる。高いところから見回すと、男の子はすぐに「かあちゃん！」と指をさした。'), n('駆け寄ってきた母親は、何度も頭を下げて、焼きたてのパンを押しつけてきた。')],
      effect: (s) => {
        s.items.bread = (s.items.bread ?? 0) + 2;
        gain(s, 'str', 0.3, {});
      },
    },
    think: {
      lines: [
        n('男の子に、最後に母親といた場所を聞く。泣きじゃくりながら指さしたのは、果物屋だった。'),
        n('果物屋の主人によると、母親は顔色を変えて南の通りへ走っていったという。{I}が男の子の手を引いて南の通りへ向かうと、母親がちょうど戻ってくるところだった。'),
      ],
      effect: (s) => {
        gain(s, 'wit', 0.6, {});
        gain(s, 'empathy', 0.6, {});
        s.items.bread = (s.items.bread ?? 0) + 2;
      },
    },
    guard: { lines: [n('詰所の兵士は面倒くさそうな顔をしたが、男の子を預かってくれた。夕方には母親が迎えに来たらしい。')] },
  }),
  daily('mk_bard', 'after', (s) => at(s, 'market') && s.seen.great_tide !== undefined, {
    start: {
      lines: [
        n('市場の噴水の縁に、旅の吟遊詩人が腰かけて歌っていた。'),
        n('歌は、大潮の夜の歌だった。'),
        (s) =>
          s.flags.alphaSlain
            ? n('「灰の群れの長に、名もなき新人が剣を向けた」――{I}のことだ。歌の中の新人は、ずいぶん背が高く、ずいぶん勇ましかった。')
            : s.flags.villageSaved === 'hero'
              ? n('「門を背に、南へ走った若き剣」――{I}のことだ。歌の中では、七頭の狼を一人で斬ったことになっていた。実際は一頭だ。')
              : s.flags.villageSaved === 'lyne'
                ? n('「金茶の髪の娘が、ひとり南の村を守った」――リーネのことだ。本人が聞いたら、きっと真っ赤になって怒るだろう。')
                : n('「門の前に倒れた者たちの名を、灯火に刻め」――歌は、あの夜に死んだ者たちを悼んでいた。'),
        n('歌が終わると、聞いていた人々が、黙って銅貨を投げ入れた。'),
      ],
      choices: [
        { text: '銅貨を投げ入れる', cond: (s) => s.money >= 2, next: 'coin' },
        { text: '黙って立ち去る', next: 'leave' },
      ],
    },
    coin: { lines: [n('吟遊詩人は、{I}を見て、少しだけ目を細めた。')], effect: (s) => (s.money -= 2) },
    leave: { lines: [n('歌の続きが、背中のほうでまだ聞こえていた。')] },
  }),

  // ───────── 灯り亭 ─────────
  daily('inn_letter_home', 'slot', (s) => s.slot === 3 && s.day >= 10, {
    start: {
      lines: [
        n('部屋の机の上に、使っていない紙が一枚あった。'),
        n('ソラムを出てから、一度も手紙を書いていない。'),
      ],
      choices: [
        { text: '「元気にやっている」とだけ書く', effect: (s) => (s.flags.letterHome = 'fine'), next: 'write' },
        { text: 'カルナスのこと、出会った人のことを書く', effect: (s) => (s.flags.letterHome = 'people'), next: 'write' },
        { text: '正直に、つらいことも書く', effect: (s) => (s.flags.letterHome = 'honest'), next: 'write' },
        { text: '書かない', next: 'none' },
      ],
    },
    write: {
      lines: [n('書き終えた手紙を折りたたむ。明日、南へ向かう荷馬車に託そう。')],
      effect: (s) => {
        s.flags.letterDay = s.day;
        s.money = Math.max(0, s.money - 2);
        log(s, 'ソラムの家族に、手紙を書いた。');
      },
    },
    none: { lines: [n('ペンを持ったまま、しばらく紙を見つめていた。結局、何も書かなかった。')] },
  }),
  daily('inn_letter_reply', 'slot', (s) => typeof s.flags.letterDay === 'number' && s.day >= (s.flags.letterDay as number) + 12 && s.slot === 0, {
    start: {
      lines: [
        say('マルタ', 'あんた宛てに手紙が来てるよ。南の方からだ。'),
        n('拙い字だった。母の字だ。'),
        (s) =>
          s.flags.letterHome === 'fine'
            ? n('「元気でやっているなら、それでいい。でも、たまには元気じゃないときも書いておくれ。母さんは、それも知りたいんだよ」')
            : s.flags.letterHome === 'people'
              ? n('「たくさんの人と出会ったんだね。手紙を三回読んだよ。リーネさんという子は、どんな子なの。今度、もっと教えておくれ」')
              : n('「つらいことを書いてくれて、ありがとう。無理だと思ったら、いつでも帰っておいで。畑はいつでもあるからね。……でも、あんたはきっと帰ってこないんだろうね」'),
        n('手紙の最後に、小さな字で、村の子供たちが{I}の真似をして棒きれを振り回している、と書いてあった。'),
      ],
      effect: (s) => {
        s.cond.stress = clamp(s.cond.stress - 20, 0, 100);
        gain(s, 'will', 0.8, {});
        log(s, '母から、手紙の返事が届いた。');
      },
    },
  }),
  daily('inn_cards', 'slot', (s) => s.slot === 3 && s.day >= 7, {
    start: {
      lines: [n('食堂の隅で、新人たちがカード遊びをしていた。'), say('新人', '一勝負どうだ？　賭けは三銅貨。')],
      choices: [
        { text: '加わる', cond: (s) => s.money >= 3, next: 'play' },
        { text: '横で見ている', next: 'watch' },
      ],
    },
    play: {
      lines: [
        (s) => {
          const win = s.stats.wit + s.stats.empathy * 0.5 > 18 + (chance(s, 0.5) ? 5 : -5);
          s.flags._cards = win ? 1 : 0;
          return win ? n('相手の表情の揺れを読んで、最後の一枚で勝ちを拾った。') : n('いい手が来たと思ったのに、あっさり負けた。顔に出ていたらしい。');
        },
      ],
      effect: (s) => {
        s.money += s.flags._cards ? 6 : -3;
        gain(s, 'wit', 0.4, {});
        gain(s, 'empathy', 0.4, {});
        s.cond.stress = clamp(s.cond.stress - 8, 0, 100);
        delete s.flags._cards;
      },
    },
    watch: { lines: [n('負けた新人が、勝った新人の頭をはたいた。笑い声が上がる。森の話を一つもしない夜は、久しぶりだった。')], effect: (s) => (s.cond.stress = clamp(s.cond.stress - 6, 0, 100)) },
  }, { once: false, cooldown: 7 }),
  daily('inn_nightmare', 'slot', (s) => s.slot === 0 && (s.cond.stress > 55 || s.cond.injuries.length > 0) && s.day >= 5, {
    start: {
      lines: [
        n('夢を見た。'),
        n('灰色の獣が、闇の中から何度も跳びかかってくる。剣を振っても、手応えがない。'),
        n('目が覚めると、寝間着が汗で張りついていた。窓の外は、まだ暗い。'),
      ],
      choices: [
        { text: '水を飲んで、もう一度眠る', next: 'sleep' },
        { text: '起きて、剣の手入れをする', next: 'sword' },
        { text: '食堂に降りる', next: 'down' },
      ],
    },
    sleep: { lines: [n('二度目の眠りは、夢を見なかった。')], effect: (s) => (s.cond.stress = clamp(s.cond.stress - 6, 0, 100)) },
    sword: { lines: [n('刃を拭き、油を引く。手を動かしているうちに、震えは止まっていた。')], effect: (s) => { gain(s, 'will', 0.6, {}); s.cond.stress = clamp(s.cond.stress - 10, 0, 100); } },
    down: {
      lines: [n('暗い食堂に、明かりが一つ灯っていた。マルタが、明日の仕込みをしていた。'), say('マルタ', '……眠れないのかい。ほら、温めた山羊の乳。蜂蜜入りだよ。'), n('何も聞かれなかった。それが、ありがたかった。')],
      effect: (s) => {
        s.cond.stress = clamp(s.cond.stress - 18, 0, 100);
        rel(s, 'marta', 'affinity', 2);
      },
    },
  }, { once: false, cooldown: 10 }),
  daily('inn_morning', 'slot', (s) => s.slot === 0 && s.day >= 3, {
    start: {
      lines: [
        (s) =>
          n(
            pick(s, [
              '朝の食堂は、焼いたパンと煮込みの匂いで満ちていた。窓際の席で、銅級の冒険者たちが今日の狩り場を相談している。',
              '朝から食堂が騒がしい。新人の一人が、昨日初めて魔核を手に入れたと、みんなに見せびらかしていた。',
              '窓の外から、東門の開門を告げる鐘が聞こえた。荷馬車の列が、石畳を鳴らしながら森の方へ向かっていく。',
              '朝の光が、食堂の床に長い四角を作っていた。マルタが、鼻歌を歌いながら床を掃いている。',
              calm(s) ? '宿の裏手で、鶏が騒いでいた。どこかの新人が、鶏小屋の戸を閉め忘れたらしい。マルタの怒鳴り声が響いた。' : '朝から、城壁の上の兵士の数が多い。食堂の誰もが、森のほうをちらちらと気にしていた。',
            ]),
          ),
      ],
    },
  }, { once: false, cooldown: 3, weight: 0.6 }),

  // ───────── 東門・森 ─────────
  daily('gt_old_guard', 'after', (s) => at(s, 'gate') && s.day >= 5 && (s.counters.oldGuard ?? 0) < 3, {
    start: {
      lines: [
        n('門番の詰所の前で、白髪の老兵が日向ぼっこをしていた。'),
        (s) => {
          const c = s.counters.oldGuard ?? 0;
          if (c === 0) return [say('老兵', '新人か。わしはヨアヒム。この門を四十年守っとる。'), say('ヨアヒム', '森の縁で迷ったら、川の音のするほうへ行け。灰縁の森の川は、みんなカルナスへ流れとる。')];
          if (c === 1) return [say('ヨアヒム', '十四年前の大潮の夜にな、トマスという鉄級の男が、門の外で仲間を逃がして、自分は戻らんかった。'), say('ヨアヒム', '灯り亭の女将の亭主じゃ。……あの宿の煮込みの味は、トマスが好きだった味だそうな。')];
          return [say('ヨアヒム', '七年前の夜、門の前でガラドが叫んどったのを覚えとる。「レオン、門は任せた」とな。'), say('ヨアヒム', 'あいつが南へ走ったのは、正しかったのか、間違っとったのか。わしにも分からん。ただ、あいつは今も、毎朝この門を見に来る。')];
        },
      ],
      effect: (s) => {
        const c = s.counters.oldGuard ?? 0;
        s.counters.oldGuard = c + 1;
        if (c === 0) gain(s, 'survival_t', 1.0, {});
        if (c === 1) s.flags.knowTomas = true;
        if (c === 2) s.flags.heardGateCry = true;
      },
    },
  }, { once: false, cooldown: 6 }),
  daily('fo_fox', 'after', (s) => did(s, 'forest:') && s.day >= 5, {
    start: {
      lines: [n('茂みの奥から、甲高い鳴き声が聞こえた。'), n('覗き込むと、小さな赤い狐が、針金の罠に後ろ脚を挟まれてもがいていた。')],
      choices: [
        { text: '罠を外してやる', next: 'free' },
        { text: '放っておく', next: 'leave' },
      ],
    },
    free: {
      lines: [
        (s) =>
          s.stats.dex > 14 || chance(s, 0.5)
            ? n('暴れる狐をなだめながら、針金を少しずつ緩める。脚が抜けた瞬間、狐は茂みの中へ消えた。')
            : n('針金を外そうとして、狐に手を噛まれた。それでもどうにか外してやると、狐は脚を引きずって茂みの中へ消えた。'),
      ],
      effect: (s) => {
        s.flags.foxSaved = s.day;
        gain(s, 'dex', 0.4, {});
      },
    },
    leave: { lines: [n('罠を仕掛けたのは、誰かの暮らしのためだ。{I}は、その場を離れた。')] },
  }),
  daily('fo_fox_return', 'after', (s) => did(s, 'forest:') && typeof s.flags.foxSaved === 'number' && s.day >= (s.flags.foxSaved as number) + 5, {
    start: {
      lines: [
        n('木の根元に、赤い狐が座っていた。後ろ脚に、古い傷跡がある。'),
        n('狐は{I}をじっと見つめると、くるりと背を向け、数歩進んで振り返った。ついてこい、というように。'),
        n('狐の後をついていくと、小さな日だまりに出た。一面に、薬草が群れ咲いていた。'),
        n('振り返ると、狐はもういなかった。'),
      ],
      effect: (s) => {
        s.items.herb = (s.items.herb ?? 0) + 6;
        gain(s, 'herb_p', 1.0, {});
        log(s, '森の縁で、助けた狐に薬草の群生地へ案内された。');
      },
    },
  }),
  daily('fo_grave', 'after', (s) => did(s, 'forest:') && s.day >= 8, {
    start: {
      lines: [
        n('森の縁の、少し奥まった木陰に、苔むした石が立っていた。墓標だ。'),
        n('刻まれた文字は、ほとんど読めない。かろうじて、「T」で始まる名前と、「鉄」という字だけが分かった。'),
        n('墓標の根元に、錆びた鉄の札が半ば埋もれていた。'),
      ],
      choices: [
        { text: '墓標の苔を払い、手を合わせる', next: 'pray' },
        { text: '鉄の札を持ち帰る', next: 'take' },
        { text: 'そのままにしておく', next: 'leave' },
      ],
    },
    pray: { lines: [n('苔を払うと、名前がもう少し読めた。「トマ」……その先は、欠けていた。'), n('しばらく、手を合わせていた。')], effect: (s) => { s.flags.foundGrave = 'pray'; gain(s, 'will', 0.6, {}); } },
    take: { lines: [n('錆びた鉄の札を、土から掘り出した。裏に、小さく「マルタへ」と刻まれていた。')], effect: (s) => { s.flags.foundGrave = 'take'; s.items.irontag = 1; } },
    leave: { lines: [n('墓標に一礼して、その場を離れた。')], effect: (s) => (s.flags.foundGrave = 'leave') },
  }),
  daily('fo_strange_bloom', 'after', (s) => did(s, 'forest:') && s.day >= 10, {
    start: {
      lines: [n('澱溜まりのほとりに、見たことのない花が咲いていた。花びらが、青白く透けている。'), n('甘い匂いがする。')],
      choices: [
        { text: '摘んでみる', next: 'pick' },
        { text: 'よく観察する', next: 'look' },
      ],
    },
    pick: {
      lines: [
        (s) =>
          s.stats.herb_t > 12
            ? [n('手を伸ばしかけて、思い出した。澱の溜まった土に咲く花は、薬にも毒にもなる。手袋越しに、根元から慎重に摘んだ。'), n('ノインなら、喜ぶかもしれない。')]
            : [n('花を摘んだ瞬間、指先が痺れた。慌てて手を振る。痺れはしばらく取れなかった。')],
      ],
      effect: (s) => {
        if (s.stats.herb_t > 12) s.items.glowbloom = 1;
        else s.cond.injuries.push({ id: 'bloom', label: '痺れた指先', severity: 1, days: 2 });
        gain(s, 'herb_p', 0.6, {});
      },
    },
    look: { lines: [n('花の根は、澱の泥の中に深く伸びていた。澱を吸って咲いているのだ。'), n('綺麗だと思った。同時に、少しだけ怖いとも思った。')], effect: (s) => { gain(s, 'herb_t', 0.8, {}); gain(s, 'beast_t', 0.3, {}); } },
  }),

  // ───────── 分室 ─────────
  daily('in_explosion', 'after', (s) => at(s, 'institute') && here(s, 'noin'), {
    start: {
      lines: [n('分室の扉を開けた瞬間、奥でぼん、と鈍い音がした。'), n('煙の中から、髪の先を焦がしたノインが咳き込みながら出てきた。'), say('noin', 'げほっ……。だ、大丈夫。たぶん大丈夫。試料の配合を、ちょっと、間違えただけ。')],
      choices: [
        { text: '窓を開けて、煙を逃がす', next: 'window' },
        { text: '何を間違えたのか聞く', next: 'ask' },
      ],
    },
    window: { lines: [n('窓を全部開け放つ。煙が抜けていくと、焦げた机の上で、試料の瓶が一つだけ無事に残っていた。'), say('noin', 'あ、それ。それが一番大事なやつ。……よかった。')], effect: (s) => rel(s, 'noin', 'affinity', 2) },
    ask: {
      lines: [say('noin', '澱の泥に、乾いた月光草の粉を混ぜたの。そしたら、急に熱を持って……。'), n('ノインは、はっとしたように顔を上げた。'), say('noin', '……待って。熱を持った？　澱と月光草で？　これ、書き留めなきゃ。')],
      effect: (s) => {
        rel(s, 'noin', 'respect', 2);
        gain(s, 'magic_t', 0.8, {});
        gain(s, 'herb_t', 0.6, {});
      },
    },
  }),
  daily('in_noin_asleep', 'after', (s) => at(s, 'institute') && here(s, 'noin') && s.npcs.noin.rel.trust >= 8, {
    start: {
      lines: [n('分室の机で、ノインが紙の山に埋もれて眠っていた。'), n('寝顔は、見た目どおりの若い娘にしか見えない。けれど、手元の紙に書かれた日付は、四十年前のものだった。')],
      choices: [
        { text: '毛布を掛ける', next: 'blanket' },
        { text: '手元の古い記録を読む', next: 'read' },
      ],
    },
    blanket: { lines: [n('棚にあった毛布を掛ける。ノインは寝言で、知らない言葉を呟いた。森人の言葉だろうか。')], effect: (s) => rel(s, 'noin', 'affinity', 2) },
    read: {
      lines: [
        n('四十年前の、ノインの日記だった。'),
        n('「清林を出て三年。本院の連中は、私の論文を読みもしない。それでも書く。誰かが、いつか読むかもしれないから」'),
        n('顔を上げると、ノインが片目を開けて、こちらを見ていた。'),
        say('noin', '……読んだ？'),
        say('noin', 'まあ、いいや。きみが「いつか読む誰か」だったってことにしておく。'),
      ],
      effect: (s) => {
        rel(s, 'noin', 'trust', 2);
        gain(s, 'lore', 0.6, {});
      },
    },
  }),

  // ───────── 人のほうから ─────────
  daily('ap_lyne_sword', 'slot', (s) => s.slot <= 1 && here(s, 'lyne') && !s.flags.lyneLeft && s.npcs.lyne.rel.affinity >= 8 && s.day >= 14, {
    start: {
      lines: [
        n('部屋の扉が叩かれた。開けると、リーネが立っていた。'),
        say('lyne', '今日、暇？　市場の鍛冶屋で、新しい剣を見たいの。……一人だと、ぼったくられそうだから。'),
      ],
      choices: [
        { text: '付き合う', next: 'go' },
        { text: '「今日は用事がある」', next: 'no' },
      ],
    },
    go: {
      lines: [
        n('鍛冶屋の店先で、リーネは剣を一本ずつ手に取っては、真剣な顔で重心を確かめていった。'),
        n('結局、一本も買わなかった。'),
        say('lyne', 'まだ早いわ。今の剣を、もっと使いこなしてからにする。'),
        say('lyne', '……付き合ってくれて、ありがと。帰りに果物、おごるわ。'),
      ],
      effect: (s) => {
        rel(s, 'lyne', 'affinity', 4);
        gain(s, 'sword_t', 0.6, {});
        s.location = 'market';
        remember(s, 'lyne', 'ap:sword', 'リーネの剣選びに付き合った。');
      },
      end: { advance: true },
    },
    no: { lines: [say('lyne', 'そ。……じゃあ、また今度。'), n('リーネは少しだけ残念そうに去っていった。')], effect: (s) => rel(s, 'lyne', 'affinity', -1) },
  }),
  daily('ap_marta_errand', 'slot', (s) => s.slot === 0 && here(s, 'marta') && s.npcs.marta.rel.affinity >= 5, {
    start: {
      lines: [say('marta', 'ちょいと、あんた。市場までひとっ走り、塩と玉ねぎを買ってきてくれないかい。お駄賃は弾むよ。')],
      choices: [
        { text: '引き受ける', next: 'yes' },
        { text: '断る', next: 'no' },
      ],
    },
    yes: {
      lines: [n('市場で塩と玉ねぎを買い、灯り亭に戻った。'), say('marta', 'はい、ご苦労さん。……ほら、お駄賃と、味見の煮込み。'), n('お駄賃は五銅貨だった。煮込みは、いつもより肉が多かった。')],
      effect: (s) => {
        s.money += 5;
        s.cond.fed = true;
        rel(s, 'marta', 'affinity', 2);
        rel(s, 'marta', 'trust', 1);
      },
    },
    no: { lines: [say('marta', 'はいよ。じゃあ、他の子に頼むかね。')] },
  }, { once: false, cooldown: 9 }),
  daily('ap_noin_food', 'after', (s) => at(s, 'institute') && here(s, 'noin') && s.npcs.noin.rel.affinity >= 6, {
    start: {
      lines: [
        say('noin', 'ちょうどよかった。これ、食べてみて。'),
        n('ノインが差し出した皿には、緑色の、何とも言えない形のものが載っていた。'),
        say('noin', '清林の料理。木の実と苔と、あと何かを練ったやつ。百年ぶりに作ってみた。'),
      ],
      choices: [
        { text: '食べる', next: 'eat' },
        { text: '「あと何か、って何？」', next: 'ask' },
      ],
    },
    eat: {
      lines: [
        n('一口食べる。……苦い。土の味がする。いや、その奥に、かすかな甘みがある。'),
        n('もう一口。不思議と、体が軽くなった気がした。'),
        say('noin', 'どう？　……あ、食べられる？　よかった。人間には毒かもって、ちょっと思ってたんだ。'),
      ],
      effect: (s) => {
        s.cond.fatigue = clamp(s.cond.fatigue - 15, 0, 100);
        rel(s, 'noin', 'affinity', 3);
        remember(s, 'noin', 'food:ate', 'ノインの作った清林の料理を食べた。');
      },
    },
    ask: { lines: [say('noin', '……言わないほうが、おいしいと思う。'), n('結局、食べなかった。ノインは一人で全部食べて、満足そうにしていた。')], effect: (s) => rel(s, 'noin', 'affinity', 1) },
  }),
  daily('ap_edgar_advice', 'after', (s) => at(s, 'market') && here(s, 'edgar') && s.npcs.edgar.rel.affinity >= 4, {
    start: {
      lines: [
        say('edgar', 'あの、{name}さん。ひとつ、相談してもいいですか。'),
        say('edgar', '人と話すとき、どこを見ればいいんでしょう。目を見ると、怖くて。でも帳簿を見ながら話すと、失礼だって言われて。'),
      ],
      choices: [
        { text: '「眉間を見ればいい」', next: 'brow' },
        { text: '「相手の手を見るといい。気持ちが出るから」', next: 'hands' },
        { text: '「無理に見なくていい。エドガーはエドガーでいい」', next: 'self' },
      ],
    },
    brow: { lines: [say('edgar', '眉間……。'), n('エドガーは、真剣な顔で{I}の眉間を見つめた。近い。')], effect: (s) => rel(s, 'edgar', 'affinity', 2) },
    hands: { lines: [say('edgar', '手、ですか。……なるほど。手は、数字みたいに正直ですね。'), n('エドガーは、自分の帳簿だこのある手を見つめた。')], effect: (s) => { rel(s, 'edgar', 'trust', 2); gain(s, 'empathy', 0.5, {}); } },
    self: { lines: [n('エドガーは、しばらく黙っていた。'), say('edgar', '……そう言われたのは、初めてです。'), n('それから、帳簿から顔を上げて、少しだけ{I}の目を見た。')], effect: (s) => rel(s, 'edgar', 'trust', 3) },
  }),

  // ───────── どこでも：季節・空 ─────────
  daily('any_night_sky', 'slot', (s) => s.slot === 3 && s.day >= 4, {
    start: {
      lines: [
        n('宿へ戻る道すがら、ふと空を見上げた。'),
        (s) =>
          s.flags.tideRising && !s.seen.great_tide
            ? n('東の空が、ぼんやりと青白く光っている。森の霞が、星を隠していた。')
            : n('雲一つない夜空に、ソラムで見たのと同じ星が並んでいた。故郷の空と、同じ空だ。'),
      ],
      effect: (s) => (s.cond.stress = clamp(s.cond.stress - 5, 0, 100)),
    },
  }, { once: false, cooldown: 8, weight: 0.7 }),
  daily('festival_flowers', 'slot', (s) => s.day >= 40 && s.day <= 46 && s.slot === 2, {
    start: {
      lines: [
        n('街じゅうに、花の匂いがあふれていた。花月の祭りだ。'),
        n('東市場の通りには屋台が並び、子供たちが花冠をかぶって走り回っている。広場では、楽団が陽気な曲を奏でていた。'),
        n('今夜は、誰と祭りを見て回ろうか。'),
      ],
      choices: [
        { text: 'リーネを誘う', cond: (s) => here(s, 'lyne') && !s.flags.lyneLeft, next: 'lyne' },
        { text: 'ノインを連れ出す', cond: (s) => here(s, 'noin'), next: 'noin' },
        { text: 'セラを誘う', cond: (s) => here(s, 'sera') && s.npcs.sera.rel.trust >= 10, next: 'sera' },
        { text: 'マルタの屋台を手伝う', cond: (s) => here(s, 'marta'), next: 'marta' },
        { text: '一人で歩く', next: 'alone' },
      ],
    },
    lyne: {
      lines: [
        n('リーネは「子供っぽい」と文句を言いながら、射的の屋台の前から動かなかった。'),
        n('三回目で、真ん中の的を射抜いた。景品の木彫りの小鳥を、リーネは{I}に押しつけた。'),
        say('lyne', 'いらないから、あげる。……捨てたら怒るわよ。'),
      ],
      effect: (s) => {
        s.items.woodbird = 1;
        rel(s, 'lyne', 'affinity', 5, { big: true });
        remember(s, 'lyne', 'festival', '花月の祭りを、リーネと一緒に回った。');
      },
      end: { advance: true },
    },
    noin: {
      lines: [
        n('分室から引っぱり出されたノインは、最初は「人が多い」と顔をしかめていた。'),
        n('けれど、飴細工の屋台の前で足を止めると、職人の手元を食い入るように見つめはじめた。'),
        say('noin', '……すごい。砂糖が、熱でこんなふうに流れるんだ。澱の流れに、ちょっと似てる。'),
        n('ノインは、花の形の飴を三つ買って、一つを{I}にくれた。'),
      ],
      effect: (s) => {
        rel(s, 'noin', 'affinity', 5, { big: true });
        remember(s, 'noin', 'festival', '花月の祭りに、ノインを連れ出した。');
      },
      end: { advance: true },
    },
    sera: {
      lines: [
        say('sera', '……祭り、ですか。私は、仕事が。'),
        n('そう言いながら、セラは窓口の帳簿を閉じた。'),
        n('広場の端で楽団の演奏を聞きながら、セラはずっと黙っていた。曲が変わったとき、ぽつりと言った。'),
        say('sera', 'この曲、弟が好きだったんです。……下手な口笛で、いつも吹いていました。'),
      ],
      effect: (s) => {
        rel(s, 'sera', 'trust', 4, { big: true });
        rel(s, 'sera', 'affinity', 4, { big: true });
        remember(s, 'sera', 'festival', '花月の祭りで、セラと楽団の演奏を聞いた。');
      },
      end: { advance: true },
    },
    marta: {
      lines: [
        n('マルタの屋台は、煮込みの串焼きだった。祭りの客が途切れず、二人で目が回るほど働いた。'),
        say('marta', 'ほら、売り上げの分け前。……祭りの夜にまで働かせて、悪かったね。'),
        n('マルタは、少しだけ多めに銅貨をくれた。'),
      ],
      effect: (s) => {
        s.money += 15;
        rel(s, 'marta', 'affinity', 4, { big: true });
      },
      end: { advance: true },
    },
    alone: {
      lines: [n('一人で屋台の間を歩く。どこかで聞いた歌、どこかで嗅いだ匂い。ソラムの収穫祭を思い出した。'), n('広場の端で、花冠をかぶった子供が転んで泣いていた。助け起こすと、子供は花を一輪くれた。')],
      effect: (s) => {
        s.items.flower = (s.items.flower ?? 0) + 1;
        s.cond.stress = clamp(s.cond.stress - 15, 0, 100);
      },
      end: { advance: true },
    },
  }, { priority: 30 }),
];

/** 花などの贈り物への反応（会話の選択肢として使う） */
export const GIFT_REACTIONS: Record<string, string[]> = {
  garad: ['……花？　俺にか。', 'ガラドは花を受け取ると、しばらく黙ってそれを見ていた。それから、木剣立ての隙間に、そっと挿した。'],
  lyne: ['な、何よ急に。', 'リーネは花をひったくるように受け取って、そっぽを向いた。けれど、その日一日、髪にその花を挿していた。'],
  sera: ['……規則で、窓口での贈り物は受け取れないことになっています。', 'そう言いながら、セラは花を受け取り、窓口の小さな硝子瓶に生けた。'],
  noin: ['お、これ、市場の花売りの子の？', 'ノインは花を光にかざし、花びらの付け根をしげしげと観察してから、押し花にすると言って本の間に挟んだ。'],
  marta: ['あらまあ。花なんてもらったの、何年ぶりだろうね。', 'マルタは花をカウンターの古い外套の前に飾った。'],
  edgar: ['え、ぼ、僕にですか？', 'エドガーは花を両手で持ったまま、どうしていいか分からないという顔をしていた。'],
  aurelia: ['……花、ですか。', 'アウレリアは花を受け取ると、手袋を外して、指先で花びらに触れた。「辺境の花は、王都のものより色が濃いのですね」'],
};

/** マルタへの話題：森の墓標のこと */
export const MARTA_GRAVE_TOPICS: import('../engine/defs').TopicDef[] = [
  {
    id: 'irontag',
    label: '森で見つけた鉄の札を渡す',
    once: true,
    cond: (s) => !!s.items.irontag,
    node: {
      lines: [
        n('錆びた鉄の札を、カウンターに置いた。'),
        n('マルタの手が、止まった。'),
        n('札の裏の「マルタへ」という小さな字を、マルタは親指で何度もなぞった。'),
        say('marta', '……トマスの字だ。下手くそな字だろう。'),
        say('marta', 'あの人ね、出かけるたびに、こうやって札の裏に書いてたんだよ。帰ってこなかったら、誰かが届けてくれるようにって。'),
        say('marta', '十四年かかったね。……届けてくれたのが、あんたでよかった。'),
        n('マルタは札を握りしめて、厨房の奥へ消えた。しばらく、出てこなかった。'),
      ],
      effect: (s) => {
        s.items.irontag = 0;
        s.flags.tomasTagReturned = true;
        rel(s, 'marta', 'trust', 15, { big: true });
        rel(s, 'marta', 'debt', 15, { big: true });
        rel(s, 'marta', 'affinity', 8, { big: true });
        log(s, '森の墓標で見つけた鉄の札を、マルタに渡した。十四年前に帰らなかった、夫トマスのものだった。');
      },
    },
  },
  {
    id: 'grave',
    label: '森の縁で見つけた墓標のことを話す',
    once: true,
    cond: (s) => (s.flags.foundGrave === 'pray' || s.flags.foundGrave === 'leave') && !!s.flags.knowTomas,
    node: {
      lines: [
        n('森の縁の木陰に、「トマ」と読める墓標があったことを話した。'),
        n('マルタは長い間、黙っていた。'),
        say('marta', '……そうかい。仲間が、建ててくれてたんだね。あたしは知らなかった。'),
        say('marta', '今度、連れてってくれるかい。……いや、いい。あんたの手が空いたときでいいから。'),
      ],
      effect: (s) => {
        s.flags.martaKnowsGrave = true;
        rel(s, 'marta', 'trust', 6);
        rel(s, 'marta', 'affinity', 4);
      },
    },
  },
];
