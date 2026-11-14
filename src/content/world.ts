import type { EnemyDef, ItemDef, LocationDef } from '../engine/defs';
import { clamp } from '../engine/stats';

const day = (slot: number) => slot <= 2;

export const LOCATIONS: LocationDef[] = [
  {
    id: 'inn',
    name: '灯り亭',
    desc: '新人冒険者が集まる宿。一階の食堂からは、いつも煮込みの匂いがする。',
  },
  {
    id: 'guild',
    name: '冒険者ギルド',
    desc: '石造りの三階建て。依頼の掲示板の前には、朝から人だかりができている。',
    open: day,
  },
  {
    id: 'training',
    name: '訓練場',
    desc: 'ギルドの裏手にある砂地の広場。木人形と、使い込まれた木剣が並んでいる。',
    open: day,
  },
  {
    id: 'market',
    name: '東市場',
    desc: '露店がひしめく通り。魔核の買い取り屋、薬草売り、怪しげな骨董屋。',
    open: day,
  },
  {
    id: 'institute',
    name: '魔導院分室',
    desc: '路地の奥の、蔦に覆われた古い建物。看板の文字はかすれて読めない。',
    cond: (s) => !!s.flags.knowInstitute,
    open: (slot) => slot === 1 || slot === 2,
  },
  {
    id: 'gate',
    name: '東門',
    desc: '灰縁の森へ通じる大門。門の向こうには、灰色の霞がかかった森が地平まで続いている。',
  },
];

export const ITEMS: ItemDef[] = [
  {
    id: 'bread',
    name: '黒パン',
    desc: '固いが腹持ちはいい。',
    price: 3,
    use: {
      label: '食べる',
      run: (s) => {
        s.cond.fatigue = clamp(s.cond.fatigue - 6, 0, 100);
        s.cond.fed = true;
        return '固い黒パンをかじる。少し力が戻った。';
      },
    },
  },
  {
    id: 'salve',
    name: '傷薬',
    desc: '薬草を練った軟膏。傷口に塗れば痛みが引く。',
    price: 25,
    use: {
      label: '塗る',
      inCombat: true,
      run: (s) => {
        s.cond.hp = clamp(s.cond.hp + 25, 0, 100);
        return '傷薬を傷口に押し付けた。染みるような痛みの後、熱が引いていく。';
      },
    },
  },
  { id: 'oldsword', name: '古い長剣', desc: '中古屋で買った剣。刃こぼれはあるが、まだ使える。' },
  { id: 'ironsword', name: '鍛鉄の剣', desc: '東市場の鍛冶屋が打った新品の剣。重心がいい。', price: 380 },
  { id: 'book_sword', name: '『剣理初歩』', desc: '王都の剣術道場が出している教本。図が多い。', price: 60 },
  { id: 'book_beast', name: '『灰縁魔物誌』', desc: 'カルナスのギルドが編んだ、森の魔物の記録。', price: 90 },
  { id: 'book_herb', name: '『辺境薬草手引』', desc: '薬草の見分け方と効き目をまとめた小冊子。', price: 40 },
  { id: 'book_magic', name: '『術式の文法』', desc: 'ノインが貸してくれた、書き込みだらけの古い教本。' },
  { id: 'core', name: '魔核', desc: '魔物の体内で澱が凝った結晶。ギルドが買い取ってくれる。' },
  { id: 'moonherb', name: '月光草', desc: '夜にだけ淡く光る薬草。依頼の品。' },
  { id: 'herb', name: '薬草', desc: 'ありふれた傷薬の材料。市場で少しは売れる。' },
  { id: 'oldtag', name: '古い認識票', desc: '曲がった青銅の札。「G」の一文字が刻まれている。七年前から、ずっと持っている。' },
  { id: 'stone', name: '標石の欠片', desc: '旧街道の遺構で拾った石柱の欠片。断面に、髪の毛ほどの細い線が無数に走っている。' },
  { id: 'sample', name: '澱の試料', desc: 'ノインに頼まれた、澱溜まりの泥を詰めた硝子瓶。' },
];

const wolfState = (r: number) =>
  r > 0.75 ? '澱狼は低く唸り、灰色の毛を逆立てている。' :
  r > 0.45 ? '澱狼の脇腹に血がにじんでいる。それでも目の光は鋭い。' :
  r > 0.2 ? '澱狼の息が荒い。足取りが乱れはじめた。' :
  '澱狼は片足を引きずり、それでも牙を剥いている。';

