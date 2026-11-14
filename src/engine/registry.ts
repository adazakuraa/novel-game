// コンテンツの登録先。エンジンはここを通してコンテンツを参照する（循環参照を避けるため）。
import type { ActivityDef, AffiliationDef, DungeonDef, EnemyDef, EventDef, ItemDef, LocationDef, NpcDef, QuestDef } from './defs';

export const R = {
  events: new Map<string, EventDef>(),
  activities: [] as ActivityDef[],
  locations: new Map<string, LocationDef>(),
  npcs: new Map<string, NpcDef>(),
  enemies: new Map<string, EnemyDef>(),
  quests: new Map<string, QuestDef>(),
  items: new Map<string, ItemDef>(),
  affiliations: new Map<string, AffiliationDef>(),
  dungeons: new Map<string, DungeonDef>(),
};

export function registerEvents(list: EventDef[]) {
  for (const e of list) {
    if (R.events.has(e.id)) throw new Error(`duplicate event ${e.id}`);
    R.events.set(e.id, e);
  }
}
