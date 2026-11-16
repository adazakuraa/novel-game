// Bus Jam型の盤面。ルールの状態（論理）は即座に更新し、見た目は途中経過（Frame）を順に再生して追いかける。
// 演出の途中でタップされたら、演出を最後まで早送りしてから次の手を受け付ける（待たせない）。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { PlayStatus } from '../../../core/mode';
import type { Speed } from '../../../core/save';
import type { ThemeWithArt } from '../../../themes';
import { apply, init, isLocked, movable, status, type Frame, type QState, type QueueStage } from '../rules';
import { computeLayout, ptOf, whereAll, type Layout, type Pt } from './layout';

interface Props {
  stage: QueueStage;
  theme: ThemeWithArt;
  speed: Speed;
  initialMoves: number[];
  onMove(moves: number[]): void;
  /** 終局（演出が終わってから呼ぶ） */
  onEnd(st: PlayStatus): void;
}

const FACTOR: Record<Speed, number> = { normal: 1, fast: 0.5, off: 0 };

function restore(stage: QueueStage, moves: number[]): { s: QState; moves: number[] } {
  let s = init(stage);
  const ok: number[] = [];
  for (const m of moves) {
    const n = apply(s, m);
    if (!n) break;
    s = n; ok.push(m);
  }
  return { s, moves: ok };
}

const tf = (p: Pt) => `translate(${p.x}px, ${p.y}px) scale(${p.scale ?? 1})`;

export function QueueGame({ stage, theme, speed, initialMoves, onMove, onEnd }: Props) {
  const logic = useRef(restore(stage, initialMoves));
  const [shown, setShown] = useState<{ s: QState; frame?: Frame; dur: number }>({ s: logic.current.s, dur: 0 });
  const timers = useRef<number[]>([]);
  const els = useRef(new Map<number, HTMLElement>());
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ W: number; H: number } | null>(null);
  const ended = useRef(false);
  const f = FACTOR[speed];

  useLayoutEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }));
    ro.observe(el);
    setSize({ W: el.clientWidth, H: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const L = useMemo(() => (size ? computeLayout(stage, size.W, size.H) : null), [stage, size]);

  // 途中から再開したときに終局していれば知らせる
  useEffect(() => {
    const st = status(logic.current.s);
    if (st !== 'playing') { ended.current = true; onEnd(st); }
    return () => timers.current.forEach(clearTimeout);
  }, []);

  // 歩く演出：出口までの道をたどってから席へ
  useLayoutEffect(() => {
    const fr = shown.frame;
    if (!L || !fr || fr.step.k !== 'walk' || f === 0) return;
    const el = els.current.get(fr.step.id);
    if (!el) return;
    const path = fr.step.path.map((c) => L.cell(c));
    const top = path[path.length - 1];
    const exit = { x: top.x, y: L.board.y - L.s * 0.9 };
    const dest = ptOf(L, whereAll(fr.state)[fr.step.id]);
    const pts = [...path, exit, dest];
    el.animate(pts.map((p) => ({ transform: tf(p) })), { duration: shown.dur, easing: 'ease-in-out' });
  }, [shown]);

  function finish() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    for (const el of els.current.values()) el.getAnimations().forEach((a) => a.finish());
    if (shown.s !== logic.current.s) setShown({ s: logic.current.s, dur: 0 });
  }

  function durOf(fr: Frame): number {
    switch (fr.step.k) {
      case 'walk': return (fr.step.path.length * 55 + 300) * f;
      case 'spawn': return 220 * f;
      case 'dishDone': return 460 * f;
      case 'pull': return 280 * f;
    }
  }

  function endIfOver() {
    const st = status(logic.current.s);
    if (st !== 'playing' && !ended.current) { ended.current = true; onEnd(st); }
  }

  function shake(id: number) {
    const inner = els.current.get(id)?.firstElementChild as HTMLElement | null;
    inner?.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
      { duration: 260 },
    );
  }

  function tap(id: number) {
    if (ended.current) return;
    finish();
    const cur = logic.current;
    const cell = cur.s.board.indexOf(id);
    if (cell < 0) return;
    const frames: Frame[] = [];
    const n = apply(cur.s, cell, frames);
    if (!n) { shake(id); return; }
    logic.current = { s: n, moves: [...cur.moves, cell] };
    onMove(logic.current.moves);
    if (f === 0) { setShown({ s: n, dur: 0 }); endIfOver(); return; }
    let t = 0;
    frames.forEach((fr, i) => {
      const d = durOf(fr);
      const run = () => setShown({ s: fr.state, frame: fr, dur: d });
      if (i === 0) run(); else timers.current.push(window.setTimeout(run, t));
      t += d;
    });
    timers.current.push(window.setTimeout(() => { timers.current = []; endIfOver(); }, t));
  }

  return (
    <div class="qg" ref={box}>
      <theme.art.Defs theme={theme} />
      {L && <Scene L={L} stage={stage} theme={theme} shown={shown} els={els.current} onTap={tap} />}
    </div>
  );
}

