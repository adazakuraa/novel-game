// テーマ＝見た目と文言だけ。ルールは色番号しか知らない。
// 将来「バス」テーマなどを追加するときは、このインターフェースを満たすものを作る。

export interface Kind {
  name: string;     // 例：マグロ
  mark: string;     // 読み上げ・説明用の1文字
  shape: string;    // お寿司の形（色に頼らず区別するため）
  color: string;    // 基本色
  light: string;    // ハイライト
  dark: string;     // 影
}

export interface Theme {
  id: string;
  title: string;
  kinds: Kind[];
  words: {
    next: string;       // このあとのお客さん
    bench: string;      // 置き台
    exit: string;       // 出口
    clear: string;      // クリア時の言葉
    stuckFull: string;  // 置き台がいっぱいで手詰まり
    stuck: string;      // 取れるものが無くて手詰まり
  };
}

export const sushi: Theme = {
  id: 'sushi',
  title: 'おまちどう',
  kinds: [
    // 皿の色は回転寿司の色皿のように、はっきり違う6色を先に使う
    { name: 'マグロ', mark: '鮪', shape: 'nigiri', color: '#d6283a', light: '#f45a69', dark: '#8a1020' },
    { name: '玉子', mark: '玉', shape: 'tamago', color: '#f2b705', light: '#ffd84d', dark: '#9a7300' },
    { name: 'かっぱ巻き', mark: '胡', shape: 'maki', color: '#23a046', light: '#5fd27c', dark: '#0f6128' },
    { name: 'いくら', mark: '鮭', shape: 'gunkan', color: '#2a6fdb', light: '#6aa0ff', dark: '#143f86' },
    { name: 'エビ', mark: '海', shape: 'ebi', color: '#8e44c9', light: '#b77ae8', dark: '#55207e' },
    { name: 'イカ', mark: '烏', shape: 'ika', color: '#2b2b33', light: '#5d5d6a', dark: '#0d0d12' },
    { name: 'サーモン', mark: '鱒', shape: 'salmon', color: '#ff7f2a', light: '#ffab6b', dark: '#a84a0c' },
    { name: 'ウニ', mark: '雲', shape: 'uni', color: '#e75aa0', light: '#ff92c6', dark: '#8e2960' },
  ],
  words: {
    next: 'このあとのお客さん',
    bench: '置き台',
    exit: 'カウンターへ',
    clear: 'ごちそうさま！',
    stuckFull: '置き台がいっぱいで、渡せるお皿がありません',
    stuck: '取れるお皿がありません',
  },
};
