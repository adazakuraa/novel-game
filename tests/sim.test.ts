import { describe, expect, it } from 'vitest';
import { loadContent, NPC_IDS } from '../src/content';
import { createGame } from '../src/engine/creation';
import { activitiesAt, choose, combatAct, doAction, locationOpen, methodsOf, npcsAt, proceed, sceneView, talkTo, advance, beginGame } from '../src/engine/game';
import { availableMoves } from '../src/engine/combat';
import { R } from '../src/engine/registry';
import { act, currentNode, exitDungeon, linkOpen, move, search } from '../src/engine/explore';
import { makeRng } from '../src/engine/rng';
import type { GameState } from '../src/engine/types';

loadContent();

function step(s: GameState, r: () => number) {
  if (s.combat) {
    // 警告を無視しない、ふつうの慎重さのプレイヤーを想定する
    const mv = availableMoves(s);
    const warned = s.cond.hp < 30 && s.combat.loseMeansDeath;
    const pickMove = warned ? mv.find((m) => m.id === 'flee')! : mv.filter((m) => m.id !== 'flee')[Math.floor(r() * (mv.length - 1))];
    combatAct(s, pickMove.id);
    return;
  }
  if (s.scene) {
    const v = sceneView(s)!;
    if (v.choices.length) choose(s, v.choices[Math.floor(r() * v.choices.length)].index);
    else proceed(s);
    return;
  }
  if (s.explore) {
    const nd = currentNode(s);
    if (nd.exit && (s.explore.torch <= 2 || r() < 0.15)) return exitDungeon(s);
    const opts: (() => void)[] = nd.links.filter((l) => linkOpen(s, l)).map((l) => () => move(s, l.to));
    if (!s.explore.searched.includes(s.explore.node)) opts.push(() => void search(s));
    if (nd.action && (!nd.action.cond || nd.action.cond(s))) opts.push(() => act(s));
    opts[Math.floor(r() * opts.length)]();
    return;
  }
  const locs = [...R.locations.keys()].filter((l) => locationOpen(s, l));
  const loc = locs[Math.floor(r() * locs.length)];
  const people = npcsAt(s, loc);
  if (people.length && r() < 0.3) {
    talkTo(s, people[0].id);
    return;
  }
  const acts = activitiesAt(s, loc).flatMap((a) => methodsOf(s, a).map((m) => ({ a, m })));
  if (!acts.length) {
    advance(s, 1);
    return;
  }
  const { a, m } = acts[Math.floor(r() * acts.length)];
  const focus = m.focuses?.length ? m.focuses[0].id : undefined;
  doAction(s, a.id, m.id, { focus });
}

describe('simulation', () => {
  for (const seed of [1, 2, 3, 42, 777, 9, 10, 11]) {
    it(`runs 115 days without errors (seed ${seed})`, () => {
      const s = createGame({ name: 'テスト', gender: 'x', pronoun: '私', mode: 'standard', seed }, NPC_IDS);
      beginGame(s);
      const r = makeRng(seed * 13);
      let steps = 0;
      while (s.day <= 115 && !s.dead && steps < 80000) {
        step(s, r);
        steps++;
      }
      expect(steps).toBeLessThan(80000);
      const show = (k: keyof GameState['stats']) => s.stats[k].toFixed(1);
      console.log(
        `seed ${seed}: day ${s.day} dead=${!!s.dead} rank=${s.rank} money=${s.money} sword_p=${show('sword_p')} str=${show('str')} end=${show('end')} magic_p=${show('magic_p')} quests=${s.counters.questDone ?? 0} seen=${Object.keys(s.seen).length}`,
      );
      if (!s.dead) {
        expect(s.seen.great_tide).toBeDefined();
        expect(s.seen.epilogue).toBeDefined();
      }
      console.log(`  ch2: seen=${['ch2_start','aurelia_arrive','godwin_arrive','hans_offer','town_meeting','aq_mural','aq_hall'].filter((k) => s.seen[k] !== undefined).join(',')} affil=${Object.keys(s.affil ?? {}).join(',')} torch=${s.items.torch ?? 0}`);
      console.log(`  tide: choice=${s.flags.tideChoice} prep=${['guildPrepared','garrisonPrepared','ruleAdopted','seraGaradReconciled'].filter((k) => s.flags[k]).join(',')} village=${s.flags.villageSaved} heavy=${s.flags.gateHeavy} garadDied=${!!s.flags.garadDied} lyneLeft=${!!s.flags.lyneLeft} events=${Object.keys(s.seen).length}`);
      for (const k of Object.keys(s.stats)) expect(Number.isFinite(s.stats[k as keyof typeof s.stats])).toBe(true);
    });
  }
});
