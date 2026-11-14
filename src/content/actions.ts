// 行動の定義。場所 → 活動 → 方法 → 重点 の順に組み立てる。
// 描写は主人公の現在の能力によって変わる（成長を言葉で伝えるための中心的な仕組み）。
import type { ActivityDef, MethodDef } from '../engine/defs';
import type { GameState, Line, StatKey } from '../engine/types';
import { gain } from '../engine/growth';
import { band, clamp, skill } from '../engine/stats';
import { chance, pick, rand } from '../engine/rng';
import { log } from '../engine/game';
import { R } from '../engine/registry';
import { n, say } from '../engine/text';
import { rel } from '../engine/npc';

const tire = (s: GameState, v: number) => (s.cond.fatigue = clamp(s.cond.fatigue + v, 0, 100));
const byBand = (v: number, texts: string[]) => texts[Math.min(texts.length - 1, band(v))];

/** 疲れているときの一言 */
function fatigueLine(s: GameState): Line | null {
  if (s.cond.fatigue > 85) return n('体が鉛のように重い。これ以上無理をすれば、どこかを痛めそうだ。');
  if (s.cond.fatigue > 65) return n('疲れが溜まっている。動きの一つ一つに、いつもより力が要る。');
  return null;
}

/** 疲労が極端なときの怪我 */
function strainRisk(s: GameState, lines: Line[]) {
  if (s.cond.fatigue > 85 && chance(s, 0.3)) {
    s.cond.injuries.push({ id: `strain${s.day}`, label: '筋を痛めた右腕', severity: 1, days: 4 });
    lines.push(n('嫌な音がして、右腕に鋭い痛みが走った。筋を痛めたらしい。'));
    log(s, '無理をして、腕を痛めた。');
  }
}

function withExtras(s: GameState, lines: (Line | null)[]): Line[] {
  const f = fatigueLine(s);
  const out = lines.filter((l): l is Line => !!l);
  if (f) out.push(f);
  return out;
}

// ───────── 訓練場 ─────────

const swordFocus = [
  { id: 'down', label: '振り下ろし' },
  { id: 'sweep', label: '薙ぎ払い' },
  { id: 'thrust', label: '突き' },
];

