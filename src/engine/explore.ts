// 地下の探索。地点のつながり（ノード）を移動し、松明と時間を消費する。
import type { GameState, Line } from './types';
import type { DLink, DNode, DungeonDef } from './defs';
import { R } from './registry';
import { chance } from './rng';
import { fmt } from './text';
import { startCombat } from './combat';
import { advance, log, startEvent } from './game';

export const TORCH_PER_STICK = 8;

function dungeon(s: GameState): DungeonDef {
  return R.dungeons.get(s.explore!.dungeon)!;
}

export function currentNode(s: GameState): DNode {
  return dungeon(s).nodes[s.explore!.node];
}

export function enterDungeon(s: GameState, id: string, companion?: string) {
  const d = R.dungeons.get(id);
  if (!d) throw new Error(`unknown dungeon ${id}`);
  const sticks = Math.min(3, s.items.torch ?? 0);
  s.items.torch = (s.items.torch ?? 0) - sticks;
  s.explore = { dungeon: id, node: d.start, torch: sticks * TORCH_PER_STICK + 3, visited: [d.start], searched: [], moves: 0, companion };
  s.location = d.surface;
  log(s, `${d.name}に入った。`);
  arrive(s, true);
}

/** 地点に着いたときの処理（物語、遭遇） */
function arrive(s: GameState, first: boolean) {
  const nd = currentNode(s);
  if (first && nd.story && s.seen[nd.story] === undefined) {
    startEvent(s, nd.story);
    return;
  }
  if (nd.encounter) {
    const dark = s.explore!.torch <= 0 ? 0.25 : 0;
    if (chance(s, nd.encounter.chance + dark)) {
      startCombat(s, {
        enemy: nd.encounter.enemy,
        dist: 2,
        companion: s.explore!.companion,
        onWin: { ev: 'explore_fight', node: 'win' },
        onLose: { ev: 'explore_fight', node: 'lose' },
        onFlee: { ev: 'explore_fight', node: 'flee' },
        loseMeansDeath: !s.explore!.companion && (s.counters.rescued ?? 0) >= 1,
      });
    }
  }
}

export function linkOpen(s: GameState, l: DLink) {
  return !l.cond || l.cond(s);
}

export function move(s: GameState, to: string) {
  const ex = s.explore!;
  const nd = currentNode(s);
  const link = nd.links.find((l) => l.to === to);
  if (!link || !linkOpen(s, link)) return;
  ex.node = to;
  ex.moves += 1;
  ex.torch -= 1;
  const first = !ex.visited.includes(to);
  if (first) ex.visited.push(to);
  // 三歩ごとに時間帯が一つ進む
  if (ex.moves % 3 === 0) {
    advanceInside(s);
    if (!s.explore) return;
  }
  arrive(s, first);
}

function advanceInside(s: GameState) {
  s.slot += 1;
  if (s.slot >= 3) {
    // 夜になる前に、地上へ引き上げる
    s.slot = 3;
    forceExit(s, '気がつけば、地上はもう夜のはずだ。体が重い。これ以上は無理をせず、来た道を引き返した。');
  }
}

export function search(s: GameState): string {
  const ex = s.explore!;
  const nd = currentNode(s);
  if (ex.searched.includes(ex.node)) return 'ここはもう調べた。';
  ex.searched.push(ex.node);
  return nd.search ? fmt(s, nd.search(s)) : '辺りを調べたが、目ぼしいものはなかった。';
}

export function exitDungeon(s: GameState) {
  const d = dungeon(s);
  log(s, `${d.name}から地上へ戻った。`);
  s.explore = null;
  s.location = d.surface;
  advance(s, 1);
}

function forceExit(s: GameState, text: string) {
  const d = dungeon(s);
  s.explore = null;
  s.location = d.surface;
  log(s, `${d.name}から引き上げた。`);
  s.scene = { kind: 'inline', lines: [{ text: fmt(s, text) }], then: 'advance', slots: 1 };
  s.slot = 2;
}

export function torchWords(s: GameState): string {
  const t = s.explore!.torch;
  if (t <= 0) return '松明が尽きた。闇の中を手探りで進んでいる。';
  if (t <= 3) return '松明が心もとない。そろそろ引き返すべきだ。';
  if (t <= 8) return '松明はまだもつ。';
  return '松明は十分にある。';
}

export function nodeLines(s: GameState): Line[] {
  const nd = currentNode(s);
  const d = typeof nd.desc === 'function' ? nd.desc(s) : nd.desc;
  return [{ text: fmt(s, d) }];
}

export function act(s: GameState) {
  const a = currentNode(s).action;
  if (a && (!a.cond || a.cond(s))) startEvent(s, a.event);
}
