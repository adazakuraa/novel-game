import { describe, expect, it } from 'vitest';
import { empty, KEY, load, markCleared, progress, save, setCurrent, unlockedUpTo, type Store } from '../src/core/save';

function mem(): Store & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

describe('保存', () => {
  it('保存したものを読み戻せる', () => {
    const s = mem();
    const d = setCurrent(markCleared(empty(), 'queue', 1), 'queue', { stage: 2, moves: [3, 4] });
    save(d, s);
    expect(load(s)).toEqual(d);
  });
  it('壊れたデータ・古い形式・保存できない環境でも初期状態で遊べる', () => {
    const s = mem();
    s.m.set(KEY, '{壊れた');
    expect(load(s)).toEqual(empty());
    s.m.set(KEY, JSON.stringify({ v: 0 }));
    expect(load(s)).toEqual(empty());
    expect(load(null)).toEqual(empty());
    const bad: Store = { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); }, removeItem: () => {} };
    expect(load(bad)).toEqual(empty());
    expect(() => save(empty(), bad)).not.toThrow();
  });
  it('クリアすると途中の手順は消え、同じステージを何度クリアしても重複しない', () => {
    let d = setCurrent(empty(), 'queue', { stage: 1, moves: [1] });
    d = markCleared(markCleared(d, 'queue', 1), 'queue', 1);
    expect(progress(d, 'queue')).toEqual({ cleared: [1], current: undefined });
  });
});

describe('ステージの解放', () => {
  it('1から順番に、クリアした次のステージまで遊べる', () => {
    expect(unlockedUpTo({ cleared: [] }, 60)).toBe(1);
    expect(unlockedUpTo({ cleared: [1, 2, 3] }, 60)).toBe(4);
    expect(unlockedUpTo({ cleared: [1, 3] }, 60)).toBe(2);
    expect(unlockedUpTo({ cleared: Array.from({ length: 60 }, (_, i) => i + 1) }, 60)).toBe(60);
  });
});
