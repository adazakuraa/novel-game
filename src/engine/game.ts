// ゲーム進行の中核。UIはここにある関数だけを通して状態を変える。
import type { GameState, Line, StatKey } from './types';
import type { ActivityDef, ChoiceDef, EventDef, MethodDef, NodeDef } from './defs';
import { R } from './registry';
import { chance, weighted } from './rng';
import { fmt, resolveLines } from './text';
import { consolidate, markRepetition, rust } from './growth';
import { ALL_STATS, band, clamp } from './stats';
import { playerMove, type PlayerMove } from './combat';
import { BREAKTHROUGH, RISE } from '../content/selftext';

// ───────── 表示用 ─────────

export interface View {
  lines: Line[];
  choices: { index: number; text: string }[];
  canContinue: boolean;
}

function node(s: GameState): NodeDef | undefined {
  if (s.scene?.kind !== 'event') return undefined;
  return R.events.get(s.scene.ev)?.nodes[s.scene.node];
}

export function sceneView(s: GameState): View | null {
  if (!s.scene) return null;
  if (s.scene.kind === 'inline') return { lines: s.scene.lines, choices: [], canContinue: true };
  const nd = node(s);
  if (!nd) return { lines: [{ text: `（シーンが見つかりません: ${s.scene.ev}/${s.scene.node}）` }], choices: [], canContinue: true };
  const choices = (nd.choices ?? [])
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => !c.cond || c.cond(s))
    .map(({ c, index }) => ({ index, text: fmt(s, c.text) }));
  return { lines: resolveLines(s, nd.lines), choices, canContinue: choices.length === 0 };
}

// ───────── イベント ─────────

export function startEvent(s: GameState, id: string, nodeId?: string) {
  const ev = R.events.get(id);
  if (!ev) throw new Error(`unknown event ${id}`);
  s.seen[id] = s.day;
  enterNode(s, ev, nodeId ?? ev.start ?? 'start');
}

function enterNode(s: GameState, ev: EventDef, nodeId: string) {
  s.scene = { kind: 'event', ev: ev.id, node: nodeId };
  const nd = ev.nodes[nodeId];
  if (!nd) throw new Error(`unknown node ${ev.id}/${nodeId}`);
  nd.effect?.(s);
  // effect の中で戦闘や別イベントに移った場合はそちらを優先
}

function finishEvent(s: GameState, nd: NodeDef) {
  s.scene = null;
  const adv = s.flags._adv as number | undefined;
  delete s.flags._adv;
  if (nd.end?.advance) advance(s, nd.end.slots ?? adv ?? 1);
  else if (adv) advance(s, adv);
  else checkSlotEvents(s);
}

function goNext(s: GameState, ev: EventDef, nd: NodeDef, next: ChoiceDef['next'] | NodeDef['next']) {
  const target = typeof next === 'function' ? next(s) : next;
  if (target) {
    if (target.includes('/')) {
      const [e, n2] = target.split('/');
      startEvent(s, e, n2);
    } else enterNode(s, ev, target);
  } else finishEvent(s, nd);
}

export function choose(s: GameState, index: number) {
  if (s.scene?.kind !== 'event') return;
  const ev = R.events.get(s.scene.ev)!;
  const nd = ev.nodes[s.scene.node];
  const c = nd.choices?.[index];
  if (!c) return;
  const before = s.scene;
  c.effect?.(s);
  if (s.combat || s.dead) return;
  if (s.scene !== before) return; // effect が場面を切り替えた
  goNext(s, ev, nd, c.next ?? nd.next);
}

export function proceed(s: GameState) {
  const sc = s.scene;
  if (!sc) return;
  if (sc.kind === 'inline') {
    s.scene = null;
    if (sc.then === 'advance' && sc.slots === 0) return;
    if (sc.then === 'advance') {
      const after = findEvent(s, 'after');
      if (after) {
        s.flags._adv = sc.slots ?? 1;
        startEvent(s, after.id);
      } else advance(s, sc.slots ?? 1);
    }
    return;
  }
  const ev = R.events.get(sc.ev)!;
  const nd = ev.nodes[sc.node];
  if (nd.choices?.some((c) => !c.cond || c.cond(s))) return;
  goNext(s, ev, nd, nd.next);
}

