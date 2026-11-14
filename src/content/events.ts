// 物語イベント（世界の時計・人物アーク・日常）。ネタバレを含む。
import type { EventDef } from '../engine/defs';
import type { GameState } from '../engine/types';
import { n, say } from '../engine/text';
import { meet, rel, remember } from '../engine/npc';
import { gain } from '../engine/growth';
import { log } from '../engine/game';
import { startCombat } from '../engine/combat';
import { band, skill } from '../engine/stats';
import { chance, pick } from '../engine/rng';
import { trainingDays } from './npcs';

const slot = (s: GameState, v: number) => s.slot === v;

// ───────── 序章 ─────────

const prologue: EventDef = {
  id: 'prologue',
  trigger: 'slot',
  priority: 100,
  once: true,
  cond: (s) => s.day === 1 && s.slot === 0,
  nodes: {
    start: {
      lines: [
        n('荷馬車の揺れが止まった。'),
        say('御者', '着いたぞ。カルナスだ。'),
        n('幌の隙間から外を覗く。灰色の石の城壁が、空を半分ふさいでいた。'),
        n('城壁のさらに向こう、地平線まで続く森の上に、灰色の霞がかかっている。灰縁の森。澱の森。'),
        n('懐に手を入れる。指先に、曲がった金属の感触が触れた。'),
      ],
      choices: [
        { text: '札を取り出して眺める', next: 'memory', effect: (s) => (s.flags.motiveTag = 1) },
        { text: 'そのまま荷馬車を降りる', next: 'walk' },
      ],
    },
    memory: {
      lines: [
        n('曲がった青銅の札。表面に「G」の一文字が刻まれている。'),
        n('七年前の夜のことを、{I}は今でも覚えている。'),
        n('村中の犬が一斉に吠えた。森の方角から、灰色の獣が畑を突っ切ってきた。狼にしては大きすぎた。肩のあたりに、石のようなものが生えていた。'),
        n('獣が納屋の戸を破ったとき、誰かが間に割って入った。剣の光。獣の悲鳴。'),
        n('男は血まみれの足を引きずって、礼も聞かずに夜の道を去っていった。翌朝、納屋の前の泥の中に、この札が落ちていた。'),
        n('札を懐に戻した。'),
      ],
      next: 'walk',
    },
    walk: {
      lines: [
        n('南門をくぐると、石畳の道が街の東へまっすぐ伸びていた。'),
        n('魔導灯の燃料になる魔核を積んだ荷車。鎧姿の兵士。剣を背負った冒険者たち。村では一年かけても見られない数の人間が、一刻のうちに目の前を通り過ぎていく。'),
        n('道の突き当たりに、三階建ての石造りの建物があった。扉の上に、交差した剣と灯火の紋章。冒険者ギルドだ。'),
      ],
      next: 'guild',
    },
    guild: {
      lines: [
        n('ギルドの中は、汗と革と酒の匂いがした。'),
        n('奥の窓口に、髪をきっちりと結い上げた女性が座っていた。分厚い帳簿から目を上げもせずに言う。'),
        say('受付の女性', '新規の登録ですか。'),
        n('頷くと、彼女は一枚の書類を差し出した。'),
        say('受付の女性', '受付のセラ・ミドウです。お名前と出身を。'),
        n('{name}。南の村、ソラム。そう答えると、セラはさらさらとペンを走らせた。'),
        say('sera', '登録の理由は。'),
      ],
      effect: (s) => meet(s, 'sera'),
      choices: [
        { text: '食べていくため', effect: (s) => { s.flags.motive = 'living'; remember(s, 'sera', 'motive:living', '登録の理由を「食べていくため」と答えた。'); rel(s, 'sera', 'trust', 2); }, next: 'rules' },
        { text: '強くなりたい', effect: (s) => { s.flags.motive = 'strength'; remember(s, 'sera', 'motive:strength', '登録の理由を「強くなりたい」と答えた。'); }, next: 'rules' },
        { text: '人を探している', effect: (s) => { s.flags.motive = 'seek'; remember(s, 'sera', 'motive:seek', '登録の理由を「人を探している」と答えた。'); }, next: 'seek' },
        { text: 'まだ分からない', effect: (s) => { s.flags.motive = 'unknown'; remember(s, 'sera', 'motive:unknown', '登録の理由を「まだ分からない」と答えた。'); rel(s, 'sera', 'wariness', 2); }, next: 'rules' },
      ],
    },
    seek: {
      lines: [say('sera', 'どなたを？　ギルドの記録で分かることなら、お調べできますが。')],
      choices: [
        { text: '古い認識票を見せる', next: 'showtag' },
        { text: '「いえ、自分で探します」', next: 'rules' },
      ],
    },
    showtag: {
      lines: [
        n('セラは札を受け取り、明かりにかざした。'),
        say('sera', '古い型ですね。七年前まで使われていたものです。刻印は頭文字だけ……。'),
        n('ほんの一瞬、彼女の指が止まった気がした。'),
        say('sera', '七年前の大潮で、多くの記録が失われました。この札だけで持ち主を探すのは、難しいと思います。'),
        n('セラは札を丁寧に返してくれた。'),
      ],
      effect: (s) => {
        s.flags.showedTagSera = true;
        remember(s, 'sera', 'tag:shown', '登録の日に、セラに古い認識票を見せた。');
      },
      next: 'rules',
    },
    rules: {
      lines: [
        say('sera', '仮登録の期間について説明します。一度しか言いませんので、よく聞いてください。'),
        say('sera', '一つ。最初の七日間のうち、三日以上は訓練場で講習を受けること。受けなければ、仮登録の期間が延びます。'),
        say('sera', '二つ。依頼を受けられるのは、八日目からです。仮登録者向けのものに限ります。'),
        say('sera', '三つ。森の縁より奥へは、絶対に入らないこと。'),
        say('sera', '石級への昇級審査は、登録から二週間後から受けられます。以上です。'),
        n('セラは、木の札を一枚差し出した。「仮」の焼き印が押してある。'),
      ],
      next: 'lyne',
    },
    lyne: {
      lines: [
        n('そのとき、背後で扉が勢いよく開いた。'),
        say('少女', 'さっきの書類、書き直してきたわ。これで文句ないでしょう？'),
        n('金茶色の髪を一つに束ねた少女だった。歳は{I}と同じくらい。腰の剣は、使い込まれているのに手入れが行き届いている。'),
        n('セラが書類を確かめる間、少女は{I}をじろじろと眺めた。'),
        say('少女', 'あなたも新人？　今日登録したの？　……ふうん。じゃあ同期ね。'),
        say('lyne', '私はリーネ。先に銅級になるのは私だから。覚えておいて。'),
      ],
      effect: (s) => meet(s, 'lyne'),
      choices: [
        { text: '「よろしく、リーネ」', effect: (s) => { rel(s, 'lyne', 'affinity', 3); remember(s, 'lyne', 'first:friendly', '初対面で「よろしく」と挨拶した。'); }, next: 'lyne2' },
        { text: '「それはどうかな」', effect: (s) => { rel(s, 'lyne', 'rivalry', 5); rel(s, 'lyne', 'respect', 1); remember(s, 'lyne', 'first:rival', '初対面で「それはどうかな」と言い返した。'); }, next: 'lyne3' },
        { text: '黙って頷く', effect: (s) => remember(s, 'lyne', 'first:quiet', '初対面で、黙って頷いた。'), next: 'lyne2' },
      ],
    },
    lyne2: { lines: [say('lyne', '……変な人。'), n('リーネはそう言い残して、さっさとギルドを出ていった。')], next: 'inn' },
    lyne3: { lines: [n('リーネの目が、きらりと光った。'), say('lyne', '言うじゃない。いいわ、勝負よ。'), n('リーネは楽しそうに笑って、ギルドを出ていった。')], next: 'inn' },
    inn: {
      lines: [
        say('sera', '宿が決まっていないなら、灯り亭へどうぞ。新人が多い宿です。安くて、女将がうるさい。'),
        n('セラの言った通り、灯り亭の女将マルタはうるさかった。'),
        say('マルタ', 'ソラムから？　遠いところをよく来たねえ。ほら、荷物はそこ。宿代と飯代で一日十銅貨。払えない日は厩で寝な。'),
        say('マルタ', '……さっきの金茶の髪の子も、今日からここに泊まるんだよ。仲良くおし。'),
        n('二階の小さな部屋の窓から、東の城壁が見えた。その向こうで、灰色の霞が夕陽に染まりはじめていた。'),
      ],
      effect: (s) => {
        log(s, 'カルナスに着いた。冒険者ギルドで仮登録をして、灯り亭に部屋を取った。');
        s.location = 'inn';
      },
      end: { advance: true, slots: 2 },
    },
  },
};

