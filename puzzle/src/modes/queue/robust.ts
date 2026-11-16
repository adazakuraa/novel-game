// 「見えている情報だけで解けるか」の判定。
//
// プレイヤーに見えるのは、各列の上から rows 枚・各列の残り枚数・お客さんの行列・置き台。
// 列の rows 枚より下の皿（見えない皿）は、並びが分からない。
// そこで「見えない皿が見えるようになるたびに、その色を意地悪な相手が選ぶ」と考え、
// それでも勝てる打ち方（見えている情報だけで決まる打ち方）があるかを調べる。
// あれば、見えない皿の実際の並びがどうであっても、正しく考えれば必ずクリアできる＝運では詰まない。
//
// ルール本体を二重に書かないよう、見えない皿どうしの色を入れ替えた局面を作り、本物の apply で進める。
import { apply, legalMoves, status, type QState } from './rules';
import { SolverBudgetError } from './budget';

/** 見えない皿（各列の rows 枚目より下）の id */
function hiddenIds(s: QState): number[] {
  const out: number[] = [];
  const rows = s.stage.rows;
  s.colIds.forEach((ids, col) => { for (let j = s.top[col] + rows; j < ids.length; j++) out.push(ids[j]); });
  return out;
}

/** プレイヤーに見えている情報だけで作る局面キー（見えない皿は色の内訳だけ） */
export function visibleKey(s: QState): string {
  const rows = s.stage.rows;
  const cols = s.colIds.map((ids, col) => {
    let k = '';
    for (let j = s.top[col]; j < Math.min(ids.length, s.top[col] + rows); j++) {
      const it = s.items[ids[j]];
      k += String.fromCharCode(97 + it.c) + (it.lock > s.served ? it.lock - s.served : '');
    }
    return k + ':' + (ids.length - s.top[col]);
  }).join('/');
  const pool = hiddenIds(s).map((id) => s.items[id].c).sort().join('');
  const b = s.bench.map((id) => s.items[id].c).sort().join('');
  const seats = s.seats.map((x) => `${x.order}.${x.got.length}`).join(',');
  return cols + '|' + pool + '|' + seats + '|' + s.next + '|' + b;
}

export class RobustSolver {
  readonly memo = new Map<string, boolean>();
  nodes = 0;
  constructor(public budget = 400_000) {}

  /** 見えている情報だけで勝てるか */
  wins(s: QState): boolean {
    const st = status(s);
    if (st === 'cleared') return true;
    if (st !== 'playing') return false;
    const k = visibleKey(s);
    const m = this.memo.get(k);
    if (m !== undefined) return m;
    if (++this.nodes > this.budget) throw new SolverBudgetError();
    let ok = false;
    for (const mv of legalMoves(s)) if (this.moveWins(s, mv)) { ok = true; break; }
    this.memo.set(k, ok);
    return ok;
  }

  /** この手を打ったあと、新しく見える皿がどの色でも勝てるか */
  moveWins(s: QState, mv: number): boolean {
    const n = apply(s, mv)!;
    const rows = s.stage.rows;
    const ids = n.colIds[mv];
    const revealedPos = n.top[mv] + rows - 1;
    // 列が1段上がって、それまで見えなかった皿が見えるようになったか
    if (revealedPos >= ids.length || revealedPos < s.top[mv] + rows) return this.wins(n);
    const revealed = ids[revealedPos];
    const pool = [revealed, ...hiddenIds(n)];
    const colors = [...new Set(pool.map((id) => n.items[id].c))];
    for (const c of colors) {
      if (!this.wins(withColor(n, revealed, c, pool))) return false;
    }
    return true;
  }
}

/** 見えるようになった皿 id の色を c にした局面（見えない皿のどれかと色を入れ替える） */
function withColor(s: QState, id: number, c: number, pool: number[]): QState {
  if (s.items[id].c === c) return s;
  const other = pool.find((x) => x !== id && s.items[x].c === c)!;
  const items = s.items.slice();
  items[id] = { ...items[id], c };
  items[other] = { ...items[other], c: s.items[id].c };
  return { ...s, items };
}
