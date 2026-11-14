// ターン制戦闘。敵は次の行動を「予兆」として示し、経験と知識があるほどはっきり読める。
import type { CombatState, GameState, SceneRef, StatKey } from './types';
import type { EnemyDef, EnemyIntent } from './defs';
import { R } from './registry';
import { chance, rand, weighted } from './rng';
import { body, clamp, skill } from './stats';
import { gain } from './growth';

export type PlayerMove = 'attack' | 'guard' | 'dodge' | 'back' | 'close' | 'observe' | 'magic' | 'flee' | `item:${string}`;

export interface CombatSetup {
  enemy: string;
  dist?: number;
  companion?: string;
  onWin: SceneRef;
  onLose: SceneRef;
  onFlee: SceneRef;
  loseMeansDeath?: boolean;
  spar?: boolean;
}

const DIST_NAMES = ['組み合う距離', '剣の届く距離', '数歩の距離', '離れた距離'];
export const distName = (d: number) => DIST_NAMES[clamp(d, 0, 3)];

function enemy(c: CombatState): EnemyDef {
  return R.enemies.get(c.enemyId)!;
}

function pickIntent(s: GameState, c: CombatState): EnemyIntent {
  const e = enemy(c);
  const ratio = c.enemyHp / c.enemyMaxHp;
  return (
    weighted(
      s,
      e.intents.map((i) => ({ w: i.weight(c.dist, ratio), v: i })),
    ) ?? e.intents[0]
  );
}

/** 予兆をどこまで読めるか。0: 何かが来る 1: 何が来るか見える 2: 意図まで読める */
export function readLevel(s: GameState, c: CombatState): number {
  const e = enemy(c);
  const kills = s.counters[`kill:${e.loreKey}`] ?? 0;
  const seen = s.counters[`fight:${e.loreKey}`] ?? 0;
  const score =
    skill(s, 'beast') * 0.9 +
    s.stats.wit * 0.5 +
    Math.min(kills, 6) * 4 +
    Math.min(seen, 10) * 1.5 +
    (c.observed ? 22 : 0) +
    rand(s) * 8;
  if (score > 34 + e.level) return 2;
  if (score > 16 + e.level * 0.6) return 1;
  return 0;
}

export function startCombat(s: GameState, o: CombatSetup) {
  const e = R.enemies.get(o.enemy);
  if (!e) throw new Error(`unknown enemy ${o.enemy}`);
  const c: CombatState = {
    enemyId: e.id,
    enemyHp: e.hp,
    enemyMaxHp: e.hp,
    dist: o.dist ?? 2,
    turn: 1,
    intent: '',
    observed: false,
    edge: 0,
    log: [e.intro],
    companion: o.companion,
    onWin: o.onWin,
    onLose: o.onLose,
    onFlee: o.onFlee,
    loseMeansDeath: o.loseMeansDeath ?? false,
    spar: o.spar,
  };
  s.combat = c;
  s.scene = null;
  s.counters[`fight:${e.loreKey}`] = (s.counters[`fight:${e.loreKey}`] ?? 0) + 1;
  beginTurn(s);
}

function beginTurn(s: GameState) {
  const c = s.combat!;
  const it = pickIntent(s, c);
  c.intent = it.id;
  const lv = readLevel(s, c);
  c.read = lv;
}

export function currentTell(s: GameState): { text: string; read?: string } {
  const c = s.combat!;
  const it = enemy(c).intents.find((i) => i.id === c.intent)!;
  const lv = c.read ?? 0;
  if (lv === 0) return { text: it.tell[0] };
  if (lv === 1) return { text: it.tell[1] };
  return { text: it.tell[1], read: it.read };
}

export function heroState(s: GameState): string {
  const hp = s.cond.hp;
  if (hp > 75) return 'まだ体は軽い。';
  if (hp > 50) return '息が上がり、あちこちが痛む。';
  const alone = s.combat?.loseMeansDeath ? 'ここで倒れたら、助けは来ない。' : '';
  if (hp > 25) return '傷が熱い。動きが鈍っているのが自分でもわかる。' + (alone && hp < 40 ? alone : '');
  return '視界の端が暗い。これ以上はまずい。' + alone;
}