// ───────── 初日の講習 ─────────

const orientation: EventDef = {
  id: 'orientation',
  trigger: 'slot',
  priority: 50,
  once: true,
  cond: (s) => s.day >= 2 && slot(s, 0),
  nodes: {
    start: {
      lines: [
        n('朝の訓練場には、{I}を含めて七人の新人が集まっていた。リーネの姿もある。'),
        n('砂地の真ん中に、白髪交じりの大男が立っていた。右足に重心を預けないような、少し傾いた立ち方をしている。'),
        say('教官', 'ガラドだ。お前らの面倒を見る。'),
        say('garad', '最初に言っておく。この中の半分は、この季節が終わる前にいなくなる。辞めるか、死ぬかだ。'),
        say('garad', '木剣を取れ。振ってみろ。'),
      ],
      effect: (s) => {
        meet(s, 'garad');
        s.counters.trainDaysOld = 1;
      },
      next: 'swing',
    },
    swing: {
      lines: [
        n('木剣を握り、振り下ろす。'),
        (s) =>
          n(
            [
              '木剣は思ったより重かった。振り下ろした勢いに、体ごと持っていかれそうになる。',
              '村で鍬を振っていた要領で、どうにか形にはなった。',
              '木剣が、思ったより手に馴染んだ。',
              '体が勝手に動いた。振り下ろした木剣が、ぴたりと止まる。',
            ][Math.min(3, band(skill(s, 'sword') + s.stats.str * 0.3))],
          ),
        (s) => {
          const v = skill(s, 'sword') + s.stats.str * 0.3;
          if (v < 12) return say('garad', '腰が引けてる。腕だけで振るな。');
          if (v < 22) return say('garad', '……悪い癖はついてないな。');
          return [n('ガラドの目が、わずかに細くなった。'), say('garad', 'どこで習った。……まあいい。')];
        },
        n('隣でリーネが木剣を振った。背筋の伸びた、教本通りの美しい振りだ。何人かの新人が感嘆の声を漏らした。'),
        say('garad', '型はきれいだ。死ぬ奴の型だな。'),
        n('リーネの顔が、さっと赤くなった。'),
        say('lyne', '……どういう意味ですか。'),
        say('garad', 'きれいな型ってのは、相手もきれいに動いてくれる前提の型だ。魔物は教本を読まん。'),
      ],
      choices: [
        { text: '「では、どうすればいいんですか」', effect: (s) => { rel(s, 'garad', 'respect', 2); remember(s, 'garad', 'first:asked', '初日の講習で「どうすればいいのか」と質問した。'); }, next: 'ask' },
        { text: '黙って素振りを続ける', effect: (s) => { rel(s, 'garad', 'trust', 2); remember(s, 'garad', 'first:silent', '初日の講習で、黙って素振りを続けた。'); }, next: 'end' },
        { text: '「リーネの剣は、きれいだと思います」', effect: (s) => { rel(s, 'lyne', 'affinity', 4); rel(s, 'garad', 'wariness', 1); remember(s, 'lyne', 'first:defended', '初日の講習で、ガラドに対してリーネの剣を庇った。'); }, next: 'defend' },
      ],
    },
    ask: {
      lines: [say('garad', '汚く動け。生き残るためなら、転がれ、逃げろ、砂でも投げろ。'), say('garad', 'それから、毎日ここに来い。最初の七日のうち三日は義務だ。来ない奴は、そのまま森で死ぬ。')],
      next: 'end',
    },
    defend: {
      lines: [n('リーネが驚いたように{I}を見た。'), say('garad', 'きれいなのは認めてる。きれいなだけだと言ってるんだ。'), say('garad', '……お前ら、最初の七日のうち三日は義務だ。来ない奴は、そのまま森で死ぬ。')],
      next: 'end',
    },
    end: {
      lines: [n('それから昼過ぎまで、素振りと走り込みが続いた。終わる頃には、腕が上がらなくなっていた。')],
      effect: (s) => {
        gain(s, 'sword_p', 1.2, { kind: 'mentor', difficulty: 16, quality: 1.2 });
        gain(s, 'end', 0.8, { difficulty: 20 });
        s.cond.fatigue += 20;
        log(s, '訓練場で初めての講習を受けた。教官はガラドという男だった。');
      },
      end: { advance: true, slots: 2 },
    },
  },
};

// ───────── ノインとの出会い ─────────

