// ヒントの計算は重いことがあるので、画面を止めないよう Web Worker で行う
import { findHint, replayMoves } from './hint';
import type { QueueStage } from './rules';

self.onmessage = (e: MessageEvent<{ id: number; stage: QueueStage; moves: number[] }>) => {
  const { id, stage, moves } = e.data;
  const hint = findHint(replayMoves(stage, moves));
  (self as unknown as Worker).postMessage({ id, hint });
};
