import { EYE_COLORS, SKIN_SHADES, SKIN_TONES, type Appearance } from '../data/appearance';
import { ITEMS, type Vis } from '../data/items';
import type { Loadout } from '../core/state';

/** Aparência + equipamento já resolvidos em cores/estilos prontos a desenhar. */
export interface Look {
  skin: string;
  skinShade: string;
  eyeColor: string;
  eyes: string;
  brows: string;
  mouth: string;
  beard: string;
  height: number;
  hair: Vis;
  hairColor: Vis;
  outfit: Vis;
  gloves: Vis;
  mask: Vis | null;
  aura: Vis | null;
}

const EMPTY: Vis = {};

export function resolveLook(a: Appearance, l: Pick<Loadout, 'outfit' | 'gloves' | 'mask' | 'aura'>): Look {
  return {
    skin: SKIN_TONES[a.skin] ?? SKIN_TONES[2],
    skinShade: SKIN_SHADES[a.skin] ?? SKIN_SHADES[2],
    eyeColor: EYE_COLORS[a.eyeColor] ?? EYE_COLORS[0],
    eyes: a.eyes,
    brows: a.brows,
    mouth: a.mouth,
    beard: a.beard,
    height: a.height,
    hair: ITEMS[a.hair]?.vis ?? EMPTY,
    hairColor: ITEMS[a.hairColor]?.vis ?? EMPTY,
    outfit: ITEMS[l.outfit]?.vis ?? EMPTY,
    gloves: ITEMS[l.gloves]?.vis ?? EMPTY,
    mask: l.mask ? ITEMS[l.mask]?.vis ?? null : null,
    aura: l.aura ? ITEMS[l.aura]?.vis ?? null : null,
  };
}