export function findEvent(s: GameState, trigger: EventDef['trigger']): EventDef | undefined {
  const cands: EventDef[] = [];
  for (const ev of R.events.values()) {
    if (ev.trigger !== trigger) continue;
    if (ev.once && s.seen[ev.id] !== undefined) continue;
    if (ev.cooldown && s.seen[ev.id] !== undefined && s.day - s.seen[ev.id] < ev.cooldown) continue;
    if (ev.cond && !ev.cond(s)) continue;
    cands.push(ev);
  }
  if (!cands.length) return undefined;
  const top = Math.max(...cands.map((e) => e.priority ?? 0));
  const pool = cands.filter((e) => (e.priority ?? 0) === top);
  // 優先度の低い（日常の）イベントは、毎回は起きない
  if (top < 10 && !chance(s, trigger === 'after' ? 0.35 : 0.3)) return undefined;
  return weighted(s, pool.map((e) => ({ w: e.weight ?? 1, v: e })));
}

/** 新しく始めたゲームの最初の時間帯を開始する */
export function beginGame(s: GameState) {
  checkSlotEvents(s);
}

function checkSlotEvents(s: GameState) {
  if (s.scene || s.combat || s.dead || s.ended) return;
  const ev = findEvent(s, 'slot');
  if (ev) startEvent(s, ev.id);
}

// ───────── 時間 ─────────

export function advance(s: GameState, slots = 1) {
  for (let i = 0; i < slots; i++) {
    s.slot += 1;
    if (s.slot > 3) endDay(s);
    if (i < slots - 1) {
      const ev = findInterrupt(s);
      if (ev) {
        startEvent(s, ev.id);
        return;
      }
    }
  }
  checkSlotEvents(s);
}

function findInterrupt(s: GameState): EventDef | undefined {
  for (const ev of R.events.values()) {
    if (!ev.interrupt || ev.trigger !== 'slot') continue;
    if (ev.once && s.seen[ev.id] !== undefined) continue;
    if (ev.cond && !ev.cond(s)) continue;
    return ev;
  }
  return undefined;
}

/** 同行できる仲間（その場にいる者と、パーティーを組んだ者） */
export function availableCompanions(s: GameState, loc: string): string[] {
  const ids = new Set(npcsAt(s, loc).map((n) => n.id).filter((id) => id === 'lyne' || id === 'garad'));
  const ly = s.npcs.lyne;
  if (s.flags.lyneParty && ly && ly.alive && ly.away <= 0 && !s.flags.lyneLeft && s.slot <= 2) ids.add('lyne');
  return [...ids];
}

export const LIVING_COST = 10;

function perceptionLines(before: Record<StatKey, number>, s: GameState): string[] {
  const out: string[] = [];
  for (const k of ALL_STATS) {
    const b0 = band(before[k]);
    const b1 = band(s.stats[k]);
    if (b1 > b0) {
      const t = RISE[k]?.[b1];
      if (t) out.push(t);
    }
  }
  return out;
}

export function endDay(s: GameState) {
  const before = { ...s.stats };
  let q = 1;
  const notes: string[] = [];
  if (s.flags._late) q -= 0.25;
  if (s.money >= LIVING_COST) {
    s.money -= LIVING_COST;
    s.cond.fed = true;
  } else if (s.npcs.marta?.met && s.npcs.marta.rel.trust >= 4 && (s.counters.tab ?? 0) < 80) {
    // マルタが宿代を待ってくれる（ツケ）
    s.counters.tab = (s.counters.tab ?? 0) + LIVING_COST;
    s.cond.fed = true;
    q -= 0.05;
    notes.push((s.counters.tab ?? 0) <= LIVING_COST ? '宿代が払えないと言うと、マルタは黙ってカウンターの下の帳面に{I}の名前を書いた。「稼げるようになったら返しな」' : 'マルタは何も言わずに、帳面の{I}の名前の横に数字を書き足した。');
  } else {
    q -= 0.3;
    s.cond.fed = false;
    notes.push('宿代が払えず、灯り亭の厩の藁の上で眠った。腹が鳴って、何度も目が覚めた。');
    s.counters.roughSleep = (s.counters.roughSleep ?? 0) + 1;
  }
  const inj = s.cond.injuries.reduce((a, i) => a + i.severity, 0);
  q -= inj * 0.04;
  if (s.cond.stress > 70) q -= 0.1;
  q = clamp(q, 0.3, 1.2);

  const { insights } = consolidate(s, q);

  // 回復
  s.cond.hp = clamp(s.cond.hp + 30 * q - inj * 4, 1, 100);
  for (const i of s.cond.injuries) if (!i.lasting) i.days -= 1;
  const healed = s.cond.injuries.filter((i) => i.days <= 0 && !i.lasting);
  s.cond.injuries = s.cond.injuries.filter((i) => i.days > 0 || i.lasting);
  for (const h of healed) notes.push(`${h.label}は、もうほとんど痛まない。`);

  // 依頼の期限
  if (s.quest && s.day >= s.quest.deadline) {
    const qd = R.quests.get(s.quest.id);
    notes.push(`「${qd?.title ?? '依頼'}」の期限が過ぎてしまった。`);
    s.counters.questFail = (s.counters.questFail ?? 0) + 1;
    s.flags[`questFailed:${s.quest.id}`] = true;
    s.quest = null;
  }

  const perceived = perceptionLines(before, s);
  const text = [...s.today, ...notes.map((t) => fmt(s, t))];
  for (const p of perceived) text.push(p);
  for (const ins of insights) {
    text.push(BREAKTHROUGH[ins.skill]);
    s.counters[`break:${ins.skill}`] = (s.counters[`break:${ins.skill}`] ?? 0) + 1;
  }
  if (text.length === 0) text.push('特に何もない一日だった。');
  s.journal.push({ day: s.day, text, kind: insights.length ? 'insight' : 'day' });
  if (s.journal.length > 400) s.journal.splice(0, s.journal.length - 400);

  // NPCの一日
  for (const npc of Object.values(s.npcs)) {
    if (npc.away > 0) npc.away -= 1;
    npc.mood = clamp(npc.mood * 0.5, -50, 50);
  }
  rust(s);

  delete s.flags._late;
  s.today = [];
  s.day += 1;
  s.slot = 0;
  s.location = 'inn';
  s.flags._newDay = true;
}

