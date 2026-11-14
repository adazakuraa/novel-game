// 主要NPC。それぞれの生活（居場所）・人物像・話題を持つ。
import type { NpcDef, TopicDef } from '../engine/defs';
import type { GameState } from '../engine/types';
import { n, say } from '../engine/text';
import { closeness, rel, remember } from '../engine/npc';
import { log } from '../engine/game';
import { pick } from '../engine/rng';

const used = (s: GameState, npc: string, topic: string) => s.npcs[npc].topicsUsed[topic] !== undefined;
const R_ = (s: GameState, npc: string) => s.npcs[npc].rel;

// ───────── ガラド ─────────

const garadTopics: TopicDef[] = [
  {
    id: 'small',
    label: '世間話をする',
    node: {
      lines: [
        (s) =>
          pick(s, [
            [say('garad', '……天気の話がしたいなら、マルタにしろ。'), n('そう言いながらも、ガラドは訓練場の端の丸太に腰を下ろした。')],
            [say('garad', '新人の半分は、最初の季節で辞めるか死ぬ。お前はどっちだ。'), n('答えを待たずに、ガラドは遠くを見た。')],
            [n('ガラドは木剣の手入れをしながら、黙って{I}の話を聞いていた。'), say('garad', '……そうか。')],
            [say('garad', '膝が疼く。明日は雨だな。')],
          ]),
      ],
      effect: (s) => rel(s, 'garad', 'affinity', 1),
    },
  },
  {
    id: 'strength',
    label: '強さとは何か、聞いてみる',
    once: true,
    cond: (s) => s.day >= 3,
    node: {
      lines: [
        say('garad', '強さ？'),
        n('ガラドは鼻で笑い、木剣の先で砂地に線を引いた。'),
        say('garad', 'ここから向こうに行って、こっちに帰ってくる。それだけだ。生きて帰った奴が強い。どんなに剣が上手くても、死んだ奴は弱い。'),
        say('garad', 'お前は、何のために強くなりたい。'),
      ],
      choices: [
        {
          text: '生き延びるため',
          effect: (s) => {
            rel(s, 'garad', 'respect', 3);
            remember(s, 'garad', 'value:survive', '強くなる理由を「生き延びるため」と答えた。');
          },
          next: 't:strength_a',
        },
        {
          text: '誰かを守るため',
          effect: (s) => {
            rel(s, 'garad', 'respect', 1);
            rel(s, 'garad', 'wariness', 2);
            remember(s, 'garad', 'value:protect', '強くなる理由を「誰かを守るため」と答えた。');
          },
          next: 't:strength_b',
        },
        {
          text: '名を上げるため',
          effect: (s) => {
            rel(s, 'garad', 'wariness', 3);
            remember(s, 'garad', 'value:fame', '強くなる理由を「名を上げるため」と答えた。');
          },
          next: 't:strength_c',
        },
        {
          text: 'まだ分からない',
          effect: (s) => {
            rel(s, 'garad', 'trust', 2);
            remember(s, 'garad', 'value:unknown', '強くなる理由は「まだ分からない」と答えた。');
          },
          next: 't:strength_d',
        },
      ],
    },
    extraNodes: {
      't:strength_a': { lines: [say('garad', '……いい答えだ。少なくとも、正直だ。'), n('ガラドは線を足で消した。')], next: 'menu' },
      't:strength_b': {
        lines: [
          n('ガラドの手が止まった。'),
          say('garad', '守る、か。'),
          n('長い沈黙のあと、ガラドは立ち上がって背を向けた。'),
          say('garad', '守ろうとした奴が、守れなかったものの数を数えることになる。覚えておけ。'),
        ],
        next: 'menu',
      },
      't:strength_c': { lines: [say('garad', '名を上げた奴の墓なら、東門の外にいくらでもある。'), n('ガラドはそれ以上何も言わなかった。')], next: 'menu' },
      't:strength_d': { lines: [say('garad', '分からんうちは、死ぬな。それだけでいい。')], next: 'menu' },
    },
  },
  {
    id: 'why_teacher',
    label: 'どうして教官をしているのか聞く',
    once: true,
    cond: (s) => R_(s, 'garad').respect >= 6 || R_(s, 'garad').affinity >= 8,
    node: {
      lines: [
        say('garad', '膝だ。'),
        n('ガラドは右膝を拳で軽く叩いた。'),
        say('garad', '銀級まで行った。そこで、この膝をやった。森の奥へはもう行けん。だから、森の縁で死なない奴を育てる。……それだけだ。'),
      ],
      effect: (s) => {
        s.flags.garadPast0 = true;
        rel(s, 'garad', 'trust', 2);
        remember(s, 'garad', 'asked:teacher', 'ガラドが元銀級で、膝の怪我で引退したことを聞いた。');
      },
    },
  },
  {
    id: 'party',
    label: '昔の仲間のことを聞く',
    once: true,
    cond: (s) => !!s.flags.garadPast0 && R_(s, 'garad').trust >= 14,
    node: {
      lines: [
        n('ガラドはしばらく答えなかった。訓練場の砂を、風が転がしていく。'),
        say('garad', '「赤錆の鎚」。四人のパーティーだった。名前の通り、品のない連中でな。'),
        say('garad', '七年前の大潮で、俺以外は死んだ。'),
        n('ガラドの声は平坦だった。けれど、木剣を握る手の甲に筋が浮いていた。'),
      ],
      choices: [
        { text: '黙って聞く', effect: (s) => { rel(s, 'garad', 'trust', 3); remember(s, 'garad', 'party:listened', '赤錆の鎚の話を、黙って聞いた。'); }, next: 't:party_end' },
        { text: '「何があったんですか」', effect: (s) => { rel(s, 'garad', 'wariness', 2); }, next: 't:party_ask' },
        { text: '「つらいことを聞いてすみません」', effect: (s) => { rel(s, 'garad', 'affinity', 2); }, next: 't:party_end' },
      ],
      effect: (s) => {
        s.flags.garadPast1 = true;
        log(s, 'ガラドから、昔の仲間「赤錆の鎚」のことを聞いた。');
      },
    },
    extraNodes: {
      't:party_ask': { lines: [say('garad', '……今日はここまでだ。'), n('ガラドは立ち上がり、訓練場を出ていった。右足を、少し引きずっていた。')], next: 'bye' },
      't:party_end': { lines: [say('garad', '昔の話だ。'), n('それきり、ガラドは口を閉ざした。けれど、追い払われはしなかった。')], next: 'menu' },
    },
  },
  {
    id: 'tag',
    label: '古い認識票を見せる',
    cond: (s) =>
      !!s.items.oldtag && !!s.flags.garadPast1 && !s.flags.tagRevealed && (s.flags.tagRejectedDay === undefined || s.day - (s.flags.tagRejectedDay as number) >= 10),
    node: {
      lines: [n('懐から、曲がった青銅の札を取り出す。七年間、ずっと持っていたものだ。')],
      next: (s) => (R_(s, 'garad').trust >= 26 && R_(s, 'garad').respect >= 20 ? 't:tag_yes' : 't:tag_no'),
    },
    extraNodes: {
      't:tag_no': {
        lines: [
          n('ガラドは札を一瞥した。'),
          n('その目が、一瞬だけ見開かれた気がした。けれど次の瞬間には、いつもの無表情に戻っていた。'),
          say('garad', '古い型だ。七年前まで使われていた。……どこで拾ったか知らんが、持ち主は死んだんだろう。'),
          say('garad', 'しまっておけ。'),
        ],
        effect: (s) => {
          s.flags.tagRejectedDay = s.day;
          rel(s, 'garad', 'wariness', 3);
          remember(s, 'garad', 'tag:early', 'ガラドに古い認識票を見せたが、取り合ってもらえなかった。');
        },
        next: 'bye',
      },
      't:tag_yes': {
        lines: [
          n('ガラドは札を受け取った。指先で「G」の刻印をなぞる。'),
          n('長い、長い沈黙があった。'),
          say('garad', '……どこで、これを。'),
          n('ソラムのこと。七年前の夜。畑まで来た狼。それを斬って、血を流しながら去っていった人のこと。{I}は話した。'),
          n('ガラドは最後まで、一言も口を挟まなかった。'),
          say('garad', 'あの夜、俺は門を離れた。一匹だけ、群れから外れて南へ走る狼がいた。追えば、門が手薄になる。分かっていた。'),
          say('garad', '村を一つ守った。その間に、仲間が三人死んだ。'),
          say('garad', 'どっちが正しかったのか、七年考えた。答えは出なかった。'),
          n('ガラドは札を{I}の手に押し戻した。その手が、かすかに震えていた。'),
          say('garad', '……そうか。あの村の。お前が。'),
        ],
        choices: [
          { text: '「あなたのおかげで、今ここにいます」', effect: (s) => remember(s, 'garad', 'tag:thanks', 'ガラドに、命を救われた礼を言った。'), next: 't:tag_end' },
          { text: '何も言わずに頭を下げる', effect: (s) => remember(s, 'garad', 'tag:bow', 'ガラドに、黙って頭を下げた。'), next: 't:tag_end' },
          { text: '「答えは、出たんじゃないですか」', effect: (s) => remember(s, 'garad', 'tag:answer', 'ガラドに「答えは出たのでは」と言った。'), next: 't:tag_end' },
        ],
      },
      't:tag_end': {
        lines: [
          n('ガラドは空を見上げた。'),
          say('garad', '持っていろ。それは、もうお前のものだ。'),
          say('garad', '明日も来い。……教えることが、まだ山ほどある。'),
        ],
        effect: (s) => {
          s.flags.tagRevealed = true;
          rel(s, 'garad', 'trust', 25, { big: true });
          rel(s, 'garad', 'affinity', 15, { big: true });
          rel(s, 'garad', 'debt', 20, { big: true });
          rel(s, 'garad', 'wariness', -15, { big: true });
          s.flags.garadStays = true;
          log(s, '古い認識票の持ち主は、ガラドだった。');
        },
        next: 'bye',
      },
    },
  },
  {
    id: 'report',
    label: '最近の依頼の話をする',
    cond: (s) => (s.counters.questDone ?? 0) > ((s.flags.garadHeardQuests as number) ?? 0),
    node: {
      lines: [
        (s) =>
          s.flags.lastQuestHurt
            ? [n('依頼の話をすると、ガラドは{I}の傷に目をやった。'), say('garad', '……生きて帰ったなら、それでいい。次は傷を作るな。')]
            : [n('依頼の話をすると、ガラドは黙って最後まで聞いた。'), say('garad', '無傷か。運がよかったか、腕がよかったか。……次も同じとは思うな。')],
      ],
      effect: (s) => {
        s.flags.garadHeardQuests = s.counters.questDone ?? 0;
        rel(s, 'garad', 'respect', s.flags.lastQuestHurt ? 1 : 2.5);
        rel(s, 'garad', 'trust', 1.5);
      },
    },
  },
];