const noinMeet: EventDef = {
  id: 'noin_meet',
  trigger: 'after',
  priority: 50,
  once: true,
  cond: (s) => !s.npcs.noin.met && s.day >= 3 && /^(stroll|shop|sell|work|library|magic):/.test(s.lastAction ?? ''),
  nodes: {
    start: {
      lines: [
        n('路地の入り口に、子供たちが集まっていた。'),
        n('覗き込むと、薄汚れた白衣の女性が石畳にしゃがみこんでいた。足元には、腹を裂かれた澱鼠の死骸がある。彼女は細い鉗子で、その腹の中をつついていた。'),
        n('耳が、少し尖っている。'),
        say('白衣の女性', 'ねえ、そこのきみ。ちょうどいい。この灯り、持っててくれる？'),
      ],
      choices: [
        { text: '灯りを持つ', next: 'hold', effect: (s) => rel(s, 'noin', 'affinity', 3) },
        { text: '「何をしているんですか」', next: 'what', effect: (s) => rel(s, 'noin', 'respect', 2) },
        { text: '立ち去る', next: 'leave' },
      ],
    },
    hold: {
      lines: [
        n('差し出された携帯灯を受け取り、手元を照らす。鼠の腹の中で、小指の先ほどの灰色の結晶が鈍く光っていた。'),
        say('白衣の女性', 'ありがと。見て。この鼠、まだ若いのに魔核がこんなに育ってる。おかしいと思わない？'),
        (s) =>
          s.stats.beast_t > 6 || s.stats.wit > 16
            ? n('若い個体の魔核は、普通もっと小さいはずだ。森の澱が濃くなっているのだろうか。そう口にすると、彼女の目が輝いた。')
            : n('何がおかしいのか、{I}には分からなかった。'),
      ],
      next: 'intro',
    },
    what: {
      lines: [
        say('白衣の女性', '解剖。見れば分かるでしょ。'),
        say('白衣の女性', 'この鼠、若いのに魔核が育ちすぎてる。森の澱が濃くなってるのかもしれない。そういうのを調べるのが仕事。'),
      ],
      next: 'intro',
    },
    leave: {
      lines: [
        n('背を向けかけたとき、彼女が独り言のように呟いた。'),
        say('白衣の女性', '今年は、大潮の年なんだけどな。'),
        n('振り返ると、彼女はもうこちらを見ていなかった。'),
      ],
      next: 'intro',
    },
    intro: {
      lines: [
        say('白衣の女性', 'ノイン。魔導院の分室で研究してる。見ての通り、森人。'),
        say('noin', '分室は、この路地の奥の蔦だらけの建物。昼と夕方なら、たいていいるよ。暇なら来て。人手が足りないんだ。人手っていうか、人が。'),
        n('ノインは鼠の死骸を布に包むと、子供たちを手で追い払いながら路地の奥へ消えていった。'),
      ],
      effect: (s) => {
        meet(s, 'noin');
        s.flags.knowInstitute = true;
        log(s, '市場の路地で、ノインという森人の研究者に出会った。');
      },
      end: { advance: true },
    },
  },
};

const noinHint: EventDef = {
  id: 'noin_hint',
  trigger: 'slot',
  priority: 20,
  once: true,
  cond: (s) => s.day >= 9 && !s.flags.knowInstitute && slot(s, 3),
  nodes: {
    start: {
      lines: [
        n('灯り亭の食堂で、マルタが皿を拭きながら言った。'),
        say('マルタ', 'そういえば、魔導院の分室の森人さんが、手伝いを探してるらしいよ。市場の路地の奥の、蔦だらけの建物さ。変わり者だけど、悪い人じゃない。'),
      ],
      effect: (s) => (s.flags.knowInstitute = true),
    },
  },
};

const noinMeet2: EventDef = {
  id: 'noin_meet2',
  trigger: 'after',
  priority: 50,
  once: true,
  cond: (s) => !s.npcs.noin.met && s.location === 'institute',
  nodes: {
    start: {
      lines: [
        n('書庫の奥から、白衣の女性が顔を出した。耳が少し尖っている。'),
        say('白衣の女性', 'あれ、お客さん？　珍しい。'),
        say('白衣の女性', 'ノイン。ここの研究員。見ての通り、森人。'),
        say('noin', '暇なら手伝ってよ。人手が足りないんだ。人手っていうか、人が。'),
      ],
      effect: (s) => {
        meet(s, 'noin');
        log(s, '魔導院の分室で、ノインという森人の研究者に出会った。');
      },
    },
  },
};

// ───────── 仮登録期間 ─────────

const dutyWarning: EventDef = {
  id: 'duty_warning',
  trigger: 'slot',
  priority: 40,
  once: true,
  cond: (s) => s.day === 6 && slot(s, 0) && trainingDays(s) < 2,
  nodes: {
    start: {
      lines: [
        n('朝、宿の扉の下に、折りたたまれた紙が差し込まれていた。'),
        n('「講習の記録が不足しています。七日目までに、規定の日数を満たしてください。ギルド受付　セラ・ミドウ」'),
        n('几帳面な字だった。'),
      ],
    },
  },
};

const dutyCheck: EventDef = {
  id: 'duty_check',
  trigger: 'slot',
  priority: 40,
  once: true,
  cond: (s) => s.day >= 8 && slot(s, 0),
  nodes: {
    start: {
      lines: [],
      next: (s) => (trainingDays(s) >= 3 ? 'ok' : 'ng'),
    },
    ok: {
      lines: [
        n('朝の食堂で、リーネが向かいの席に座った。手には、ギルドの掲示板から剥がしてきたらしい紙を持っている。'),
        say('lyne', '今日から依頼が受けられるのよ。知ってた？　仮登録者向けのは、鼠退治とか、薬草摘みとか、地味なのばっかりだけど。'),
        say('lyne', 'ま、最初はそんなものよね。……あなたも早く受けなさいよ。置いていくわよ。'),
      ],
      effect: (s) => {
        s.flags.boardOpen = true;
        rel(s, 'sera', 'trust', 2);
      },
    },
    ng: {
      lines: [
        n('ギルドの窓口で、セラは帳簿を指で叩いた。'),
        say('sera', '講習の日数が足りません。規定により、仮登録の期間を七日延長します。依頼の受注は、それまでできません。'),
        say('sera', '規則ですので。'),
      ],
      effect: (s) => {
        s.flags.dutyFailed = true;
        s.flags.boardOpenDay = s.day + 7;
        rel(s, 'sera', 'trust', -3);
        rel(s, 'sera', 'wariness', 3);
        remember(s, 'sera', 'duty:failed', '講習の義務を果たさず、仮登録の期間を延長された。');
        log(s, '講習の日数が足りず、仮登録の期間が七日延びた。');
      },
    },
  },
};

const boardLate: EventDef = {
  id: 'board_late',
  trigger: 'slot',
  priority: 30,
  once: true,
  cond: (s) => !!s.flags.dutyFailed && s.day >= (s.flags.boardOpenDay as number) && slot(s, 0),
  nodes: {
    start: {
      lines: [n('仮登録の延長期間が明けた。今日から依頼を受けられる。')],
      effect: (s) => (s.flags.boardOpen = true),
    },
  },
};

// ───────── 昇級審査 ─────────

