// 進行と設定の保存（ブラウザの localStorage）。アカウント不要。
// 読み書きに失敗しても（プライベートモードなど）ゲームは遊べるようにする。

export type Speed = 'normal' | 'fast' | 'off';

export interface ModeProgress {
  cleared: number[];                         // クリアしたステージ番号
  current?: { stage: number; moves: number[] }; // 遊んでいる途中の手順（同じ手順を再生すれば同じ局面になる）
}

export interface SaveData {
  v: 1;
  modes: Record<string, ModeProgress>;
  settings: { speed: Speed };
}

export const KEY = 'omachido.v1';

export const empty = (): SaveData => ({ v: 1, modes: {}, settings: { speed: 'normal' } });

export interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

function store(): Store | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function load(s: Store | null = store()): SaveData {
  try {
    const raw = s?.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw);
    if (d?.v !== 1 || typeof d.modes !== 'object') return empty();
    return { ...empty(), ...d, settings: { ...empty().settings, ...d.settings } };
  } catch {
    return empty();
  }
}

export function save(d: SaveData, s: Store | null = store()) {
  try { s?.setItem(KEY, JSON.stringify(d)); } catch { /* 保存できなくても続行 */ }
}

export function reset(s: Store | null = store()) {
  try { s?.removeItem(KEY); } catch { /* noop */ }
}

export function progress(d: SaveData, mode: string): ModeProgress {
  return d.modes[mode] ?? { cleared: [] };
}

/** ステージは1から順番。クリアした最大番号の次まで遊べる */
export function unlockedUpTo(p: ModeProgress, total: number): number {
  let n = 1;
  while (p.cleared.includes(n) && n < total) n++;
  return n;
}

export function markCleared(d: SaveData, mode: string, stage: number): SaveData {
  const p = progress(d, mode);
  const cleared = p.cleared.includes(stage) ? p.cleared : [...p.cleared, stage].sort((a, b) => a - b);
  return { ...d, modes: { ...d.modes, [mode]: { cleared, current: undefined } } };
}

export function setCurrent(d: SaveData, mode: string, cur: ModeProgress['current']): SaveData {
  const p = progress(d, mode);
  return { ...d, modes: { ...d.modes, [mode]: { ...p, current: cur } } };
}