// ───────── リーネ ─────────

const lyneTopics: TopicDef[] = [
  {
    id: 'small',
    label: '世間話をする',
    node: {
      lines: [
        (s) =>
          pick(s, [
            [say('lyne', '灯り亭の煮込み、豆ばっかりよね。王都じゃ考えられないわ。'), n('文句を言いながら、リーネは二杯目を頼んでいた。')],
            [say('lyne', '今日の素振り、何回した？　……ふうん。私はその倍よ。'), n('胸を張るリーネの手のひらには、潰れた豆がいくつもあった。')],
            [say('lyne', 'ねえ、銅級に上がるのって、普通どのくらいかかるの？　……一年？　遅すぎる。')],
            [say('lyne', '別に、あなたと話したかったわけじゃないわ。暇だっただけ。'), n('それから半刻、リーネは剣の話をし続けた。')],
          ]),
      ],
      effect: (s) => rel(s, 'lyne', 'affinity', 1.5),
    },
  },
  {
    id: 'why',
    label: 'なぜ冒険者になったのか聞く',
    once: true,
    cond: (s) => R_(s, 'lyne').affinity >= 4,
    node: {
      lines: [
        say('lyne', '決まってるでしょ。名を上げるためよ。'),
        say('lyne', '一年で銅級。三年で銀級。それで王都に手紙を書くの。「アーデルの名に恥じない働きをしております」って。'),
        n('リーネは笑った。けれど、その目は笑っていなかった。'),
      ],
      choices: [
        { text: '「すごい目標だね」', effect: (s) => { rel(s, 'lyne', 'affinity', 2); remember(s, 'lyne', 'why:praise', 'リーネの目標を褒めた。'); }, next: 'menu' },
        { text: '「誰に読んでほしい手紙なの？」', effect: (s) => { rel(s, 'lyne', 'wariness', 2); rel(s, 'lyne', 'trust', 2); remember(s, 'lyne', 'why:letter', 'リーネに、手紙を誰に読んでほしいのか聞いた。'); }, next: 't:why_letter' },
        { text: '「急ぎすぎると死ぬよ」', effect: (s) => { rel(s, 'lyne', 'rivalry', 3); remember(s, 'lyne', 'why:warn', 'リーネに「急ぎすぎると死ぬ」と言った。'); }, next: 't:why_warn' },
      ],
    },
    extraNodes: {
      't:why_letter': { lines: [n('リーネは言葉に詰まった。'), say('lyne', '……誰だっていいでしょ。'), n('彼女は顔を背けた。耳が少し赤かった。')], next: 'menu' },
      't:why_warn': { lines: [say('lyne', 'ガラド教官みたいなこと言うのね。'), say('lyne', '急がなかったら、私には何も残らないのよ。'), n('最後の言葉は、ほとんど独り言だった。')], next: 'menu' },
    },
  },
  {
    id: 'family',
    label: '家族のことを聞く',
    once: true,
    cond: (s) => used(s, 'lyne', 'why') && R_(s, 'lyne').trust >= 16,
    node: {
      lines: [
        n('夜の灯り亭の食堂。客はもう、{I}たちしか残っていない。'),
        say('lyne', '……私ね、庶子なの。アーデル家の当主が、屋敷の女中に産ませた子。'),
        say('lyne', '父は私の名前も覚えてないと思う。兄さまたちは、私を家具みたいに扱った。剣を教えてくれたのは、年寄りの家付き騎士だけ。'),
        say('lyne', 'だから私には剣しかないの。剣で名を上げなきゃ、私なんていてもいなくても同じ。'),
        n('リーネは杯の中の水を見つめていた。'),
      ],
      choices: [
        { text: '「リーネはリーネだよ。家なんて関係ない」', effect: (s) => { rel(s, 'lyne', 'affinity', 4); remember(s, 'lyne', 'family:yourself', '「リーネはリーネだ」と言った。'); }, next: 't:family_a' },
        { text: '黙ってそばにいる', effect: (s) => { rel(s, 'lyne', 'trust', 5); remember(s, 'lyne', 'family:stay', 'リーネの話を、黙ってそばで聞いた。'); }, next: 't:family_b' },
        { text: '「剣以外にも、リーネにはいいところがある」', effect: (s) => { rel(s, 'lyne', 'affinity', 2); rel(s, 'lyne', 'wariness', 1); remember(s, 'lyne', 'family:more', '「剣以外にもいいところがある」と言った。'); }, next: 't:family_c' },
      ],
    },
    extraNodes: {
      't:family_a': { lines: [say('lyne', '……簡単に言うわね。'), n('そう言いながら、リーネは少しだけ笑った。')], next: 'bye' },
      't:family_b': { lines: [n('しばらくして、リーネは小さく息を吐いた。'), say('lyne', '……話したの、初めて。誰にも言わないでよ。')], next: 'bye' },
      't:family_c': { lines: [say('lyne', 'たとえば？'), n('{I}が答えを探しているうちに、リーネは吹き出した。'), say('lyne', 'ほら、ないじゃない。……でも、ありがと。')], next: 'bye' },
    },
  },
  {
    id: 'spar',
    label: '手合わせを申し込む',
    cond: (s) => s.location === 'training' && s.slot <= 2 && s.cond.hp > 40 && !s.flags.lyneInjured,
    node: {
      lines: [
        (s) =>
          R_(s, 'lyne').rivalry > 8
            ? say('lyne', '望むところよ。今日こそ、はっきり差をつけてあげる。')
            : say('lyne', 'いいわよ。手加減はしないから。'),
        n('二人で木剣を取り、砂地の真ん中に向かい合った。'),
      ],
      next: 'lyne_spar/start',
    },
  },
  {
    id: 'injured',
    label: '傷の具合を聞く',
    once: true,
    cond: (s) => !!s.flags.lyneInjured && s.npcs.lyne.away <= 0,
    node: {
      lines: [
        n('リーネの左腕には、まだ包帯が巻かれていた。'),
        say('lyne', '……大丈夫よ。剣は握れる。握れるんだから。'),
        n('そう言って剣の柄を握った指は、うまく閉じきらなかった。'),
        (s) => (s.flags.lyneWarned ? say('lyne', 'あなたの言う通りにしておけばよかった。……なんて、言わないわよ。') : say('lyne', '笑いたければ笑えば。')),
      ],
      choices: [
        { text: '「生きて帰ってきた。それで十分だ」', effect: (s) => { rel(s, 'lyne', 'trust', 4); rel(s, 'lyne', 'affinity', 3); remember(s, 'lyne', 'injured:alive', '怪我をしたリーネに「生きて帰った、それで十分だ」と言った。'); }, next: 'menu' },
        { text: '「一緒に、もう一度やり直そう」', effect: (s) => { rel(s, 'lyne', 'affinity', 4); rel(s, 'lyne', 'rivalry', -2); remember(s, 'lyne', 'injured:together', 'リーネに「一緒にやり直そう」と言った。'); }, next: 'menu' },
        { text: '何も言わない', effect: (s) => rel(s, 'lyne', 'trust', 1), next: 'menu' },
      ],
    },
  },
];

