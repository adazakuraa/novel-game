import { useEffect, useState } from 'preact/hooks';
import type { GameState } from '../engine/types';
import { deleteAll, loadCurrent, loadDayStart, saveCurrent, saveDayStart } from '../engine/save';
import { Title } from './Title';
import { Create } from './Create';
import { Game } from './Game';
import { migrate } from '../engine/creation';
import { NPC_IDS } from '../content';

type Screen = 'loading' | 'title' | 'create' | 'game';

export function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [state, setState] = useState<GameState | null>(null);
  const [hasSave, setHasSave] = useState(false);

  useEffect(() => {
    loadCurrent().then((s) => {
      setHasSave(!!s && !s.ended);
      setScreen('title');
    });
  }, []);

  const commit = (s: GameState) => {
    migrate(s, NPC_IDS);
    if (s.flags._newDay) {
      delete s.flags._newDay;
      if (!s.scene && !s.combat) void saveDayStart(s);
      else s.flags._dayStartPending = true;
    } else if (s.flags._dayStartPending && !s.scene && !s.combat) {
      delete s.flags._dayStartPending;
      void saveDayStart(s);
    }
    setState(s);
    void saveCurrent(s);
  };

  /** 状態を複製して変更し、保存する */
  const update = (fn: (s: GameState) => void) => {
    if (!state) return;
    const s = structuredClone(state);
    fn(s);
    commit(s);
  };

  if (screen === 'loading') return <div class="center muted">読み込み中…</div>;
  if (screen === 'title')
    return (
      <Title
        hasSave={hasSave}
        onContinue={async () => {
          const s = await loadCurrent();
          if (s) {
            setState(migrate(s, NPC_IDS));
            setScreen('game');
          }
        }}
        onNew={() => setScreen('create')}
        onImport={(s) => {
          commit(s);
          void saveDayStart(s);
          setScreen('game');
        }}
      />
    );
  if (screen === 'create')
    return (
      <Create
        onBack={() => setScreen('title')}
        onStart={(s) => {
          void saveDayStart(s);
          commit(s);
          setScreen('game');
        }}
      />
    );
  return (
    <Game
      state={state!}
      update={update}
      replace={commit}
      onTitle={async () => {
        const s = await loadCurrent();
        setHasSave(!!s && !s.dead);
        setScreen('title');
      }}
      onRewind={async () => {
        const s = await loadDayStart();
        if (s) commit(s);
      }}
      onWipe={async () => {
        await deleteAll();
        setHasSave(false);
        setState(null);
        setScreen('title');
      }}
    />
  );
}
