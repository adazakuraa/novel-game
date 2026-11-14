import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameState, Line, StatKey } from '../engine/types';
import type { ActivityDef, MethodDef } from '../engine/defs';
import { R } from '../engine/registry';
import {
  activitiesAt,
  advance,
  choose,
  combatAct,
  doAction,
  locationOpen,
  methodsOf,
  moveTo,
  npcsAt,
  proceed,
  sceneView,
  talkTo,
} from '../engine/game';
import { availableMoves, currentTell, distName, enemyOf, enemyStateText, heroState } from '../engine/combat';
import { SLOT_NAMES, dateLabel, fmt } from '../engine/text';
import { band } from '../engine/stats';
import { exportJson, loadSlot, saveSlot } from '../engine/save';
import { SELF } from '../content/selftext';

type Tab = 'act' | 'journal' | 'people' | 'items' | 'system';

interface Props {
  state: GameState;
  update: (fn: (s: GameState) => void) => void;
  replace: (s: GameState) => void;
  onTitle: () => void;
  onRewind: () => void;
  onWipe: () => void;
}

const RANKS = ['仮登録', '石級', '銅級', '鉄級', '銀級', '金級', '星級'];

function speaker(who?: string) {
  if (!who) return undefined;
  return R.npcs.get(who)?.name ?? who;
}

function condWords(s: GameState): string[] {
  const out: string[] = [];
  const f = s.cond.fatigue;
  out.push(f > 80 ? '疲れ切っている' : f > 55 ? 'かなり疲れている' : f > 30 ? '少し疲れている' : '体は軽い');
  if (s.cond.hp < 40) out.push('体が痛む');
  if (s.cond.stress > 60) out.push('気が張りつめている');
  if (!s.cond.fed) out.push('空腹');
  for (const i of s.cond.injuries) out.push(i.label);
  return out;
}