// ───────── セラ ─────────

const seraTopics: TopicDef[] = [
  {
    id: 'small',
    label: '世間話をする',
    node: {
      lines: [
        (s) =>
          pick(s, [
            [say('sera', '用件は手短にお願いします。後ろに人が並んでいますので。'), n('後ろには誰もいなかった。')],
            [say('sera', '今朝、仮登録の子が一人、登録票を返しに来ました。故郷に帰るそうです。'), n('セラは書類から目を上げずに言った。'), say('sera', '……賢明な判断だと思います。')],
            [say('sera', '依頼票の字が汚い依頼主は、たいてい報酬の支払いも汚いものです。覚えておくといいですよ。')],
            [n('セラは帳簿をめくりながら、それでも{I}の話に相槌を打ってくれた。')],
          ]),
      ],
      effect: (s) => rel(s, 'sera', 'affinity', 1),
    },
  },
  {
    id: 'rules',
    label: 'どうしてそんなに規則に厳しいのか聞く',
    once: true,
    cond: (s) => s.day >= 3,
    node: {
      lines: [
        n('セラはペンを置いた。'),
        say('sera', '規則というのは、誰かが死んだ跡にできるものなんです。'),
        say('sera', '「森の縁より奥に、仮登録者を入れてはならない」。この規則ができるまでに、十二人の新人が死にました。記録に残っているだけで。'),
        say('sera', 'ですから私は、規則を曲げません。あなたにも、曲げさせません。'),
      ],
      choices: [
        { text: '「分かりました。守ります」', effect: (s) => { rel(s, 'sera', 'trust', 3); remember(s, 'sera', 'rules:obey', '規則を守ると約束した。'); s.flags.promisedSera = true; }, next: 'menu' },
        { text: '「規則で、全員が守れるんですか」', effect: (s) => { rel(s, 'sera', 'respect', 2); rel(s, 'sera', 'wariness', 2); remember(s, 'sera', 'rules:question', '「規則で全員を守れるのか」と問うた。'); }, next: 't:rules_q' },
      ],
    },
    extraNodes: {
      't:rules_q': {
        lines: [n('セラの表情が、一瞬だけ揺れた。'), say('sera', '……守れません。'), say('sera', 'それでも、ないよりはましです。'), n('セラは書類に視線を戻した。話は終わり、ということらしい。')],
        next: 'bye',
      },
    },
  },
  {
    id: 'rank',
    label: '昇級について相談する',
    cond: (s) => s.rank === 0 && s.day >= 5,
    node: {
      lines: [
        say('sera', '石級への昇級には、三つの条件があります。'),
        say('sera', '訓練場での講習を規定通り受けていること。仮登録者向けの依頼を一件以上、達成していること。そして、ガラド教官との立ち合いで、最低限の力を示すこと。'),
        (s) => {
          const lack: string[] = [];
          if (trainingDays(s) < 3) lack.push('講習がまだ足りません');
          if ((s.counters.questDone ?? 0) < 1) lack.push('依頼の実績がまだありません');
          if (lack.length === 0) return say('sera', s.day >= 14 ? '書類上の条件は満たしています。あとは、訓練場で教官に審査を申し込んでください。' : '書類上の条件は満たしています。審査は、登録から二週間が経ってからです。');
          return say('sera', `今のあなたは……${lack.join('。')}。`);
        },
      ],
    },
  },
  {
    id: 'draft',
    label: '遅くまで何を書いているのか聞く',
    once: true,
    cond: (s) => R_(s, 'sera').trust >= 12 && s.slot === 2,
    node: {
      lines: [
        n('窓口の明かりの下で、セラは分厚い紙の束に書き込みをしていた。'),
        say('sera', '……見られてしまいましたか。'),
        say('sera', '「新人保護規定」の草案です。仮登録の期間を延ばして、訓練を義務にする。森に入る前に、最低限の技術を身につけさせる。'),
        say('sera', '支部長には、三度突き返されました。新人が森に入らなければ、魔核が集まらない。魔核が集まらなければ、商会が困る。そういうことです。'),
      ],
      choices: [
        { text: '「手伝えることはありますか」', effect: (s) => { s.flags.supportDraft = true; rel(s, 'sera', 'trust', 4); rel(s, 'sera', 'affinity', 2); remember(s, 'sera', 'draft:help', '新人保護規定の草案を手伝うと申し出た。'); }, next: 't:draft_help' },
        { text: '「いい規定だと思います」', effect: (s) => { rel(s, 'sera', 'affinity', 2); remember(s, 'sera', 'draft:praise', '新人保護規定の草案に賛成した。'); }, next: 'menu' },
        { text: '「訓練ばかりでは稼げません」', effect: (s) => { rel(s, 'sera', 'respect', 1); rel(s, 'sera', 'affinity', -2); remember(s, 'sera', 'draft:against', '新人保護規定の草案に反対した。'); }, next: 't:draft_against' },
      ],
    },
    extraNodes: {
      't:draft_help': { lines: [say('sera', '……あなたが、生きて依頼をこなしてくれること。それが一番の材料になります。'), say('sera', '「講習をきちんと受けた新人は死なない」。その実例が要るんです。')], next: 'menu' },
      't:draft_against': { lines: [say('sera', 'ええ。皆そう言います。'), say('sera', '死んだ人は、もう何も言いませんけれど。')], next: 'menu' },
    },
  },
  {
    id: 'brother',
    label: 'セラ自身のことを聞く',
    once: true,
    cond: (s) => used(s, 'sera', 'draft') && R_(s, 'sera').trust >= 24,
    node: {
      lines: [
        say('sera', '私のこと、ですか。'),
        n('セラは少し考えて、引き出しから一枚の古い依頼票を取り出した。端が擦り切れている。'),
        say('sera', '弟がいました。レオン。冒険者でした。規則はきちんと守る子でした。私よりよほど真面目で。'),
        say('sera', '七年前の大潮で死にました。東門の防衛で。'),
        say('sera', '「赤錆の鎚」というパーティーにいたんです。リーダーは……ガラド教官でした。'),
        n('セラはそれ以上言わなかった。依頼票をそっと引き出しに戻した。'),
      ],
      effect: (s) => {
        s.flags.knowLeon = true;
        rel(s, 'sera', 'trust', 4);
        log(s, 'セラの弟レオンが、七年前の大潮で死んだことを知った。ガラドの仲間だったという。');
      },
      choices: [
        { text: '「ガラドさんを恨んでいますか」', cond: (s) => !!s.flags.garadPast1, effect: (s) => remember(s, 'sera', 'brother:grudge', 'ガラドを恨んでいるのかと聞いた。'), next: 't:brother_grudge' },
        { text: '「話してくれてありがとう」', effect: (s) => { rel(s, 'sera', 'affinity', 3); remember(s, 'sera', 'brother:thanks', '弟の話を聞かせてもらった礼を言った。'); }, next: 'bye' },
      ],
    },
    extraNodes: {
      't:brother_grudge': {
        lines: [
          say('sera', '恨む、ですか。'),
          say('sera', 'あの人が門を離れたことは、知っています。理由も、だいたいは。'),
          say('sera', '恨めたら、楽だったと思います。'),
          n('セラは窓の外を見た。訓練場のほうから、木剣を打ち合う音が聞こえていた。'),
        ],
        effect: (s) => {
          s.flags.seraGaradKnot = true;
          rel(s, 'sera', 'trust', 3);
        },
        next: 'bye',
      },
    },
  },
];

