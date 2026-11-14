// 「今、気になっていること」。次に向かう先を、いつも見えるところに置く（能力の数値は出さない）。
import type { GameState } from '../engine/types';
import { R } from '../engine/registry';
import { trainingDays } from './npcs';
import { canTakeTest } from './events';
import { TIDE_DAY } from './chapter1b';
import { isMember } from '../engine/affil';

export function concerns(s: GameState): string[] {
  const out: string[] = [];
  const push = (t: string | false | undefined | null) => t && out.push(t);

  if (s.quest) {
    const q = R.quests.get(s.quest.id);
    const left = s.quest.deadline - s.day;
    push(s.quest.data.done ? `「${q?.title}」をギルドに報告する` : `依頼「${q?.title}」　期限まであと${left}日`);
  }
  if (s.day <= 7 && trainingDays(s) < 3) push(`講習を受ける（七日目までにあと${3 - trainingDays(s)}日）`);
  if (s.rank === 0 && s.flags.testOpen) push(canTakeTest(s) ? '昇級審査を受けられる（訓練場でガラドに申し込む）' : '昇級審査には、まだ足りないものがある（訓練場で確かめられる）');
  if (s.rank === 0 && s.flags.boardOpen && (s.counters.questDone ?? 0) === 0) push('最初の依頼をこなす（ギルドの掲示板）');

  if (s.flags.prediction !== undefined && s.seen.great_tide === undefined) push(`大潮の夜まで、あと${TIDE_DAY - s.day}日`);
  if (s.flags.prediction !== undefined && !s.npcs.noin.topicsUsed.warn && s.seen.great_tide === undefined) push('大潮の予測を、誰かに伝えるべきか');
  if (s.flags.noinQuest && s.flags['questDone:q_sample'] === undefined) push('ノインに頼まれた、澱溜まりの泥');
  if (s.flags.noinRuin && s.flags['questDone:q_ruin'] === undefined && s.rank >= 1) push('ノインに頼まれた、旧街道の標石の欠片');
  if (s.flags.lyneInjured && s.npcs.lyne.away <= 0 && !s.npcs.lyne.topicsUsed.injured) push('リーネの怪我の具合');
  if (s.seen.lyne_letter !== undefined && s.seen.lyne_decide === undefined) push('リーネに届いた、縁談の手紙');
  if (s.flags.heardGaradQuit && !s.flags.garadStays && !s.flags.garadQuit) push('ガラドが教官を辞めるという噂');

  if (typeof s.flags.catHunt === 'number' && !s.flags.catDone) push(s.flags.catClue ? '迷い猫ボタン（東門のあたりにいるらしい）' : '迷い猫ボタン（市場か宿で聞き込みを）');
  if (s.items.irontag) push('錆びた鉄の札を、マルタに渡すかどうか');
  if (s.flags.martaDebt && !s.seen.godwin_arrive) push('灯り亭の家賃のこと');

  for (const id of ['institute', 'berg', 'garrison']) {
    if (s.flags[`offer:${id}`] === 'pending' && !isMember(s, id)) push(`${R.affiliations.get(id)?.name}からの誘いに、まだ返事をしていない`);
  }
  if (s.flags.needDoorHelp && !s.flags.doorKey) push('旧水道の扉の紋様を、ノインに見せる');
  if (s.flags.doorKey && !s.flags.doorOpen) push('旧水道の扉を、教わった通りに開けてみる');
  if (s.flags.aqueductOpen && !s.flags.foundHall && !s.flags.needDoorHelp) push('旧水道の奥に、何があるのか');

  if (s.cond.injuries.some((i) => i.severity >= 2)) push('深い傷が治るまで、無理はしないほうがいい');
  if ((s.counters.tab ?? 0) > 0) push(`マルタに待ってもらっている宿代（${s.counters.tab}銅貨）`);
  else if (s.money < 20) push('手持ちが心もとない');
  return out.slice(0, 5);
}
