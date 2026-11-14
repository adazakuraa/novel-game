import { describe, expect, it } from 'vitest';
import { loadContent, NPC_IDS } from '../src/content';
import { createGame } from '../src/engine/creation';
import { advance, choose, combatAct, doAction, proceed, sceneView } from '../src/engine/game';
import { join } from '../src/engine/affil';
import { act, move } from '../src/engine/explore';
import type { GameState } from '../src/engine/types';

loadContent();

function game() {
  const s = createGame({ name: 't', gender: 'x', pronoun: '私', mode: 'standard', seed: 8 }, NPC_IDS);
  s.day = 100;
  s.slot = 0;
  s.flags.chapter1Done = true;
  s.flags.aqueductOpen = true;
  for (const k of ['sword_p', 'agi', 'str', 'end'] as const) s.stats[k] = 70;
  for (const id of NPC_IDS) s.npcs[id].met = true;
  for (const ev of ['ch2_start', 'aurelia_arrive', 'godwin_arrive', 'hans_offer', 'town_meeting', 'noin_offer']) s.seen[ev] = 1;
  return s;
}

function settle(s: GameState) {
  for (let i = 0; i < 200 && (s.scene || s.combat); i++) {
    if (s.combat) { combatAct(s, 'attack'); continue; }
    const v = sceneView(s)!;
    if (v.choices.length) choose(s, v.choices[0].index); else proceed(s);
  }
}

describe('chapter 2 systems', () => {
  it('weekly duty pays, and missing it twice dismisses', () => {
    const s = game();
    s.day = 99;
    join(s, 'garrison');
    s.affil!.garrison.joined = 90;
    const m0 = s.money;
    s.slot = 3;
    doAction(s, 'aff_garrison', 'duty_garrison');
    settle(s);
    s.slot = 3;
    doAction(s, 'aff_garrison', 'duty_garrison');
    settle(s); // 100日目の夜が明けて…
    while (s.day % 7 !== 0 || s.slot !== 3) { advance(s, 1); settle(s); }
    advance(s, 1);
    settle(s);
    expect(s.journal.some((e) => e.text.some((t) => t.includes('守備隊から、今週の給金40銅貨')))).toBe(true);
    void m0;
    // 二週続けて務めを果たさない
    for (let w = 0; w < 2; w++) for (let i = 0; i < 28; i++) { advance(s, 1); settle(s); }
    expect(s.affil?.garrison).toBeUndefined();
    expect(s.flags['dismissed:garrison']).toBeDefined();
  });

  it('the aqueduct can be explored to the hall with Noin\'s help', () => {
    const s = game();
    join(s, 'garrison');
    s.items.torch = 3;
    doAction(s, 'aqueduct', 'enter');
    settle(s);
    expect(s.explore?.node).toBe('stairs');
    for (const to of ['channel', 'junction', 'cistern', 'door']) { move(s, to); settle(s); if (!s.explore) return expect.fail('left early'); }
    act(s); // 扉を調べる → 書き写す
    proceed(s);
    const v = sceneView(s)!;
    choose(s, v.choices.find((c) => c.text.includes('書き写'))!.index);
    settle(s);
    expect(s.flags.needDoorHelp).toBe(true);
    // ノインに解読してもらう（地上で）
    s.explore = null;
    s.flags.doorKey = true;
    s.slot = 0;
    s.items.torch = 3;
    doAction(s, 'aqueduct', 'enter');
    settle(s);
    for (const to of ['channel', 'junction', 'cistern', 'door']) { move(s, to); settle(s); }
    act(s);
    proceed(s);
    const v2 = sceneView(s)!;
    choose(s, v2.choices.find((c) => c.text.includes('ノイン'))!.index);
    settle(s);
    expect(s.flags.doorOpen).toBe(true);
    move(s, 'hall');
    settle(s);
    expect(s.flags.foundHall).toBe(true);
  });

  it('entering without permission is refused', () => {
    const s = game();
    s.rank = 1;
    doAction(s, 'aqueduct', 'denied');
    expect(s.explore).toBeFalsy();
  });
});