const training: ActivityDef[] = [
  {
    id: 'sword',
    loc: 'training',
    label: '剣の稽古',
    methods: [
      {
        id: 'swing',
        label: '素振り',
        desc: '木剣を繰り返し振る。基本の形と腕の力が身につく。',
        focuses: swordFocus,
        run: (s, { focus }) => {
          const sw = s.stats.sword_p;
          gain(s, 'sword_p', 1.6, { difficulty: 16, key: `sword:swing:${focus}` });
          gain(s, 'str', 0.7, { difficulty: 22, key: 'body:swing' });
          gain(s, 'end', 0.3, { difficulty: 20 });
          tire(s, 16);
          const part = swordFocus.find((f) => f.id === focus)?.label ?? '素振り';
          log(s, `訓練場で${part}の素振りをした。`);
          const lines = withExtras(s, [
            n(`木剣を握り、${part}を繰り返す。`),
            n(
              byBand(sw, [
                '数十回で腕が上がらなくなった。剣先が勝手に流れていく。',
                '回数を重ねるうちに、剣の重さに振り回されることが減ってきた。',
                '刃筋が通るときの音が分かる。空気を裂く、短く鋭い音だ。',
                '一振りごとに、余計な力を削ぎ落としていく。もう基本の素振りで得るものは少ないかもしれない。',
                '素振りは、もはや確認作業に近い。体が覚えた形を、なぞるだけだ。',
              ]),
            ),
          ]);
          strainRisk(s, lines);
          return lines;
        },
      },
      {
        id: 'kata',
        label: '型の練習',
        desc: '攻防の流れを型としてなぞる。動きの意味を考えながら。',
        focuses: [
          { id: 'guard', label: '受けからの返し' },
          { id: 'step', label: '足運び' },
          { id: 'combo', label: '連続技' },
        ],
        run: (s, { focus }) => {
          gain(s, 'sword_p', 1.2, { difficulty: 26, key: `sword:kata:${focus}` });
          gain(s, 'sword_t', 0.9, { difficulty: 22, key: `sword:kata:${focus}` });
          if (focus === 'step') gain(s, 'agi', 0.6, { difficulty: 24 });
          else gain(s, 'focus', 0.4, { difficulty: 20 });
          tire(s, 12);
          log(s, '型の練習をした。');
          return withExtras(s, [
            n('訓練場の隅で、教わった型を一つずつなぞる。'),
            n(
              byBand(s.stats.sword_t, [
                'どうしてこの順番で動くのか、さっぱり分からない。とにかく形だけを追う。',
                '受けてから返すまでの間。足を置く位置。少しずつ、型の「理由」が見えてきた。',
                '型の中に、実戦の一場面が閉じ込められているのが分かる。相手の姿を思い浮かべながら動く。',
                '型を崩し、また組み直す。自分の体に合わせた形が見えてきた。',
              ]),
            ),
          ]);
        },
      },
      {
        id: 'spar',
        label: '模擬戦',
        desc: '居合わせた冒険者と木剣で打ち合う。痛いが、実戦に近い。',
        companions: true,
        run: (s, { companion }) => {
          const partner = companion ? R.npcs.get(companion)?.name : undefined;
          const diff = companion === 'lyne' ? 28 : companion === 'garad' ? 45 : 22;
          gain(s, 'sword_p', 1.5, { difficulty: diff, key: `sword:spar:${companion ?? 'x'}`, kind: 'combat' });
          gain(s, 'agi', 0.6, { difficulty: diff });
          gain(s, 'will', 0.3, { difficulty: diff });
          tire(s, 20);
          const mine = skill(s, 'sword');
          const win = mine + s.stats.agi * 0.3 > diff * 0.9 + rand(s) * 10;
          s.cond.hp = clamp(s.cond.hp - (win ? 3 : 8), 1, 100);
          s.counters.spars = (s.counters.spars ?? 0) + 1;
          if (companion) {
            rel(s, companion, 'affinity', 1.5);
            if (companion === 'lyne') rel(s, 'lyne', 'rivalry', win ? 3 : 1);
            if (win) rel(s, companion, 'respect', 2);
          }
          log(s, partner ? `${partner}と模擬戦をした。` : '訓練場で模擬戦をした。');
          const who = partner ?? pick(s, ['髭面の銅級冒険者', '同じ宿の新人', '槍使いの男']);
          return withExtras(s, [
            n(`${who}と、木剣で打ち合った。`),
            n(
              win
                ? byBand(mine, ['何度か打ち込まれたが、一本だけ取り返せた。', '打ち合いの中で、相手の癖が見えた。そこを突いた。', '相手の剣が止まって見える瞬間があった。'])
                : byBand(mine, ['ほとんど一方的に打ち込まれた。腕も脇腹も痣だらけだ。', '何度か惜しいところまで行ったが、最後は押し切られた。', '紙一重で負けた。何が足りなかったのか、考えながら木剣を返した。']),
            ),
          ]);
        },
      },
      {
        id: 'lesson',
        label: 'ガラドに教えを請う',
        desc: '教官に直接見てもらう。厳しいが、得るものは大きい。',
        cond: (s) => s.npcs.garad.met && R.npcs.get('garad')!.where(s) === 'training',
        focuses: [
          { id: 'basic', label: '基本を見てもらう' },
          { id: 'defense', label: '守りを教わる' },
          { id: 'reading', label: '相手の読み方を教わる', cond: (s) => s.npcs.garad.rel.respect >= 10 },
        ],
        run: (s, { focus }) => {
          const g = s.npcs.garad.rel;
          const willing = g.respect + g.trust >= 0 && s.cond.fatigue < 90;
          tire(s, 22);
          log(s, 'ガラドに稽古をつけてもらった。');
          if (!willing) {
            return [say('garad', '……顔を洗って出直せ。今のお前に教えることはない。'), n('ガラドは背を向けた。')];
          }
          const q = 1.25 + Math.min(g.respect, 40) / 100;
          gain(s, 'sword_p', 1.4, { difficulty: s.stats.sword_p + 12, quality: q, kind: 'mentor', key: `sword:lesson:${focus}` });
          gain(s, 'sword_t', 0.8, { difficulty: s.stats.sword_t + 10, quality: q, kind: 'mentor' });
          if (focus === 'defense') gain(s, 'end', 0.6, {});
          if (focus === 'reading') {
            gain(s, 'beast_t', 0.5, {});
            gain(s, 'wit', 0.6, { quality: q });
          }
          rel(s, 'garad', 'respect', s.cond.fatigue > 60 ? 2.5 : 1.5);
          rel(s, 'garad', 'trust', 0.8);
          s.counters.lessons = (s.counters.lessons ?? 0) + 1;
          const lines: Line[] = [];
          if (focus === 'defense') {
            lines.push(say('garad', '攻めは誰でも覚える。生き残る奴は受けを覚えた奴だ。'));
            lines.push(n('ガラドの木剣が、肩、脇、膝と、守りの空いたところを容赦なく叩いてくる。'));
          } else if (focus === 'reading') {
            lines.push(say('garad', '剣を見るな。肩と腰を見ろ。人も魔物も、動く前に必ずどこかが先に動く。'));
            lines.push(n('ガラドがゆっくりと打ち込む。その寸前、確かに肩がわずかに沈むのが見えた。'));
          } else {
            lines.push(say('garad', '構えろ。……違う。足の幅が広すぎる。'));
            lines.push(n('足の位置、肘の角度、視線。ガラドは一つ一つ、短い言葉で直していく。'));
          }
          lines.push(
            n(
              byBand(s.stats.sword_p, [
                '言われたことの半分も体が追いつかない。それでも、ガラドは最後まで付き合ってくれた。',
                '「悪くない」とは一度も言われなかった。ただ、直される回数は確かに減った。',
                'ガラドの打ち込みに、何度か遅れずに反応できた。彼の眉がわずかに動いた。',
                'ガラドが、少しだけ本気で打ち込んできた気がする。',
              ]),
            ),
          );
          return withExtras(s, lines);
        },
      },
    ],
  },
  {
    id: 'body',
    loc: 'training',
    label: '体づくり',
    methods: [
      {
        id: 'run',
        label: '走り込み',
        desc: '城壁沿いを走る。持久力と脚が鍛えられる。',
        run: (s) => {
          gain(s, 'end', 1.3, { difficulty: 26, key: 'body:run' });
          gain(s, 'agi', 0.5, { difficulty: 22, key: 'body:run' });
          gain(s, 'will', 0.3, { difficulty: 18 });
          tire(s, 22);
          log(s, '城壁沿いを走った。');
          return withExtras(s, [
            n('訓練場を出て、城壁沿いの道を走る。'),
            n(byBand(s.stats.end, ['半周もしないうちに、脇腹が刺すように痛んだ。', '一周を走りきった。息は荒いが、まだ足は動く。', '二周目に入っても、呼吸が乱れない。', '城壁を三周しても、まだ走れる気がした。'])),
          ]);
        },
      },
      {
        id: 'lift',
        label: '筋力鍛錬',
        desc: '砂袋や石を使って、全身を鍛える。',
        run: (s) => {
          gain(s, 'str', 1.4, { difficulty: 26, key: 'body:lift' });
          gain(s, 'end', 0.4, { difficulty: 22 });
          tire(s, 20);
          log(s, '筋力の鍛錬をした。');
          const lines = withExtras(s, [
            n('砂袋を担ぎ、石を持ち上げ、腕立てを繰り返す。'),
            n(byBand(s.stats.str, ['砂袋が肩に食い込む。三往復で膝が笑った。', '砂袋の重さに慣れてきた。次はもう少し重いものを担げそうだ。', '石を持ち上げたまま、しばらく静止していられる。', 'ここにある砂袋では、もう物足りない。'])),
          ]);
          strainRisk(s, lines);
          return lines;
        },
      },
      {
        id: 'agility',
        label: '身のこなし',
        desc: '杭を並べた足場を跳び移り、転がり、身をかわす練習。',
        run: (s) => {
          gain(s, 'agi', 1.3, { difficulty: 26, key: 'body:agi' });
          gain(s, 'dex', 0.5, { difficulty: 20 });
          tire(s, 16);
          log(s, '身のこなしの練習をした。');
          return withExtras(s, [
            n('杭の上を跳び移り、砂の上を転がり、吊るした丸太をかわす。'),
            n(byBand(s.stats.agi, ['丸太にまともにぶつかって、砂の上にひっくり返った。', '何度か丸太をかわせた。', '丸太の動きが、ゆっくり見えはじめた。', '目を閉じていても、風の音で丸太をかわせる。'])),
          ]);
        },
      },
    ],
  },
  {
    id: 'bow',
    loc: 'training',
    label: '弓の練習',
    methods: [
      {
        id: 'shoot',
        label: '備え付けの弓で的を射る',
        desc: '訓練場の古い弓を借りて、藁の的を狙う。',
        run: (s) => {
          gain(s, 'bow_p', 1.5, { difficulty: 18, key: 'bow:shoot' });
          gain(s, 'dex', 0.5, { difficulty: 20 });
          gain(s, 'focus', 0.5, { difficulty: 20 });
          tire(s, 12);
          log(s, '弓の練習をした。');
          return withExtras(s, [
            n('弦を引き、藁の的を狙う。'),
            n(byBand(s.stats.bow_p, ['矢は的のはるか上を飛んでいった。弦で腕の内側を打って、赤く腫れた。', '十本のうち三本が的に当たった。', '的の中心に、矢が集まりはじめた。', '放つ前に、当たるかどうかが分かる。'])),
          ]);
        },
      },
    ],
  },
];

