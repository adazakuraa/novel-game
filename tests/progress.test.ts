import { describe, expect, it } from 'vitest';
import { loadContent, NPC_IDS } from '../src/content';
import { createGame } from '../src/engine/creation';
import { advance, choose, combatAct, doAction, proceed, sceneView } from '../src/engine/game';
import { merit } from '../src/engine/progress';
import type { GameState } from '../src/engine/types';

loadContent();

function settle(s: GameState) {
  for (let i = 0; i < 200 && (s.scene || s.combat); i++) {
    if (s.combat) { combatAct(s, 'attack'); continue; }
    const v = sceneView(s)!;
    if (v.choices.length) choose(s, v.choices[0].index); else proceed(s);
  }
}

describe('long-term goals', () => {
  it('merit opens the copper exam, and winning promotes', () => {
    const s = createGame({ name: 't', gender: 'x', pronoun: '私', mode: 'standard', seed: 4 }, NPC_IDS);
    s.day = 30; s.slot = 0; s.rank = 1; s.location = 'guild';
    for (const k of ['sword_p', 'agi', 'str', 'end'] as const) s.stats[k] = 70;
    s.counters.questDone = 4;
    s.counters['kill:wolf'] = 3;
    expect(merit(s)).toBeGreaterThanOrEqual(50);
    doAction(s, 'exam', 'copper');
    settle(s);
    expect(s.rank).toBe(2);
  });

  it('a chosen ambition records milestones at night', () => {
    const s = createGame({ name: 't', gender: 'x', pronoun: '私', mode: 'standard', seed: 4 }, NPC_IDS);
    s.day = 20; s.slot = 3;
    s.flags.ambition = 'blade';
    s.stats.sword_t = 13;
    for (const ev of ['prologue', 'orientation']) s.seen[ev] = 1;
    advance(s, 1);
    settle(s);
    expect(s.flags['ms:b1']).toBeDefined();
    expect(s.journal.at(-1)!.text.some((t) => t.includes('剣の道'))).toBe(true);
  });
});