const rankNotice: EventDef = {
  id: 'rank_notice',
  trigger: 'slot',
  priority: 30,
  once: true,
  cond: (s) => s.day >= 14 && slot(s, 0) && s.rank === 0,
  nodes: {
    start: {
      lines: [
        n('訓練場の掲示板に、新しい貼り紙があった。'),
        n('「石級昇級審査　希望者は教官まで申し出ること」'),
        say('lyne', '来たわね。'),
        n('いつの間にか、隣にリーネが立っていた。'),
        say('lyne', '私は明日受ける。あなたは？'),
      ],
      effect: (s) => (s.flags.testOpen = true),
    },
  },
};

export function canTakeTest(s: GameState): boolean {
  return (
    !!s.flags.testOpen &&
    s.rank === 0 &&
    trainingDays(s) >= 3 &&
    (s.counters.questDone ?? 0) >= 1 &&
    (s.flags.testFailDay === undefined || s.day - (s.flags.testFailDay as number) >= 7) &&
    (!s.flags.dutyFailed || s.day >= 21)
  );
}

const rankTest: EventDef = {
  id: 'rank_test',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [
        n('審査を申し出ると、ガラドは無言で木剣を二本取った。一本を{I}に放る。'),
        n('訓練場の端に、セラの姿があった。書類を抱えて、審査の記録を取りに来たらしい。ガラドとセラは、一度も目を合わせなかった。'),
        say('garad', '勝てとは言わん。俺が見たいのは、お前が森で生きて帰れるかどうかだ。'),
        say('garad', '構えろ。'),
      ],
      choices: [
        {
          text: '構える',
          effect: (s) =>
            startCombat(s, {
              enemy: 'garad_spar',
              dist: 2,
              spar: true,
              onWin: { ev: 'rank_test', node: 'win' },
              onLose: { ev: 'rank_test', node: 'judge' },
              onFlee: { ev: 'rank_test', node: 'yield' },
            }),
        },
      ],
    },
    win: {
      lines: [
        n('{I}の木剣が、ガラドの胴を打った。'),
        n('ガラドは一歩下がり、しばらく打たれた場所を見下ろしていた。'),
        say('garad', '……膝のせいにはせん。'),
        say('garad', '合格だ。セラ、書いておけ。'),
        say('sera', 'はい。'),
        n('セラの返事は短かった。けれど、ペンを走らせる手はいつもより速かった。'),
      ],
      effect: (s) => {
        rel(s, 'garad', 'respect', 10, { big: true });
        rel(s, 'sera', 'respect', 4);
        remember(s, 'garad', 'test:won', '昇級審査で、ガラドから一本取った。');
      },
      next: 'pass',
    },
    judge: {
      lines: [
        n('木剣が手から弾き飛ばされた。砂の上に膝をつく。'),
        (s) =>
          (s.flags._lastTurns as number) >= 6
            ? [say('garad', '……立て。'), n('差し出された手を取って立ち上がる。'), say('garad', '最後まで目を閉じなかったな。それでいい。合格だ。')]
            : [say('garad', '今のお前では、森で死ぬ。'), say('garad', '七日後にまた来い。')],
      ],
      next: (s) => ((s.flags._lastTurns as number) >= 6 ? 'pass' : 'fail'),
    },
    yield: {
      lines: [n('{I}は木剣を下ろし、一歩退いた。'), say('garad', '……退くのも一つの判断だ。だが、審査は審査だ。七日後にまた来い。')],
      next: 'fail',
    },
    pass: {
      lines: [
        n('セラから、新しい認識票を受け取った。灰色の石を削り出した、小さな札だ。'),
        say('sera', '石級です。森の縁での狩りと、石級向けの依頼が受けられます。'),
        say('sera', '……おめでとうございます。'),
      ],
      effect: (s) => {
        s.rank = 1;
        rel(s, 'garad', 'respect', 4);
        rel(s, 'sera', 'trust', 3);
        if (!s.flags.lynePassed) rel(s, 'lyne', 'rivalry', 6);
        s.counters.rankUps = (s.counters.rankUps ?? 0) + 1;
        log(s, '昇級審査に合格し、石級の冒険者になった。');
      },
      end: { advance: true },
    },
    fail: {
      lines: [n('セラは記録に何かを書き込むと、黙って一礼して去っていった。')],
      effect: (s) => {
        s.flags.testFailDay = s.day;
        rel(s, 'garad', 'trust', 1);
        log(s, '昇級審査に落ちた。');
      },
      end: { advance: true },
    },
  },
};

const lynePasses: EventDef = {
  id: 'lyne_passes',
  trigger: 'slot',
  priority: 25,
  once: true,
  cond: (s) => s.day >= 15 && slot(s, 3) && !s.flags.lyneInjured,
  nodes: {
    start: {
      lines: [
        n('灯り亭の食堂で、リーネが真新しい石の札を指先でくるくると回していた。'),
        (s) =>
          s.rank >= 1
            ? [say('lyne', '合格したわ。……あなたより一日遅かったけど。'), n('リーネは悔しそうに唇を尖らせた。')]
            : [say('lyne', '合格したわよ。石級。'), say('lyne', 'あなたも早く来なさいよ。置いていくって言ったでしょ。')],
      ],
      effect: (s) => {
        s.flags.lynePassed = true;
        rel(s, 'lyne', 'affinity', 1);
      },
    },
  },
};

// ───────── リーネとの手合わせ ─────────

const lyneSpar: EventDef = {
  id: 'lyne_spar',
  trigger: 'manual',
  nodes: {
    start: {
      lines: [],
      effect: (s) =>
        startCombat(s, {
          enemy: 'lyne_spar',
          dist: 2,
          spar: true,
          onWin: { ev: 'lyne_spar', node: 'win' },
          onLose: { ev: 'lyne_spar', node: 'lose' },
          onFlee: { ev: 'lyne_spar', node: 'yield' },
        }),
    },
    win: {
      lines: [
        n('{I}の木剣が、リーネの手首を打った。木剣が砂の上に落ちる。'),
        say('lyne', '……っ。'),
        n('リーネは手首を押さえて、しばらく黙っていた。'),
        (s) => (s.npcs.lyne.rel.rivalry > 10 ? say('lyne', 'もう一回。……今日じゃなくていい。明日、もう一回よ。') : say('lyne', '……やるじゃない。')),
      ],
      effect: (s) => {
        rel(s, 'lyne', 'rivalry', 5);
        rel(s, 'lyne', 'respect', 4);
        s.counters.lyneWins = (s.counters.lyneWins ?? 0) + 1;
        log(s, 'リーネと手合わせをして、勝った。');
      },
      end: { advance: true },
    },
    lose: {
      lines: [
        n('リーネの木剣が、{I}の喉元でぴたりと止まった。'),
        say('lyne', '私の勝ち。'),
        n('リーネは得意げに笑った。それから、少しだけ声を落とした。'),
        say('lyne', '……あなた、受けるときに右肩が上がる癖があるわよ。直したほうがいい。'),
      ],
      effect: (s) => {
        rel(s, 'lyne', 'affinity', 2);
        gain(s, 'sword_t', 0.8, { kind: 'mentor' });
        log(s, 'リーネと手合わせをして、負けた。');
      },
      end: { advance: true },
    },
    yield: {
      lines: [n('{I}は木剣を下ろした。'), say('lyne', '何よ、降参？　……つまんない。')],
      effect: (s) => rel(s, 'lyne', 'respect', -2),
      end: { advance: true },
    },
  },
};