// ───────── 灯り亭 ─────────

const books: { item: string; stat: StatKey; second: StatKey; label: string; text: string[] }[] = [
  { item: 'book_sword', stat: 'sword_t', second: 'lore', label: '『剣理初歩』', text: ['図を眺めても、どこが大事なのかよく分からない。', '間合いと拍子の章が面白い。昼に見たガラドの動きが思い出される。', '書かれていない行間が読めるようになってきた。'] },
  { item: 'book_beast', stat: 'beast_t', second: 'lore', label: '『灰縁魔物誌』', text: ['知らない魔物の名前ばかりで、頭に入ってこない。', '澱狼の項を読み返す。肩の結晶は硬く、剣が通らない、とある。', '記録の書き手ごとの癖まで分かる。誰が実際に戦い、誰が伝聞で書いたのか。'] },
  { item: 'book_herb', stat: 'herb_t', second: 'lore', label: '『辺境薬草手引』', text: ['似たような葉の絵ばかりで、見分けがつかない。', '月光草と偽月草の見分け方を覚えた。葉の裏の筋の数が違う。', '薬効の組み合わせ方が分かってきた。'] },
  { item: 'book_magic', stat: 'magic_t', second: 'wit', label: '『術式の文法』', text: ['記号の羅列にしか見えない。ノインの書き込みのほうがよほど読みやすい。', '術式には文法がある。主語、述語、修飾。言葉と同じだ。', '古い術式の欠けた部分を、自分で補えそうな気がする。'] },
];