// ───────── ノイン ─────────

const noinTopics: TopicDef[] = [
  {
    id: 'small',
    label: '世間話をする',
    node: {
      lines: [
        (s) =>
          pick(s, [
            [say('noin', 'ねえ、きみ、昨日何回瞬きした？　……数えてない？　もったいない。人間の瞬きの回数は、澱の濃さで変わるかもしれないのに。')],
            [say('noin', 'お茶飲む？　……あ、ごめん、それ試薬だった。こっち。たぶんこっち。')],
            [say('noin', '森人の寿命はきみたちの三倍くらいだけど、退屈の量も三倍なんだよ。だから研究してる。'), n('ノインは本気とも冗談ともつかない顔で言った。')],
            [n('ノインは顕微鏡を覗いたまま、{I}の話に「うん」「へえ」「それで？」と相槌を打った。話をちゃんと聞いていたことが、最後の質問で分かった。')],
          ]),
      ],
      effect: (s) => rel(s, 'noin', 'affinity', 1),
    },
  },
  {
    id: 'tide',
    label: '何の研究をしているのか聞く',
    once: true,
    node: {
      lines: [
        say('noin', '澱潮。澱の満ち引き。'),
        n('ノインは壁一面に貼られた紙を指さした。日付と数字と、曲線がびっしりと書き込まれている。'),
        say('noin', '小さな潮は毎季、大きな潮はだいたい七年ごと。ここまでは誰でも知ってる。でもね、大潮の規模が毎回大きくなってるってことは、誰も気にしてない。'),
        say('noin', '今年は大潮の年だよ。私の計算だと、前回の倍以上。……でも計算だけじゃ誰も信じない。だから「潮計」を作ってる。澱の脈動を直接測る道具。'),
      ],
      choices: [
        { text: '「本当なら大変なことだ」', effect: (s) => { rel(s, 'noin', 'trust', 3); s.flags.believesNoin = true; remember(s, 'noin', 'tide:believe', 'ノインの大潮の予測を信じた。'); }, next: 't:tide_a' },
        { text: '「証拠はあるの？」', effect: (s) => { rel(s, 'noin', 'respect', 3); remember(s, 'noin', 'tide:evidence', 'ノインに証拠を求めた。'); }, next: 't:tide_b' },
        { text: '「難しくてよく分からない」', effect: (s) => rel(s, 'noin', 'affinity', 1), next: 't:tide_c' },
      ],
    },
    extraNodes: {
      't:tide_a': { lines: [say('noin', '……へえ。'), n('ノインは少し驚いたように{I}を見た。'), say('noin', '信じるって言われたの、ここに来て初めてかも。')], next: 'menu' },
      't:tide_b': { lines: [say('noin', 'いい質問。ないよ。まだ。'), say('noin', 'だから作るの。きみ、そういうことを聞ける人は長生きするよ。')], next: 'menu' },
      't:tide_c': { lines: [say('noin', '正直でよろしい。分からないって言える人は、少ないんだ。')], next: 'menu' },
    },
  },
  {
    id: 'magic',
    label: '魔法を教えてほしいと頼む',
    once: true,
    cond: (s) => R_(s, 'noin').affinity >= 3 || R_(s, 'noin').trust >= 3,
    node: {
      lines: [
        say('noin', '魔法？　いいよ。手、出して。'),
        n('ノインは{I}の手のひらに、自分の冷たい指先を重ねた。目を閉じて、しばらく黙っている。'),
        (s) => {
          const a = s.apt.magic_p;
          if (a > 1.35) return [n('ノインの目が、ぱっと開いた。'), say('noin', '……うわ。きみ、すごく通りがいい。澱に好かれる体質だ。森人の言葉で言うと「灯りの器」。めったにいないよ、こういう人間。')];
          if (a > 1.05) return say('noin', 'うん、素直な流れ。練習すれば、それなりに使えるようになるよ。');
          return say('noin', 'うーん、ちょっと詰まってるね。でも、詰まってる人の方が理屈をよく考えるから、いい術者になったりもする。');
        },
        say('noin', '術式っていうのは、頭の中に組む文法みたいなもの。魔力はその文法に沿って流れる。まずは、体の中の魔力を感じるところから。瞑想でも、ここでの練習でもいい。'),
        say('noin', 'この本、貸してあげる。書き込みは気にしないで。'),
      ],
      effect: (s) => {
        s.flags.magicIntro = true;
        s.items.book_magic = 1;
        rel(s, 'noin', 'affinity', 3);
        log(s, 'ノインに魔法の手ほどきを受け、『術式の文法』を借りた。');
      },
    },
  },
  {
    id: 'sample',
    label: '何か手伝えることはないか聞く',
    once: true,
    cond: (s) => used(s, 'noin', 'tide'),
    node: {
      lines: [
        say('noin', 'ある。すごくある。'),
        say('noin', '潮計の調整に、森の澱溜まりの泥が要るんだ。新しいやつ。森の縁の、北の窪地に小さな澱溜まりがある。そこの泥を、この瓶に詰めてきてほしい。'),
        say('noin', 'ギルドを通して正式に依頼を出しておくよ。報酬は……あんまり出せないけど。'),
      ],
      effect: (s) => {
        s.flags.noinQuest = true;
        rel(s, 'noin', 'trust', 2);
        log(s, 'ノインから、澱溜まりの泥の採取を頼まれた。');
      },
    },
  },
  {
    id: 'forestfolk',
    label: '森人のことを聞く',
    once: true,
    cond: (s) => R_(s, 'noin').trust >= 16,
    node: {
      lines: [
        say('noin', '森人のこと？　うーん。退屈な人たちだよ。'),
        say('noin', '清林っていう、澱の届かない森の奥に住んでる。澱のことは「森の病」って呼んで、触れることも話すことも禁じてる。'),
        say('noin', '私は、病なら治し方を調べるべきだと思った。そう言ったら、出ていけって。'),
        n('ノインは笑っていた。けれど、手元の硝子瓶を磨く指が、いつまでも止まらなかった。'),
        say('noin', '……百年経ったら、帰れるかな。'),
      ],
      effect: (s) => {
        rel(s, 'noin', 'trust', 3);
        rel(s, 'noin', 'affinity', 2);
        remember(s, 'noin', 'folk:listened', '森人の一族を出た話を聞いた。');
      },
    },
  },
];