const lyneChallenge: EventDef = {
  id: 'lyne_challenge',
  trigger: 'after',
  priority: 40,
  once: true,
  cond: (s) => s.day >= 8 && s.day <= 16 && s.location === 'training' && s.npcs.lyne.met && /^sword:/.test(s.lastAction ?? '') && s.cond.hp > 40,
  nodes: {
    start: {
      lines: [
        n('稽古を終えて木剣を戻そうとしたとき、リーネが前に立った。'),
        say('lyne', 'ねえ。一本、勝負しない？'),
        say('lyne', '同期で一番強いのが誰か、はっきりさせておきたいの。'),
      ],
      choices: [
        { text: '受けて立つ', next: 'lyne_spar/start', effect: (s) => remember(s, 'lyne', 'challenge:accepted', 'リーネからの勝負を受けた。') },
        { text: '「今日はやめておく」', effect: (s) => { rel(s, 'lyne', 'rivalry', 2); rel(s, 'lyne', 'respect', -1); }, next: 'decline' },
      ],
    },
    decline: { lines: [say('lyne', '逃げるの？　……まあいいわ。いつでも受けてあげるから。')], end: { advance: true } },
  },
};

// ───────── リーネの無謀 ─────────

const lyneRash: EventDef = {
  id: 'lyne_rash',
  trigger: 'slot',
  priority: 60,
  once: true,
  cond: (s) => s.day >= 19 && s.day <= 24 && slot(s, 0) && !!s.flags.lynePassed,
  nodes: {
    start: {
      lines: [
        n('朝、宿の廊下でリーネとすれ違った。いつもより荷物が多い。野営用の毛布まで背負っている。'),
        say('lyne', '……何よ。'),
        n('問いただすと、リーネはしぶしぶ一枚の紙を見せた。ギルドの依頼票ではない。商人の私的な依頼書だった。'),
        n('「森の縁の北、窪地周辺で目撃された大型魔物の痕跡調査。報酬二百銅貨」'),
        say('lyne', 'セラさんが掲示板に貼ってくれなかったのよ。石級には危険すぎるって。だから、依頼主に直接頼んだの。'),
        say('lyne', '痕跡を調べるだけよ。戦うわけじゃない。これで一気に実績が積めるの。'),
        (s) => (s.stats.beast_t > 10 || s.counters.tideStudy ? n('大型魔物。森の縁で。最近の噂が頭をよぎる。熊の足跡を見た、という話だ。') : null),
      ],
      choices: [
        { text: '「一緒に行く」', effect: (s) => remember(s, 'lyne', 'rash:together', 'リーネの無謀な依頼に同行した。'), next: 'together' },
        { text: '行かないよう説得する', next: 'persuade' },
        { text: 'セラに知らせる', next: 'report' },
        { text: '好きにさせる', effect: (s) => { s.flags.lyneAlone = s.day; remember(s, 'lyne', 'rash:ignored', 'リーネの無謀な依頼を止めなかった。'); }, next: 'ignore' },
      ],
    },
    persuade: {
      lines: [
        (s) => {
          const score = (s.stats.speech + s.stats.empathy) / 2 + s.npcs.lyne.rel.trust * 0.5 + s.npcs.lyne.rel.affinity * 0.2;
          s.flags._persuade = score >= 20 ? 1 : 0;
          return n('{I}は言葉を選んで、リーネを引き止めた。');
        },
      ],
      next: (s) => (s.flags._persuade ? 'persuaded' : 'not_persuaded'),
    },
    persuaded: {
      lines: [
        n('リーネはしばらく黙って、依頼書を見つめていた。'),
        say('lyne', '……分かったわよ。あなたがそこまで言うなら。'),
        say('lyne', 'その代わり、今日一日、私の稽古に付き合いなさい。'),
      ],
      effect: (s) => {
        s.flags.lyneStopped = true;
        rel(s, 'lyne', 'trust', 6);
        rel(s, 'lyne', 'affinity', 2);
        remember(s, 'lyne', 'rash:stopped', 'リーネを説得して、無謀な依頼を思いとどまらせた。');
        log(s, '危険な依頼に向かおうとするリーネを、説得して止めた。');
      },
      end: { advance: true },
    },
    not_persuaded: {
      lines: [
        say('lyne', 'あなたに何が分かるのよ。'),
        say('lyne', '私には、急ぐ理由があるの。'),
        n('リーネは{I}の脇をすり抜けて、階段を駆け下りていった。'),
      ],
      effect: (s) => {
        s.flags.lyneAlone = s.day;
        s.flags.lyneWarned = true;
        rel(s, 'lyne', 'trust', 1);
        remember(s, 'lyne', 'rash:warned', 'リーネを止めようとしたが、止められなかった。');
        log(s, 'リーネを止めようとしたが、彼女は一人で森へ向かった。');
      },
      end: { advance: false },
    },
    report: {
      lines: [
        n('ギルドへ走り、セラに事情を伝えた。'),
        n('セラの顔から、すっと血の気が引いた。彼女は窓口を飛び出し、ちょうど東門へ向かおうとしていたリーネを呼び止めた。'),
        say('sera', '私的な依頼であっても、ギルドの登録者が規定外の区域に入ることは認められません。依頼書をお預かりします。'),
        n('リーネは依頼書を渡した。そして、{I}を振り返った。'),
        say('lyne', '……あなたが言ったのね。'),
        n('それだけ言って、リーネは去っていった。'),
      ],
      effect: (s) => {
        s.flags.lyneReported = s.day;
        rel(s, 'lyne', 'affinity', -6, { big: true });
        rel(s, 'lyne', 'wariness', 6, { big: true });
        rel(s, 'sera', 'trust', 6);
        remember(s, 'lyne', 'rash:reported', 'リーネの無謀な依頼を、セラに知らせた。');
        remember(s, 'sera', 'rash:reported', 'リーネの無謀な依頼を知らせた。');
        log(s, 'リーネの無謀な依頼をセラに知らせた。リーネは、{I}を見なかった。');
      },
      end: { advance: true },
    },
    ignore: {
      lines: [n('リーネは「じゃあね」とだけ言って、階段を降りていった。')],
      effect: (s) => log(s, 'リーネが一人で、森の北の窪地へ向かった。'),
    },
    together: {
      lines: [
        say('lyne', '……え？'),
        n('リーネは目を丸くした。それから、ふいと顔を背けた。'),
        say('lyne', '勝手にすれば。報酬は山分けよ。'),
        n('東門を出て、森の縁を北へ歩く。いつもの薬草地を過ぎると、木々が急に密になった。'),
        n('昼前、窪地の手前で、リーネが足を止めた。'),
      ],
      next: 'tracks',
    },
    tracks: {
      lines: [
        n('泥の上に、足跡があった。'),
        (s) =>
          s.stats.survival_p + s.stats.beast_t + s.stats.beast_p > 22
            ? n('熊だ。だが大きすぎる。足跡の深さからすると、普通の熊の倍は重い。それに、まだ新しい。泥の縁が崩れていない。半刻も経っていないだろう。')
            : n('大きな足跡だ。何の足跡かは分からない。ただ、{I}の手のひらを広げたより、ずっと大きい。'),
        say('lyne', '……これを記録すれば、依頼は達成よね。もう少し先まで見ておけば、報酬が上乗せされるかも。'),
      ],
      choices: [
        { text: '「ここで引き返そう」', next: 'turnback' },
        { text: 'リーネについていく', next: 'bear' },
      ],
    },
    turnback: {
      lines: [
        (s) => {
          const ok = s.npcs.lyne.rel.trust + s.npcs.lyne.rel.respect * 0.5 + s.stats.speech * 0.5 >= 14 || s.stats.survival_p + s.stats.beast_t > 22;
          s.flags._turn = ok ? 1 : 0;
          return n(ok ? '{I}は足跡の新しさをリーネに示した。リーネは唇を噛み、やがて頷いた。' : 'リーネは首を振った。「あと少しだけ」');
        },
      ],
      next: (s) => (s.flags._turn ? 'safe' : 'bear'),
    },
    safe: {
      lines: [
        n('窪地を離れ、来た道を急いで戻る。'),
        n('背後の森の奥で、太い枝の折れる音がした。二人とも、振り返らなかった。'),
        n('東門が見えたとき、リーネが小さく息を吐いた。'),
        say('lyne', '……ありがと。'),
        n('聞き返す前に、リーネは早足で門をくぐっていった。'),
      ],
      effect: (s) => {
        s.flags.lyneStopped = true;
        rel(s, 'lyne', 'trust', 8, { big: true });
        rel(s, 'lyne', 'respect', 4);
        s.money += 60;
        gain(s, 'survival_p', 1.2, { kind: 'practice' });
        remember(s, 'lyne', 'rash:turnedback', '熊の足跡を見つけて、リーネと一緒に引き返した。');
        log(s, 'リーネと森の北の窪地へ行き、巨大な熊の足跡を見つけて引き返した。痕跡の報告で、報酬の一部を受け取った。');
      },
      end: { advance: true, slots: 2 },
    },
    bear: {
      lines: [
        n('窪地の底へ降りた、そのときだった。'),
        n('倒木だと思っていたものが、動いた。'),
        say('lyne', '……うそ。'),
      ],
      effect: (s) =>
        startCombat(s, {
          enemy: 'bear',
          dist: 2,
          companion: 'lyne',
          onWin: { ev: 'lyne_rash', node: 'bear_win' },
          onLose: { ev: 'lyne_rash', node: 'bear_lose' },
          onFlee: { ev: 'lyne_rash', node: 'bear_flee' },
        }),
    },
    bear_win: {
      lines: [
        n('澱熊が、地響きを立てて倒れた。'),
        n('しばらく、二人とも動けなかった。息をするたびに、肺が焼けるように痛い。'),
        say('lyne', '……倒した。倒したのよ、私たち。'),
        n('リーネの声は震えていた。笑っているのか、泣いているのか、分からなかった。'),
        n('東門に戻ると、知らせを受けたセラが待っていた。熊の魔核を見たセラは、何も言わずに長い間それを見つめていた。'),
        say('sera', '……規定外の区域です。記録には残します。'),
        say('sera', 'それから、よく生きて帰りました。'),
      ],
      effect: (s) => {
        s.flags.bearSlain = true;
        rel(s, 'lyne', 'trust', 12, { big: true });
        rel(s, 'lyne', 'affinity', 8, { big: true });
        rel(s, 'garad', 'wariness', 4);
        rel(s, 'sera', 'respect', 6);
        rel(s, 'sera', 'trust', -3);
        s.money += 120;
        log(s, 'リーネと二人で、澱熊を倒した。');
      },
      end: { advance: true, slots: 2 },
    },
    bear_flee: {
      lines: [
        n('リーネの腕をつかんで、窪地の斜面を駆け上がる。'),
        n('背後で、何かが木をなぎ倒す音がした。振り返る余裕はなかった。'),
        n('どれだけ走ったのか分からない。気づいたときには、森の縁の草地に二人で倒れ込んでいた。'),
        say('lyne', '……ごめん。'),
        n('リーネは空を見上げたまま、小さな声で言った。'),
        say('lyne', '私のせいで、あなたまで死ぬところだった。'),
      ],
      effect: (s) => {
        s.flags.lyneStopped = true;
        rel(s, 'lyne', 'trust', 10, { big: true });
        rel(s, 'lyne', 'debt', 8, { big: true });
        remember(s, 'lyne', 'rash:fled', '澱熊から、リーネと一緒に逃げ延びた。');
        log(s, '森の北の窪地で澱熊に遭遇し、リーネと一緒に逃げ延びた。');
      },
      end: { advance: true, slots: 2 },
    },
    bear_lose: {
      lines: [
        n('熊の腕が、{I}を薙ぎ払った。体が宙に浮き、地面に叩きつけられる。'),
        n('視界が暗くなっていく。リーネの叫び声が、遠くに聞こえる。'),
        n('そのとき、誰かが{I}の前に立った。'),
        n('白髪交じりの大きな背中。右足を引きずりながら、それでも一歩も退かずに、熊の前に立ちはだかっている。'),
        say('garad', '……下がれ。'),
        n('そこで、意識が途切れた。'),
      ],
      next: 'bear_after',
    },
    bear_after: {
      lines: [
        n('目を覚ますと、灯り亭の自分の部屋だった。体中に包帯が巻かれている。'),
        say('マルタ', '起きたかい。……丸一日寝てたんだよ。'),
        say('マルタ', 'ガラドの旦那が、あんたたち二人を担いで帰ってきたんだ。あの足でさ。セラちゃんが知らせを聞いて、旦那に頼みに行ったらしいよ。'),
        say('マルタ', '旦那の膝は、もう駄目かもしれないって。'),
      ],
      effect: (s) => {
        s.flags.garadSavedUs = true;
        s.flags.garadKneeWorse = true;
        s.flags.lyneInjured = true;
        s.npcs.lyne.away = 4;
        s.cond.injuries.push({ id: 'bear', label: '肋の骨折', severity: 3, days: 14 });
        rel(s, 'garad', 'debt', 15, { big: true });
        rel(s, 'lyne', 'debt', 6, { big: true });
        remember(s, 'garad', 'rash:saved', '澱熊に襲われたところを、ガラドに救われた。');
        remember(s, 'lyne', 'rash:together_lost', 'リーネと一緒に澱熊に挑み、ガラドに救われた。');
        log(s, '澱熊に敗れた。ガラドが助けに来てくれた。彼の膝はもう駄目かもしれない。');
      },
      end: { advance: true, slots: 6 },
    },
  },
};

