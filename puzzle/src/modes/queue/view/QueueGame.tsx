// Bus Jam型の盤面。ルールの状態（論理）は即座に更新し、見た目は途中経過（Frame）を順に再生して追いかける。
// 演出の途中でタップされたら、演出を最後まで早送りしてから次の手を受け付ける（待たせない）。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { PlayStatus } from '../../../core/mode';
import type { Speed } from '../../../core/save';
import type { ThemeWithArt } from '../../../themes';
import { apply, init, isLocked, legalMoves, status, topOf, type Frame, type QState, type QueueStage } from '../rules';
import { computeLayout, ptOf, whereAll, type Layout, type Pt } from './layout';

interface Props {
  stage: QueueStage;
  theme: ThemeWithArt;
  speed: Speed;
  initialMoves: number[];
  onMove(moves: number[]): void;
  /** 終局（演出が終わってから呼ぶ）。benchFull=置き台がいっぱいで手詰まりになったか */
  onEnd(st: PlayStatus, benchFull: boolean): void;
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
    endIfOver();
    return () => timers.current.forEach(clearTimeout);
  }, []);

  // 皿が列の上へ抜けて、お客さんの前（または置き台）へ運ばれる演出
  useLayoutEffect(() => {
    const fr = shown.frame;
    if (!L || !fr || fr.step.k !== 'take' || f === 0) return;
    const el = els.current.get(fr.step.id);
    if (!el) return;
    const from = L.inCol(fr.step.col, 0);
    const exit = { x: from.x, y: L.board.y - L.s * 0.9 };
    const dest = ptOf(L, whereAll(fr.state)[fr.step.id]);
    el.animate([from, exit, dest].map((p, i) => ({ transform: tf(p), offset: [0, 0.35, 1][i] })), { duration: shown.dur, easing: 'ease-in-out' });
  }, [shown]);

  function endIfOver() {
    const s = logic.current.s;
    const st = status(s);
    if (st !== 'playing' && !ended.current) {
      ended.current = true;
      onEnd(st, s.bench.length >= s.stage.bench);
    }
  }

  /** 演出を最後まで早送りする */
  function finish() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    for (const el of els.current.values()) el.getAnimations().forEach((a) => a.finish());
    if (shown.s !== logic.current.s) setShown({ s: logic.current.s, dur: 0 });
    endIfOver();
  }

  function durOf(fr: Frame): number {
    switch (fr.step.k) {
      case 'take': return 420 * f;
      case 'leave': return 420 * f;
      case 'sit': return 300 * f;
      case 'pull': return 280 * f;
    }
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
    if (ended.current) return;
    const cur = logic.current;
    const col = cur.s.items[id].col;
    if (topOf(cur.s, col) !== id) { shake(id); return; }
    const frames: Frame[] = [];
    const n = apply(cur.s, col, frames);
    if (!n) { shake(id); return; }
    logic.current = { s: n, moves: [...cur.moves, col] };
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
  const can = new Set(legalMoves(s).map((col) => topOf(s, col)));
  const playing = s.served < stage.orders.length;
  const benchFull = s.bench.length >= stage.bench;
  const sz = L.s;
  const leaving = shown.frame?.step.k === 'leave' ? shown.frame.step : null;
  const waiting = stage.orders.length - s.next;
  const seatOf = new Map(s.seats.map((x, i) => [x.order, i] as const));

  return (
    <div class="scene" style={{ '--t': `${shown.dur}ms` }}>
      {/* カウンター */}
      <div class="counter" style={{ left: `${L.counter.x}px`, top: `${L.counter.y}px`, width: `${L.counter.w}px`, height: `${L.counter.h}px` }} />
      {s.seats.map((seat, si) => Array.from({ length: L.maxN }, (_, i) => {
        const p = L.slot(si, i);
        const on = seat.order >= 0 && i < stage.orders[seat.order].n;
        return <div class={'mat' + (on ? '' : ' off')} style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${L.u}px`, height: `${L.u}px` }} />;
      }))}
      <div class="label" style={{ left: `${L.strip.x}px`, top: `${L.strip.y}px` }}>
        {theme.words.next}（{waiting}人）
      </div>
      {/* 置き台 */}
      <div class={'benchbox' + (benchFull && playing ? ' full' : '')}
        style={{ left: `${L.benchBox.x}px`, top: `${L.benchBox.y}px`, width: `${L.benchBox.w}px`, height: `${L.benchBox.h}px` }}>
        <span class="benchlabel">{theme.words.bench} {s.bench.length}/{stage.bench}{benchFull && playing ? ' ・いっぱい（注文に合うお皿だけ取れます）' : ''}</span>
      </div>
      {Array.from({ length: stage.bench }, (_, j) => {
        const p = L.bench(j);
        return <div class="slot" style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${L.u}px`, height: `${L.u}px` }} />;
      })}
      {/* 盤面と厨房 */}
      <div class="exit" style={{ left: `${L.board.x}px`, top: `${L.board.y - sz * 0.42}px`, width: `${L.board.w}px`, height: `${sz * 0.42}px` }}>
        ▲ {theme.words.exit} ▲
      </div>
      <div class="board" style={{ left: `${L.board.x}px`, top: `${L.board.y}px`, width: `${L.board.w}px`, height: `${L.board.h}px`, '--w': stage.cols.length, '--h': stage.rows }} />
      {L.kitchen && (
        <div class="kitchen" style={{ left: `${L.kitchen.x}px`, top: `${L.kitchen.y}px`, width: `${L.kitchen.w}px`, height: `${L.kitchen.h}px` }} />
      )}
      {L.kitchen && s.colIds.map((ids, col) => {
        const hidden = Math.max(0, ids.length - s.top[col] - stage.rows);
        return (
          <div class="colcount" style={{ left: `${L.board.x + col * sz}px`, top: `${L.kitchen!.y}px`, width: `${sz}px`, height: `${L.kitchen!.h}px`, fontSize: `${Math.round(sz * 0.24)}px` }}>
            {hidden ? `あと${hidden}` : ''}
          </div>
        );
      })}
      {/* お客さん（注文） */}
      {stage.orders.map((o, d) => {
        const seat = seatOf.get(d);
        let p: Pt;
        let isCur = false;
        if (seat !== undefined) { p = L.guest(seat); isCur = true; }
        else if (d >= s.next) p = { ...L.chip(d - s.next), scale: L.chipSize / L.guestSize };
        else if (leaving?.order === d) p = { ...L.guest(leaving.seat), x: L.W + sz, opacity: 0 };
        else return null;
        const got = seat !== undefined ? s.seats[seat].got.length : 0;
        return (
          <div key={`o${d}`} class={'guest' + (isCur ? ' current' : '')} data-order={d}
            aria-label={`${theme.kinds[o.c].name}を${o.n}皿ほしいお客さん`}
            style={{ width: `${L.guestSize}px`, height: `${L.guestSize}px`, transform: tf(p), opacity: p.opacity ?? 1 }}>
            <A.Customer theme={theme} kind={o.c} />
            <span class="want" style={{ fontSize: `${Math.round(L.guestSize * (isCur ? 0.2 : 0.3))}px` }}>
              <span class="wantplate"><A.Plate theme={theme} kind={o.c} /></span>
              {isCur ? `${got}/${o.n}` : `×${o.n}`}
            </span>
          </div>
        );
      })}
      {/* お皿 */}
      {s.items.map((it, id) => {
        const w = where[id];
        let p: Pt;
        if (w.k === 'done') {
          if (!leaving?.ids.includes(id)) return null;
          p = L.gone(leaving.seat);
        } else p = ptOf(L, w);
        const inCol = w.k === 'col';
        const isTop = inCol && w.p === 0;
        const locked = inCol && isLocked(s, id);
        const cls = 'item' + (isTop && can.has(id) ? ' can' : '') + (inCol && !can.has(id) ? ' blocked' : '')
          + (inCol && !isTop ? ' under' : '') + (inCol && w.p >= stage.rows ? ' unseen' : '')
          + (shown.frame?.step.k === 'take' && shown.frame.step.id === id ? ' walking' : '') + (w.k === 'done' ? ' done' : '');
        return (
          <div key={id} class={cls} ref={(el) => { if (el) els.set(id, el); else els.delete(id); }}
            data-id={id} data-col={inCol && w.p < stage.rows ? w.col : undefined} data-top={isTop ? '' : undefined} data-kind={inCol && w.p >= stage.rows ? undefined : it.c}
            aria-label={`${theme.kinds[it.c].name}のお皿`}
            style={{ width: `${sz}px`, height: `${sz}px`, transform: tf(p), opacity: p.opacity ?? 1 }}
            onPointerDown={(e) => { e.preventDefault(); if (inCol) onTap(id); }}>
            <div class="inner">
              <A.Plate theme={theme} kind={it.c} />
              {locked && <span class="lock" style={{ fontSize: `${Math.max(9, Math.round(sz * 0.24))}px` }}>札{it.lock - s.served}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
