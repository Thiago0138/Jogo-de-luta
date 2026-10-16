/**
 * Ícones do jogo desenhados em SVG (substituem os emojis): contorno escuro como os lutadores,
 * gradientes e brilhos. Todos partilham um único sprite injetado uma vez no documento.
 */

const O = 'stroke="#1a1220" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"';
const O2 = 'stroke="#1a1220" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';
const HI = 'fill="#fff" opacity=".55"';

const DEFS = `
<linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a8"/><stop offset=".45" stop-color="#ffcc2e"/><stop offset="1" stop-color="#d98a00"/></linearGradient>
<linearGradient id="gGold2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#c47a00"/></linearGradient>
<linearGradient id="gGem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8f4ff"/><stop offset=".5" stop-color="#3fb4ff"/><stop offset="1" stop-color="#2a54e0"/></linearGradient>
<linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a85"/><stop offset=".5" stop-color="#ec2b3c"/><stop offset="1" stop-color="#a5111f"/></linearGradient>
<linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset=".5" stop-color="#2f7bff"/><stop offset="1" stop-color="#1c3fb0"/></linearGradient>
<linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6ff8a"/><stop offset="1" stop-color="#2fae3a"/></linearGradient>
<linearGradient id="gPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4b8ff"/><stop offset="1" stop-color="#7a3cff"/></linearGradient>
<linearGradient id="gSilver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c9d2de"/><stop offset="1" stop-color="#7d8796"/></linearGradient>
<linearGradient id="gWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9894a"/><stop offset="1" stop-color="#7a4520"/></linearGradient>
<linearGradient id="gFire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3a00"/><stop offset=".55" stop-color="#ff8a00"/><stop offset="1" stop-color="#ffe14a"/></linearGradient>
<linearGradient id="gSkin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6c9a4"/><stop offset="1" stop-color="#c98a5a"/></linearGradient>
<linearGradient id="gPaper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8e6"/><stop offset="1" stop-color="#e9d6a8"/></linearGradient>
<linearGradient id="gDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4560"/><stop offset="1" stop-color="#22202e"/></linearGradient>
<linearGradient id="gMat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cdd6e6"/></linearGradient>
<radialGradient id="gGlow"><stop offset="0" stop-color="#fff6c0"/><stop offset="1" stop-color="#fff6c0" stop-opacity="0"/></radialGradient>
`;