const lyneReturn: EventDef = {
  id: 'lyne_return',
  trigger: 'slot',
  priority: 55,
  once: true,
  cond: (s) => typeof s.flags.lyneAlone === 'number' && s.day >= (s.flags.lyneAlone as number) + 1 && slot(s, 2),
  nodes: {
    start: {
      lines: [
        n('夕方、東門のほうが騒がしかった。'),
        n('守備隊の巡回兵が、担架を運んでいる。その上に横たわっているのは、金茶色の髪の少女だった。'),
        n('左腕が、血に染まった布でぐるぐる巻きにされていた。'),
        say('巡回兵', '北の窪地の近くで倒れてた。熊にやられたらしい。運がよかったな、俺たちが通りかかって。'),
        (s) => (s.flags.lyneWarned ? n('リーネは薄く目を開けて、{I}を見た。何か言おうとして、そのまま目を閉じた。') : n('リーネは、気を失っていた。')),
      ],
      effect: (s) => {
        s.flags.lyneInjured = true;
        s.npcs.lyne.away = 6;
        rel(s, 'lyne', 'debt', -2);
        log(s, 'リーネが、熊に襲われて重傷を負って帰ってきた。');
      },
    },
  },
};

const lyneReportedAfter: EventDef = {
  id: 'lyne_reported_after',
  trigger: 'slot',
  priority: 30,
  once: true,
  cond: (s) => typeof s.flags.lyneReported === 'number' && s.day >= (s.flags.lyneReported as number) + 4 && slot(s, 3),
  nodes: {
    start: {
      lines: [
        n('食堂で、リーネが{I}の向かいに座った。この数日、口をきいていなかった。'),
        say('lyne', '……銅級のパーティーが、あの窪地で熊を見たって。体中に結晶の生えた、とんでもない大きさの奴。'),
        say('lyne', '三人がかりで、逃げるのがやっとだったそうよ。'),
        n('リーネは杯を両手で握りしめていた。'),
        say('lyne', '許したわけじゃないから。……でも、礼は言っておく。'),
      ],
      effect: (s) => {
        rel(s, 'lyne', 'trust', 8, { big: true });
        rel(s, 'lyne', 'wariness', -4, { big: true });
        remember(s, 'lyne', 'rash:thanked', 'セラに知らせたことを、後でリーネに感謝された。');
      },
    },
  },
};