export const ENEMIES: EnemyDef[] = [
  {
    id: 'rat',
    name: '澱鼠',
    loreKey: 'rat',
    level: 5,
    hp: 16,
    power: 5,
    speed: 9,
    armor: 0,
    intro: '猫ほどの大きさの鼠が、黒く濁った目でこちらを見ている。背中の毛の間から、灰色の結晶が覗いていた。',
    intents: [
      { id: 'bite', tell: ['鼠が身を縮めた。', '鼠が後ろ足に力を溜めている。飛びかかってくる。'], read: '噛みつく直前、鼠は必ず髭を伏せる。', type: 'heavy', power: 1.2, range: 1, weight: (d) => (d <= 1 ? 3 : 1) },
      { id: 'scratch', tell: ['鼠がちょろちょろと動いた。', '鼠が前足を振り上げた。引っかく気だ。'], read: '浅い攻撃だ。受ければいい。', type: 'light', power: 0.7, range: 1, weight: () => 2 },
      { id: 'scurry', tell: ['鼠が素早く走り回っている。', '鼠が物陰へ回り込もうとしている。'], read: '回り込まれる前に向きを合わせればいい。', type: 'reposition', range: 3, weight: () => 1.5 },
    ],
    state: (r) => (r > 0.6 ? '澱鼠は甲高く鳴いた。' : r > 0.3 ? '澱鼠の動きが鈍ってきた。' : '澱鼠はふらついている。'),
    fleeAt: 0.25,
    loot: [{ item: 'core', chance: 0.3 }],
  },
  {
    id: 'wolf',
    name: '澱狼',
    loreKey: 'wolf',
    level: 15,
    hp: 34,
    power: 10,
    speed: 17,
    armor: 1,
    intro: '木々の間から、灰色の狼が姿を現した。普通の狼よりひと回り大きく、肩のあたりの毛皮が石のように硬く盛り上がっている。',
    intents: [
      { id: 'pounce', tell: ['狼が頭を低くした。', '狼が低く身構え、後ろ足に力を溜めている。跳びかかってくる。'], read: '大きく跳ぶ分、着地の後に隙ができる。かわせば好機だ。', type: 'heavy', power: 1.5, range: 2, weight: (d) => (d <= 2 ? 3 : 0.5) },
      { id: 'snap', tell: ['狼が唸った。', '狼が牙を剥き、鼻先を突き出してきた。噛みつく気だ。'], read: '速いが浅い。剣を立てて受ければ防げる。', type: 'light', power: 0.8, range: 1, weight: (d) => (d <= 1 ? 3 : 0) },
      { id: 'circle', tell: ['狼が動いた。', '狼が円を描くように横へ回り込んでいく。'], read: '死角を取りに来ている。目を離すな。', type: 'reposition', range: 3, weight: () => 1.5 },
      { id: 'howl', tell: ['狼が顔を上げた。', '狼が天を仰ぎ、喉を震わせている。'], read: '遠吠えで自分を奮い立たせている。今が打ち込む好機だ。', type: 'call', range: 3, weight: (_, r) => (r < 0.6 ? 1.2 : 0.3) },
      { id: 'back', tell: ['狼が足を止めた。', '狼がじりじりと後ずさっている。'], read: '距離を取って、次の跳躍の機会をうかがっている。', type: 'retreat', range: 3, weight: (d) => (d <= 1 ? 1 : 0.2) },
    ],
    state: wolfState,
    fleeAt: 0.2,
    loot: [{ item: 'core', chance: 0.8 }],
  },
  {
    id: 'boar',
    name: '棘猪',
    loreKey: 'boar',
    level: 19,
    hp: 50,
    power: 14,
    speed: 11,
    armor: 3,
    intro: '藪を押し倒して、巨大な猪が現れた。背中には、澱で硬化した無数の棘が並んでいる。',
    intents: [
      { id: 'charge', tell: ['猪が地面を掻いている。', '猪が前足で地面を掻き、頭を下げた。突進してくる。'], read: '一直線にしか走れない。横へ跳べばかわせる。', type: 'heavy', power: 1.6, range: 3, weight: (d) => (d >= 2 ? 3 : 1) },
      { id: 'tusk', tell: ['猪が首を振った。', '猪が牙を突き上げようとしている。'], read: '重い。受けるより、かわすか退くべきだ。', type: 'heavy', power: 1.0, range: 1, weight: (d) => (d <= 1 ? 2.5 : 0) },
      { id: 'snort', tell: ['猪が鼻を鳴らした。', '猪が鼻息荒く、こちらを睨みつけている。'], read: '気が立っているだけだ。斬り込む好機だ。', type: 'wait', range: 3, weight: () => 1 },
    ],
    state: (r) => (r > 0.6 ? '棘猪は鼻息荒く、地面を踏み鳴らしている。' : r > 0.3 ? '棘猪の棘が何本か折れている。動きが重い。' : '棘猪は血を流し、よろめいている。'),
    fleeAt: 0.15,
    loot: [{ item: 'core', chance: 1 }],
  },
  {
    id: 'bear',
    name: '澱熊',
    loreKey: 'bear',
    level: 34,
    hp: 95,
    power: 22,
    speed: 13,
    armor: 5,
    intro: '倒木の陰から、黒い山が立ち上がった。熊だ。だが大きすぎる。体のあちこちから灰色の結晶が突き出し、片目は濁った光を放っている。',
    intents: [
      { id: 'swipe', tell: ['熊が腕を上げた。', '熊が丸太のような前脚を大きく振りかぶった。'], read: 'まともに受ければ骨が砕ける。受けてはいけない。', type: 'heavy', power: 1.4, range: 1, weight: (d) => (d <= 1 ? 3 : 0) },
      { id: 'rush', tell: ['熊が身を沈めた。', '熊が四つ足になり、地を蹴ろうとしている。'], read: '巨体の割に速い。距離があっても届く。', type: 'heavy', power: 1.2, range: 3, weight: (d) => (d >= 2 ? 3 : 0.5) },
      { id: 'roar', tell: ['熊が口を開いた。', '熊が後ろ脚で立ち上がり、咆哮しようとしている。'], read: '威嚇だ。この間に距離を取れる。', type: 'call', range: 3, weight: () => 1 },
    ],
    state: (r) => (r > 0.7 ? '澱熊はびくともしていない。' : r > 0.4 ? '澱熊の毛皮が裂け、黒い血が滴っている。' : '澱熊の息が荒い。だが、その目は怒りで燃えている。'),
    loot: [{ item: 'core', chance: 1 }],
  },
  {
    id: 'garad_spar',
    name: 'ガラド',
    loreKey: 'garad',
    level: 28,
    hp: 40,
    power: 7,
    speed: 15,
    armor: 2,
    intro: 'ガラドは木剣を片手でぶら下げたまま、構えもせずに立っている。それなのに、どこにも打ち込める隙が見えない。',
    intents: [
      { id: 'thrust', tell: ['ガラドの肩がわずかに動いた。', 'ガラドの切っ先がこちらの喉元に向いた。突いてくる。'], read: '突きは速いが、引き戻しが遅い。かわせば懐が空く。', type: 'heavy', power: 1.3, range: 2, weight: () => 2 },
      { id: 'tap', tell: ['ガラドが木剣を軽く振った。', 'ガラドが小手を狙って、軽く打ち込んでくる。'], read: '試しているだけだ。受ければいい。', type: 'light', power: 0.8, range: 1, weight: (d) => (d <= 1 ? 2.5 : 0) },
      { id: 'step', tell: ['ガラドが一歩動いた。', 'ガラドが悪い足を庇いながら、横へ回り込む。'], read: '右膝を庇っている。右へ回られると、彼は踏ん張りがきかない。', type: 'reposition', range: 3, weight: () => 1.5 },
      { id: 'wait', tell: ['ガラドは動かない。', 'ガラドは動かず、こちらの出方を見ている。'], read: '誘っている。だが、待ちすぎるのも試験では評価されないだろう。', type: 'wait', range: 3, weight: () => 1 },
    ],
    state: (r) => (r > 0.6 ? 'ガラドの呼吸は乱れていない。' : r > 0.3 ? 'ガラドの額に汗が浮いている。' : 'ガラドが右膝を庇っている。'),
  },
  {
    id: 'lyne_spar',
    name: 'リーネ',
    loreKey: 'lyne',
    level: 16,
    hp: 30,
    power: 6,
    speed: 16,
    armor: 1,
    intro: 'リーネは木剣を正眼に構えた。教本通りの、きれいな構えだ。',
    intents: [
      { id: 'cut', tell: ['リーネが踏み込んできた。', 'リーネが大きく踏み込み、上段から振り下ろしてくる。'], read: '型通りの面打ち。癖で、打つ前に必ず息を吸う。', type: 'heavy', power: 1.2, range: 2, weight: () => 2.5 },
      { id: 'quick', tell: ['リーネの剣先が揺れた。', 'リーネが細かく連続で打ち込んでくる。'], read: '速いが軽い。受けてしまえば怖くない。', type: 'light', power: 0.8, range: 1, weight: (d) => (d <= 1 ? 2 : 0) },
      { id: 'reset', tell: ['リーネが下がった。', 'リーネが距離を取って構えを直している。'], read: '焦っている。構え直す間は無防備だ。', type: 'retreat', range: 3, weight: (_, r) => (r < 0.5 ? 1.5 : 0.5) },
    ],
    state: (r) => (r > 0.6 ? 'リーネはまだ余裕のある顔をしている。' : r > 0.3 ? 'リーネが唇を噛んでいる。' : 'リーネの構えが崩れかけている。'),
  },
];
