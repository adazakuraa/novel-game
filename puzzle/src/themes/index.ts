import type { FunctionComponent } from 'preact';
import { sushi, type Theme } from './theme';
import { ArtDefs, Customer, Noren, Plate } from './sushiArt';

export interface ThemeArt {
  Defs: FunctionComponent<{ theme: Theme }>;
  Customer: FunctionComponent<{ theme: Theme; kind: number }>;
  Plate: FunctionComponent<{ theme: Theme; kind: number; small?: boolean }>;
  Noren: FunctionComponent<{ theme: Theme; queue: number[]; dir: string }>;
}

export type ThemeWithArt = Theme & { art: ThemeArt };

export const THEMES: Record<string, ThemeWithArt> = {
  sushi: { ...sushi, art: { Defs: ArtDefs, Customer, Plate, Noren } },
};