// ───────── 遭遇（森の縁での戦闘） ─────────

const encounter: EventDef = {
  id: 'encounter',
  trigger: 'after',
  priority: 100,
  cond: (s) => !!s.flags._encounter,
  nodes: {
    start: {
      lines: [],
      effect: (s) => {
        const e = s.flags._encounter as string;
        delete s.flags._encounter;
        startCombat(s, {
          enemy: e,
          dist: e === 'boar' ? 3 : 2,
          onWin: { ev: 'encounter', node: 'win' },
          onLose: { ev: 'encounter', node: 'lose' },
          onFlee: { ev: 'encounter', node: 'flee' },
          loseMeansDeath: (s.counters.rescued ?? 0) >= 1,
        });
      },
    },
    win: {
      lines: [
        n('静かになった森の縁で、{I}は剣を下ろした。手が、まだ震えている。'),
        n('呼吸が落ち着くのを待ってから、死骸を検めた。'),
      ],
      effect: (s) => log(s, '森の縁で魔物と戦い、勝った。'),
    },
    flee: {
      lines: [n('どうにか森の縁を抜け、東門まで走り切った。門番が、怪訝な顔で{I}を見ていた。')],
      effect: (s) => log(s, '森の縁で魔物に出くわし、逃げ帰った。'),
    },
    lose: {
      lines: [
        n('地面に倒れた{I}の上に、魔物の影が覆いかぶさる。'),
        n('そのとき、角笛の音が響いた。'),
        n('気がつくと、守備隊の巡回兵に担がれていた。'),
        say('巡回兵', '運がよかったな、新人。俺たちが通りかからなきゃ、今頃は狼の腹の中だ。'),
        say('巡回兵', '次も誰かが通りかかるとは思うなよ。'),
      ],
      effect: (s) => {
        s.counters.rescued = (s.counters.rescued ?? 0) + 1;
        s.items.herb = 0;
        log(s, '森の縁で魔物に敗れ、守備隊の巡回兵に助けられた。次は、誰も来ないかもしれない。');
      },
    },
  },
};

// ───────── 小潮・章の区切り ─────────

const smallTide: EventDef = {
  id: 'small_tide',
  trigger: 'slot',
  priority: 30,
  once: true,
  cond: (s) => s.day >= 28 && slot(s, 0),
  nodes: {
    start: {
      lines: [
        n('朝から、ギルドの前に人だかりができていた。'),
        n('掲示板に、赤い縁取りの貼り紙。「小潮の始まりにつき、森の縁での単独行動を控えること」'),
        (s) =>
          s.npcs.noin.met
            ? [n('人だかりの後ろで、ノインが貼り紙を睨んでいた。'), say('noin', '早い。前の季節より五日も早い。……誰も気にしてないけど。')]
            : n('誰かが「今年は潮の年だからな」と呟いた。'),
      ],
      effect: (s) => {
        s.flags.smallTide = true;
        log(s, '小潮が始まった。森の魔物が増えるらしい。');
      },
    },
  },
};

const chapterNote: EventDef = {
  id: 'chapter_note',
  trigger: 'slot',
  priority: 90,
  once: true,
  cond: (s) => s.day >= 31 && slot(s, 0),
  nodes: {
    start: {
      lines: [
        n('――第1章「澱潮の春」は、ここから先も続いていく予定です。'),
        n('（開発中のお知らせ：31日目以降の物語イベントは今後のアップデートで追加されます。日常の行動・訓練・依頼・人との交流は、引き続き自由に行えます。）'),
      ],
    },
  },
};

// ───────── 日常（ストーリーレット） ─────────

