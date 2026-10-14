/** Emotes próprios do jogo (SVG, estilo autocolante com contorno grosso). viewBox 0 0 64 64. */
const K = 'stroke="#1a1220" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"';

/** Cabeça de lutador com máscara (base para as caras). */
const head = (mask: string, trim: string) =>
  `<circle cx="32" cy="34" r="25" fill="#f2b98d" ${K}/>` +
  `<path d="M9 30 Q10 9 32 8 Q54 9 55 30 Q50 26 44 27 L32 33 L20 27 Q14 26 9 30Z" fill="${mask}" ${K}/>` +
  `<path d="M32 8 L32 24" stroke="${trim}" stroke-width="4" stroke-linecap="round"/>`;

export interface Emote {
  id: string;
  word: string;
  svg: string;
}

export const EMOTES: Emote[] = [
  {
    id: 'gg',
    word: 'GG!',
    svg: `<path d="M14 40 Q10 22 22 18 L40 16 Q54 16 54 30 L54 40 Q54 52 40 52 L24 52 Q16 52 14 40Z" fill="#e8283c" ${K}/>
      <path d="M22 18 Q20 30 30 30 L44 28" fill="none" ${K}/><path d="M18 46 h22" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round"/>
      <rect x="20" y="50" width="26" height="9" rx="3" fill="#fff" ${K}/>
      <text x="33" y="44" text-anchor="middle" font-family="Luckiest Guy, Impact, sans-serif" font-size="15" fill="#ffd23d" stroke="#1a1220" stroke-width="1.5">GG</text>`,
  },
  {
    id: 'fire',
    word: 'ON FIRE!',
    svg: `<path d="M32 4 Q42 16 40 22 Q48 14 48 8 Q60 24 56 40 Q52 58 32 60 Q12 58 8 40 Q6 26 18 16 Q18 24 24 26 Q20 12 32 4Z" fill="#ff6a00" ${K}/>
      <path d="M32 24 Q40 34 38 38 Q44 36 44 32 Q50 42 46 50 Q42 58 32 58 Q22 58 19 50 Q16 42 24 36 Q26 40 29 40 Q26 32 32 24Z" fill="#ffd23d"/>
      <path d="M32 40 Q37 46 36 52 Q34 57 30 56 Q26 54 28 48 Z" fill="#fff6c0"/>`,
  },
  {
    id: 'haha',
    word: 'HAHA!',
    svg: `${head('#3aa0ff', '#ffd23d')}
      <path d="M17 30 Q22 25 27 30" fill="none" ${K}/><path d="M37 30 Q42 25 47 30" fill="none" ${K}/>
      <path d="M18 39 Q32 41 46 39 Q44 54 32 54 Q20 54 18 39Z" fill="#7a1020" ${K}/>
      <path d="M21 41 Q32 43 43 41 L42 44 Q32 46 22 44Z" fill="#fff"/>
      <path d="M9 36 q-4 6 0 10" fill="#7ad0ff" stroke="#1a1220" stroke-width="2.5"/><path d="M55 36 q4 6 0 10" fill="#7ad0ff" stroke="#1a1220" stroke-width="2.5"/>`,
  },
  {
    id: 'whoa',
    word: 'WHOA!',
    svg: `${head('#b45cff', '#fff')}
      <circle cx="23" cy="31" r="6" fill="#fff" ${K}/><circle cx="41" cy="31" r="6" fill="#fff" ${K}/>
      <circle cx="23" cy="32" r="2.4" fill="#1a1220"/><circle cx="41" cy="32" r="2.4" fill="#1a1220"/>
      <ellipse cx="32" cy="48" rx="6" ry="7" fill="#7a1020" ${K}/>
      <path d="M50 10 l3 -6 M56 16 l6 -3 M46 6 l0 -5" stroke="#ffd23d" stroke-width="3.5" stroke-linecap="round"/>`,
  },
  {
    id: 'flex',
    word: 'FLEX!',
    svg: `<path d="M8 54 L22 54 Q30 50 34 42 Q38 50 50 48 Q62 44 58 30 Q54 18 42 24 Q38 14 32 10 L26 8 Q20 8 20 14 Q24 18 30 18 L32 22 Q22 30 20 40 L8 42Z" fill="#f2b98d" ${K}/>
      <path d="M40 30 Q48 26 52 32" fill="none" stroke="#c98a5a" stroke-width="3" stroke-linecap="round"/>
      <path d="M6 42 L22 42 L22 56 L6 56Z" fill="#e8283c" ${K}/>
      <path d="M46 10 l2 -5 M52 14 l5 -3 M54 20 l5 0" stroke="#ffd23d" stroke-width="3.5" stroke-linecap="round"/>`,
  },
  {
    id: 'cool',
    word: 'TOO EASY',
    svg: `${head('#1a1a26', '#e8283c')}
      <path d="M12 28 L52 28 L50 36 Q44 40 38 36 L35 31 L29 31 L26 36 Q20 40 14 36Z" fill="#1a1220" stroke="#1a1220" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M17 31 l6 0 M40 31 l6 0" stroke="#7af7ff" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M24 46 Q34 51 42 44" fill="none" ${K}/>`,
  },
  {
    id: 'grr',
    word: 'GRRR!',
    svg: `${head('#e8283c', '#1a1220')}
      <path d="M16 28 L28 32 M48 28 L36 32" ${K}/>
      <circle cx="23" cy="35" r="2.6" fill="#1a1220"/><circle cx="41" cy="35" r="2.6" fill="#1a1220"/>
      <rect x="21" y="43" width="22" height="9" rx="3" fill="#fff" ${K}/><path d="M27 43v9M32 43v9M37 43v9" stroke="#1a1220" stroke-width="2"/>
      <path d="M6 14 q4 -4 2 -8 M58 14 q-4 -4 -2 -8" fill="none" stroke="#cfd8e3" stroke-width="3.5" stroke-linecap="round"/>`,
  },
  {
    id: 'champ',
    word: 'CHAMP!',
    svg: `<path d="M4 28 Q4 22 10 22 L54 22 Q60 22 60 28 L60 40 Q60 46 54 46 L10 46 Q4 46 4 40Z" fill="#1a1a26" ${K}/>
      <ellipse cx="32" cy="34" rx="15" ry="16" fill="#ffd23d" ${K}/>
      <ellipse cx="32" cy="34" rx="9" ry="10" fill="#ffb31a" stroke="#1a1220" stroke-width="2.5"/>
      <path d="M32 27 l2.2 4.6 5 .6 -3.7 3.4 1 5 -4.5 -2.5 -4.5 2.5 1 -5 -3.7 -3.4 5 -.6Z" fill="#fff6c0" stroke="#1a1220" stroke-width="1.6"/>
      <circle cx="11" cy="34" r="4" fill="#ffd23d" ${K}/><circle cx="53" cy="34" r="4" fill="#ffd23d" ${K}/>`,
  },
];

export const emoteSvg = (e: Emote) => `<svg viewBox="0 0 64 64" aria-hidden="true">${e.svg}</svg>`;