const inn: ActivityDef[] = [
  {
    id: 'meal',
    loc: 'inn',
    label: '食事',
    methods: [
      {
        id: 'hearty',
        label: 'しっかり食べる（5銅貨）',
        desc: 'マルタの煮込みを腹いっぱい食べる。疲れが取れる。',
        cond: (s) => s.money >= 5,
        run: (s) => {
          s.money -= 5;
          s.cond.fed = true;
          tire(s, -18);
          s.cond.stress = clamp(s.cond.stress - 6, 0, 100);
          log(s, '灯り亭で食事をとった。');
          return [n('マルタの煮込みは、肉より豆の方が多い。それでも温かく、腹の底から力が湧いてくる。'), say('マルタ', pick(s, ['ほら、もっと食べな。体が資本なんだから。', '顔色が悪いね。ちゃんと寝てるのかい。', 'あんたぐらいの頃の冒険者はね、みんな食べるのも仕事のうちさ。']))];
        },
      },
    ],
  },
  {
    id: 'rest',
    loc: 'inn',
    label: '休む',
    methods: [
      {
        id: 'nap',
        label: '部屋で体を休める',
        desc: '横になって疲れを抜く。',
        run: (s) => {
          tire(s, -28);
          s.cond.stress = clamp(s.cond.stress - 10, 0, 100);
          s.cond.hp = clamp(s.cond.hp + 6, 0, 100);
          log(s, '部屋で休んだ。');
          return [n('硬い寝台に体を横たえる。窓の外から、市場の喧騒が遠く聞こえる。'), n(s.cond.fatigue > 40 ? '少し眠った。まだ体は重いが、動けないほどではない。' : '体の芯から疲れが抜けていった。')];
        },
      },
      {
        id: 'think',
        label: '考えごとをする',
        desc: 'これまでのことを振り返り、頭を整理する。',
        run: (s) => {
          s.cond.stress = clamp(s.cond.stress - 14, 0, 100);
          gain(s, 'will', 0.4, { key: 'mind:think' });
          gain(s, 'wit', 0.4, { key: 'mind:think' });
          tire(s, -8);
          log(s, '部屋で考えごとをした。');
          return [n('窓辺に座って、ここ数日のことを思い返す。'), n(s.items.oldtag ? '気がつくと、古い認識票を指で撫でていた。' : '答えの出ない問いが、いくつも浮かんでは消えた。')];
        },
      },
    ],
  },
  {
    id: 'study',
    loc: 'inn',
    label: '読書',
    cond: (s) => books.some((b) => s.items[b.item]),
    methods: [],
    dynamic: (s) =>
      books
        .filter((b) => s.items[b.item])
        .map<MethodDef>((b) => ({
          id: b.item,
          label: `${b.label}を読む`,
          desc: '部屋で本を開く。夜に読むと寝不足になる。',
          late: true,
          run: (st) => {
            const v = st.stats[b.stat];
            gain(st, b.stat, 1.5, { difficulty: 24, key: `${b.stat.split('_')[0]}:read:${b.item}` });
            gain(st, b.second, 0.5, { difficulty: 20 });
            gain(st, 'focus', 0.3, {});
            tire(st, 6);
            log(st, `${b.label}を読んだ。`);
            return [n(`${b.label}を開く。`), n(b.text[Math.min(2, Math.floor(v / 15))])];
          },
        })),
  },
  {
    id: 'selftrain',
    loc: 'inn',
    label: '自主鍛錬',
    methods: [
      {
        id: 'meditate',
        label: '瞑想',
        desc: '目を閉じ、呼吸に意識を向ける。心を整え、集中力を養う。',
        late: true,
        run: (s) => {
          gain(s, 'focus', 1.0, { difficulty: 22, key: 'mind:meditate' });
          gain(s, 'will', 0.6, { difficulty: 22, key: 'mind:meditate' });
          if (s.flags.magicIntro) gain(s, 'magic_p', 0.8, { difficulty: 18, key: 'magic:meditate' });
          s.cond.stress = clamp(s.cond.stress - 8, 0, 100);
          log(s, '瞑想をした。');
          return [
            n('寝台の上で足を組み、目を閉じる。'),
            n(
              s.flags.magicIntro
                ? byBand(s.stats.magic_p, ['ノインに教わった通り、体の中の魔力を探す。……何も感じない。いや、指先がかすかに温かい気もする。', '胸の奥に、小さな火種のようなものがある。それを指先へ導く。', '魔力の流れが、呼吸に合わせて体を巡るのが分かる。'])
                : byBand(s.stats.focus, ['雑念ばかりが浮かぶ。腹が減った。明日の依頼。ガラドの顔。', 'しばらくの間、呼吸の音だけが聞こえていた。', '意識が澄んでいく。部屋の空気の流れまで感じられた。']),
            ),
          ];
        },
      },
      {
        id: 'pushups',
        label: '部屋で筋力鍛錬',
        desc: '狭い部屋でもできる腕立てや腹筋。',
        run: (s) => {
          gain(s, 'str', 0.8, { difficulty: 18, key: 'body:room' });
          gain(s, 'end', 0.6, { difficulty: 18, key: 'body:room' });
          tire(s, 12);
          log(s, '部屋で体を鍛えた。');
          return [n('床板を軋ませながら、腕立てと腹筋を繰り返す。'), n('隣の部屋から壁を叩かれた。')];
        },
      },
    ],
  },
];