const martaNight: EventDef = {
  id: 'marta_night',
  trigger: 'slot',
  priority: 0,
  cooldown: 3,
  cond: (s) => slot(s, 3) && s.day >= 3,
  nodes: {
    start: {
      lines: [
        n('灯り亭の食堂で、マルタが皿を拭いていた。'),
        (s) => {
          if (s.day >= 16 && !s.flags.heardGaradQuit) {
            s.flags.heardGaradQuit = true;
            return [say('マルタ', 'ガラドの旦那、今季限りで教官を辞めるかもしれないって噂だよ。'), say('マルタ', 'あの人、毎晩一人で飲んでるだろう。七年前から、ずっとさ。')];
          }
          if (s.cond.injuries.length) return say('マルタ', '怪我してるじゃないか。……無茶するんじゃないよ。死んだら宿代も取れやしない。');
          if ((s.counters.roughSleep ?? 0) > 0 && s.money < 20) return say('マルタ', 'お金がないなら、市場の商会の倉庫で荷運びの仕事があるよ。きついけど、日銭にはなる。');
          return say(
            'マルタ',
            pick(s, [
              'うちの亭主もね、昔は冒険者だったんだよ。森から帰ってこなかったけどさ。……だから、あんたたちには帰ってきてほしいんだ。',
              '新人ってのはね、最初の一月が一番危ないんだよ。慣れた頃が一番、ってね。',
              '明日は雨かもね。ガラドの旦那が、足をさすってたから。',
            ]),
          );
        },
      ],
    },
  },
};

const timoMeet: EventDef = {
  id: 'timo_meet',
  trigger: 'slot',
  priority: 5,
  once: true,
  cond: (s) => s.day >= 10 && s.day <= 18 && slot(s, 3),
  weight: 3,
  nodes: {
    start: {
      lines: [
        n('食堂に、見慣れない少年がいた。{I}より二つか三つ年下だろうか。真新しい革鎧を着て、仲間らしい少年たちに胸を張っている。'),
        say('少年', '俺はティモ。昨日登録したんだ。すぐに森の奥まで行って、でかい魔核を取ってくるんだ。'),
        n('少年は{I}の「仮」ではない札に気づいて、目を輝かせた。'),
        say('ティモ', '先輩！　森の奥って、どんなところですか？'),
      ],
      choices: [
        { text: '「無理はするな。最初は縁だけにしておけ」', effect: (s) => { s.flags.timoAdvice = 'careful'; log(s, '新人のティモに、無理をするなと言った。'); }, next: 'end' },
        { text: '「自分の目で確かめるといい」', effect: (s) => { s.flags.timoAdvice = 'free'; }, next: 'end' },
        { text: '「訓練場の講習には必ず出ろ」', effect: (s) => { s.flags.timoAdvice = 'training'; log(s, '新人のティモに、講習に出るよう言った。'); }, next: 'end' },
      ],
    },
    end: { lines: [say('ティモ', 'はい！'), n('ティモは元気よく返事をした。本当に聞いていたのかは、分からない。')] },
  },
};

const timoLost: EventDef = {
  id: 'timo_lost',
  trigger: 'slot',
  priority: 20,
  once: true,
  cond: (s) => s.seen.timo_meet !== undefined && s.day >= (s.seen.timo_meet as number) + 9 && slot(s, 3),
  nodes: {
    start: {
      lines: [],
      next: (s) => (s.flags.timoAdvice === 'free' || (s.flags.timoAdvice !== 'training' && chance(s, 0.5)) ? 'lost' : 'alive'),
    },
    lost: {
      lines: [
        n('食堂の隅の席が、ひとつ空いていた。'),
        n('マルタが、その席に置かれたままの革の手袋を、黙って片付けていた。'),
        say('マルタ', 'ティモって子、三日前に森に入ったきり戻らないんだよ。……仲間の子たちは、奥まで行こうって言ったのはティモだって。'),
        n('セラが、窓口で遅くまで草案を書いているのを見かけた。'),
      ],
      effect: (s) => {
        s.flags.timoDead = true;
        rel(s, 'sera', 'trust', 1);
        log(s, '新人のティモが、森から帰ってこなかった。');
      },
    },
    alive: {
      lines: [
        n('食堂で、ティモが仲間たちと騒いでいた。腕に包帯を巻いている。'),
        say('ティモ', '先輩！　言われた通り、縁だけで引き返したんですよ。仲間は奥に行こうって言ったんですけど。'),
        say('ティモ', 'そしたら、帰り道で狼に出くわして……。奥まで行ってたら、死んでました。'),
        n('ティモは照れくさそうに笑った。'),
      ],
      effect: (s) => {
        s.flags.timoSaved = true;
        log(s, '新人のティモは、{I}の言葉を守って生き延びた。');
      },
    },
  },
};

const rainyDay: EventDef = {
  id: 'rain',
  trigger: 'slot',
  priority: 0,
  cooldown: 6,
  cond: (s) => slot(s, 0) && s.day > 4,
  weight: 0.6,
  nodes: {
    start: {
      lines: [
        n('朝から雨だった。'),
        n('灰縁の森の上の霞が、雨に打たれて低く垂れ込めている。窓の外の石畳を、荷車が水しぶきを上げて通り過ぎていった。'),
      ],
      effect: (s) => log(s, '雨の日だった。'),
    },
  },
};

const noinSampleThanks: EventDef = {
  id: 'noin_sample_thanks',
  trigger: 'after',
  priority: 45,
  once: true,
  cond: (s) => !!s.flags.sampleDelivered && s.location === 'institute',
  nodes: {
    start: {
      lines: [
        n('分室に入ると、ノインが飛びつくように駆け寄ってきた。'),
        say('noin', 'きみの持ってきた泥、すごくいいよ！　脈動の痕跡がはっきり残ってた。'),
        say('noin', '潮計の芯の調整が、これで一段進む。……ありがとう、ほんとに。'),
        n('ノインは{I}の手を両手で握って、上下にぶんぶんと振った。'),
      ],
      effect: (s) => {
        s.flags.tideGauge = ((s.flags.tideGauge as number) ?? 0) + 1;
        rel(s, 'noin', 'trust', 5);
        rel(s, 'noin', 'affinity', 3);
        remember(s, 'noin', 'sample:done', '潮計のための澱の試料を届けた。');
      },
    },
  },
};

export const EVENTS: EventDef[] = [
  prologue,
  orientation,
  noinMeet,
  noinHint,
  noinMeet2,
  dutyWarning,
  dutyCheck,
  boardLate,
  rankNotice,
  rankTest,
  lynePasses,
  lyneSpar,
  lyneChallenge,
  lyneRash,
  lyneReturn,
  lyneReportedAfter,
  encounter,
  smallTide,
  chapterNote,
  martaNight,
  timoMeet,
  timoLost,
  rainyDay,
  noinSampleThanks,
];
