import { it } from 'vitest';
import { loadContent, NPC_IDS } from '../src/content';
import { createGame } from '../src/engine/creation';
import { beginGame, choose, doAction, proceed, sceneView, combatAct } from '../src/engine/game';
import { availableMoves } from '../src/engine/combat';
import type { GameState } from '../src/engine/types';

loadContent();

function settle(s: GameState) {
  let g = 0;
  while ((s.scene || s.combat) && g++ < 200) {
    if (s.combat) { combatAct(s, availableMoves(s)[0].id); continue; }
    const v = sceneView(s)!;
    if (v.choices.length) choose(s, v.choices[0].index); else proceed(s);
  }
}

it('focused sword training curve', () => {
  for (const seed of [5, 6, 7]) {
    const s = createGame({ name: 'b', gender: 'x', pronoun: '私', mode: 'standard', seed }, NPC_IDS);
    beginGame(s);
    const out: string[] = [`talents=${s.hero.talents} start sword=${s.stats.sword_p.toFixed(1)}`];
    while (s.day <= 60) {
      settle(s);
      if (s.slot === 3) doAction(s, 'rest', 'nap');
      else if (s.slot === 2) doAction(s, 'sword', 'kata', { focus: ['guard', 'step', 'combo'][s.day % 3] });
      else doAction(s, 'sword', s.day % 2 ? 'swing' : 'spar', { focus: ['down', 'sweep', 'thrust'][s.day % 3] });
      settle(s);
      if ([10, 20, 30, 45, 60].includes(s.day) && s.slot === 0) out.push(`d${s.day}: sword_p=${s.stats.sword_p.toFixed(1)} t=${s.stats.sword_t.toFixed(1)} walls=${s.wallsBroken.sword} str=${s.stats.str.toFixed(1)}`);
    }
    console.log(out.join('\n'));
  }
});
