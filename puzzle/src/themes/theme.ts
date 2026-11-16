// テーマ＝見た目と文言だけ。ルールは色番号しか知らない。
// 将来「バス」テーマなどを追加するときは、このインターフェースを満たすものを作る。

export interface Kind {
  name: string;     // 例：マグロ
  mark: string;     // 色に頼らず区別するための1文字
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
    { name: 'マグロ', mark: '鮪', color: '#d8374a', light: '#f36b7a', dark: '#8f1e2c' },
    { name: '玉子', mark: '玉', color: '#f2be2c', light: '#ffe07a', dark: '#a87d0c' },
    { name: 'かっぱ巻き', mark: '胡', color: '#3f9e4f', light: '#79d184', dark: '#21612b' },
    { name: 'サーモン', mark: '鮭', color: '#f0843a', light: '#ffb37a', dark: '#a6501a' },
    { name: 'イカ', mark: '烏', color: '#e9edf1', light: '#ffffff', dark: '#9aa4ae' },
    { name: 'サバ', mark: '鯖', color: '#3d6fb8', light: '#7ea6e6', dark: '#1f3f73' },
    { name: 'エビ', mark: '海', color: '#ef8fb5', light: '#ffc2da', dark: '#a8466f' },
    { name: 'ウニ', mark: '雲', color: '#8b5bb7', light: '#b994de', dark: '#53307a' },
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