export function Game(p: Props) {
  const [tab, setTab] = useState<Tab>('act');
  const s = p.state;
  const busy = !!s.scene || !!s.combat;

  useEffect(() => {
    if (busy) setTab('act');
  }, [busy]);

  return (
    <div class="game">
      <header class="hud">
        <div class="hud-main">
          <span class="hud-date">{dateLabel(s.day)}</span>
          <span class="hud-slot">{SLOT_NAMES[s.slot]}</span>
          <span class="hud-place">{R.locations.get(s.location)?.name}</span>
        </div>
        <div class="hud-sub">
          <span>{RANKS[s.rank]}</span>
          <span>{s.money}銅貨</span>
          <span class="hud-cond">{condWords(s).slice(0, 2).join('・')}</span>
        </div>
      </header>
      <main class="main">
        {s.dead ? (
          <Death s={s} onRewind={p.onRewind} onWipe={p.onWipe} onTitle={p.onTitle} />
        ) : tab === 'act' ? (
          s.combat ? (
            <Combat s={s} update={p.update} />
          ) : s.scene ? (
            <Scene s={s} update={p.update} />
          ) : (
            <Planner s={s} update={p.update} />
          )
        ) : tab === 'journal' ? (
          <Journal s={s} />
        ) : tab === 'people' ? (
          <People s={s} />
        ) : tab === 'items' ? (
          <Items s={s} update={p.update} />
        ) : (
          <System s={s} replace={p.replace} onTitle={p.onTitle} />
        )}
      </main>
      {!s.dead && (
        <nav class="tabs">
          {(
            [
              ['act', busy ? '物語' : '行動'],
              ['journal', '日誌'],
              ['people', '人物'],
              ['items', '持ち物'],
              ['system', '記録'],
            ] as [Tab, string][]
          ).map(([t, l]) => (
            <button class={`tab ${tab === t ? 'on' : ''}`} disabled={busy && t !== 'act' && t !== 'journal' && t !== 'people'} onClick={() => setTab(t)}>
              {l}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

// ───────── 物語 ─────────

function Lines({ lines }: { lines: Line[] }) {
  return (
    <div class="novel">
      {lines.map((l) =>
        l.who ? (
          <p class="speech">
            <span class="who">{speaker(l.who)}</span>
            <span class="say">「{l.text}」</span>
          </p>
        ) : (
          <p>{l.text}</p>
        ),
      )}
    </div>
  );
}

function Scene({ s, update }: { s: GameState; update: Props['update'] }) {
  const v = sceneView(s)!;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'start' });
  }, [s.scene]);
  return (
    <div class="scene" ref={ref}>
      <Lines lines={v.lines} />
      <div class="choices">
        {v.choices.map((c) => (
          <button class="choice" onClick={() => update((st) => choose(st, c.index))}>
            {c.text}
          </button>
        ))}
        {v.canContinue && (
          <button class="btn primary next" onClick={() => update((st) => proceed(st))}>
            続ける
          </button>
        )}
      </div>
    </div>
  );
}

// ───────── 戦闘 ─────────

function Combat({ s, update }: { s: GameState; update: Props['update'] }) {
  const c = s.combat!;
  const e = enemyOf(s);
  const tell = currentTell(s);
  return (
    <div class="combat">
      <div class="combat-head">
        <span class="enemy-name">{e.name}</span>
        <span class="dist">{distName(c.dist)}</span>
      </div>
      <div class="novel">
        {c.log.map((l) => (
          <p>{l}</p>
        ))}
        <p class="enemy-state">{enemyStateText(s)}</p>
        <p class="tell">{tell.text}</p>
        {tell.read && <p class="read">――{tell.read}</p>}
        <p class="hero-state">{heroState(s)}</p>
      </div>
      <div class="moves">
        {availableMoves(s).map((m) => (
          <button class={`choice ${m.id === 'flee' ? 'flee' : ''}`} onClick={() => update((st) => combatAct(st, m.id))}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────── 行動計画 ─────────

function Planner({ s, update }: { s: GameState; update: Props['update'] }) {
  const locs = [...R.locations.values()].filter((l) => !l.cond || l.cond(s));
  const here = R.locations.get(s.location)!;
  const open = locationOpen(s, here.id);
  const people = open ? npcsAt(s, here.id) : [];
  const acts = open ? activitiesAt(s, here.id) : [];
  const [act, setAct] = useState<string | null>(null);

  return (
    <div class="planner">
      <div class="locs">
        {locs.map((l) => {
          const o = locationOpen(s, l.id);
          return (
            <button
              class={`loc ${l.id === s.location ? 'on' : ''} ${o ? '' : 'closed'}`}
              onClick={() => {
                setAct(null);
                update((st) => moveTo(st, l.id));
              }}
            >
              {l.name}
            </button>
          );
        })}
      </div>
      <p class="loc-desc">{fmt(s, here.desc)}</p>
      {!open && <p class="muted">{SLOT_NAMES[s.slot]}は閉まっている。</p>}
      {people.length > 0 && (
        <div class="people-here">
          {people.map((n) => (
            <button class="person" onClick={() => update((st) => talkTo(st, n.id))}>
              {n.name}と話す
            </button>
          ))}
        </div>
      )}
      <div class="acts">
        {acts.map((a) => (
          <Activity s={s} a={a} open={act === a.id} toggle={() => setAct(act === a.id ? null : a.id)} update={update} />
        ))}
      </div>
      <div class="pass">
        {s.slot === 3 ? (
          <button class="btn primary" onClick={() => update((st) => advance(st, 1))}>
            眠る
          </button>
        ) : (
          <button class="btn ghost" onClick={() => update((st) => advance(st, 1))}>
            何もせずに過ごす
          </button>
        )}
      </div>
    </div>
  );
}

function Activity({ s, a, open, toggle, update }: { s: GameState; a: ActivityDef; open: boolean; toggle: () => void; update: Props['update'] }) {
  const methods = methodsOf(s, a);
  const [method, setMethod] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | undefined>(undefined);
  const [comp, setComp] = useState<string | undefined>(undefined);
  const m: MethodDef | undefined = methods.find((x) => x.id === method);
  const focuses = m?.focuses?.filter((f) => !f.cond || f.cond(s)) ?? [];
  const companions = m?.companions ? npcsAt(s, a.loc).filter((n) => n.id === 'lyne' || n.id === 'garad') : [];

  return (
    <div class={`act ${open ? 'open' : ''}`}>
      <button class="act-head" onClick={toggle}>
        {a.label}
      </button>
      {open && (
        <div class="act-body">
          {methods.length === 0 && <p class="muted">今はできることがない。</p>}
          {methods.map((x) => (
            <button
              class={`method ${method === x.id ? 'on' : ''}`}
              onClick={() => {
                setMethod(x.id);
                setFocus(x.focuses?.[0]?.id);
                setComp(undefined);
              }}
            >
              <span class="method-label">{x.label}</span>
              {x.desc && <span class="method-desc">{x.desc}</span>}
            </button>
          ))}
          {m && focuses.length > 0 && (
            <div class="sub">
              <span class="sub-label">重点</span>
              <div class="seg wrap">
                {focuses.map((f) => (
                  <button class={`seg-btn ${focus === f.id ? 'on' : ''}`} onClick={() => setFocus(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {m && companions.length > 0 && (
            <div class="sub">
              <span class="sub-label">相手</span>
              <div class="seg wrap">
                <button class={`seg-btn ${!comp ? 'on' : ''}`} onClick={() => setComp(undefined)}>
                  居合わせた誰か
                </button>
                {companions.map((n) => (
                  <button class={`seg-btn ${comp === n.id ? 'on' : ''}`} onClick={() => setComp(n.id)}>
                    {n.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {m && (
            <button class="btn primary do" onClick={() => update((st) => doAction(st, a.id, m.id, { focus, companion: comp }))}>
              {(m.slots ?? 1) === 0 ? '行う' : (m.slots ?? 1) > 1 ? `行う（${m.slots}つの時間帯）` : '行う'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ───────── 日誌 ─────────

const SELF_ORDER: StatKey[] = ['str', 'end', 'agi', 'will', 'wit', 'sword_p', 'beast_p', 'magic_p'];

function Journal({ s }: { s: GameState }) {
  const [view, setView] = useState<'log' | 'self'>('log');
  const entries = [...s.journal].reverse().slice(0, 60);
  return (
    <div class="journal">
      <div class="seg">
        <button class={`seg-btn ${view === 'log' ? 'on' : ''}`} onClick={() => setView('log')}>
          日々の記録
        </button>
        <button class={`seg-btn ${view === 'self' ? 'on' : ''}`} onClick={() => setView('self')}>
          自分を振り返る
        </button>
      </div>
      {view === 'log' ? (
        <>
          {s.today.length > 0 && (
            <div class="entry today">
              <h3>今日（{dateLabel(s.day)}）</h3>
              {s.today.map((t) => (
                <p>{t}</p>
              ))}
            </div>
          )}
          {entries.map((e) => (
            <div class={`entry ${e.kind === 'insight' ? 'insight' : ''}`}>
              <h3>{dateLabel(e.day)}</h3>
              {e.text.map((t) => (
                <p>{t}</p>
              ))}
            </div>
          ))}
          {entries.length === 0 && s.today.length === 0 && <p class="muted">まだ何も書かれていない。</p>}
        </>
      ) : (
        <div class="novel self">
          {SELF_ORDER.map((k) => {
            const t = SELF[k]?.[band(s.stats[k])];
            return t ? <p>{fmt(s, t)}</p> : null;
          })}
          {s.cond.injuries.map((i) => (
            <p>{i.label}が、まだ痛む。</p>
          ))}
          <p class="muted small">これは主人公自身の感じ方です。思い込みや、まだ自覚していない才能もあるかもしれません。</p>
        </div>
      )}
    </div>
  );
}

// ───────── 人物 ─────────

function People({ s }: { s: GameState }) {
  const met = [...R.npcs.values()].filter((n) => s.npcs[n.id]?.met);
  if (met.length === 0) return <p class="muted">まだ誰とも知り合っていない。</p>;
  return (
    <div class="people">
      {met.map((n) => {
        const st = s.npcs[n.id];
        return (
          <details class="person-card">
            <summary>{n.name}</summary>
            {n.profile(s).map((t) => (
              <p>{fmt(s, t)}</p>
            ))}
            {st.memories.length > 0 && (
              <>
                <h4>覚えていること</h4>
                <ul>
                  {st.memories.slice(-8).map((m) => (
                    <li>
                      {dateLabel(m.day)}：{fmt(s, m.note)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </details>
        );
      })}
    </div>
  );
}

// ───────── 持ち物 ─────────

function Items({ s, update }: { s: GameState; update: Props['update'] }) {
  const list = Object.entries(s.items).filter(([, c]) => c > 0);
  const [msg, setMsg] = useState('');
  return (
    <div class="items">
      {msg && <p class="notice">{msg}</p>}
      {list.map(([id, c]) => {
        const d = R.items.get(id);
        if (!d) return null;
        return (
          <div class="item">
            <div>
              <strong>{d.name}</strong>
              {c > 1 && <span class="muted"> ×{c}</span>}
              <p class="muted small">{d.desc}</p>
            </div>
            {d.use && (
              <button
                class="btn small"
                onClick={() =>
                  update((st) => {
                    setMsg(d.use!.run(st));
                    st.items[id] -= 1;
                  })
                }
              >
                {d.use.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ───────── 記録（セーブ） ─────────

function System({ s, replace, onTitle }: { s: GameState; replace: (s: GameState) => void; onTitle: () => void }) {
  const [msg, setMsg] = useState('');
  const [slots, setSlots] = useState<(GameState | undefined)[]>([]);
  useEffect(() => {
    Promise.all([1, 2, 3].map((n) => loadSlot(n))).then(setSlots);
  }, [msg]);

  const download = () => {
    const blob = new Blob([exportJson(s)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kaiberi-${s.hero.name}-day${s.day}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div class="system">
      <p class="muted small">
        {s.mode === 'ironman' ? '鉄人モード：自動セーブのみ。' : '標準モード：自動セーブに加えて、手動セーブ枠が3つあります。'}
        進行は自動で保存されます。
      </p>
      {s.mode === 'standard' && (
        <div class="slots">
          {[1, 2, 3].map((n, i) => {
            const v = slots[i];
            return (
              <div class="slot">
                <span>
                  枠{n}：{v ? `${v.hero.name}　${dateLabel(v.day)} ${SLOT_NAMES[v.slot]}` : '空き'}
                </span>
                <div class="row">
                  <button class="btn small" disabled={!!s.scene || !!s.combat} onClick={async () => { await saveSlot(n, s); setMsg(`枠${n}に保存しました`); }}>
                    保存
                  </button>
                  <button class="btn small ghost" disabled={!v} onClick={() => { if (v) { replace(structuredClone(v)); setMsg(`枠${n}から読み込みました`); } }}>
                    読込
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button class="btn" onClick={download}>
        セーブデータを書き出す（バックアップ）
      </button>
      <button class="btn ghost" onClick={onTitle}>
        タイトルへ戻る
      </button>
      {msg && <p class="notice">{msg}</p>}
    </div>
  );
}

// ───────── 死 ─────────

function Death({ s, onRewind, onWipe, onTitle }: { s: GameState; onRewind: () => void; onWipe: () => void; onTitle: () => void }) {
  return (
    <div class="death">
      <div class="novel">
        <p>視界が暗く沈んでいく。</p>
        <p>土の匂い。遠くで、誰かが名前を呼んでいる気がした。</p>
        <p>{s.hero.name}の旅は、ここで終わった。</p>
      </div>
      <p class="muted small">
        {dateLabel(s.day)}。カルナスに来て{s.day}日目。{RANKS[s.rank]}。
      </p>
      {s.mode === 'standard' ? (
        <>
          <button class="btn primary" onClick={onRewind}>
            その日の朝に戻る
          </button>
          <button class="btn ghost" onClick={onTitle}>
            タイトルへ
          </button>
        </>
      ) : (
        <button class="btn primary" onClick={onWipe}>
          人生を閉じる
        </button>
      )}
    </div>
  );
}
