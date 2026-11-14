// 所属（職業）。複数の組織に属せるが、それぞれの義務が時間を奪う。
import type { GameState } from './types';
import { R } from './registry';

export function isMember(s: GameState, id: string) {
  return !!s.affil?.[id];
}

export function join(s: GameState, id: string) {
  s.affil ??= {};
  if (!s.affil[id]) s.affil[id] = { joined: s.day, standing: 0, duty: 0, missed: 0 };
  s.flags[`offer:${id}`] = 'joined';
}

export function leave(s: GameState, id: string) {
  if (s.affil) delete s.affil[id];
  s.flags[`left:${id}`] = s.day;
}

/** 義務を一つこなす */
export function doDuty(s: GameState, id: string, amount = 1) {
  const a = s.affil?.[id];
  if (!a) return;
  a.duty += amount;
  a.standing += 0.5 * amount;
}

/** 週の終わりの清算。日誌に書く文を返す */
export function weeklyAffiliations(s: GameState): string[] {
  const notes: string[] = [];
  for (const [id, a] of Object.entries(s.affil ?? {})) {
    const def = R.affiliations.get(id);
    if (!def) continue;
    const firstWeek = s.day - a.joined < 7;
    if (def.dutyPerWeek === 0 || a.duty >= def.dutyPerWeek || firstWeek) {
      const pay = firstWeek ? Math.round((def.pay * (s.day - a.joined)) / 7) : def.pay;
      s.money += pay;
      a.missed = 0;
      a.standing += 1;
      if (pay > 0) notes.push(`${def.name}から、今週の給金${pay}銅貨を受け取った。`);
    } else {
      a.missed += 1;
      a.standing -= 2;
      const half = Math.floor((def.pay * a.duty) / Math.max(1, def.dutyPerWeek));
      s.money += half;
      if (a.missed >= def.dismissAfter) {
        notes.push(`${def.name}の務めを果たせない週が続き、籍を外された。`);
        leave(s, id);
        s.flags[`dismissed:${id}`] = s.day;
        continue;
      }
      notes.push(`今週は${def.name}の務め（${def.dutyLabel}）を十分に果たせなかった。${half > 0 ? `給金は${half}銅貨に減らされた。` : '給金は出なかった。'}`);
    }
    a.duty = 0;
  }
  return notes;
}

/** 所属の一覧（表示用） */
export function affiliationList(s: GameState) {
  return Object.entries(s.affil ?? {}).map(([id, a]) => {
    const def = R.affiliations.get(id)!;
    return { id, def, state: a };
  });
}