// ───────── 共通 ─────────

export function trainingDays(s: GameState): number {
  const days = new Set<number>();
  for (const [k, v] of Object.entries(s.repetition)) {
    if (k.startsWith('sword:') || k.startsWith('body:') || k.startsWith('bow:')) for (const d of v) days.add(d);
  }
  return days.size + (s.counters.trainDaysOld ?? 0);
}

function impression(s: GameState, id: string, name: string): string[] {
  const r = s.npcs[id].rel;
  const out: string[] = [];
  if (r.trust > 30) out.push(`${name}は、{I}を頼りにしてくれているようだ。`);
  else if (r.trust > 12) out.push(`${name}は、少しずつ{I}に心を開いてきている気がする。`);
  if (r.respect > 25) out.push(`${name}は、{I}の力を認めている。`);
  else if (r.respect > 10) out.push(`${name}は、{I}のことを見直しはじめているようだ。`);
  if (r.affinity > 25) out.push(`${name}と一緒にいると、気安い空気が流れる。`);
  else if (r.affinity < -10) out.push(`${name}には、どうも嫌われているらしい。`);
  if (r.wariness > 15) out.push(`${name}は、{I}をどこか警戒している。`);
  if (r.rivalry > 15) out.push(`${name}は、{I}を強く意識している。`);
  else if (r.rivalry > 6) out.push(`${name}は、{I}に負けたくないと思っているようだ。`);
  if (r.debt > 15) out.push(`${name}とは、言葉にしにくい縁で結ばれている。`);
  if (out.length === 0) out.push(`${name}とは、まだ顔見知り程度だ。`);
  return out;
}

