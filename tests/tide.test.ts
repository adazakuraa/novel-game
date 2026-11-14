import { describe, expect, it } from 'vitest';
import { loadContent, NPC_IDS } from '../src/content';
import { createGame } from '../src/engine/creation';
import { advance, choose, combatAct, proceed, sceneView } from '../src/engine/game';
import type { GameState } from '../src/engine/types';

loadContent();

function setup(flags: Record<string, boolean | number | string>, strong = true) {
  const s = createGame({ name: 't', gender: 'x', pronoun: '私', mode: 'standard', seed: 5 }, NPC_IDS);
  s.day = 78;
  s.slot = 2;
  s.rank = 1;
  for (const id of NPC_IDS) s.npcs[id].met = true;
  Object.assign(s.flags, flags);
  if (strong) for (const k of ['sword_p', 'agi', 'str', 'end'] as const) s.stats[k] = 70;
  return s;
}

/** 大潮の夜を、選択肢のラベルで進める */
function run(s: GameState, pickText: string) {
  advance(s, 1);
  expect(s.scene && s.scene.kind === 'event' && s.scene.ev).toBe('great_tide');
  for (let i = 0; i < 400 && (s.scene || s.combat) && s.day === 78; i++) {
    if (s.combat) { combatAct(s, 'attack'); continue; }
    const v = sceneView(s)!;
    if (v.choices.length) {
      const c = v.choices.find((x) => x.text.includes(pickText)) ?? v.choices[0];
      choose(s, c.index);
    } else proceed(s);
  }
  return s;
}

describe('great tide', () => {
  it('chasing south with no preparation costs Garad his life', () => {
    const s = run(setup({}), '南へ走る');
    expect(s.flags.tideChoice).toBe('chase');
    expect(s.flags.garadDied).toBe(true);
    expect(s.flags.villageSaved).toBe('hero');
  });
  it('holding the gate keeps Garad alive but the village burns without the garrison', () => {
    const s = run(setup({}), '門を守る');
    expect(s.flags.garadDied).toBeUndefined();
    expect(s.flags.villageBurned).toBe(true);
  });
  it('trusting Lyne saves the village while the hero holds the gate', () => {
    const s = setup({ lyneParty: true, lyneStays: true, guildPrepared: true });
    run(s, 'リーネ');
    expect(s.flags.villageSaved).toBe('lyne');
    expect(s.flags.gateHeavy).toBe(false);
  });
  it('the next morning brings promotion', () => {
    const s = run(setup({ guildPrepared: true, garrisonPrepared: true }), '門を守る');
    for (let i = 0; i < 50 && s.scene; i++) {
      const v = sceneView(s)!;
      if (v.choices.length) choose(s, v.choices[0].index); else proceed(s);
    }
    expect(s.seen.tide_after).toBeDefined();
    expect(s.rank).toBe(2);
  });
});
