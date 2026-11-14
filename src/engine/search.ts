// 自由入力による行動検索。入力された文から、実行できる行動の候補を探す。
// 生成AIは使わず、辞書の言葉と、文字の並びの近さだけで判定する。
import type { GameState } from './types';
import { R } from './registry';
import { activitiesAt, locationOpen, methodsOf, npcsAt, availableCompanions } from './game';
import { ACTION_WORDS, ACTIVITY_WORDS, LOCATION_WORDS, NPC_WORDS, TALK_WORDS } from '../content/lexicon';
import { SLOT_NAMES } from './text';

export interface SearchHit {
  kind: 'action' | 'talk';
  loc: string;
  activity?: string;
  method?: string;
  focus?: string;
  companion?: string;
  npc?: string;
  label: string;
  score: number;
  /** 実行できない場合の理由 */
  blocked?: string;
}

export function normalize(q: string) {
  return q
    .normalize('NFKC')
    .replace(/[\s、。，．,.!！?？「」『』（）()]/g, '')
    .toLowerCase();
}

function bigrams(t: string) {
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** 文字の並び（2文字ずつ）がどれくらい重なるか */
function similarity(a: string, b: string) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return hit / Math.min(A.size, B.size);
}

function matchWords(q: string, words: string[] | undefined): number {
  if (!words) return 0;
  let best = 0;
  for (const w of words) if (q.includes(w)) best = Math.max(best, w.length);
  return best;
}

function mentionedNpc(q: string): string | undefined {
  for (const [id, words] of Object.entries(NPC_WORDS)) if (matchWords(q, words) > 0) return id;
  return undefined;
}

function mentionedLoc(q: string): string | undefined {
  let best: [string, number] | undefined;
  for (const [id, words] of Object.entries(LOCATION_WORDS)) {
    const m = matchWords(q, words);
    if (m > 0 && (!best || m > best[1])) best = [id, m];
  }
  return best?.[0];
}

export function searchActions(s: GameState, query: string, limit = 5): SearchHit[] {
  const q = normalize(query);
  if (!q) return [];
  const hits: SearchHit[] = [];
  const wantLoc = mentionedLoc(q);
  const npc = mentionedNpc(q);
  const wantsTalk = matchWords(q, TALK_WORDS) > 0;

  for (const loc of R.locations.values()) {
    if (loc.cond && !loc.cond(s)) continue;
    const open = locationOpen(s, loc.id);
    const locBonus = wantLoc === loc.id ? 2 : 0;

    for (const a of activitiesAt(s, loc.id)) {
      const methods = methodsOf(s, a);
      for (const m of methods) {
        const key = `${a.id}:${m.id}`;
        // 重点（突き・足運びなど）の言葉も、その方法を指す手がかりになる
        let focus: string | undefined;
        let focusScore = 0;
        for (const f of m.focuses ?? []) {
          if (f.cond && !f.cond(s)) continue;
          const fm = matchWords(q, ACTION_WORDS[`${key}:${f.id}`]) + (q.includes(f.label) ? f.label.length : 0);
          if (fm > focusScore) {
            focusScore = fm;
            focus = f.id;
          }
        }
        let score = matchWords(q, ACTION_WORDS[key]) * 2 + matchWords(q, ACTIVITY_WORDS[a.id]) + (q.includes(m.label) ? 4 : 0) + focusScore * 2;
        // 辞書にない言い回しでも、ラベルや説明文と文字の並びが似ていれば候補にする
        const sim = Math.max(similarity(q, m.label), similarity(q, a.label + m.label) * 0.8, similarity(q, m.desc) * 0.6);
        if (score === 0 && sim < 0.34) continue;
        score += sim * 3 + locBonus;
        if (!focus) focus = m.focuses?.find((f) => !f.cond || f.cond(s))?.id;

        let companion: string | undefined;
        if (npc && m.companions) {
          if (availableCompanions(s, loc.id).includes(npc)) {
            companion = npc;
            score += 3;
          } else score -= 1;
        }
        const focusLabel = m.focuses?.find((f) => f.id === focus)?.label;
        const compName = companion ? R.npcs.get(companion)?.name : undefined;
        hits.push({
          kind: 'action',
          loc: loc.id,
          activity: a.id,
          method: m.id,
          focus,
          companion,
          score,
          label: `${loc.name}：${a.label}「${m.label}」${focusLabel ? `（${focusLabel}）` : ''}${compName ? `　${compName}と` : ''}`,
          blocked: open ? undefined : `${SLOT_NAMES[s.slot]}は閉まっている`,
        });
      }
    }

    // 人と話す
    if (npc && (wantsTalk || !hits.length)) {
      const here = open ? npcsAt(s, loc.id) : [];
      if (here.some((x) => x.id === npc)) {
        hits.push({ kind: 'talk', loc: loc.id, npc, score: 6 + (wantsTalk ? 3 : 0) + locBonus, label: `${loc.name}：${R.npcs.get(npc)!.name}と話す` });
      }
    }
  }

  // 話したい相手が今どこにもいない場合
  if (npc && wantsTalk && !hits.some((h) => h.kind === 'talk')) {
    const def = R.npcs.get(npc);
    if (def && s.npcs[npc]?.met)
      hits.push({ kind: 'talk', loc: s.location, npc, score: 5, label: `${def.name}と話す`, blocked: `${def.name}は、今は見当たらない` });
  }

  hits.sort((a, b) => b.score - a.score || (a.blocked ? 1 : 0) - (b.blocked ? 1 : 0));
  return hits.slice(0, limit);
}
