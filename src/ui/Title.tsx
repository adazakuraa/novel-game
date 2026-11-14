import { useRef, useState } from 'preact/hooks';
import type { GameState } from '../engine/types';
import { importJson } from '../engine/save';
import { CHAPTERS, GAME_VERSION } from '../content/meta';

export function Title(p: { hasSave: boolean; onContinue: () => void; onNew: () => void; onImport: (s: GameState) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  return (
    <div class="title-screen">
      <div class="title-mark">
        <p class="title-sub">辺境都市カルナス</p>
        <h1>灰縁の灯</h1>
      </div>
      <div class="title-status">
        {CHAPTERS.map((c) => (
          <p>
            {c.title}　<span class={c.status === '完結' ? 'done' : 'wip'}>{c.status}</span>
          </p>
        ))}
        <p class="ver">{GAME_VERSION}　開発中</p>
      </div>
      <div class="title-menu">
        {p.hasSave && (
          <button class="btn primary" onClick={p.onContinue}>
            続きから
          </button>
        )}
        <button class={`btn ${p.hasSave ? '' : 'primary'}`} onClick={p.onNew}>
          はじめから
        </button>
        <button class="btn ghost" onClick={() => file.current?.click()}>
          セーブデータを読み込む
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            try {
              p.onImport(importJson(await f.text()));
            } catch (x) {
              setErr((x as Error).message);
            }
          }}
        />
        {err && <p class="error">{err}</p>}
      </div>
      <p class="title-foot muted">セーブデータはこの端末のブラウザ内に保存されます。</p>
    </div>
  );
}