export function availableMoves(s: GameState): { id: PlayerMove; label: string }[] {
  const c = s.combat!;
  const moves: { id: PlayerMove; label: string }[] = [];
  if (c.dist <= 2) moves.push({ id: 'attack', label: c.dist === 2 ? '踏み込んで斬る' : '斬りかかる' });
  moves.push({ id: 'guard', label: '構えて受ける' });
  moves.push({ id: 'dodge', label: '身をかわす' });
  if (c.dist < 3) moves.push({ id: 'back', label: '間合いを取る' });
  if (c.dist > 1) moves.push({ id: 'close', label: '間合いを詰める' });
  moves.push({ id: 'observe', label: '相手をよく見る' });
  if (s.stats.magic_p >= 12 && s.flags.knowsSpark) moves.push({ id: 'magic', label: '火花の術を放つ' });
  for (const [id, cnt] of Object.entries(s.items)) {
    const d = R.items.get(id);
    if (cnt > 0 && d?.use?.inCombat) moves.push({ id: `item:${id}`, label: `${d.name}を使う` });
  }
  moves.push({ id: 'flee', label: '逃げる' });
  return moves;
}

function weaponBonus(s: GameState) {
  const sharp = (s.flags.sharpUntil as number | undefined) ?? 0;
  const edge = s.day <= sharp ? 1.5 : 0;
  if (s.items.ironsword) return 7 + edge;
  if (s.items.oldsword) return 3 + edge;
  return 0;
}

function hurt(s: GameState, dmg: number, log: string[]) {
  const d = Math.max(1, Math.round(dmg - body(s, 'end') * 0.08));
  s.cond.hp = clamp(s.cond.hp - d, -50, 100);
  s.cond.stress = clamp(s.cond.stress + d * 0.4, 0, 100);
  if (d >= 14 && !s.combat!.spar && chance(s, 0.45)) {
    const parts = ['左腕', '右肩', '脇腹', '太腿', '額'];
    const part = parts[Math.floor(rand(s) * parts.length)];
    const sev = d >= 22 ? 2 : 1;
    s.cond.injuries.push({
      id: `inj${s.day}-${s.combat!.turn}`,
      label: `${part}の${sev === 2 ? '深い傷' : '裂傷'}`,
      severity: sev,
      days: sev === 2 ? 12 : 5,
    });
    log.push(`${part}に熱い痛みが走った。`);
  }
  return d;
}

function heroHit(s: GameState, c: CombatState, bonus: number): boolean {
  const e = enemy(c);
  const p = 0.5 + (skill(s, 'sword') + body(s, 'agi') * 0.4 - e.speed) / 80 + c.edge * 0.15 + bonus;
  return chance(s, clamp(p, 0.1, 0.95));
}

function heroDamage(s: GameState, c: CombatState, mult = 1) {
  const e = enemy(c);
  const raw = 6 + skill(s, 'sword') * 0.22 + body(s, 'str') * 0.18 + weaponBonus(s) - e.armor;
  return Math.max(1, raw * (0.8 + rand(s) * 0.4) * mult);
}

function enemyDamage(s: GameState, c: CombatState, it: EnemyIntent) {
  const e = enemy(c);
  const buff = c.buff ?? 0;
  return e.power * (it.power ?? 1) * (1 + buff) * (0.8 + rand(s) * 0.4) * (1 - c.edge * 0.1);
}

function learn(s: GameState, c: CombatState, k: StatKey, base: number) {
  const e = enemy(c);
  gain(s, k, base, { difficulty: e.level + 6, kind: 'combat', quality: 1.2 });
}

export type CombatResult = 'continue' | 'win' | 'lose' | 'fled';

