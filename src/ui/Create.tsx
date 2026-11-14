import { useState } from 'preact/hooks';
import type { GameState, Gender, Mode } from '../engine/types';
import { createGame, rollTalents, talentHints } from '../engine/creation';
import { NPC_IDS } from '../content';
import { beginGame } from '../engine/game';

const PRONOUNS = ['俺', '僕', '私', 'あたし', 'うち'];

function newSeed() {
  return (Math.random() * 2 ** 31) | 0;
}

export function Create(p: { onBack: () => void; onStart: (s: GameState) => void }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('x');
  const [pronoun, setPronoun] = useState('私');
  const [custom, setCustom] = useState('');
  const [mode, setMode] = useState<Mode>('standard');
  const [seed, setSeed] = useState(newSeed);
  const [step, setStep] = useState<'form' | 'origin'>('form');

  const pr = pronoun === '_' ? custom.trim() || '私' : pronoun;
  const hero = name.trim() || 'アル';

  if (step === 'origin') {
    const hints = talentHints(rollTalents(seed), pr);
    return (
      <div class="page">
        <h2 class="page-title">生い立ち</h2>
        <div class="novel">
          <p>{hero}は、南の農村ソラムで生まれ育った。</p>
          {hints.map((h) => (
            <p>{h}</p>
          ))}
          <p>十六の春、{pr}は村を出て、東の辺境都市カルナスへ向かった。</p>
        </div>
        <p class="muted small">生い立ちには、主人公の素質がそれとなく表れています。数値は表示されません。</p>
        <div class="row">
          <button class="btn ghost" onClick={() => setSeed(newSeed())}>
            別の生い立ちにする
          </button>
          <button
            class="btn primary"
            onClick={() => {
              const s = createGame({ name: hero, gender, pronoun: pr, mode, seed }, NPC_IDS);
              beginGame(s);
              p.onStart(s);
            }}
          >
            この生い立ちで始める
          </button>
        </div>
        <button class="btn link" onClick={() => setStep('form')}>
          ← 戻る
        </button>
      </div>
    );
  }

  return (
    <div class="page">
      <h2 class="page-title">主人公</h2>
      <label class="field">
        <span>名前</span>
        <input value={name} maxLength={10} placeholder="アル" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>
      <fieldset class="field">
        <legend>性別</legend>
        <div class="seg">
          {(
            [
              ['m', '男性'],
              ['f', '女性'],
              ['x', '答えない'],
            ] as const
          ).map(([v, l]) => (
            <button class={`seg-btn ${gender === v ? 'on' : ''}`} onClick={() => setGender(v)}>
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset class="field">
        <legend>一人称</legend>
        <div class="seg wrap">
          {PRONOUNS.map((v) => (
            <button class={`seg-btn ${pronoun === v ? 'on' : ''}`} onClick={() => setPronoun(v)}>
              {v}
            </button>
          ))}
          <button class={`seg-btn ${pronoun === '_' ? 'on' : ''}`} onClick={() => setPronoun('_')}>
            その他
          </button>
        </div>
        {pronoun === '_' && <input value={custom} maxLength={4} placeholder="例：自分" onInput={(e) => setCustom((e.target as HTMLInputElement).value)} />}
      </fieldset>
      <fieldset class="field">
        <legend>難易度</legend>
        <div class="seg">
          <button class={`seg-btn ${mode === 'standard' ? 'on' : ''}`} onClick={() => setMode('standard')}>
            標準
          </button>
          <button class={`seg-btn ${mode === 'ironman' ? 'on' : ''}`} onClick={() => setMode('ironman')}>
            鉄人
          </button>
        </div>
        <p class="muted small">
          {mode === 'standard'
            ? '死亡すると、その日の朝からやり直せます。手動セーブも使えます。'
            : 'セーブは自動の1枠のみ。死亡すると、その人生はそこで終わります。'}
        </p>
      </fieldset>
      <div class="row">
        <button class="btn ghost" onClick={p.onBack}>
          戻る
        </button>
        <button class="btn primary" onClick={() => setStep('origin')}>
          次へ
        </button>
      </div>
    </div>
  );
}
