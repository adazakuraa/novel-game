// 共通UI：タイトル・ステージ選択・プレイ画面の枠・設定。ゲームモード固有の盤面は modes/* が描く。
import { useRef, useState } from 'preact/hooks';
import type { PlayStatus } from '../core/mode';
import { load, markCleared, progress, reset, save, setCurrent, unlockedUpTo, type SaveData, type Speed } from '../core/save';
import { QueueGame } from '../modes/queue/view/QueueGame';
import type { QueueStage } from '../modes/queue/rules';
import { THEMES } from '../themes';
import queueStages from '../../stages/queue.json';

const MODE = 'queue';
const STAGES = queueStages as QueueStage[];
const theme = THEMES.sushi;
export const VERSION = '0.1.0';

type Screen = { k: 'title' } | { k: 'select' } | { k: 'play'; stage: number };

const params = new URLSearchParams(location.search);
const speedOverride = params.get('anim') === '0' ? ('off' as Speed) : null;

export function App() {
  const [data, setData] = useState<SaveData>(() => load());
  const [screen, setScreen] = useState<Screen>(() => ({ k: 'title' }));
  const [settings, setSettings] = useState(false);
  const latest = useRef(data);
  const commit = (fn: (d: SaveData) => SaveData) => {
    const d = fn(latest.current);
    latest.current = d; setData(d); save(d);
  };
  const p = progress(data, MODE);
  const unlocked = unlockedUpTo(p, STAGES.length);
  const allClear = p.cleared.length >= STAGES.length;

  return (
    <div class="app">
      {screen.k === 'title' && (
        <div class="title screen">
          <div class="noren-top" />
          <h1>{theme.title}</h1>
          <p class="sub">お客さんを順番どおりに席へ案内するパズル</p>
          <div class="menu">
            <button class="btn primary" onClick={() => setScreen({ k: 'play', stage: p.current?.stage ?? unlocked })}>
              {p.current ? `つづきから（ステージ ${p.current.stage}）` : allClear ? 'ステージを選ぶ' : `ステージ ${unlocked} から`}
            </button>
            <button class="btn" onClick={() => setScreen({ k: 'select' })}>ステージを選ぶ</button>
            <button class="btn ghost" onClick={() => setSettings(true)}>設定</button>
          </div>
          <p class="progress">クリア {p.cleared.length} / {STAGES.length}{allClear ? ' ・全ステージ制覇！' : ''}</p>
          <p class="ver">v{VERSION}</p>
        </div>
      )}
      {screen.k === 'select' && (
        <div class="select screen">
          <header class="bar">
            <button class="icon" aria-label="戻る" onClick={() => setScreen({ k: 'title' })}>←</button>
            <span class="bar-title">ステージを選ぶ</span>
            <span class="bar-right">{p.cleared.length}/{STAGES.length}</span>
          </header>
          <div class="grid">
            {STAGES.map((st) => {
              const n = st.id;
              const done = p.cleared.includes(n);
              const open = done || n <= unlocked;
              return (
                <button class={'stage' + (done ? ' done' : open ? ' open' : ' closed')} disabled={!open}
                  aria-label={`ステージ${n}${done ? '（クリア済み）' : open ? '' : '（未解放）'}`}
                  onClick={() => setScreen({ k: 'play', stage: n })}>
                  <span class="n">{n}</span>
                  {done && <span class="mark">✓</span>}
                  {st.intro && n > 1 && <span class="new">新</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {screen.k === 'play' && (
        <Play key={screen.stage} stage={STAGES[screen.stage - 1]} data={data} commit={commit}
          speed={speedOverride ?? data.settings.speed}
          onBack={() => setScreen({ k: 'select' })}
          onNext={() => setScreen(screen.stage < STAGES.length ? { k: 'play', stage: screen.stage + 1 } : { k: 'select' })} />
      )}
      {settings && (
        <Settings data={data} onClose={() => setSettings(false)}
          onSpeed={(sp) => commit((d) => ({ ...d, settings: { ...d.settings, speed: sp } }))}
          onReset={() => { reset(); const d = load(); latest.current = d; setData(d); setSettings(false); }} />
      )}
    </div>
  );
}

function Play({ stage, data, commit, speed, onBack, onNext }: {
  stage: QueueStage; data: SaveData; commit(fn: (d: SaveData) => SaveData): void; speed: Speed; onBack(): void; onNext(): void;
}) {
  const cur = progress(data, MODE).current;
  const initial = cur?.stage === stage.id ? cur.moves : [];
  const [run, setRun] = useState(0);                 // やり直しのたびに増やして盤面を作り直す
  const [moves, setMoves] = useState(initial);
  const [end, setEnd] = useState<PlayStatus | null>(null);
  const [intro, setIntro] = useState(!!stage.intro && initial.length === 0);
  const [confirm, setConfirm] = useState(false);

  const restart = () => {
    setRun((r) => r + 1); setMoves([]); setEnd(null); setConfirm(false);
    commit((d) => setCurrent(d, MODE, undefined));
  };

  return (
    <div class="play screen">
      <header class="bar">
        <button class="icon" aria-label="ステージ選択へ" onClick={onBack}>←</button>
        <span class="bar-title">ステージ {stage.id}</span>
        <button class="icon" aria-label="最初からやり直す" onClick={() => (moves.length && !end ? setConfirm(true) : restart())}>↻</button>
      </header>
      <QueueGame key={run} stage={stage} theme={theme} speed={speed} initialMoves={run === 0 ? initial : []}
        onMove={(m) => { setMoves(m); commit((d) => setCurrent(d, MODE, { stage: stage.id, moves: m })); }}
        onEnd={(st) => {
          setEnd(st);
          if (st === 'cleared') commit((d) => markCleared(d, MODE, stage.id));
        }} />
      {intro && (
        <div class="overlay soft" onClick={() => setIntro(false)}>
          <div class="card">
            <h2>{stage.id === 1 ? 'あそびかた' : '新しい要素'}</h2>
            <p>{stage.intro}</p>
            <button class="btn primary" onClick={() => setIntro(false)}>はじめる</button>
          </div>
        </div>
      )}
      {confirm && (
        <div class="overlay soft">
          <div class="card">
            <h2>最初からやり直しますか？</h2>
            <div class="row">
              <button class="btn" onClick={() => setConfirm(false)}>つづける</button>
              <button class="btn primary" onClick={restart}>やり直す</button>
            </div>
          </div>
        </div>
      )}
      {end === 'cleared' && (
        <div class="overlay win">
          <div class="card">
            <h2>{theme.words.clear}</h2>
            <p>ステージ {stage.id} クリア</p>
            <div class="row">
              <button class="btn" onClick={onBack}>ステージ選択</button>
              <button class="btn primary" onClick={onNext}>{stage.id < STAGES.length ? '次のステージへ' : 'おわり'}</button>
            </div>
          </div>
        </div>
      )}
      {(end === 'full' || end === 'stuck') && (
        <div class="overlay lose">
          <div class="card">
            <h2>{end === 'full' ? theme.words.full : theme.words.stuck}</h2>
            <p>何度でも無料でやり直せます。</p>
            <div class="row">
              <button class="btn" onClick={onBack}>ステージ選択</button>
              <button class="btn primary" onClick={restart}>最初からやり直す</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Settings({ data, onClose, onSpeed, onReset }: { data: SaveData; onClose(): void; onSpeed(s: Speed): void; onReset(): void }) {
  const [sure, setSure] = useState(false);
  const opts: [Speed, string][] = [['normal', '標準'], ['fast', '速い'], ['off', 'なし']];
  return (
    <div class="overlay soft" onClick={onClose}>
      <div class="card" onClick={(e) => e.stopPropagation()}>
        <h2>設定</h2>
        <p class="lbl">演出の速さ</p>
        <div class="seg">
          {opts.map(([v, l]) => (
            <button class={'btn' + (data.settings.speed === v ? ' on' : '')} onClick={() => onSpeed(v)}>{l}</button>
          ))}
        </div>
        <p class="lbl">データ</p>
        {!sure ? <button class="btn ghost" onClick={() => setSure(true)}>進行データを消す</button> : (
          <button class="btn danger" onClick={onReset}>本当に消す（元に戻せません）</button>
        )}
        <button class="btn primary" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}
