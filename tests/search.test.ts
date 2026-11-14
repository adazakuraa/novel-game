import { describe, expect, it } from 'vitest';
import { loadContent, NPC_IDS } from '../src/content';
import { createGame } from '../src/engine/creation';
import { searchActions } from '../src/engine/search';

loadContent();

function game() {
  const s = createGame({ name: 't', gender: 'x', pronoun: '私', mode: 'standard', seed: 3 }, NPC_IDS);
  s.day = 10;
  s.slot = 1;
  for (const id of NPC_IDS) s.npcs[id].met = true;
  return s;
}

describe('free-text action search', () => {
  const cases: [string, string, string?][] = [
    ['素振りをする', 'sword:swing'],
    ['突きの練習', 'sword:swing', 'thrust'],
    ['足運びを確認したい', 'sword:kata', 'step'],
    ['ちょっと昼寝', 'rest:nap'],
    ['お金を稼ぎたい', 'work:haul'],
    ['城壁沿いを走る', 'body:run'],
    ['魔物について勉強したい', 'library:beasts'],
    ['薬草を摘みに行く', 'forest:gather'],
  ];
  for (const [q, want, focus] of cases) {
    it(`「${q}」→ ${want}`, () => {
      const s = game();
      s.flags.knowInstitute = true;
      const top = searchActions(s, q)[0];
      expect(top, q).toBeDefined();
      expect(`${top.activity}:${top.method}`).toBe(want);
      if (focus) expect(top.focus).toBe(focus);
    });
  }
  it('「リーネと模擬戦」は相手にリーネを選ぶ', () => {
    const s = game();
    s.slot = 0; // リーネは朝、訓練場にいる
    const top = searchActions(s, 'リーネと模擬戦')[0];
    expect(`${top.activity}:${top.method}`).toBe('sword:spar');
    expect(top.companion).toBe('lyne');
  });
  it('「セラと話したい」は会話になる', () => {
    const s = game();
    const top = searchActions(s, 'セラと話したい')[0];
    expect(top.kind).toBe('talk');
    expect(top.npc).toBe('sera');
  });
  it('夜に閉まっている場所は理由つきで示す', () => {
    const s = game();
    s.slot = 3;
    const hit = searchActions(s, '素振り').find((h) => h.method === 'swing');
    expect(hit?.blocked).toBeTruthy();
  });
  it('意味の通らない入力は候補を出さない', () => {
    expect(searchActions(game(), 'ぽぽぽ')).toHaveLength(0);
  });
});