// ───────── 市場 ─────────

const SHOP = ['bread', 'salve', 'book_sword', 'book_beast', 'book_herb', 'ironsword'];

const market: ActivityDef[] = [
  {
    id: 'shop',
    loc: 'market',
    label: '買い物',
    methods: [],
    dynamic: (s) =>
      SHOP.map((id) => R.items.get(id)!)
        .filter((it) => !(it.id.startsWith('book_') && s.items[it.id]) && !(it.id === 'ironsword' && s.items.ironsword))
        .map<MethodDef>((it) => ({
          id: `buy:${it.id}`,
          label: `${it.name}（${it.price}銅貨）`,
          desc: it.desc,
          cond: (st) => st.money >= (it.price ?? 0),
          slots: 0,
          run: (st) => {
            st.money -= it.price ?? 0;
            st.items[it.id] = (st.items[it.id] ?? 0) + 1;
            log(st, `${it.name}を買った。`);
            return [n(`${it.name}を買った。`)];
          },
        })),
  },
  {
    id: 'sell',
    loc: 'market',
    label: '売る',
    cond: (s) => (s.items.herb ?? 0) > 0,
    methods: [
      {
        id: 'herbs',
        label: '薬草を売る',
        desc: '薬草売りの老婆が買い取ってくれる。',
        slots: 0,
        run: (s) => {
          const cnt = s.items.herb ?? 0;
          const price = 3 + (s.stats.herb_p > 15 ? 2 : 0);
          s.money += cnt * price;
          s.items.herb = 0;
          log(s, '薬草を売った。');
          return [n(`薬草を${cnt}束売って、${cnt * price}銅貨になった。`), say('老婆', s.stats.herb_p > 15 ? '摘み方がいいね。根が生きてる。' : '葉がちぎれてるねえ。まあ、買ってはあげるよ。')];
        },
      },
    ],
  },
  {
    id: 'stroll',
    loc: 'market',
    label: '市場を歩く',
    methods: [
      {
        id: 'browse',
        label: '人々を眺めながら歩く',
        desc: '噂話に耳を傾ける。街のことが分かる。',
        run: (s) => {
          gain(s, 'empathy', 0.6, { key: 'social:stroll' });
          gain(s, 'lore', 0.3, { key: 'social:stroll' });
          s.cond.stress = clamp(s.cond.stress - 5, 0, 100);
          log(s, '東市場を歩いた。');
          return [n('露店の間を縫うように歩く。'), n(rumor(s))];
        },
      },
      {
        id: 'herbstall',
        label: '薬草の露店を覗く',
        desc: '薬草売りの老婆に、草の見分け方を聞く。',
        run: (s) => {
          gain(s, 'herb_t', 1.0, { difficulty: 16, key: 'herb:stall' });
          gain(s, 'speech', 0.3, {});
          log(s, '薬草の露店で話を聞いた。');
          return [n('干した薬草が軒先にぶら下がった露店。'), say('老婆', pick(s, ['月光草はね、昼に探しても見つからないよ。葉の裏が銀色のやつさ。', '血止め草とヨモギモドキを間違える若いのが多くてねえ。茎の断面を見な。四角いのが本物だよ。', '澱の溜まった土に生えた草は、効きが強すぎて毒になる。森の奥のは摘むんじゃないよ。']))];
        },
      },
    ],
  },
  {
    id: 'work',
    loc: 'market',
    label: '日雇い仕事',
    methods: [
      {
        id: 'haul',
        label: '荷運び（2時間帯）',
        desc: '商会の倉庫で荷を運ぶ。きついが、確実に稼げる。',
        slots: 2,
        run: (s) => {
          const pay = 18 + Math.floor(s.stats.str / 4);
          s.money += pay;
          gain(s, 'str', 1.2, { difficulty: 24, key: 'body:haul' });
          gain(s, 'end', 1.0, { difficulty: 24, key: 'body:haul' });
          tire(s, 32);
          log(s, `ベルク商会の倉庫で荷運びをして、${pay}銅貨を稼いだ。`);
          return withExtras(s, [n('ベルク商会の倉庫で、魔導灯の燃料になる魔核の木箱を運ぶ。'), n(`日が傾く頃、${pay}銅貨を受け取った。肩が焼けるように痛い。`)]);
        },
      },
    ],
  },
];

