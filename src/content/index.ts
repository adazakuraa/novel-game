// コンテンツをエンジンに登録する。
import type { ChoiceDef, EventDef, NodeDef } from '../engine/defs';
import { R, registerEvents } from '../engine/registry';
import { n } from '../engine/text';
import { rel } from '../engine/npc';
import { ACTIVITIES } from './actions';
import { EVENTS } from './events';
import { NPCS } from './npcs';
import { CORE_ACTIVITY, QUESTS, QUEST_ACTIVITY, QUEST_EVENTS, TEST_ACTIVITY } from './quests';
import { ENEMIES, ITEMS, LOCATIONS } from './world';
import { ENEMIES_1B, EVENTS_1B, QUEST_RUIN, extendNpcs } from './chapter1b';
import { ACTIVITIES2, EVENTS2, NPCS2 } from './npcs2';
import { ACTIVITIES_2, EVENTS_CH2, NPCS_CH2, registerCh2 } from './chapter2';

const ALL_NPCS = [...NPCS, ...NPCS2, ...NPCS_CH2];

const MAX_TOPICS = 2;

function buildTalkEvent(npcId: string): EventDef {
  const def = R.npcs.get(npcId)!;
  const nodes: Record<string, NodeDef> = {};
  const choices: ChoiceDef[] = def.topics.map((t) => ({
    text: t.label,
    cond: (s) => {
      const used = s.npcs[npcId].topicsUsed[t.id];
      if (t.once && used !== undefined) return false;
      if (used === s.day) return false;
      if (((s.flags._talkCount as number) ?? 0) >= MAX_TOPICS) return false;
      return !t.cond || t.cond(s);
    },
    effect: (s) => {
      s.npcs[npcId].topicsUsed[t.id] = s.day;
      s.flags._talkCount = ((s.flags._talkCount as number) ?? 0) + 1;
    },
    next: `t:${t.id}`,
  }));
  choices.push({ text: '話を切り上げる', next: 'bye' });

  nodes.start = {
    lines: [(s) => def.greet(s)],
    effect: (s) => {
      const st = s.npcs[npcId];
      if (st.lastTalkDay !== s.day) {
        // 顔を合わせて話すこと自体が、少しずつ関係を育てる
        rel(s, npcId, 'affinity', 0.8);
        rel(s, npcId, 'trust', 0.4);
        st.lastTalkDay = s.day;
        s.counters[`talk:${npcId}`] = (s.counters[`talk:${npcId}`] ?? 0) + 1;
      }
      st.met = true;
    },
    choices,
  };
  nodes.menu = {
    lines: [(s) => (((s.flags._talkCount as number) ?? 0) >= MAX_TOPICS ? n('（そろそろ話を切り上げる頃合いだ）') : n('（他に何を話そう）'))],
    choices,
  };
  nodes.bye = {
    lines: [(s) => n(`${def.name}との話を終えた。`)],
    effect: (s) => {
      s.today.push(`${def.name}と話した。`);
    },
    end: { advance: true },
  };
  const withDefault = (nd: NodeDef): NodeDef => (nd.next || nd.end || nd.choices ? nd : { ...nd, next: 'menu' });
  for (const t of def.topics) {
    nodes[`t:${t.id}`] = withDefault(t.node);
    for (const [k, v] of Object.entries(t.extraNodes ?? {})) nodes[k] = withDefault(v);
  }
  return { id: `talk:${npcId}`, trigger: 'manual', nodes };
}

let loaded = false;
export function loadContent() {
  if (loaded) return;
  loaded = true;
  for (const l of LOCATIONS) R.locations.set(l.id, l);
  for (const i of ITEMS) R.items.set(i.id, i);
  for (const e of [...ENEMIES, ...ENEMIES_1B]) R.enemies.set(e.id, e);
  QUESTS.push(QUEST_RUIN);
  extendNpcs(ALL_NPCS);
  for (const q of QUESTS) R.quests.set(q.id, q);
  for (const npc of ALL_NPCS) R.npcs.set(npc.id, npc);
  registerCh2();
  R.activities.push(QUEST_ACTIVITY, CORE_ACTIVITY, TEST_ACTIVITY, ...ACTIVITIES, ...ACTIVITIES2, ...ACTIVITIES_2);
  registerEvents(EVENTS);
  registerEvents(QUEST_EVENTS);
  registerEvents(EVENTS_1B);
  registerEvents(EVENTS2);
  registerEvents(EVENTS_CH2);
  registerEvents(ALL_NPCS.map((n2) => buildTalkEvent(n2.id)));
}

export const NPC_IDS = ALL_NPCS.map((x) => x.id);
