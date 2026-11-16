// 寿司テーマの絵。すべて SVG で描く（画像ファイル不要）。立体感はグラデーションと影で出す。
import type { Theme } from './theme';

/** グラデーションの定義（画面に1回だけ置く） */
export function ArtDefs({ theme }: { theme: Theme }) {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {theme.kinds.map((k, i) => (
          <>
            <linearGradient id={`kb${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color={k.light} />
              <stop offset="0.45" stop-color={k.color} />
              <stop offset="1" stop-color={k.dark} />
            </linearGradient>
            <linearGradient id={`kt${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color={k.light} />
              <stop offset="0.6" stop-color={k.color} />
              <stop offset="1" stop-color={k.dark} />
            </linearGradient>
          </>
        ))}
        <radialGradient id="skin" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stop-color="#ffe6cf" />
          <stop offset="1" stop-color="#e9b48b" />
        </radialGradient>
        <linearGradient id="rice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="1" stop-color="#d9d4c7" />
        </linearGradient>
        <radialGradient id="plate" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="0.75" stop-color="#e8e3d8" />
          <stop offset="1" stop-color="#b9b1a1" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** お客さん。服の色＝注文のネタ。胸の札の文字で色に頼らず区別できる */
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
      <circle cx="50" cy="80" r="11" fill="#fffaf0" stroke={k.dark} stroke-width="2" />
      <text x="50" y="85" text-anchor="middle" font-size="14" font-weight="700" fill={k.dark === '#9aa4ae' ? '#4a5560' : k.dark}>{k.mark}</text>
    </svg>
  );
}

/** にぎり寿司を皿にのせた絵 */
export function Plate({ theme, kind, small }: { theme: Theme; kind: number; small?: boolean }) {
  const k = theme.kinds[kind];
  return (
    <svg viewBox="0 0 100 100" class="art">
      <ellipse cx="50" cy="62" rx="46" ry="30" fill="rgba(0,0,0,.2)" transform="translate(0 4)" />
      <ellipse cx="50" cy="60" rx="46" ry="30" fill="url(#plate)" stroke="#a79d8a" stroke-width="1.5" />
      <ellipse cx="50" cy="60" rx="34" ry="21" fill="none" stroke="#2f4f86" stroke-width="2.5" opacity=".55" />
      <rect x="24" y="48" width="52" height="22" rx="11" fill="url(#rice)" stroke="#c9c2b2" stroke-width="1" />
      <path d="M20 52 C24 36 76 34 80 50 C80 58 70 60 50 60 C30 60 20 59 20 52 Z" fill={`url(#kt${kind})`} stroke={k.dark} stroke-width="1.5" />
      {kind === 1 || kind === 2 ? <rect x="44" y="38" width="12" height="30" rx="2" fill="#1e2a22" opacity=".92" /> : (
        <path d="M32 48 L40 41 M44 51 L53 41 M57 51 L65 42" stroke="rgba(255,255,255,.55)" stroke-width="2.5" stroke-linecap="round" />
      )}
      {!small && (
        <g>
          <circle cx="86" cy="30" r="11" fill="#fffaf0" stroke={k.dark} stroke-width="2" />
          <text x="86" y="35" text-anchor="middle" font-size="13" font-weight="700" fill={k.dark === '#9aa4ae' ? '#4a5560' : k.dark}>{k.mark}</text>
        </g>
      )}
    </svg>
  );
}

/** のれん：中で待っている客の色を順番に並べて見せる */
export function Noren({ theme, queue, dir }: { theme: Theme; queue: number[]; dir: string }) {
  const arrow = { u: 'M50 6 L42 16 L58 16 Z', d: 'M50 94 L42 84 L58 84 Z', l: 'M6 50 L16 42 L16 58 Z', r: 'M94 50 L84 42 L84 58 Z' }[dir];
  return (
    <svg viewBox="0 0 100 100" class="art">
      <rect x="8" y="8" width="84" height="84" rx="10" fill="#27325a" stroke="#141a33" stroke-width="2" />
      <path d="M8 18 H92" stroke="#c9a85a" stroke-width="4" />
      <path d="M36 20 V90 M64 20 V90" stroke="#141a33" stroke-width="2" />
      <path d={arrow} fill="#f2dfa8" />
      {queue.slice(0, 4).map((c, i) => (
        <g>
          <circle cx={22 + i * 19} cy="56" r={i === 0 ? 9 : 7} fill={theme.kinds[c].color} stroke="#fff" stroke-width="1.5" />
          <text x={22 + i * 19} y="60" text-anchor="middle" font-size={i === 0 ? 10 : 8} font-weight="700" fill="#1b1b1b">{theme.kinds[c].mark}</text>
        </g>
      ))}
      <text x="50" y="84" text-anchor="middle" font-size="12" fill="#f2dfa8" font-weight="700">あと{queue.length}</text>
    </svg>
  );
}