export function playerMove(s: GameState, move: PlayerMove): CombatResult {
  const c = s.combat!;
  const e = enemy(c);
  const it = e.intents.find((i) => i.id === c.intent)!;
  const lv = c.read ?? 0;
  const log: string[] = [];
  const inRange = c.dist <= it.range;
  let dmgMult = inRange && (it.type === 'heavy' || it.type === 'light') ? 1 : 0;
  let heroDealt = 0;
  let observedNow = false;
  const readBonus = lv === 2 ? 0.2 : lv === 1 ? 0.08 : 0;

  switch (move) {
    case 'attack': {
      const lunge = c.dist === 2;
      if (lunge) c.dist = 1;
      learn(s, c, 'sword_p', 1.4);
      learn(s, c, 'str', 0.4);
      if (it.type === 'light' && inRange) {
        const fast = skill(s, 'sword') * 0.3 + body(s, 'agi') + readBonus * 40 > e.speed + rand(s) * 12;
        if (fast) {
          dmgMult = 0.5;
          log.push('相手より一瞬早く、刃が届いた。');
        }
      }
      if (it.type === 'reposition') log.push('相手は動き続けていて、狙いが定まらない。');
      const bonus = (lunge ? -0.12 : 0) + (it.type === 'reposition' ? -0.15 : 0) + (it.type === 'retreat' || it.type === 'call' ? 0.15 : 0);
      if (heroHit(s, c, bonus)) {
        // 会心：予兆を読み切っているほど、また有利な体勢ほど出やすい
        const crit = chance(s, 0.08 + (lv === 2 ? 0.1 : 0) + Math.max(0, c.edge) * 0.08);
        heroDealt = heroDamage(s, c, (it.type === 'call' ? 1.2 : 1) * (crit ? 1.8 : 1));
        if (crit) {
          log.push('【会心】刃が、吸い込まれるように急所へ入った。腕に、骨まで響く確かな手応え。');
          s.counters.crits = (s.counters.crits ?? 0) + 1;
        } else log.push(lunge ? '踏み込みざまに剣を振るう。手応えがあった。' : '振り下ろした剣が、確かに相手を捉えた。');
      } else {
        log.push(lunge ? '踏み込んだが、刃は空を切った。' : '剣は相手をかすめただけだった。');
      }
      c.edge = 0;
      break;
    }
    case 'guard': {
      learn(s, c, 'end', 0.5);
      learn(s, c, 'sword_p', 0.6);
      if (dmgMult > 0) {
        const block = it.type === 'light' ? 0.15 : clamp(0.55 - body(s, 'str') / 120 - skill(s, 'sword') / 200, 0.2, 0.6);
        dmgMult *= block;
        log.push('剣を立てて衝撃を受け止める。腕が痺れた。');
        if (it.type === 'heavy') c.edge = Math.max(c.edge, 1);
      } else {
        log.push('身構えたが、攻撃は来なかった。');
      }
      break;
    }
    case 'dodge': {
      learn(s, c, 'agi', 0.8);
      if (dmgMult > 0) {
        const p = 0.35 + (body(s, 'agi') - e.speed) / 60 + readBonus + (it.type === 'heavy' ? 0.1 : 0);
        if (chance(s, clamp(p, 0.1, 0.9))) {
          dmgMult = 0;
          log.push('体を投げ出すようにして、攻撃をかわした。');
          if (it.type === 'heavy') {
            c.edge = 2;
            log.push('大振りの後で、相手の体勢が崩れている。');
          }
        } else {
          dmgMult *= 0.7;
          log.push('かわしきれなかった。');
        }
      } else {
        log.push('身をひねったが、何も来なかった。');
      }
      break;
    }
    case 'back': {
      learn(s, c, 'agi', 0.5);
      const ok = chance(s, clamp(0.5 + (body(s, 'agi') - e.speed) / 50 + readBonus, 0.15, 0.9));
      if (ok) {
        c.dist = Math.min(3, c.dist + 1);
        if (dmgMult > 0 && c.dist > it.range) {
          dmgMult = 0;
          log.push('素早く後ろへ跳んだ。攻撃は届かなかった。');
        } else log.push('後ろへ下がって、間合いを取った。');
      } else {
        log.push('下がろうとしたが、足がもつれた。');
      }
      break;
    }
    case 'close': {
      c.dist = Math.max(0, c.dist - 1);
      log.push('じりじりと間合いを詰める。');
      if (it.type === 'heavy' && c.dist <= it.range) dmgMult = Math.max(dmgMult, 1.1);
      break;
    }
    case 'observe': {
      observedNow = true;
      gain(s, 'beast_p', 1.6, { difficulty: e.level + 8, kind: 'combat', key: `beast:obs:${e.loreKey}` });
      gain(s, 'wit', 0.6, { difficulty: e.level + 4 });
      log.push('相手の呼吸、重心、目の動きをじっと見る。');
      if (it.type === 'reposition') {
        c.edge = Math.max(c.edge, 0);
        log.push('回り込もうとする動きに合わせて、向きを変えた。');
      }
      break;
    }
    case 'magic': {
      gain(s, 'magic_p', 1.5, { difficulty: e.level + 6, kind: 'combat' });
      gain(s, 'focus', 0.6, {});
      const p = 0.45 + (s.stats.focus + s.stats.magic_p) / 120 - (s.cond.stress > 60 ? 0.2 : 0);
      if (chance(s, clamp(p, 0.15, 0.9))) {
        heroDealt = 5 + s.stats.magic_p * 0.35;
        log.push('指先から弾けた火花が、相手の顔を焼いた。');
        c.edge = Math.max(c.edge, 1);
      } else {
        log.push('術式が乱れて、火花は手元で虚しく散った。');
      }
      s.cond.fatigue = clamp(s.cond.fatigue + 6, 0, 100);
      break;
    }
    case 'flee': {
      const p = 0.25 + c.dist * 0.15 + (body(s, 'agi') - e.speed) / 60 + (it.type === 'retreat' || it.type === 'wait' ? 0.25 : 0);
      if (chance(s, clamp(p, 0.05, 0.9))) {
        log.push('背を向けて、全力で走った。');
        c.log = log;
        s.counters.fled = (s.counters.fled ?? 0) + 1;
        return 'fled';
      }
      log.push('逃げ道を塞がれた。');
      if (dmgMult > 0) dmgMult *= 1.2;
      break;
    }
    default: {
      const id = move.slice(5);
      const d = R.items.get(id);
      if (d?.use && (s.items[id] ?? 0) > 0) {
        log.push(d.use.run(s));
        s.items[id] -= 1;
      }
    }
  }

  // 同行者の援護
  if (c.companion && chance(s, 0.6)) {
    const comp = R.npcs.get(c.companion);
    heroDealt += 4 + rand(s) * 5;
    log.push(`${comp?.name ?? '仲間'}の一撃が、相手の脇を打った。`);
  }

  if (heroDealt > 0) c.enemyHp -= heroDealt;

  // 敵の行動
  if (c.enemyHp > 0) {
    const bf = c;
    if (it.type === 'heavy' || it.type === 'light') {
      if (!inRange && it.type === 'heavy') {
        c.dist = Math.max(0, c.dist - 1);
        log.push(`${e.name}が距離を詰めてきた。`);
      } else if (dmgMult > 0) {
        const d = hurt(s, enemyDamage(s, c, it) * dmgMult, log);
        log.push(d > 15 ? `${e.name}の一撃をまともに受けた。` : `${e.name}の攻撃を受けた。`);
        bf.buff = 0;
      }
      if (it.type === 'heavy' && inRange) c.dist = Math.min(c.dist, 1);
    } else if (it.type === 'reposition') {
      if (!observedNow) c.edge = Math.min(c.edge, -1);
      log.push(`${e.name}は横へ回り込むように動いた。`);
    } else if (it.type === 'retreat') {
      c.dist = Math.min(3, c.dist + 1);
      log.push(`${e.name}が距離を取った。`);
    } else if (it.type === 'call') {
      bf.buff = 0.25;
      log.push(`${e.name}の気配が、ひとまわり膨らんだ気がした。`);
    }
  }

  if (s.cond.hp < 40) gain(s, 'will', 0.8, { difficulty: 30 });

  c.observed = observedNow;
  c.turn += 1;
  c.log = log;

  if (c.enemyHp <= 0) {
    s.counters[`kill:${e.loreKey}`] = (s.counters[`kill:${e.loreKey}`] ?? 0) + 1;
    gain(s, 'beast_p', 1.2, { difficulty: e.level + 5, kind: 'combat' });
    for (const l of e.loot ?? []) if (chance(s, l.chance)) s.items[l.item] = (s.items[l.item] ?? 0) + 1;
    return 'win';
  }
  if (s.cond.hp <= 0 && c.loseMeansDeath && !c.lastStand) {
    // 理不尽な即死を避ける：一度だけ踏みとどまり、はっきりと警告する
    c.lastStand = true;
    s.cond.hp = 1;
    log.push('膝が崩れかけた。……次の一撃を受けたら、終わる。');
  } else if (s.cond.hp <= 0) return 'lose';
  const ratio = c.enemyHp / c.enemyMaxHp;
  if (e.fleeAt && ratio < e.fleeAt && chance(s, 0.35)) {
    log.push(`${e.name}は身を翻し、逃げていった。`);
    s.counters[`rout:${e.loreKey}`] = (s.counters[`rout:${e.loreKey}`] ?? 0) + 1;
    return 'win';
  }
  beginTurn(s);
  return 'continue';
}

export function enemyStateText(s: GameState): string {
  const c = s.combat!;
  return enemy(c).state(Math.max(0, c.enemyHp / c.enemyMaxHp));
}

export function enemyOf(s: GameState) {
  return enemy(s.combat!);
}
