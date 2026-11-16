// 寿司テーマの絵。すべて SVG で描く（画像ファイル不要）。
// 見分けやすさを最優先：皿のふちの色（回転寿司の色皿）と、お寿司の形の2つでネタを区別する。
import type { JSX } from 'preact';
import type { Theme } from './theme';

/** グラデーションの定義（画面に1回だけ置く） */
export function ArtDefs({ theme }: { theme: Theme }) {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {theme.kinds.map((k, i) => (
          <linearGradient id={`kb${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color={k.light} />
            <stop offset="0.5" stop-color={k.color} />
            <stop offset="1" stop-color={k.dark} />
          </linearGradient>
        ))}
        <radialGradient id="skin" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stop-color="#ffe6cf" />
          <stop offset="1" stop-color="#e9b48b" />
        </radialGradient>
        <linearGradient id="rice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="1" stop-color="#e2ddd0" />
        </linearGradient>
        <radialGradient id="dish" cx="0.5" cy="0.4" r="0.65">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="1" stop-color="#ece7dc" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** お寿司の形（中心 50,52 に描く） */
const SUSHI: Record<string, () => JSX.Element> = {
  // マグロ：赤いにぎり
  nigiri: () => (
    <g>
      <rect x="27" y="48" width="46" height="18" rx="9" fill="url(#rice)" stroke="#cfc8b8" />
      <path d="M22 50 C26 34 74 33 78 48 C78 56 66 58 50 58 C32 58 22 57 22 50 Z" fill="#d3263b" stroke="#8c1424" stroke-width="2" />
      <path d="M33 46 L41 39 M46 49 L55 39 M59 49 L67 41" stroke="#ff8e9a" stroke-width="3" stroke-linecap="round" />
    </g>
  ),
  // 玉子：黄色い四角に海苔の帯
  tamago: () => (
    <g>
      <rect x="27" y="50" width="46" height="16" rx="8" fill="url(#rice)" stroke="#cfc8b8" />
      <rect x="22" y="34" width="56" height="22" rx="5" fill="#f6c623" stroke="#a77b00" stroke-width="2" />
      <rect x="44" y="30" width="12" height="38" rx="2" fill="#1d2b22" />
    </g>
  ),
  // かっぱ巻：上から見た巻物（緑の芯）
  maki: () => (
    <g>
      <circle cx="50" cy="51" r="21" fill="#1d2b22" />
      <circle cx="50" cy="51" r="16" fill="#ffffff" stroke="#d9d3c4" />
      <circle cx="50" cy="51" r="7" fill="#35b04e" stroke="#1d7a33" stroke-width="2" />
    </g>
  ),
  // いくら軍艦：海苔の筒に、つぶつぶ
  gunkan: () => (
    <g>
      <rect x="26" y="40" width="48" height="26" rx="10" fill="#1d2b22" />
      <ellipse cx="50" cy="41" rx="23" ry="9" fill="#ff7a1a" />
      {[[38, 40], [46, 37], [54, 38], [62, 41], [43, 44], [52, 44], [59, 45]].map(([x, y]) => (
        <circle cx={x} cy={y} r="3.6" fill="#ff9a3a" stroke="#c94f00" stroke-width="1.2" />
      ))}
    </g>
  ),
  // エビ：しま模様としっぽ
  ebi: () => (
    <g>
      <rect x="27" y="48" width="46" height="18" rx="9" fill="url(#rice)" stroke="#cfc8b8" />
      <path d="M24 50 C28 36 70 34 74 46 C74 55 64 58 48 58 C32 58 24 57 24 50 Z" fill="#fff3ea" stroke="#e0603a" stroke-width="2" />
      <path d="M34 40 L36 56 M44 37 L45 58 M54 37 L54 58 M64 39 L63 56" stroke="#f07a4a" stroke-width="3.5" />
      <path d="M72 44 L86 34 L84 50 Z" fill="#e8442a" stroke="#a52a14" stroke-width="1.5" />
    </g>
  ),
  // イカ：白いにぎりに切れ目
  ika: () => (
    <g>
      <rect x="27" y="48" width="46" height="18" rx="9" fill="url(#rice)" stroke="#cfc8b8" />
      <path d="M21 50 C25 35 75 34 79 48 C79 56 66 58 50 58 C32 58 21 57 21 50 Z" fill="#fbfdff" stroke="#8d99a6" stroke-width="2" />
      <path d="M32 44 L68 44 M30 50 L70 50" stroke="#c7d0da" stroke-width="2.5" stroke-dasharray="4 3" />
    </g>
  ),
  // サーモン（予備）
  salmon: () => (
    <g>
      <rect x="27" y="48" width="46" height="18" rx="9" fill="url(#rice)" stroke="#cfc8b8" />
      <path d="M22 50 C26 34 74 33 78 48 C78 56 66 58 50 58 C32 58 22 57 22 50 Z" fill="#ff8a3d" stroke="#b44e10" stroke-width="2" />
      <path d="M32 47 L42 38 M45 50 L56 38 M59 50 L69 40" stroke="#fff1e4" stroke-width="3" stroke-linecap="round" />
    </g>
  ),
  // たまご焼き以外の予備：ウニ軍艦
  uni: () => (
    <g>
      <rect x="26" y="40" width="48" height="26" rx="10" fill="#1d2b22" />
      <ellipse cx="50" cy="41" rx="23" ry="9" fill="#e9a400" />
      <path d="M32 41 Q38 34 44 41 Q50 34 56 41 Q62 34 68 41" fill="none" stroke="#b87a00" stroke-width="3" />
    </g>
  ),
};

/** 色皿にのったお寿司 */
export function Plate({ theme, kind }: { theme: Theme; kind: number; small?: boolean }) {
  const k = theme.kinds[kind];
  const Sushi = SUSHI[k.shape] ?? SUSHI.nigiri;
  return (
    <svg viewBox="0 0 100 100" class="art">
      <ellipse cx="50" cy="58" rx="47" ry="38" fill="rgba(0,0,0,.22)" />
      <ellipse cx="50" cy="52" rx="45" ry="38" fill="url(#dish)" stroke={k.color} stroke-width="11" />
      <ellipse cx="50" cy="52" rx="45" ry="38" fill="none" stroke={k.dark} stroke-width="2" />
      <ellipse cx="50" cy="52" rx="34" ry="27" fill="none" stroke={k.dark} stroke-width="1.5" opacity=".35" />
      <Sushi />
    </svg>
  );
}

/** お客さん。服の色＝注文の皿の色 */
export function Customer({ theme, kind }: { theme: Theme; kind: number }) {
  const k = theme.kinds[kind];
  return (
    <svg viewBox="0 0 100 100" class="art">
      <ellipse cx="50" cy="93" rx="30" ry="6" fill="rgba(0,0,0,.22)" />
      <path d="M18 92 C18 66 30 56 50 56 C70 56 82 66 82 92 Z" fill={`url(#kb${kind})`} stroke={k.dark} stroke-width="2" />
      <path d="M40 57 L50 72 L60 57" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="4" stroke-linejoin="round" />
      <circle cx="50" cy="35" r="20" fill="url(#skin)" stroke="#b9825c" stroke-width="1.5" />
      <path d="M30 33 C30 17 42 12 50 12 C60 12 71 18 70 33 C64 25 56 22 49 22 C42 22 35 26 30 33 Z" fill="#3a2a22" />
      <circle cx="43" cy="38" r="2.2" fill="#3a2a22" />
      <circle cx="57" cy="38" r="2.2" fill="#3a2a22" />
      <path d="M45 46 Q50 49 55 46" fill="none" stroke="#9a5a3c" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}

/** のれん（現在のステージでは未使用。テーマの部品としては残す） */
export function Noren(_: { theme: Theme; queue: number[]; dir: string }) {
  return <svg viewBox="0 0 100 100" class="art"><rect x="8" y="8" width="84" height="84" rx="10" fill="#27325a" /></svg>;
}
