// 端末内セーブ（IndexedDB）。使えない環境では localStorage にフォールバックする。
import type { GameState } from './types';

const DB = 'novel-game';
const STORE = 'saves';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put(key: string, value: unknown) {
  try {
    const db = await openDb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    localStorage.setItem(`${DB}:${key}`, JSON.stringify(value));
  }
}

async function get<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise<T | undefined>((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => res(r.result as T | undefined);
      r.onerror = () => rej(r.error);
    });
  } catch {
    const v = localStorage.getItem(`${DB}:${key}`);
    return v ? (JSON.parse(v) as T) : undefined;
  }
}

async function del(key: string) {
  try {
    const db = await openDb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    localStorage.removeItem(`${DB}:${key}`);
  }
}

/** 自動セーブ（常に1枠） */
export const saveCurrent = (s: GameState) => put('current', s);
export const loadCurrent = () => get<GameState>('current');
/** その日の朝の状態（標準モードで死亡したときの巻き戻し先） */
export const saveDayStart = (s: GameState) => put('daystart', s);
export const loadDayStart = () => get<GameState>('daystart');
/** 手動セーブ枠（標準モードのみ） */
export const saveSlot = (n: number, s: GameState) => put(`slot${n}`, s);
export const loadSlot = (n: number) => get<GameState>(`slot${n}`);
export const deleteAll = async () => {
  await del('current');
  await del('daystart');
};

export function exportJson(s: GameState): string {
  return JSON.stringify({ format: 'novel-game-save', version: s.version, state: s });
}

export function importJson(text: string): GameState {
  const obj = JSON.parse(text);
  if (obj?.format !== 'novel-game-save' || !obj.state) throw new Error('セーブデータの形式が正しくありません');
  return obj.state as GameState;
}