function rumor(s: GameState): string {
  const pool = [
    '「最近、魔核の値が上がってるらしい」「王都で新しい魔導灯が流行ってるんだと」',
    '「守備隊の連中、また酒場で冒険者と揉めたってよ」',
    '「東門の外で、狼の遠吠えが増えたって話だ」',
    '魚屋の主人が、七年前の大潮の話をしている。「あんときゃ、この市場まで狼が入ってきたんだ」',
    '子供たちが「森人だ、森人だ」と囃し立てながら、路地のほうへ走っていく。',
  ];
  if (s.day > 20) pool.push('「森の縁で、でかい熊の足跡を見たって奴がいる」');
  if (s.day > 25) pool.push('「今年は潮の年だろ。七年ぶりの」「縁起でもねえ」');
  if (s.flags.tideRising && !s.seen.great_tide) {
    pool.length = 0;
    pool.push('「魔核の値が跳ね上がってる。今のうちに森で稼がなきゃ損だ」', '露店の主人たちが、夜は店を早じまいすると話している。', '「門の外の開拓村の連中、街に避難しなくて大丈夫なのか」');
    if (s.flags.guildPrepared) pool.push('「ギルドが森の奥での狩りを禁止したってよ。森人の予言を真に受けたらしい」');
  }
  if (s.seen.great_tide !== undefined) {
    pool.push(s.flags.alphaSlain ? '「大潮の夜、群れ長を倒した新人がいたらしい」' : '「群れ長は、まだ森のどこかで生きてるらしい」');
    pool.push(s.flags.gateHeavy ? '東門の外の墓地に、新しい墓標が並んでいる。花売りの娘が、白い花ばかり売れると言っていた。' : '「門の前に柵がなかったら、今頃どうなってたか」');
  }
  return pick(s, pool);
}

// ───────── 魔導院分室 ─────────