/** Desenho de cada ícone (viewBox 0 0 64 64). */
const I: Record<string, string> = {
  // ───────── moedas e recursos ─────────
  coin: `<circle cx="32" cy="34" r="25" fill="#b8740a" ${O}/><circle cx="32" cy="30" r="25" fill="url(#gGold)" ${O}/><circle cx="32" cy="30" r="17" fill="none" stroke="#c47a00" stroke-width="3"/><path d="M22 34l3-11 7 6 7-6 3 11z" fill="#c47a00"/><path d="M14 22a20 20 0 0 1 12-10" fill="none" stroke="#fff" stroke-width="3.5" opacity=".7" stroke-linecap="round"/>`,
  gem: `<path d="M18 10h28l12 16-26 32L6 26z" fill="url(#gGem)" ${O}/><path d="M6 26h52M18 10l6 16 8-16 8 16 6-16M24 26l8 32 8-32" fill="none" stroke="#1c3fb0" stroke-width="2" opacity=".55"/><path d="M18 12l-8 13h12z" ${HI}/>`,
  trophy: `<path d="M18 10h28v14a14 14 0 0 1-28 0z" fill="url(#gGold)" ${O}/><path d="M18 14H9v5a10 10 0 0 0 10 10M46 14h9v5a10 10 0 0 1-10 10" fill="none" ${O}/><path d="M28 37h8v9h-8z" fill="url(#gGold2)" ${O}/><path d="M19 46h26l3 9H16z" fill="url(#gWood)" ${O}/><path d="M23 14v9a9 9 0 0 0 5 8" fill="none" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/>`,
  xp: `<path d="M32 5l8 17 18 2-13 13 4 19-17-9-17 9 4-19L6 24l18-2z" fill="url(#gGold)" ${O}/><path d="M32 14l4 10" stroke="#fff" stroke-width="3.5" opacity=".7" stroke-linecap="round"/>`,
  fire: `<path d="M32 58c-13 0-20-8-20-19 0-11 9-16 10-27 6 4 9 10 9 15 3-3 4-8 3-13 10 6 18 15 18 26 0 11-8 18-20 18z" fill="url(#gFire)" ${O}/><path d="M32 56c-6 0-10-4-10-9s5-8 6-13c4 3 6 6 6 9 2-1 3-3 3-5 4 3 5 6 5 9 0 5-4 9-10 9z" fill="#ffe680"/>`,
  medal: `<path d="M20 4h10l6 18h-10zM44 4H34l-6 18h10z" fill="url(#gRed)" ${O2}/><circle cx="32" cy="40" r="18" fill="url(#gGold)" ${O}/><path d="M32 29l3.5 7 7.5 1-5.5 5 1.5 7.5L32 46l-7 3.5 1.5-7.5-5.5-5 7.5-1z" fill="#d98a00"/>`,
  bolt: `<path d="M36 4L12 36h16l-6 24 28-34H33z" fill="url(#gGold)" ${O}/><path d="M33 10l-14 20" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/>`,
  heart: `<path d="M32 56S6 40 6 22a13 13 0 0 1 26-5 13 13 0 0 1 26 5c0 18-26 34-26 34z" fill="url(#gRed)" ${O}/><path d="M15 17a7 7 0 0 1 8-4" stroke="#fff" stroke-width="4" opacity=".7" stroke-linecap="round" fill="none"/>`,
  chest: `<path d="M8 28h48v26H8z" fill="url(#gWood)" ${O}/><path d="M8 28c0-10 6-18 24-18s24 8 24 18z" fill="url(#gWood)" ${O}/><path d="M8 28h48" ${O}/><path d="M18 11v43M46 11v43" stroke="url(#gGold)" stroke-width="6"/><path d="M18 11v43M46 11v43" fill="none" stroke="#1a1220" stroke-width="1.5" opacity=".5"/><rect x="26" y="24" width="12" height="13" rx="2" fill="url(#gGold)" ${O2}/><circle cx="32" cy="30" r="2" fill="#1a1220"/>`,
  // ───────── navegação ─────────
  ring: `<path d="M6 40l10-22h32l10 22z" fill="url(#gMat)" ${O}/><path d="M6 40v6h52v-6" fill="#d6202f" ${O}/><path d="M14 22v-8M50 22v-8M8 40V28M56 40V28" ${O}/><path d="M14 16h36M12 21h40M9 26l5-10M55 26l-5-10" fill="none" stroke="#ff4a5a" stroke-width="2.6"/><path d="M14 26h36" stroke="#3a8bff" stroke-width="2.6"/><circle cx="14" cy="14" r="3" fill="#d6202f" ${O2}/><circle cx="50" cy="14" r="3" fill="#2f7bff" ${O2}/><ellipse cx="32" cy="33" rx="9" ry="3.5" fill="none" stroke="#d6202f" stroke-width="2"/>`,
  shop: `<path d="M10 22h44l-4 34H14z" fill="url(#gRed)" ${O}/><path d="M22 22v-6a10 10 0 0 1 20 0v6" fill="none" ${O}/><circle cx="32" cy="39" r="9" fill="url(#gGold)" ${O2}/><path d="M32 34v10M29 36h4a2 2 0 0 1 0 4h-3a2 2 0 0 0 0 4h4" fill="none" stroke="#c47a00" stroke-width="2"/><path d="M14 26l-2 18" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round"/>`,
  collection: `<rect x="8" y="14" width="26" height="36" rx="4" transform="rotate(-14 21 32)" fill="url(#gPurple)" ${O}/><rect x="30" y="14" width="26" height="36" rx="4" transform="rotate(12 43 32)" fill="url(#gBlue)" ${O}/><rect x="19" y="10" width="26" height="38" rx="4" fill="url(#gGold)" ${O}/><path d="M32 18l3 6 6.5.8-4.8 4.5 1.3 6.5L32 32.6l-6 3.2 1.3-6.5-4.8-4.5L29 24z" fill="#fff" opacity=".9"/>`,
  missions: `<path d="M14 8h30l6 6v42H14z" fill="url(#gPaper)" ${O}/><path d="M44 8v6h6" fill="#e9d6a8" ${O2}/><path d="M20 22l3 3 6-6M20 34l3 3 6-6" fill="none" stroke="#2fae3a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M33 23h11M33 35h11M20 46h24" stroke="#8a7350" stroke-width="3" stroke-linecap="round"/>`,
  fighter: `<path d="M8 50c2-12 8-16 14-16l4-10c-6-1-9-6-8-11 1-4 6-7 11-5 4 2 6 7 4 11l-2 4c9-2 18 3 20 12 1 7-3 14-11 16-10 2-24 2-32-1z" fill="url(#gSkin)" ${O}/><path d="M30 34c3 4 9 5 13 2" fill="none" stroke="#a5683c" stroke-width="2.4" stroke-linecap="round"/><path d="M18 46c6 2 16 2 24 0" fill="none" stroke="#a5683c" stroke-width="2" opacity=".6"/><path d="M38 28c4 0 8 3 9 7" stroke="#fff" stroke-width="3" opacity=".55" stroke-linecap="round" fill="none"/>`,
  // ───────── ações ─────────
  glove: `<path d="M14 36c-4-10 2-24 14-26 10-2 22 2 24 14 1 7-1 12-5 16l-1 8H22v-6c-4-1-6-3-8-6z" fill="url(#gRed)" ${O}/><path d="M22 34c-3-6 0-12 7-12" fill="none" ${O2}/><path d="M22 48h24v8H22z" fill="#fff" ${O}/><path d="M24 16c6-3 14-3 18 0" stroke="#fff" stroke-width="3.5" opacity=".6" stroke-linecap="round" fill="none"/>`,
  tag: `<g transform="rotate(-18 22 32)"><path d="M6 34c-3-8 1-18 10-20 8-1 16 2 17 11 1 5-1 9-4 12v6H14v-4c-4-1-6-3-8-5z" fill="url(#gRed)" ${O}/><path d="M14 43h15v6H14z" fill="#fff" ${O2}/></g><g transform="rotate(18 42 32)"><path d="M58 34c3-8-1-18-10-20-8-1-16 2-17 11-1 5 1 9 4 12v6h15v-4c4-1 6-3 8-5z" fill="url(#gBlue)" ${O}/><path d="M35 43h15v6H35z" fill="#fff" ${O2}/></g><path d="M32 6l2 6M26 8l3 5M38 8l-3 5" stroke="#ffd23d" stroke-width="3" stroke-linecap="round"/>`,
  crown: `<path d="M8 46l-2-28 14 12 12-18 12 18 14-12-2 28z" fill="url(#gGold)" ${O}/><path d="M8 46h48v8H8z" fill="url(#gGold2)" ${O}/><circle cx="32" cy="38" r="4" fill="#d6202f" ${O2}/><circle cx="18" cy="40" r="3" fill="#2f7bff" ${O2}/><circle cx="46" cy="40" r="3" fill="#2fae3a" ${O2}/><path d="M14 26l3 10" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/>`,
  refresh: `<path d="M50 24A20 20 0 1 0 52 38" fill="none" stroke="#1a1220" stroke-width="10" stroke-linecap="round"/><path d="M50 24A20 20 0 1 0 52 38" fill="none" stroke="#5ef0c0" stroke-width="5" stroke-linecap="round"/><path d="M56 10v16H40z" fill="#5ef0c0" ${O}/>`,
  gear: `<path d="M27 4h10l2 7 6 3 7-3 6 8-5 6 1 7 6 4-3 10-7 0-4 5 1 7-9 4-5-6h-6l-5 6-9-4 1-7-4-5-7 0-3-10 6-4 1-7-5-6 6-8 7 3 6-3z" fill="url(#gSilver)" ${O}/><circle cx="32" cy="32" r="9" fill="#4a4560" ${O}/>`,
  news: `<path d="M8 12h40v40a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" fill="url(#gPaper)" ${O}/><path d="M48 22h8v30a4 4 0 0 1-8 0" fill="#e9d6a8" ${O}/><rect x="14" y="18" width="28" height="9" fill="#d6202f"/><path d="M14 34h12M14 41h12M14 48h28M30 34h12v8H30z" stroke="#8a7350" stroke-width="3" fill="#8fd0ff" stroke-linecap="round"/>`,
  lock: `<path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="#1a1220" stroke-width="9"/><path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="url(#gSilver)" stroke-width="4.5"/><rect x="12" y="28" width="40" height="28" rx="5" fill="url(#gGold)" ${O}/><circle cx="32" cy="40" r="4" fill="#1a1220"/><path d="M32 42v7" stroke="#1a1220" stroke-width="3.5" stroke-linecap="round"/>`,
  unlock: `<path d="M20 28v-8a12 12 0 0 1 23-5" fill="none" stroke="#1a1220" stroke-width="9" stroke-linecap="round"/><path d="M20 28v-8a12 12 0 0 1 23-5" fill="none" stroke="url(#gSilver)" stroke-width="4.5" stroke-linecap="round"/><rect x="12" y="28" width="40" height="28" rx="5" fill="url(#gGreen)" ${O}/><circle cx="32" cy="40" r="4" fill="#1a1220"/><path d="M32 42v7" stroke="#1a1220" stroke-width="3.5" stroke-linecap="round"/>`,
  info: `<circle cx="32" cy="32" r="25" fill="#3aa0ff" stroke="#1a1220" stroke-width="5"/><circle cx="32" cy="19" r="4.5" fill="#fff"/><path d="M32 29v17" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`,
  check: `<path d="M10 34l14 14 30-32" fill="none" stroke="#1a1220" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 34l14 14 30-32" fill="none" stroke="#5ef08a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  close: `<path d="M14 14l36 36M50 14L14 50" stroke="#1a1220" stroke-width="12" stroke-linecap="round"/><path d="M14 14l36 36M50 14L14 50" stroke="#ff5a6a" stroke-width="6" stroke-linecap="round"/>`,
  skip: `<path d="M8 12l22 20-22 20zM30 12l22 20-22 20z" fill="url(#gGold)" ${O}/><path d="M52 10v44" stroke="#1a1220" stroke-width="7" stroke-linecap="round"/>`,
  edit: `<path d="M12 52l4-14 30-30 10 10-30 30z" fill="url(#gGold)" ${O}/><path d="M40 14l10 10" ${O}/><path d="M12 52l4-14 10 10z" fill="#f6c9a4" ${O2}/><path d="M12 52l2-6 4 4z" fill="#1a1220"/>`,
  dice: `<rect x="8" y="8" width="48" height="48" rx="11" fill="url(#gRed)" ${O}/><g fill="#fff"><circle cx="21" cy="21" r="5"/><circle cx="43" cy="21" r="5"/><circle cx="32" cy="32" r="5"/><circle cx="21" cy="43" r="5"/><circle cx="43" cy="43" r="5"/></g><path d="M14 18c1-3 3-5 6-6" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round" fill="none"/>`,
  shuffle: `<path d="M6 20h12c12 0 16 24 28 24h8M6 44h12c5 0 8-4 11-9M38 25c2-3 5-5 8-5h8" fill="none" stroke="#1a1220" stroke-width="9" stroke-linecap="round"/><path d="M6 20h12c12 0 16 24 28 24h8M6 44h12c5 0 8-4 11-9M38 25c2-3 5-5 8-5h8" fill="none" stroke="#7ad7ff" stroke-width="4.5" stroke-linecap="round"/><path d="M50 12l10 8-10 8zM50 36l10 8-10 8z" fill="#7ad7ff" ${O2}/>`,
  swap: `<path d="M10 22h40M54 42H14" stroke="#1a1220" stroke-width="9" stroke-linecap="round"/><path d="M10 22h40M54 42H14" stroke="#ffd23d" stroke-width="4.5" stroke-linecap="round"/><path d="M44 12l14 10-14 10zM20 32L6 42l14 10z" fill="#ffd23d" ${O2}/>`,
  speaker: `<path d="M8 24h10l14-12v40L18 40H8z" fill="url(#gSilver)" ${O}/><path d="M40 22a14 14 0 0 1 0 20M46 14a24 24 0 0 1 0 36" fill="none" stroke="#1a1220" stroke-width="7" stroke-linecap="round"/><path d="M40 22a14 14 0 0 1 0 20M46 14a24 24 0 0 1 0 36" fill="none" stroke="#7ad7ff" stroke-width="3" stroke-linecap="round"/>`,
  music: `<path d="M24 46V14l30-6v32" fill="none" stroke="#1a1220" stroke-width="7" stroke-linejoin="round"/><path d="M24 46V14l30-6v32" fill="none" stroke="url(#gPurple)" stroke-width="3.5" stroke-linejoin="round"/><ellipse cx="17" cy="47" rx="9" ry="7" fill="url(#gPurple)" ${O}/><ellipse cx="47" cy="41" rx="9" ry="7" fill="url(#gPurple)" ${O}/>`,
  mic: `<rect x="17" y="4" width="30" height="36" rx="15" fill="url(#gSilver)" ${O}/><path d="M17 16h30M17 24h30M17 32h30" stroke="#7d8796" stroke-width="2.4"/><path d="M10 30a22 22 0 0 0 44 0" fill="none" ${O}/><path d="M32 52v6M20 60h24" ${O}/><path d="M24 10v12" stroke="#fff" stroke-width="3.5" opacity=".7" stroke-linecap="round"/>`,
  crowd: `<g fill="url(#gBlue)" ${O2}><circle cx="16" cy="24" r="7"/><path d="M4 50c0-10 5-16 12-16s12 6 12 16z"/><circle cx="48" cy="24" r="7"/><path d="M36 50c0-10 5-16 12-16s12 6 12 16z"/></g><g fill="url(#gRed)" ${O2}><circle cx="32" cy="20" r="8"/><path d="M18 54c0-12 6-18 14-18s14 6 14 18z"/></g><path d="M24 10l-4-6M40 10l4-6" stroke="#ffd23d" stroke-width="3" stroke-linecap="round"/>`,
  sparkle: `<path d="M28 6l5 17 17 5-17 5-5 17-5-17-17-5 17-5z" fill="url(#gGold)" ${O}/><path d="M50 38l2.5 7.5 7.5 2.5-7.5 2.5L50 58l-2.5-7.5L40 48l7.5-2.5z" fill="url(#gGem)" ${O2}/>`,
  fast: `<path d="M4 14l24 18-24 18zM30 14l24 18-24 18z" fill="url(#gGem)" ${O}/><path d="M56 22h4M56 32h6M56 42h4" stroke="#7ad7ff" stroke-width="3" stroke-linecap="round"/>`,
  install: `<rect x="16" y="4" width="32" height="56" rx="7" fill="url(#gDark)" ${O}/><rect x="20" y="10" width="24" height="40" rx="2" fill="url(#gBlue)"/><path d="M32 16v20M24 28l8 9 8-9" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="55" r="2.4" fill="#fff"/>`,
  rarity: `<path d="M32 4l10 14-10 14-10-14z" fill="url(#gGem)" ${O2}/><path d="M14 26l10 14-10 14L4 40z" fill="url(#gPurple)" ${O2}/><path d="M50 26l10 14-10 14-10-14z" fill="url(#gGold)" ${O2}/><path d="M32 36l8 11-8 11-8-11z" fill="url(#gRed)" ${O2}/>`,
  clock: `<path d="M16 6h32M16 58h32" ${O}/><path d="M18 6c0 14 14 18 14 26S18 44 18 58h28c0-14-14-18-14-26S46 20 46 6z" fill="url(#gPaper)" ${O}/><path d="M24 54c2-6 8-8 8-12 0 4 6 6 8 12z" fill="url(#gGold)"/><path d="M26 14h12l-6 8z" fill="url(#gGold)"/>`,
  calendar: `<rect x="8" y="12" width="48" height="44" rx="6" fill="url(#gPaper)" ${O}/><path d="M8 18a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6v8H8z" fill="url(#gRed)" ${O}/><path d="M20 6v12M44 6v12" ${O}/><g fill="#8a7350"><rect x="15" y="32" width="7" height="6" rx="1"/><rect x="28" y="32" width="7" height="6" rx="1"/><rect x="41" y="32" width="7" height="6" rx="1"/><rect x="15" y="43" width="7" height="6" rx="1"/><rect x="28" y="43" width="7" height="6" rx="1" fill="#d6202f"/></g>`,
  sun: `<g stroke="#1a1220" stroke-width="7" stroke-linecap="round"><path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M12 52l6-6M46 18l6-6"/></g><g stroke="#ffb000" stroke-width="3.5" stroke-linecap="round"><path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M12 52l6-6M46 18l6-6"/></g><circle cx="32" cy="32" r="14" fill="url(#gGold)" ${O}/>`,
  chart: `<rect x="8" y="34" width="12" height="22" rx="2" fill="url(#gRed)" ${O2}/><rect x="26" y="20" width="12" height="36" rx="2" fill="url(#gGold)" ${O2}/><rect x="44" y="8" width="12" height="48" rx="2" fill="url(#gGreen)" ${O2}/>`,
  shirt: `<path d="M22 6c2 6 18 6 20 0l14 8-6 12-6-3v35H20V23l-6 3-6-12z" fill="url(#gRed)" ${O}/><path d="M22 6c2 6 18 6 20 0" fill="none" ${O2}/><path d="M20 30h24" stroke="#fff" stroke-width="4"/><path d="M26 14l-2 40" stroke="#fff" stroke-width="3" opacity=".35"/>`,
  road: `<path d="M24 60l6-56h4l6 56z" fill="url(#gDark)" ${O}/><path d="M32 8v6M32 22v8M32 38v8M32 52v6" stroke="#ffd23d" stroke-width="3" stroke-linecap="round"/><path d="M44 10v22" ${O}/><path d="M44 10h14l-4 5 4 5H44z" fill="url(#gRed)" ${O2}/>`,
  star: `<path d="M32 5l8 17 18 2-13 13 4 19-17-9-17 9 4-19L6 24l18-2z" fill="url(#gGold)" ${O}/>`,
  gift: `<rect x="8" y="24" width="48" height="12" rx="2" fill="url(#gRed)" ${O}/><rect x="12" y="36" width="40" height="22" rx="2" fill="url(#gRed)" ${O}/><path d="M32 24v34" stroke="url(#gGold)" stroke-width="8"/><path d="M32 24v34" stroke="#1a1220" stroke-width="1.5" opacity=".4"/><path d="M32 24c-8-14-22-8-14 0zM32 24c8-14 22-8 14 0z" fill="url(#gGold)" ${O2}/>`,
  // ───────── criador de personagem ─────────
  skin: `<path d="M32 6C16 6 6 16 6 30c0 10 8 16 16 16 4 0 5 3 5 6 0 4 3 7 8 6 14-2 23-13 23-26C58 16 47 6 32 6z" fill="url(#gPaper)" ${O}/><circle cx="20" cy="24" r="5" fill="#ffe0c7" ${O2}/><circle cx="32" cy="17" r="5" fill="#d29466" ${O2}/><circle cx="44" cy="23" r="5" fill="#94593a" ${O2}/><circle cx="45" cy="37" r="5" fill="#4a2a1c" ${O2}/>`,
  hair: `<path d="M12 40c-4-18 6-32 22-32s24 12 20 30c-2-8-6-12-10-14-6 6-16 8-26 6-3 2-5 6-6 10z" fill="#5a3418" ${O}/><path d="M18 34c2 14 8 22 16 22s14-8 16-22" fill="url(#gSkin)" ${O}/><path d="M20 18c6-6 18-6 24 0" stroke="#83522b" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  palette: `<path d="M18 52c-6-4-8-12-2-16s2-10 4-16c4-10 26-14 32 2s-6 32-18 32c-6 0-10-1-16-2z" fill="url(#gPaper)" ${O}/><circle cx="26" cy="22" r="4.5" fill="#ff2e93" ${O2}/><circle cx="38" cy="19" r="4.5" fill="#ffd23d" ${O2}/><circle cx="46" cy="29" r="4.5" fill="#2bd41f" ${O2}/><circle cx="42" cy="42" r="4.5" fill="#1c6dff" ${O2}/>`,
  eye: `<path d="M4 32c8-12 18-18 28-18s20 6 28 18c-8 12-18 18-28 18S12 44 4 32z" fill="#fff" ${O}/><circle cx="32" cy="32" r="11" fill="url(#gBlue)" ${O2}/><circle cx="32" cy="32" r="5" fill="#1a1220"/><circle cx="28" cy="28" r="3" fill="#fff"/>`,
  brows: `<path d="M6 30c8-10 18-12 24-8l-2 6c-6-3-12-1-18 6z" fill="#3a2a1a" ${O2}/><path d="M58 30c-8-10-18-12-24-8l2 6c6-3 12-1 18 6z" fill="#3a2a1a" ${O2}/><path d="M12 44c4-4 10-4 14 0M38 44c4-4 10-4 14 0" fill="none" stroke="#1a1220" stroke-width="3" stroke-linecap="round"/>`,
  lips: `<path d="M6 32c8-8 14-12 20-8 3 2 9 2 12 0 6-4 12 0 20 8-8 12-18 16-26 16S14 44 6 32z" fill="url(#gRed)" ${O}/><path d="M6 32c12 4 40 4 52 0" fill="none" stroke="#7a0a16" stroke-width="2.4"/><path d="M20 40c6 3 12 3 18 1" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round" fill="none"/>`,
  beard: `<path d="M14 18c0 18 6 22 18 22s18-4 18-22" fill="url(#gSkin)" ${O}/><path d="M10 22c0 22 10 36 22 36s22-14 22-36c-4 8-8 12-12 12-4-6-16-6-20 0-4 0-8-4-12-12z" fill="#5a3418" ${O}/><path d="M24 34c4-3 12-3 16 0" fill="none" stroke="#83522b" stroke-width="3" stroke-linecap="round"/>`,
  height: `<path d="M32 4l12 14H20zM32 60L20 46h24z" fill="url(#gGem)" ${O}/><path d="M32 18v28" stroke="#1a1220" stroke-width="8"/><path d="M32 18v28" stroke="#7ad7ff" stroke-width="4"/><path d="M14 26h8M14 32h12M14 38h8M42 26h8M38 32h12M42 38h8" stroke="#c9d2de" stroke-width="3" stroke-linecap="round"/>`,
  // ───────── atributos ─────────
  fist: `<path d="M14 30c0-8 4-14 10-14h16c8 0 12 5 12 12v8c0 10-8 18-18 18h-6c-8 0-14-6-14-14z" fill="url(#gSkin)" ${O}/><path d="M22 16v12M31 16v12M40 16v12" stroke="#a5683c" stroke-width="2.6" stroke-linecap="round"/><path d="M14 34c4-4 12-4 16 2" fill="none" ${O2}/><path d="M10 14l-6-4M16 8l-2-6M8 22H2" stroke="#ff5a5a" stroke-width="3" stroke-linecap="round"/>`,
  grapple: `<path d="M4 36c6-4 12-6 18-4l8 4" fill="none" stroke="#1a1220" stroke-width="13" stroke-linecap="round"/><path d="M60 28c-6 4-12 6-18 4l-8-4" fill="none" stroke="#1a1220" stroke-width="13" stroke-linecap="round"/><path d="M4 36c6-4 12-6 18-4l8 4" fill="none" stroke="#f6c9a4" stroke-width="8" stroke-linecap="round"/><path d="M60 28c-6 4-12 6-18 4l-8-4" fill="none" stroke="#d29466" stroke-width="8" stroke-linecap="round"/><circle cx="32" cy="33" r="9" fill="#ff8a3d" ${O}/><path d="M26 30c4-2 8-2 12 0" fill="none" ${O2}/>`,
  speed: `<path d="M38 4L16 34h14l-6 26 26-32H34z" fill="url(#gGold)" ${O}/><path d="M4 22h10M2 32h10M6 42h8" stroke="#ffd23d" stroke-width="3.4" stroke-linecap="round"/>`,
  dodge: `<path d="M8 22h30a8 8 0 1 0-8-8" fill="none" stroke="#1a1220" stroke-width="8" stroke-linecap="round"/><path d="M8 22h30a8 8 0 1 0-8-8" fill="none" stroke="#5ef0c0" stroke-width="4" stroke-linecap="round"/><path d="M4 34h44a8 8 0 1 1-8 8" fill="none" stroke="#1a1220" stroke-width="8" stroke-linecap="round"/><path d="M4 34h44a8 8 0 1 1-8 8" fill="none" stroke="#5ef0c0" stroke-width="4" stroke-linecap="round"/><path d="M12 48h16" stroke="#5ef0c0" stroke-width="3.4" stroke-linecap="round"/>`,
  shield: `<path d="M32 4l24 8v16c0 16-10 26-24 32C18 54 8 44 8 28V12z" fill="url(#gBlue)" ${O}/><path d="M32 12l16 5v11c0 11-7 18-16 22z" fill="#1c3fb0" opacity=".45"/><path d="M14 16v12c0 8 3 14 8 19" stroke="#fff" stroke-width="3.5" opacity=".55" stroke-linecap="round" fill="none"/>`,
  vitality: `<path d="M32 56S6 40 6 22a13 13 0 0 1 26-5 13 13 0 0 1 26 5c0 18-26 34-26 34z" fill="url(#gRed)" ${O}/><path d="M32 22v18M23 31h18" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`,
  stamina: `<rect x="6" y="18" width="46" height="28" rx="5" fill="url(#gDark)" ${O}/><path d="M52 26h6v12h-6" fill="#c9d2de" ${O2}/><rect x="11" y="23" width="10" height="18" rx="2" fill="#9be15d"/><rect x="24" y="23" width="10" height="18" rx="2" fill="#9be15d"/><rect x="37" y="23" width="10" height="18" rx="2" fill="#9be15d" opacity=".4"/>`,
  target: `<circle cx="30" cy="34" r="24" fill="#fff" ${O}/><circle cx="30" cy="34" r="17" fill="url(#gRed)"/><circle cx="30" cy="34" r="10" fill="#fff"/><circle cx="30" cy="34" r="4" fill="#d6202f"/><path d="M30 34L56 8" ${O}/><path d="M50 6l8 2 2 8-6-2z" fill="url(#gPurple)" ${O2}/>`,
  charisma: `<rect x="22" y="6" width="18" height="28" rx="9" fill="url(#gPurple)" ${O}/><path d="M31 34v14l-6 10h12l-6-10" fill="#4a4560" ${O2}/><path d="M8 14l3 5 5 1-4 3 1 5-5-3-4 3 1-5-4-3 5-1zM54 20l2.5 4 4.5 1-3 3 .5 4.5-4-2-4 2 .5-4.5-3-3 4.5-1z" fill="url(#gGold)" ${O2}/>`,
  counter: `<path d="M44 12H24a14 14 0 0 0 0 28h24" fill="none" stroke="#1a1220" stroke-width="10" stroke-linecap="round"/><path d="M44 12H24a14 14 0 0 0 0 28h24" fill="none" stroke="#7ad7ff" stroke-width="5" stroke-linecap="round"/><path d="M44 28l14 12-14 12z" fill="#7ad7ff" ${O2}/>`,
  // ───────── lojas e categorias ─────────
  moves: `<circle cx="18" cy="14" r="7" fill="url(#gRed)" ${O2}/><path d="M18 22l10 10 14-4M28 32l-4 14M18 22l-8 10" fill="none" stroke="#1a1220" stroke-width="7" stroke-linecap="round"/><path d="M18 22l10 10 14-4M28 32l-4 14M18 22l-8 10" fill="none" stroke="#ff5a5a" stroke-width="3.5" stroke-linecap="round"/><circle cx="48" cy="40" r="7" fill="url(#gBlue)" ${O2}/><path d="M42 46l-10 12M48 48v12M44 44l-12-4" fill="none" stroke="#1a1220" stroke-width="7" stroke-linecap="round"/><path d="M42 46l-10 12M48 48v12M44 44l-12-4" fill="none" stroke="#3a8bff" stroke-width="3.5" stroke-linecap="round"/><path d="M38 20l6-6M44 24l8-2" stroke="#ffd23d" stroke-width="3" stroke-linecap="round"/>`,
  entrance: `<path d="M32 4L8 58h48z" fill="url(#gGlow)" opacity=".9"/><path d="M26 4h12l-2 6H28z" fill="url(#gSilver)" ${O2}/><circle cx="32" cy="42" r="6" fill="url(#gSkin)" ${O2}/><path d="M24 58c0-8 3-12 8-12s8 4 8 12z" fill="url(#gRed)" ${O2}/><path d="M24 50l-8-14M40 50l8-14" stroke="#1a1220" stroke-width="6" stroke-linecap="round"/><path d="M24 50l-8-14M40 50l8-14" stroke="#f6c9a4" stroke-width="3" stroke-linecap="round"/><path d="M8 20l3 5 5 1-4 3 1 5-5-3-4 3 1-5-4-3 5-1zM56 14l2 4 4 1-3 2 1 4-4-2-4 2 1-4-3-2 4-1z" fill="url(#gGold)"/>`,
  abilities: `<circle cx="32" cy="32" r="26" fill="url(#gPurple)" ${O}/><path d="M36 10L20 36h12l-4 18 18-26H34z" fill="url(#gGold)" ${O2}/>`,
  // ───────── passivas ─────────
  p_ferro: `<path d="M32 4l24 8v16c0 16-10 26-24 32C18 54 8 44 8 28V12z" fill="url(#gSilver)" ${O}/><g fill="#7d8796"><circle cx="18" cy="18" r="2.5"/><circle cx="46" cy="18" r="2.5"/><circle cx="20" cy="40" r="2.5"/><circle cx="44" cy="40" r="2.5"/></g><path d="M32 14v34M18 28h28" stroke="#7d8796" stroke-width="3"/>`,
  p_showman: `<rect x="23" y="6" width="18" height="26" rx="9" fill="url(#gGold)" ${O}/><path d="M32 32v12" ${O}/><path d="M22 58h20l-4-14H26z" fill="url(#gDark)" ${O2}/><path d="M10 10l4 6M54 10l-4 6M6 26h7M58 26h-7" stroke="#ff7ae0" stroke-width="3.4" stroke-linecap="round"/>`,
  p_maos: `<g transform="translate(6 0)"><path d="M14 36c-4-10 2-24 14-26 10-2 22 2 24 14 1 7-1 12-5 16l-1 8H22v-6c-4-1-6-3-8-6z" fill="url(#gRed)" ${O}/><path d="M22 48h24v8H22z" fill="#fff" ${O}/></g><path d="M2 18h10M0 28h12M4 38h10" stroke="#ffd23d" stroke-width="3.4" stroke-linecap="round"/>`,
  p_folego: `<path d="M8 22h26a9 9 0 1 0-9-9" fill="none" stroke="#1a1220" stroke-width="8" stroke-linecap="round"/><path d="M8 22h26a9 9 0 1 0-9-9" fill="none" stroke="#8fd0ff" stroke-width="4" stroke-linecap="round"/><path d="M6 34h38a10 10 0 1 1-10 10" fill="none" stroke="#1a1220" stroke-width="8" stroke-linecap="round"/><path d="M6 34h38a10 10 0 1 1-10 10" fill="none" stroke="#8fd0ff" stroke-width="4" stroke-linecap="round"/><path d="M50 6v14M43 13h14" stroke="#2fae3a" stroke-width="5" stroke-linecap="round"/>`,
  p_frio: `<g stroke="#1a1220" stroke-width="8" stroke-linecap="round"><path d="M32 6v52M9 19l46 26M9 45l46-26"/></g><g stroke="#bff4ff" stroke-width="4" stroke-linecap="round"><path d="M32 6v52M9 19l46 26M9 45l46-26M26 10l6 6 6-6M26 54l6-6 6 6"/></g><circle cx="32" cy="32" r="7" fill="url(#gGem)" ${O2}/>`,
  p_vampiro: `<path d="M6 20c8 6 18 8 26 8s18-2 26-8c-2 16-12 26-26 26S8 36 6 20z" fill="url(#gDark)" ${O}/><path d="M20 27l4 14 4-13M36 28l4 13 4-14" fill="#fff" ${O2}/><path d="M24 44c0 4-2 8-2 8M40 44c0 4 2 8 2 8" stroke="#d6202f" stroke-width="3.5" stroke-linecap="round"/>`,
  p_furia: `<path d="M32 60c-14 0-22-9-22-20 0-12 10-18 11-30 6 4 10 11 10 16 3-3 5-9 4-14 11 6 19 16 19 28 0 12-9 20-22 20z" fill="url(#gFire)" ${O}/><path d="M20 36l8 4M44 36l-8 4" stroke="#1a1220" stroke-width="4" stroke-linecap="round"/><path d="M24 50c4-4 12-4 16 0" fill="none" stroke="#1a1220" stroke-width="3.5" stroke-linecap="round"/>`,
  p_muralha: `<path d="M6 16h52v42H6z" fill="#b8693e" ${O}/><g fill="none" stroke="#1a1220" stroke-width="2.6"><path d="M6 30h52M6 44h52M22 16v14M42 16v14M14 30v14M32 30v14M50 30v14M22 44v14M42 44v14"/></g><path d="M6 16V8h8v8M20 16V8h8v8M36 16V8h8v8M50 16V8h8v8" fill="#b8693e" ${O2}/>`,
  p_fenix: `<path d="M32 58c-4-8-4-16 0-22-10 2-20-4-26-14 10 2 18 0 22-6-4-6-2-12 4-14 6 2 8 8 4 14 4 6 12 8 22 6-6 10-16 16-26 14 4 6 4 14 0 22z" fill="url(#gFire)" ${O}/><circle cx="32" cy="12" r="2" fill="#1a1220"/>`,
  p_bencao: `<ellipse cx="32" cy="12" rx="16" ry="5" fill="none" stroke="#1a1220" stroke-width="7"/><ellipse cx="32" cy="12" rx="16" ry="5" fill="none" stroke="#ffe27a" stroke-width="3.5"/><path d="M32 26c-10-8-26-6-28 6 10-2 18 2 22 8zM32 26c10-8 26-6 28 6-10-2-18 2-22 8z" fill="#fff" ${O2}/><path d="M24 42c0-10 4-16 8-16s8 6 8 16c0 8-4 14-8 14s-8-6-8-14z" fill="url(#gPaper)" ${O2}/>`,
};

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const syms = Object.entries(I)
    .map(([k, v]) => `<symbol id="ic-${k}" viewBox="0 0 64 64">${v}</symbol>`)
    .join('');
  const div = document.createElement('div');
  div.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  div.setAttribute('aria-hidden', 'true');
  div.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${DEFS}</defs>${syms}</svg>`;
  document.body.prepend(div);
}

export type IconName = keyof typeof I;

/** HTML de um ícone (inline, alinhado com o texto). */
export function ico(name: string, cls = ''): string {
  inject();
  const n = I[name] ? name : 'star';
  return `<svg class="ic ${cls}" aria-hidden="true"><use href="#ic-${n}"/></svg>`;
}

export function hasIcon(name: string): boolean {
  return !!I[name];
}

/** Emblema de liga: escudo com as cores da liga e um símbolo por patamar. */
export function leagueBadge(id: string, color: string, cls = ''): string {
  const sym: Record<string, string> = {
    bronze: '<path d="M32 18l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="#fff" opacity=".85"/>',
    prata: '<path d="M32 16l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="#fff" opacity=".9"/><path d="M18 48c4 4 24 4 28 0" stroke="#fff" stroke-width="3" fill="none"/>',
    ouro: '<path d="M32 14l5 10 11 1-8 8 2 11-10-6-10 6 2-11-8-8 11-1z" fill="#fff"/><path d="M14 44c6 8 30 8 36 0" stroke="#fff" stroke-width="3" fill="none"/>',
    platina: '<path d="M32 14l12 12-12 22-12-22z" fill="#fff" opacity=".9"/><path d="M20 26h24" stroke="#1a1220" stroke-width="2" opacity=".4"/>',
    diamante: '<path d="M22 18h20l8 10-18 22-18-22z" fill="#fff" opacity=".92"/><path d="M14 28h36M22 18l4 10 6-10 6 10 4-10M26 28l6 22 6-22" stroke="#2a54e0" stroke-width="1.6" fill="none" opacity=".6"/>',
    mestre: '<circle cx="32" cy="32" r="12" fill="#fff" opacity=".9"/><path d="M32 22l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#7a3cff"/>',
    lenda: '<path d="M16 42l-2-18 10 8 8-12 8 12 10-8-2 18z" fill="#fff"/><path d="M16 42h32v5H16z" fill="#fff"/>',
  };
  return `<svg class="ic league-badge ${cls}" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 3l25 8v18c0 17-11 27-25 33C18 56 7 46 7 29V11z" fill="${color}" stroke="#1a1220" stroke-width="3.2" stroke-linejoin="round"/><path d="M32 9l19 6v14c0 13-8 21-19 26z" fill="#000" opacity=".18"/><path d="M13 15v14c0 7 2 12 6 17" stroke="#fff" stroke-width="3" opacity=".5" fill="none" stroke-linecap="round"/>${sym[id] ?? ''}</svg>`;
}

/** Ícone associado a cada atributo. */
export const STAT_ICONS: Record<string, string> = {
  for: 'fist', agr: 'grapple', vel: 'speed', esq: 'dodge', def: 'shield', vit: 'vitality', res: 'stamina', pre: 'target', car: 'charisma', ctr: 'counter',
};

/** Ícone genérico de cada tipo de item. */
export const KIND_ICON: Record<string, string> = {
  hair: 'hair', hairColor: 'palette', outfit: 'shirt', gloves: 'glove', mask: 'fighter', aura: 'sparkle',
  super: 'bolt', passive: 'abilities', entrance: 'entrance', move: 'moves', moveStyle: 'sparkle', taunt: 'crowd',
};
