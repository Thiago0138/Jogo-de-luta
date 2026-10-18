import { EYE_COLORS, SKIN_SHADES, SKIN_TONES, shade, type Appearance } from '../data/appearance';
import { ITEMS, type Vis } from '../data/items';
import type { Loadout } from '../core/state';

/** Aparência + equipamento já resolvidos em cores/estilos prontos a desenhar. */
export interface Look {
  skin: string;
  skinShade: string;
  /** Cor do corpo (pele ou fato de corpo inteiro). */
  body: string;
  bodyShade: string;
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
/** Sem traje equipado: calções simples pretos. */
const PLAIN: Vis = { style: 'trunks', c1: '#24242c', c2: '#4a4a56' };

/** Materiais que também mudam a cor da cabeça (golems e corpo cósmico). */
const HEAD_MAT: Record<string, string> = { lava: '#4a2c22', ice: '#a8e2ff', cosmic: '#2a1a6a', gold: '#e8b21c' };

export function resolveLook(a: Appearance, l: Pick<Loadout, 'outfit' | 'gloves' | 'mask' | 'aura'>): Look {
  const o = ITEMS[l.outfit]?.vis ?? PLAIN;
  const hm = o.mat ? HEAD_MAT[o.mat] : undefined;
  const skin = hm ?? SKIN_TONES[a.skin] ?? SKIN_TONES[2];
  const skinShade = hm ? shade(hm, -0.25) : SKIN_SHADES[a.skin] ?? SKIN_SHADES[2];
  const body = o.suit ?? skin;
  return {
    skin,
    skinShade,
    body,
    bodyShade: o.suit ? shade(o.suit, -0.25) : skinShade,
    eyeColor: EYE_COLORS[a.eyeColor] ?? EYE_COLORS[0],
    eyes: a.eyes,
    brows: a.brows,
    mouth: a.mouth,
    beard: a.beard,
    height: a.height,
    hair: ITEMS[a.hair]?.vis ?? EMPTY,
    hairColor: ITEMS[a.hairColor]?.vis ?? EMPTY,
    outfit: ITEMS[l.outfit]?.vis ?? PLAIN,
    gloves: ITEMS[l.gloves]?.vis ?? { style: 'bare' },
    mask: l.mask ? ITEMS[l.mask]?.vis ?? null : null,
    aura: l.aura ? ITEMS[l.aura]?.vis ?? null : null,
  };
}