const institute: ActivityDef[] = [
  {
    id: 'library',
    loc: 'institute',
    label: '書庫で調べもの',
    methods: [
      {
        id: 'beasts',
        label: '魔物の記録を読む',
        desc: '分室が集めた魔物の観察記録。',
        run: (s) => {
          gain(s, 'beast_t', 1.4, { difficulty: 26, key: 'beast:lib' });
          gain(s, 'lore', 0.5, { difficulty: 24 });
          log(s, '分室の書庫で魔物の記録を読んだ。');
          return [n('埃をかぶった観察記録を読む。'), n(byBand(s.stats.beast_t, ['専門用語ばかりで、半分も分からない。', '澱が濃い土地の魔物ほど、体の結晶が大きいらしい。', '記録を読みながら、森で見た狼の姿が重なった。']))];
        },
      },
      {
        id: 'tides',
        label: '澱潮の記録を読む',
        desc: '過去の潮の記録。ノインが集めたものらしい。',
        cond: (s) => s.npcs.noin.met,
        run: (s) => {
          gain(s, 'lore', 1.0, { difficulty: 26, key: 'lore:tides' });
          gain(s, 'wit', 0.8, { difficulty: 26, key: 'lore:tides' });
          s.counters.tideStudy = (s.counters.tideStudy ?? 0) + 1;
          log(s, '過去の澱潮の記録を読んだ。');
          const c = s.counters.tideStudy;
          return [
            n('ノインの几帳面な字で整理された、百年分の澱潮の記録。'),
            n(
              c < 3
                ? '数字の羅列だ。潮の日付、目撃された魔物の数、被害。'
                : c < 5
                  ? 'おかしい。大潮のたびに、記録された魔物の数が増えている。偶然だろうか。'
                  : '大潮の規模は、回を追うごとに大きくなっている。その増え方には、ある種の規則性がある。ノインが恐れているのはこれだ。',
            ),
          ];
        },
      },
    ],
  },
  {
    id: 'magic',
    loc: 'institute',
    label: '魔力の練習',
    cond: (s) => !!s.flags.magicIntro,
    methods: [
      {
        id: 'channel',
        label: '魔力を指先に集める',
        desc: 'ノインに教わった基礎の練習。',
        run: (s) => {
          gain(s, 'magic_p', 1.5, { difficulty: 18, key: 'magic:channel' });
          gain(s, 'focus', 0.6, { difficulty: 20 });
          tire(s, 14);
          log(s, '魔力の練習をした。');
          if (s.stats.magic_p >= 12 && !s.flags.knowsSpark && chance(s, 0.5)) {
            s.flags.knowsSpark = true;
            log(s, '指先から、初めて火花が散った。');
            return [n('意識を指先に集める。熱が集まり、ぱちん、と小さな音がした。'), n('火花だ。指先から、確かに火花が散った。'), say('noin', 'お。できたね。それが一番簡単な術。使いみちは、まあ、焚き火の火付けと、狼の鼻先を焦がすくらいかな。')];
          }
          return [n('術式を頭の中に描き、魔力を指先へ導く。'), n(byBand(s.stats.magic_p, ['何も起きない。額に汗がにじむだけだ。', '指先がほんのりと温かくなった。', '指先で、小さな光が揺れた。', '魔力が、思った形に素直に流れていく。']))];
        },
      },
    ],
  },
];

// ───────── 東門 ─────────

/** 仲間と一緒に行動したときの関係の変化 */
function withPartner(s: GameState, id: string) {
  rel(s, id, 'affinity', 1.5);
  rel(s, id, 'trust', 1);
  s.counters[`with:${id}`] = (s.counters[`with:${id}`] ?? 0) + 1;
}