export const NPCS: NpcDef[] = [
  {
    id: 'garad',
    name: 'ガラド',
    where: (s) => {
      if (!s.npcs.garad.alive) return null;
      if (s.flags.garadQuit && !s.flags.garadReturned) return s.slot === 3 ? 'inn' : s.slot >= 1 ? 'gate' : null;
      if (s.slot <= 2) return s.day % 7 === 0 ? null : 'training';
      return s.day % 3 === 0 ? 'inn' : null;
    },
    profile: (s) => [
      '訓練場の教官。元銀級の冒険者。右膝に古傷がある。',
      ...(s.flags.garadPast1 ? ['七年前の大潮で、パーティー「赤錆の鎚」の仲間を失っている。'] : []),
      ...(s.flags.tagRevealed ? ['七年前、ソラムを救ったのは彼だった。'] : []),
      ...impression(s, 'garad', 'ガラド'),
    ],
    greet: (s) => {
      const c = closeness(s, 'garad');
      if (s.slot === 3) return [n('灯り亭の隅の席で、ガラドが一人で杯を傾けていた。'), say('garad', c > 15 ? '……座れ。' : '何だ。')];
      if (s.cond.injuries.length) return [say('garad', 'その傷はどうした。……まあいい。何の用だ。')];
      return [say('garad', c > 20 ? '来たか。' : c > 5 ? '何だ。' : '……用件を言え。')];
    },
    topics: garadTopics,
  },
  {
    id: 'lyne',
    name: 'リーネ',
    where: (s) => {
      if (s.flags.lyneLeft) return null;
      if (s.slot === 0) return 'training';
      if (s.slot === 1) return s.day % 2 ? 'guild' : 'training';
      if (s.slot === 2) return s.day % 3 === 0 ? 'market' : 'training';
      return 'inn';
    },
    profile: (s) => [
      '同じ日に仮登録した同期。灯り亭に泊まっている。剣の腕は確か。',
      ...(used(s, 'lyne', 'family') ? ['王都の小貴族アーデル家の庶子。家に認められたいと願っている。'] : []),
      ...(s.flags.lyneInjured ? ['左腕に深い傷を負った。'] : []),
      ...impression(s, 'lyne', 'リーネ'),
    ],
    greet: (s) => {
      const r = s.npcs.lyne.rel;
      if (s.slot === 3) return [n('食堂でリーネが煮込みをつついていた。'), say('lyne', r.affinity > 15 ? 'あ、来た。座りなさいよ。' : '何？')];
      return [say('lyne', r.rivalry > 10 ? '今日も来たのね。負けないわよ。' : r.affinity > 15 ? 'ああ、あなた。どうしたの？' : '何か用？')];
    },
    topics: lyneTopics,
  },
  {
    id: 'sera',
    name: 'セラ',
    where: (s) => (s.slot <= 2 ? 'guild' : null),
    profile: (s) => [
      'ギルドの受付職員。規則に厳しい。',
      ...(used(s, 'sera', 'draft') ? ['新人保護規定の草案を、一人で書き続けている。'] : []),
      ...(s.flags.knowLeon ? ['弟のレオンを、七年前の大潮で亡くしている。'] : []),
      ...impression(s, 'sera', 'セラ'),
    ],
    greet: (s) => {
      const t = s.npcs.sera.rel.trust;
      if (s.flags.lastQuestFailed) return [say('sera', '……先日の依頼の件は、記録に残っています。それで、ご用件は。')];
      return [say('sera', t > 20 ? 'あら、{name}さん。どうしました？' : t > 8 ? 'こんにちは。ご用件は？' : 'ご用件をどうぞ。')];
    },
    topics: seraTopics,
  },
  {
    id: 'noin',
    name: 'ノイン',
    where: (s) => {
      if (!s.npcs.noin.met) return null;
      if (s.slot === 1 || s.slot === 2) return 'institute';
      if (s.slot === 0 && s.day % 4 === 1) return 'market';
      return null;
    },
    profile: (s) => [
      '魔導院カルナス分室の研究員。森人。見た目は若いが、六十を超えているらしい。',
      ...(used(s, 'noin', 'tide') ? ['澱潮の研究をしている。今年の大潮は記録より大きくなると考えている。'] : []),
      ...(used(s, 'noin', 'forestfolk') ? ['澱の研究を禁じる一族を出て、ここに来た。'] : []),
      ...impression(s, 'noin', 'ノイン'),
    ],
    greet: (s) => [say('noin', s.npcs.noin.rel.affinity > 12 ? 'やあ、きみ。ちょうどいいところに。' : 'ん？　ああ、きみか。')],
    topics: noinTopics,
  },
];

