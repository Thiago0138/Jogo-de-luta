/** Opções de aparência gratuitas e paletas usadas pelo criador de personagem. */

export interface Appearance {
  skin: number;
  hair: string;
  hairColor: string;
  eyes: string;
  eyeColor: number;
  brows: string;
  mouth: string;
  beard: string;
  /** Escala visual 0.94 – 1.06. Não influencia o jogo. */
  height: number;
}

export const SKIN_TONES = ['#ffe0c7', '#f6c9a4', '#e8b083', '#d29466', '#b9774c', '#94593a', '#6e3f28', '#4a2a1c'];
export const SKIN_SHADES = SKIN_TONES.map((c) => shade(c, -0.18));

export const EYE_COLORS = ['#3b2414', '#1f6fd1', '#2f9e4a', '#6b7a88', '#111111', '#8a5a2b'];

export const EYE_STYLES: { id: string; name: string }[] = [
  { id: 'normal', name: 'Normal' },
  { id: 'determinado', name: 'Determinado' },
  { id: 'grandes', name: 'Grandes' },
  { id: 'sonolento', name: 'Sonolento' },
  { id: 'estreitos', name: 'Estreitos' },
];

export const BROW_STYLES: { id: string; name: string }[] = [
  { id: 'normal', name: 'Normal' },
  { id: 'grossas', name: 'Grossas' },
  { id: 'zangadas', name: 'Zangadas' },
  { id: 'finas', name: 'Finas' },
  { id: 'nenhuma', name: 'Nenhuma' },
];

export const MOUTH_STYLES: { id: string; name: string }[] = [
  { id: 'sorriso', name: 'Sorriso' },
  { id: 'serio', name: 'Sério' },
  { id: 'maroto', name: 'Maroto' },
  { id: 'dentes', name: 'Dentes' },
  { id: 'grito', name: 'Grito' },
];

export const BEARD_STYLES: { id: string; name: string }[] = [
  { id: 'nenhuma', name: 'Nenhuma' },
  { id: 'curta', name: 'Curta' },
  { id: 'bigode', name: 'Bigode' },
  { id: 'cavanhaque', name: 'Cavanhaque' },
  { id: 'grande', name: 'Grande' },
];

export const DEFAULT_APPEARANCE: Appearance = {
  skin: 2,
  hair: 'h_curto',
  hairColor: 'hc_castanho',
  eyes: 'normal',
  eyeColor: 0,
  brows: 'normal',
  mouth: 'sorriso',
  beard: 'nenhuma',
  height: 1,
};

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt < 0) {
    r = Math.round(r * (1 + amt));
    g = Math.round(g * (1 + amt));
    b = Math.round(b * (1 + amt));
  } else {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  }
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