const gate: ActivityDef[] = [
  {
    id: 'wall',
    loc: 'gate',
    label: '城壁に上る',
    methods: [
      {
        id: 'watch',
        label: '森を眺める',
        desc: '見張り台から灰縁の森を見渡す。',
        run: (s) => {
          gain(s, 'survival_t', 0.6, { key: 'survival:watch' });
          gain(s, 'beast_t', 0.3, { key: 'survival:watch' });
          s.cond.stress = clamp(s.cond.stress - 4, 0, 100);
          log(s, '城壁の上から森を眺めた。');
          return [n('城壁の上から、灰縁の森が見渡せる。'), n(s.slot === 3 ? '夜の森は暗い。ところどころで、澱溜まりが青白く光っている。' : '森の上には、いつも灰色の霞がかかっている。あれが澱の気配なのだと、見張りの兵士が教えてくれた。')];
        },
      },
    ],
  },
  {
    id: 'forest',
    loc: 'gate',
    label: '森の縁へ出る',
    cond: (s) => s.day >= 4 && s.slot <= 1,
    methods: [
      {
        id: 'gather',
        label: '薬草を採る（2時間帯）',
        desc: '森の浅いところで薬草を探す。魔物に出くわすこともある。',
        slots: 2,
        companions: true,
        warn: (s, { companion }) =>
          (s.counters.rescued ?? 0) >= 1 && !companion ? '一度、助けられている。一人で倒れたら、次は誰も来ないかもしれない。' : null,
        run: (s, { companion }) => {
          gain(s, 'herb_p', 1.4, { difficulty: 20, key: 'herb:gather' });
          gain(s, 'survival_p', 1.0, { difficulty: 20, key: 'survival:gather' });
          tire(s, 18);
          const skillv = s.stats.herb_p + s.stats.herb_t * 0.5;
          const found = 1 + Math.floor(skillv / 6) + (chance(s, 0.5) ? 1 : 0);
          s.items.herb = (s.items.herb ?? 0) + found;
          log(s, `森の縁で薬草を${found}束摘んだ。`);
          const risk = s.flags.tideRising ? 0.45 : 0.3;
          if (chance(s, risk)) {
            s.flags._encounter = s.day > 6 && chance(s, s.flags.tideRising ? 0.7 : 0.4) ? 'wolf' : 'rat';
            if (companion) s.flags._encounterComp = companion;
          }
          if (companion) withPartner(s, companion);
          return [
            n(companion ? `${R.npcs.get(companion)?.name}と二人で東門を出て、森の縁の草地を歩く。` : '東門を出て、森の縁の草地を歩く。木々の向こうは昼でも薄暗い。'),
            n(`薬草を${found}束摘んだ。`),
            ...(s.flags.tideRising ? [n('森の奥から、絶えず獣の気配がする。潮が満ちてきているのだ。')] : []),
          ];
        },
      },
      {
        id: 'hunt',
        label: '魔物を探して狩る（2時間帯）',
        desc: '魔核を得るため、自分から魔物を探す。危険を伴う。',
        cond: (s) => s.rank >= 1,
        slots: 2,
        companions: true,
        warn: (s, { companion }) =>
          (s.counters.rescued ?? 0) >= 1 && !companion ? '一度、助けられている。一人で倒れたら、次は誰も来ないかもしれない。' : null,
        run: (s, { companion }) => {
          gain(s, 'survival_p', 1.2, { difficulty: 24, key: 'survival:hunt' });
          tire(s, 14);
          log(s, companion ? `${R.npcs.get(companion)?.name}と森の縁で魔物を探した。` : '森の縁で魔物を探した。');
          const r = s.stats.survival_p + s.stats.beast_p;
          s.flags._encounter = chance(s, s.flags.tideRising ? 0.35 : 0.25) ? 'boar' : chance(s, 0.7) ? 'wolf' : 'rat';
          if (companion) {
            s.flags._encounterComp = companion;
            withPartner(s, companion);
          }
          return [n('森の縁に分け入り、獣道をたどる。'), n(r > 30 ? '折れた枝、踏まれた草。足跡を見つけた。新しい。' : 'しばらく歩き回るうちに、茂みの向こうで何かが動いた。')];
        },
      },
    ],
  },
  {
    id: 'nightwatch',
    loc: 'gate',
    label: '城壁の夜警',
    cond: (s) => !!s.flags.tideRising && s.rank >= 1 && s.slot === 3 && !s.seen.great_tide,
    methods: [
      {
        id: 'watch',
        label: '夜警に加わる（報酬20銅貨）',
        desc: '潮の間、ギルドが守備隊の夜警に人を出している。寝不足になる。',
        late: true,
        run: (s) => {
          s.money += 20;
          gain(s, 'will', 0.8, { difficulty: 24, key: 'mind:nightwatch' });
          gain(s, 'focus', 0.6, { difficulty: 24, key: 'mind:nightwatch' });
          gain(s, 'survival_t', 0.6, { difficulty: 22 });
          gain(s, 'beast_t', 0.5, { difficulty: 22 });
          tire(s, 18);
          s.counters.nightwatch = (s.counters.nightwatch ?? 0) + 1;
          log(s, '城壁の夜警に立った。');
          if (chance(s, 0.25)) {
            s.flags._encounter = 'wolf';
            s.flags._encounterSafe = true;
            return [n('篝火の明かりの外で、何かが城壁をよじ登ろうとしている。'), say('守備隊の兵士', '狼だ！　一匹、壁の上に来るぞ！')];
          }
          return [
            n('篝火の脇で、守備隊の兵士たちと並んで夜の森を見張る。'),
            n(pick(s, ['森の奥で、青白い光が明滅している。澱溜まりが脈打つように光る。', '一晩中、どこかで狼の遠吠えが続いていた。', '兵士の一人が、七年前の大潮の夜の話をしてくれた。門が破られかけたこと。冒険者たちが門の前で踏みとどまったこと。'])),
          ];
        },
      },
    ],
  },
];

export const ACTIVITIES: ActivityDef[] = [...training, ...inn, ...market, ...institute, ...gate];