function Scene({ L, stage, theme, shown, els, onTap }: {
  L: Layout; stage: QueueStage; theme: ThemeWithArt; shown: { s: QState; frame?: Frame; dur: number };
  els: Map<number, HTMLElement>; onTap(id: number): void;
}) {
  const { s } = shown;
  const A = theme.art;
  const where = whereAll(s);
  const playing = status(s) === 'playing';
  const can = new Set(playing ? movable(s) : []);
  const walking = shown.frame?.step.k === 'walk' ? shown.frame.step.id : -1;
  const benchLeft = stage.bench - s.bench.length;
  const remaining = stage.dishes.length - s.dish;
  const sz = L.s;

  return (
    <div class="scene" style={{ '--t': `${shown.dur}ms` }}>
      {/* カウンター */}
      <div class="counter" style={{ left: `${L.counter.x}px`, top: `${L.counter.y}px`, width: `${L.counter.w}px`, height: `${L.counter.h}px` }} />
      {[0, 1, 2].map((i) => {
        const p = L.seat(i);
        return <div class="stool" style={{ left: `${p.x}px`, top: `${p.y + sz * 0.55}px`, width: `${sz}px`, height: `${sz * 0.5}px` }} />;
      })}
      <div class="label" style={{ left: `${L.strip.x}px`, top: `${L.strip.y}px` }}>
        {theme.words.next}（残り{Math.max(0, remaining - 1)}枚）
      </div>
      {/* 待ち席 */}
      <div class={'benchbox' + (benchLeft === 1 && playing ? ' danger' : '')}
        style={{ left: `${L.benchBox.x}px`, top: `${L.benchBox.y}px`, width: `${L.benchBox.w}px`, height: `${L.benchBox.h}px` }}>
        <span class="benchlabel">{theme.words.bench} {s.bench.length}/{stage.bench}{benchLeft === 1 && playing ? ' ・あと1人で満席' : ''}</span>
      </div>
      {Array.from({ length: stage.bench }, (_, j) => {
        const p = L.bench(j);
        return <div class={'slot' + (j === stage.bench - 1 ? ' last' : '')} style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${sz}px`, height: `${sz}px` }} />;
      })}
      {/* 盤面 */}
      <div class="exit" style={{ left: `${L.board.x}px`, top: `${L.board.y - sz * 0.42}px`, width: `${L.board.w}px`, height: `${sz * 0.42}px` }}>
        ▲ {theme.words.exit} ▲
      </div>
      <div class="board" style={{ left: `${L.board.x}px`, top: `${L.board.y}px`, width: `${L.board.w}px`, height: `${L.board.h}px`, '--w': stage.w, '--h': stage.h }} />
      {stage.cells.map((c, i) => {
        if (!c || 'c' in c) return null;
        const p = L.cell(i);
        const st = { left: `${p.x}px`, top: `${p.y}px`, width: `${sz}px`, height: `${sz}px` };
        if ('wall' in c) return <div class="wall" style={st} />;
        const t = s.tunnels.find((x) => x.cell === i)!;
        const q = t.ids.slice(t.next).map((id) => s.custs[id].c);
        return <div class="tunnel" style={st} aria-label={`のれん：あと${q.length}人`}><A.Noren theme={theme} queue={q} dir={c.tunnel} /></div>;
      })}
      {/* 皿 */}
      {stage.dishes.map((kind, d) => {
        let p: Pt;
        if (d < s.dish) p = { ...L.gone, y: L.plate.y };
        else if (d === s.dish) p = L.plate;
        else {
          const c = L.chip(d - s.dish - 1);
          p = { ...c, scale: L.chipSize / L.plateSize };
        }
        if (d < s.dish - 1) return null;
        return (
          <div class={'dish' + (d === s.dish ? ' current' : '')} data-dish={d}
            style={{ width: `${L.plateSize}px`, height: `${L.plateSize}px`, transform: tf(p), opacity: p.opacity ?? 1 }}>
            <A.Plate theme={theme} kind={kind} small={d !== s.dish} />
          </div>
        );
      })}
      {/* お客さん */}
      {s.custs.map((cu, id) => {
        const w = where[id];
        const p = ptOf(L, w);
        const onBoard = w.k === 'board';
        const locked = onBoard && isLocked(s, id);
        const cls = 'cust' + (onBoard && can.has(w.cell) ? ' can' : '') + (onBoard && !can.has(w.cell) ? ' blocked' : '') + (id === walking ? ' walking' : '') + (w.k === 'done' ? ' done' : '');
        if (w.k === 'done' && !(shown.frame?.step.k === 'dishDone' && shown.frame.step.ids.includes(id))) return null;
        return (
          <div key={id} class={cls} ref={(el) => { if (el) els.set(id, el); else els.delete(id); }}
            data-id={id} data-cell={onBoard ? w.cell : undefined} data-kind={cu.c}
            aria-label={`${theme.kinds[cu.c].name}のお客さん`}
            style={{ width: `${sz}px`, height: `${sz}px`, transform: tf(p), opacity: p.opacity ?? 1 }}
            onPointerDown={(e) => { e.preventDefault(); if (onBoard) onTap(id); }}>
            <div class="inner">
              <A.Customer theme={theme} kind={cu.c} />
              {locked && <span class="lock" style={{ fontSize: `${Math.max(9, Math.round(sz * 0.24))}px` }}>札{cu.lock - s.dish}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