export function log(s: GameState, text: string) {
  s.today.push(fmt(s, text));
}

// ───────── 行動 ─────────

export function locationOpen(s: GameState, id: string) {
  const l = R.locations.get(id);
  if (!l) return false;
  if (l.cond && !l.cond(s)) return false;
  return l.open ? l.open(s.slot, s) : true;
}

export function activitiesAt(s: GameState, loc: string) {
  return R.activities.filter((a) => a.loc === loc && (!a.cond || a.cond(s)));
}

export function npcsAt(s: GameState, loc: string) {
  return [...R.npcs.values()].filter((n) => {
    const st = s.npcs[n.id];
    return st && st.alive && st.away <= 0 && n.where(s) === loc;
  });
}

export function methodsOf(s: GameState, a: ActivityDef): MethodDef[] {
  return [...a.methods, ...(a.dynamic?.(s) ?? [])].filter((m) => !m.cond || m.cond(s));
}

export function doAction(s: GameState, activityId: string, methodId: string, ctx: { focus?: string; companion?: string } = {}) {
  const a = R.activities.find((x) => x.id === activityId);
  const m = a && methodsOf(s, a).find((x) => x.id === methodId);
  if (!a || !m) return;
  s.location = a.loc;
  const key = `${a.id}:${m.id}${ctx.focus ? ':' + ctx.focus : ''}`;
  s.lastAction = key;
  s.counters[`act:${a.id}`] = (s.counters[`act:${a.id}`] ?? 0) + (m.slots ?? 1);
  const lines = m.run(s, ctx).map((l) => ({ who: l.who, text: fmt(s, l.text) }));
  markRepetition(s, key);
  const ev = s.flags._start as string | undefined;
  if (ev) {
    // 行動がイベント（依頼への出発など）を開始する場合
    delete s.flags._start;
    startEvent(s, ev);
    return;
  }
  if (m.late && s.slot === 3) s.flags._late = true;
  s.scene = { kind: 'inline', lines, then: 'advance', slots: m.slots ?? 1 };
}

export function talkTo(s: GameState, npcId: string) {
  s.flags._talkCount = 0;
  s.lastAction = `talk:${npcId}`;
  startEvent(s, `talk:${npcId}`);
}

export function moveTo(s: GameState, loc: string) {
  s.location = loc;
}

// ───────── 戦闘 ─────────

export function combatAct(s: GameState, move: PlayerMove) {
  if (!s.combat) return;
  const res = playerMove(s, move);
  if (res === 'continue') return;
  const c = s.combat;
  s.flags._combatLog = c.log.join('\n');
  s.flags._lastTurns = c.turn;
  s.combat = null;
  if (res === 'win') {
    s.counters.wins = (s.counters.wins ?? 0) + 1;
    startEvent(s, c.onWin.ev, c.onWin.node);
  } else if (res === 'fled') {
    startEvent(s, c.onFlee.ev, c.onFlee.node);
  } else if (c.spar) {
    s.cond.hp = Math.max(s.cond.hp, 30);
    startEvent(s, c.onLose.ev, c.onLose.node);
  } else if (c.loseMeansDeath) {
    die(s, 'combat');
  } else {
    s.cond.hp = 5;
    s.cond.injuries.push({ id: `down${s.day}`, label: '打ち身と裂傷', severity: 2, days: 8 });
    startEvent(s, c.onLose.ev, c.onLose.node);
  }
}

export function die(s: GameState, cause: string) {
  s.dead = true;
  s.flags.deathCause = cause;
  s.scene = null;
  s.combat = null;
}
