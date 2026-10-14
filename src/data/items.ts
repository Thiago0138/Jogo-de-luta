import type { Rarity } from './rarity';

export type ItemKind =
  | 'hair'
  | 'hairColor'
  | 'outfit'
  | 'gloves'
  | 'mask'
  | 'aura'
  | 'super'
  | 'passive'
  | 'entrance'
  | 'move'
  | 'moveStyle';

export type ItemSource = 'start' | 'shop' | 'chest' | 'mission' | 'level';

export interface Vis {
  style?: string;
  c1?: string;
  c2?: string;
  c3?: string;
  pattern?: string;
  boots?: string;
  anim?: string;
  type?: string;
  c4?: string;
  /** Fato de corpo inteiro: cor que substitui a pele nos braços, pernas e tronco. */
  suit?: string;
  /** Material especial do corpo (lava, gelo, metal, cosmos, escamas, penas…). */
  mat?: string;
  /** Capuz / capacete / adorno de cabeça do traje. */
  head?: string;
  /** Peça nas costas: capa, asas, mochila a jato, escudo… */
  back?: string;
  /** Cauda. */
  tail?: string;
  /** Emblema / detalhe no peito. */
  chest?: string;
  /** Ombreiras. */
  shoulders?: string;
}

export interface ItemDef {
  id: string;
  kind: ItemKind;
  name: string;
  rarity: Rarity;
  desc: string;
  icon: string;
  source: ItemSource;
  coins?: number;
  gems?: number;
  unlockLevel?: number;
  vis?: Vis;
  /** Número do efeito (ex.: multiplicador de dano do super). */
  power?: number;
}

export const KIND_NAMES: Record<ItemKind, string> = {
  hair: 'Hairstyle',
  hairColor: 'Hair color',
  outfit: 'Outfit',
  gloves: 'Gloves',
  mask: 'Mask',
  aura: 'Aura',
  super: 'Super move',
  passive: 'Passive skill',
  entrance: 'Entrance',
  move: 'Signature move',
  moveStyle: 'Move style',
};

const I: ItemDef[] = [
  // ───────────── Penteados ─────────────
  { id: 'h_careca', kind: 'hair', name: 'Bald', rarity: 'comum', desc: 'Shines under the spotlights.', icon: '🥚', source: 'start', vis: { style: 'careca' } },
  { id: 'h_curto', kind: 'hair', name: 'Short', rarity: 'comum', desc: 'Classic and practical.', icon: '💇', source: 'start', vis: { style: 'curto' } },
  { id: 'h_moicano', kind: 'hair', name: 'Mohawk', rarity: 'comum', desc: 'Pure punk attitude.', icon: '🦔', source: 'start', vis: { style: 'moicano' } },
  { id: 'h_afro', kind: 'hair', name: 'Afro', rarity: 'comum', desc: 'Maximum volume.', icon: '☁️', source: 'start', vis: { style: 'afro' } },
  { id: 'h_espetado', kind: 'hair', name: 'Spiky', rarity: 'comum', desc: 'Every spike is a threat.', icon: '⚡', source: 'start', vis: { style: 'espetado' } },
  { id: 'h_rabo', kind: 'hair', name: 'Ponytail', rarity: 'comum', desc: 'Swings with every hit.', icon: '🎀', source: 'start', vis: { style: 'rabo' } },
  { id: 'h_topete', kind: 'hair', name: 'Pompadour', rarity: 'comum', desc: 'Straight out of 50s rock.', icon: '🎸', source: 'start', vis: { style: 'topete' } },
  { id: 'h_longo', kind: 'hair', name: 'Long', rarity: 'comum', desc: 'Hair in the wind.', icon: '🌊', source: 'start', vis: { style: 'longo' } },
  { id: 'h_mullet', kind: 'hair', name: 'Mullet', rarity: 'incomum', desc: 'Business in the front, party in the back.', icon: '🦅', source: 'shop', coins: 900, vis: { style: 'mullet' } },
  { id: 'h_trancas', kind: 'hair', name: 'Braids', rarity: 'raro', desc: 'Warrior braids that whip through the air.', icon: '🪢', source: 'shop', coins: 2400, vis: { style: 'trancas' } },
  { id: 'h_samurai', kind: 'hair', name: 'Samurai Bun', rarity: 'raro', desc: 'Honor above all.', icon: '🗡️', source: 'shop', coins: 2600, vis: { style: 'samurai' } },
  { id: 'h_super', kind: 'hair', name: 'Super Spiky', rarity: 'epico', desc: 'Power level over 9000.', icon: '🌟', source: 'shop', gems: 180, vis: { style: 'super' } },
  { id: 'h_chamas', kind: 'hair', name: 'Flaming Hair', rarity: 'lendario', desc: 'Literally on fire. Animated.', icon: '🔥', source: 'shop', gems: 450, vis: { style: 'chamas', anim: 'fire' } },
  { id: 'h_cometa', kind: 'hair', name: 'Comet Tail', rarity: 'mitico', desc: 'A trail of light follows every move.', icon: '☄️', source: 'chest', vis: { style: 'cometa', anim: 'comet' } },
  { id: 'h_coroa', kind: 'hair', name: 'Crown of Light', rarity: 'celestial', desc: 'Worn only by those chosen by the gods.', icon: '👑', source: 'mission', vis: { style: 'coroa', anim: 'halo' } },

  // ───────────── Cores de cabelo ─────────────
  { id: 'hc_preto', kind: 'hairColor', name: 'Black', rarity: 'comum', desc: '', icon: '⚫', source: 'start', vis: { c1: '#1b1714', c2: '#3a312a' } },
  { id: 'hc_castanho', kind: 'hairColor', name: 'Brown', rarity: 'comum', desc: '', icon: '🟤', source: 'start', vis: { c1: '#5a3418', c2: '#83522b' } },
  { id: 'hc_loiro', kind: 'hairColor', name: 'Blonde', rarity: 'comum', desc: '', icon: '🟡', source: 'start', vis: { c1: '#e2b44a', c2: '#f7dc8a' } },
  { id: 'hc_ruivo', kind: 'hairColor', name: 'Ginger', rarity: 'comum', desc: '', icon: '🟠', source: 'start', vis: { c1: '#b8461b', c2: '#e2763d' } },
  { id: 'hc_grisalho', kind: 'hairColor', name: 'Silver Fox', rarity: 'comum', desc: '', icon: '⚪', source: 'start', vis: { c1: '#8d8f95', c2: '#c9cbd0' } },
  { id: 'hc_azul', kind: 'hairColor', name: 'Neon Blue', rarity: 'incomum', desc: 'An electric shade.', icon: '🔵', source: 'shop', coins: 600, vis: { c1: '#1c6dff', c2: '#6ad4ff' } },
  { id: 'hc_rosa', kind: 'hairColor', name: 'Hot Pink', rarity: 'incomum', desc: 'Impossible to miss.', icon: '🩷', source: 'shop', coins: 600, vis: { c1: '#ff2e93', c2: '#ff9bd0' } },
  { id: 'hc_verde', kind: 'hairColor', name: 'Toxic Green', rarity: 'raro', desc: 'Glows in the dark.', icon: '🟢', source: 'chest', vis: { c1: '#2bd41f', c2: '#c7ff5e' } },
  { id: 'hc_roxo', kind: 'hairColor', name: 'Galactic Purple', rarity: 'epico', desc: 'Nebula tones.', icon: '🟣', source: 'shop', gems: 120, vis: { c1: '#5a1fd1', c2: '#e078ff' } },
  { id: 'hc_ouro', kind: 'hairColor', name: 'Pure Gold', rarity: 'lendario', desc: 'Solid gold highlights.', icon: '🏅', source: 'chest', vis: { c1: '#c98a00', c2: '#fff1a8', anim: 'shine' } },
  { id: 'hc_arcoiris', kind: 'hairColor', name: 'Rainbow', rarity: 'mitico', desc: 'Shifts color nonstop.', icon: '🌈', source: 'mission', vis: { c1: '#ff0000', c2: '#ffffff', anim: 'rainbow' } },

  // ───────────── Trajes ─────────────
  { id: 'o_classico', kind: 'outfit', name: 'Classic Trunks', rarity: 'comum', desc: 'Champion red.', icon: '🩳', source: 'start', vis: { style: 'trunks', c1: '#e3263b', c2: '#ffffff', boots: '#2a2a33', pattern: 'stripe' } },
  { id: 'o_azul', kind: 'outfit', name: 'Blue Trunks', rarity: 'comum', desc: 'Cool and calculating.', icon: '🩳', source: 'start', vis: { style: 'trunks', c1: '#2357d9', c2: '#ffd23d', boots: '#1d2235', pattern: 'stripe' } },
  { id: 'o_preto', kind: 'outfit', name: 'Black Trunks', rarity: 'comum', desc: 'No small talk.', icon: '🩳', source: 'shop', coins: 300, vis: { style: 'trunks', c1: '#1e1e24', c2: '#e3263b', boots: '#0f0f12', pattern: 'stripe' } },
  { id: 'o_lima', kind: 'outfit', name: 'Lime Singlet', rarity: 'incomum', desc: 'Visible from a mile away.', icon: '🟩', source: 'shop', coins: 800, vis: { style: 'singlet', c1: '#7bdc1f', c2: '#1b3d08', boots: '#1b3d08', pattern: 'none' } },
  { id: 'o_retro', kind: 'outfit', name: 'Retro 80s', rarity: 'incomum', desc: 'Neon, a headband and tons of attitude.', icon: '📼', source: 'chest', vis: { style: 'singlet', c1: '#ff4fa3', c2: '#3ee6ff', boots: '#ffffff', pattern: 'stripe', head: 'bandana' } },
  { id: 'o_leopardo', kind: 'outfit', name: 'Leopard', rarity: 'incomum', desc: 'Wild by nature.', icon: '🐆', source: 'shop', coins: 900, vis: { style: 'trunks', c1: '#e8a93b', c2: '#3a2310', boots: '#3a2310', pattern: 'spots' } },
  { id: 'o_luchador', kind: 'outfit', name: 'Star Luchador', rarity: 'raro', desc: 'A starry singlet and a short cape to fly higher.', icon: '⭐', source: 'shop', coins: 2800, vis: { style: 'singlet', c1: '#1940c9', c2: '#ffd700', boots: '#ffd700', pattern: 'stars', back: 'cape', c3: '#1940c9', c4: '#ffd700' } },
  { id: 'o_ninja', kind: 'outfit', name: 'Shadow Ninja', rarity: 'raro', desc: 'Hood, black suit and a katana on the back.', icon: '🥷', source: 'chest', vis: { style: 'gi', suit: '#22232d', c1: '#20212b', c2: '#7f1dd1', boots: '#15151c', pattern: 'none', head: 'ninja', back: 'katana' } },
  { id: 'o_bairro', kind: 'outfit', name: 'Hometown Hero', rarity: 'raro', desc: 'Satin jacket and a gold medallion on the chest.', icon: '🏆', source: 'level', unlockLevel: 8, vis: { style: 'jacket', c1: '#d6202f', c2: '#f5f5f5', boots: '#f5f5f5', pattern: 'stripe', chest: 'medal' } },
  { id: 'o_samurai', kind: 'outfit', name: 'Crimson Samurai', rarity: 'epico', desc: 'Lacquered armor, shoulder guards and a kabuto with a golden crest.', icon: '⛩️', source: 'shop', gems: 220, vis: { style: 'armor', c1: '#a3121f', c2: '#1a1a1a', c3: '#e8c25a', boots: '#1a1a1a', pattern: 'lacquer', head: 'kabuto', shoulders: 'samurai' } },
  { id: 'o_rocker', kind: 'outfit', name: 'Electric Rocker', rarity: 'epico', desc: 'Spiked leather jacket and an electric guitar on the back.', icon: '🎸', source: 'chest', vis: { style: 'jacket', c1: '#151518', c2: '#ffe23d', boots: '#151518', pattern: 'lightning', back: 'guitar', shoulders: 'spikes' } },
  { id: 'o_gladiador', kind: 'outfit', name: 'Gladiator', rarity: 'epico', desc: 'Plumed helmet, bronze breastplate and a Roman shield.', icon: '🏛️', source: 'level', unlockLevel: 20, vis: { style: 'armor', c1: '#8a5a24', c2: '#c98d3a', c3: '#ffd27a', boots: '#3a2410', pattern: 'muscle', head: 'galea', back: 'shield', shoulders: 'bronze' } },
  { id: 'o_heroi', kind: 'outfit', name: 'Superhero', rarity: 'epico', desc: 'Skin-tight suit, chest emblem and a huge billowing cape.', icon: '🦸', source: 'shop', gems: 280, vis: { style: 'trunks', suit: '#1f5ad9', c1: '#d6202f', c2: '#ffd23d', boots: '#d6202f', pattern: 'none', back: 'cape_long', c3: '#d6202f', c4: '#9e1220', chest: 'emblem', head: 'domino' } },
  { id: 'o_imperador', kind: 'outfit', name: 'Golden Emperor', rarity: 'lendario', desc: 'Solid gold armor, a crown and a royal velvet mantle.', icon: '👑', source: 'shop', gems: 600, vis: { style: 'armor', c1: '#e0a800', c2: '#fff3b0', c3: '#ffffff', boots: '#b07d00', pattern: 'royal', anim: 'gold', head: 'crown', back: 'royalcape', shoulders: 'gold' } },
  { id: 'o_dragao', kind: 'outfit', name: 'Ancient Dragon', rarity: 'lendario', desc: 'Dragon scales, horns, wings and tail. Glows with inner fire.', icon: '🐉', source: 'chest', vis: { style: 'none', mat: 'dragon', suit: '#1f8a4c', c1: '#0f7a3d', c2: '#ffb31a', c3: '#ffe08a', boots: '#07391c', pattern: 'none', anim: 'glow', head: 'horns', back: 'wings_dragon', tail: 'dragon' } },
  { id: 'o_astronauta', kind: 'outfit', name: 'Astronaut', rarity: 'lendario', desc: 'Space suit, glass helmet and a jetpack with lights.', icon: '👨‍🚀', source: 'shop', gems: 650, vis: { style: 'none', mat: 'astro', suit: '#f1f3f7', c1: '#f1f3f7', c2: '#ff7a1a', c3: '#3a8bff', boots: '#d9dde6', pattern: 'none', head: 'astro', back: 'astropack', chest: 'panel' } },
  { id: 'o_tubarao', kind: 'outfit', name: 'Killer Shark', rarity: 'lendario', desc: 'A full shark costume: your face peeks out between the teeth!', icon: '🦈', source: 'shop', gems: 550, vis: { style: 'none', mat: 'shark', suit: '#6f8fa8', c1: '#6f8fa8', c2: '#f2f5f8', c3: '#ffffff', boots: '#4d6a80', pattern: 'none', head: 'shark', back: 'fin', tail: 'shark' } },
  { id: 'o_lava', kind: 'outfit', name: 'Lava Golem', rarity: 'mitico', desc: 'A body of volcanic rock with magma pulsing through the cracks.', icon: '🌋', source: 'chest', vis: { style: 'none', mat: 'lava', suit: '#3a2620', c1: '#2a1410', c2: '#ff5a00', c3: '#ffd000', boots: '#1a0c08', pattern: 'none', anim: 'lava', head: 'lava', shoulders: 'rock' } },
  { id: 'o_gelo', kind: 'outfit', name: 'Frost Giant', rarity: 'mitico', desc: 'A body of frozen crystal, an icicle crown and freezing mist.', icon: '❄️', source: 'mission', vis: { style: 'none', mat: 'ice', suit: '#9fdcff', c1: '#bfefff', c2: '#3aa8ff', c3: '#ffffff', boots: '#6cc4ff', pattern: 'none', anim: 'ice', head: 'ice', shoulders: 'crystals' } },
  { id: 'o_mecha', kind: 'outfit', name: 'Titan Mecha', rarity: 'mitico', desc: 'Robotic armor, an energy core in the chest and jet thrusters.', icon: '🤖', source: 'shop', gems: 1200, vis: { style: 'none', mat: 'metal', suit: '#9aa6b8', c1: '#c3ccd8', c2: '#2be3ff', c3: '#ff4a3d', boots: '#59627a', pattern: 'none', head: 'robo', back: 'jetpack', chest: 'core', shoulders: 'mecha' } },
  { id: 'o_rex', kind: 'outfit', name: 'T-Rex', rarity: 'mitico', desc: 'Dinosaur costume with giant jaws, back plates and a tail.', icon: '🦖', source: 'shop', gems: 1000, vis: { style: 'none', mat: 'dino', suit: '#4fae3a', c1: '#4fae3a', c2: '#f4d98a', c3: '#ffffff', boots: '#2f7a22', pattern: 'none', head: 'dino', back: 'plates', tail: 'dino' } },
  { id: 'o_cosmos', kind: 'outfit', name: 'God of the Ring', rarity: 'celestial', desc: 'A living galaxy for a body, with a halo and orbiting planetary rings.', icon: '🌌', source: 'mission', vis: { style: 'none', mat: 'cosmic', suit: '#1a0f4a', c1: '#0b0626', c2: '#7a5cff', c3: '#ffffff', boots: '#0b0626', pattern: 'none', anim: 'cosmic', head: 'halo', back: 'orbit' } },
  { id: 'o_fenix', kind: 'outfit', name: 'Immortal Phoenix', rarity: 'celestial', desc: 'Feathers of fire, a flaming crest and blazing wings reborn with every hit.', icon: '🐦‍🔥', source: 'shop', gems: 2000, vis: { style: 'none', mat: 'feather', suit: '#e8461a', c1: '#d6301a', c2: '#ffb31a', c3: '#fff3a0', boots: '#7a1508', pattern: 'none', anim: 'fire', head: 'fenix', back: 'wings_fire', tail: 'fire' } },

  // ───────────── Luvas ─────────────
  { id: 'g_vermelhas', kind: 'gloves', name: 'Red Gloves', rarity: 'comum', desc: 'The usual.', icon: '🥊', source: 'start', vis: { style: 'boxe', c1: '#d91f2f', c2: '#ffffff' } },
  { id: 'g_azuis', kind: 'gloves', name: 'Blue Gloves', rarity: 'comum', desc: 'Cool as the ocean.', icon: '🥊', source: 'start', vis: { style: 'boxe', c1: '#1f5ad9', c2: '#ffffff' } },
  { id: 'g_fita', kind: 'gloves', name: 'Street Wraps', rarity: 'incomum', desc: 'Old-school fighting with taped fists.', icon: '🩹', source: 'shop', coins: 700, vis: { style: 'fita', c1: '#f2efe6', c2: '#c9c3b0' } },
  { id: 'g_pretas', kind: 'gloves', name: 'Night Gloves', rarity: 'incomum', desc: 'Black, laced up, with a gold logo.', icon: '🥊', source: 'chest', vis: { style: 'pro', c1: '#18181d', c2: '#e2b44a' } },
  { id: 'g_ouro', kind: 'gloves', name: 'Golden Gloves', rarity: 'raro', desc: 'Polished gold that gleams with every punch.', icon: '🏅', source: 'shop', coins: 2200, vis: { style: 'pro', c1: '#e8b31c', c2: '#fff3b0', anim: 'shine' } },
  { id: 'g_picos', kind: 'gloves', name: 'Studded Gauntlets', rarity: 'raro', desc: 'Heavy leather with metal spikes on the knuckles.', icon: '⛓️', source: 'chest', vis: { style: 'picos', c1: '#3a2418', c2: '#d9dde3' } },
  { id: 'g_garras', kind: 'gloves', name: 'Steel Claws', rarity: 'epico', desc: 'A metal gauntlet with three razor-sharp blades.', icon: '🦾', source: 'chest', vis: { style: 'garra', c1: '#7d8796', c2: '#eef3f8' } },
  { id: 'g_pedra', kind: 'gloves', name: 'Stone Fists', rarity: 'epico', desc: 'Two huge boulders covered in moss and cracks.', icon: '🪨', source: 'shop', gems: 200, vis: { style: 'pedra', c1: '#7d7468', c2: '#4f8a3a' } },
  { id: 'g_tesla', kind: 'gloves', name: 'Tesla Gauntlets', rarity: 'epico', desc: 'Copper coils and electric arcs between the fingers.', icon: '⚡', source: 'chest', vis: { style: 'tesla', c1: '#3a3f4a', c2: '#7ad7ff', c3: '#d98a3a' } },
  { id: 'g_fogo', kind: 'gloves', name: 'Fire Fists', rarity: 'lendario', desc: 'Fists of living flame that climb up your arms.', icon: '🔥', source: 'shop', gems: 380, vis: { style: 'fogo', c1: '#ff5a00', c2: '#ffd000', anim: 'fire' } },
  { id: 'g_gelo', kind: 'gloves', name: 'Ice Gauntlets', rarity: 'lendario', desc: 'Crystals of eternal ice and freezing mist.', icon: '🧊', source: 'chest', vis: { style: 'gelo', c1: '#bfefff', c2: '#3aa8ff' } },
  { id: 'g_dragao', kind: 'gloves', name: 'Dragon Heads', rarity: 'lendario', desc: 'Each fist is a dragon head that opens its jaws and breathes smoke.', icon: '🐲', source: 'shop', gems: 480, vis: { style: 'dragao', c1: '#c4122c', c2: '#ffd23d' } },
  { id: 'g_mecha', kind: 'gloves', name: 'Mecha Fists', rarity: 'mitico', desc: 'Giant robot fists with pistons, lights and thrusters.', icon: '🦿', source: 'shop', gems: 800, vis: { style: 'mecha', c1: '#9aa6b8', c2: '#2be3ff', c3: '#ff4a3d' } },
  { id: 'g_sombra', kind: 'gloves', name: 'Shadow Hands', rarity: 'mitico', desc: 'Ghostly claws of purple smoke with glowing eyes.', icon: '👻', source: 'chest', vis: { style: 'sombra', c1: '#2a0a45', c2: '#c77dff' } },
  { id: 'g_cosmicas', kind: 'gloves', name: 'Cosmic Gauntlets', rarity: 'celestial', desc: 'Galaxies in your fists, with orbiting planetary rings.', icon: '✨', source: 'chest', vis: { style: 'cosmico', c1: '#2a1a7a', c2: '#9be8ff', anim: 'cosmic' } },
  { id: 'g_sol', kind: 'gloves', name: 'Fists of the Sun', rarity: 'celestial', desc: 'Two miniature suns with a crown of rays and solar flares.', icon: '☀️', source: 'mission', vis: { style: 'sol', c1: '#ff9a00', c2: '#fff6b0' } },

  // ───────────── Máscaras ─────────────
  { id: 'm_luchador', kind: 'mask', name: 'Luchador Mask', rarity: 'raro', desc: 'Mexican tradition with style.', icon: '🎭', source: 'shop', coins: 2500, vis: { style: 'luchador', c1: '#1f5ad9', c2: '#ffffff' } },
  { id: 'm_luchador_r', kind: 'mask', name: 'Ruby Luchador', rarity: 'raro', desc: 'Blood red and silver.', icon: '🎭', source: 'chest', vis: { style: 'luchador', c1: '#c4122c', c2: '#d9dde3' } },
  { id: 'm_caveira', kind: 'mask', name: 'Skull Paint', rarity: 'epico', desc: 'Scares them before the first hit.', icon: '💀', source: 'chest', vis: { style: 'caveira', c1: '#f4f4f4', c2: '#111111' } },
  { id: 'm_demonio', kind: 'mask', name: 'Demon Mask', rarity: 'lendario', desc: 'Eyes that burn in the dark.', icon: '👹', source: 'chest', vis: { style: 'demonio', c1: '#b3121f', c2: '#ffd000' } },
  { id: 'm_cyber', kind: 'mask', name: 'Cyber Visor', rarity: 'mitico', desc: 'Scans your opponent in real time.', icon: '🤖', source: 'mission', vis: { style: 'cyber', c1: '#1a1d26', c2: '#00f0ff', anim: 'scan' } },

  // ───────────── Auras (efeito à volta do lutador + fundo nos menus) ─────────────
  { id: 'a_holofotes', kind: 'aura', name: 'Spotlights', rarity: 'comum', desc: 'An arena backdrop with spotlights sweeping through the smoke.', icon: '🔦', source: 'shop', coins: 400, vis: { type: 'holofotes', c1: '#ffffff', c2: '#9ab8ff' } },
  { id: 'a_neon', kind: 'aura', name: 'Retro Neon', rarity: 'incomum', desc: 'Synthwave sunset and a neon grid. Neon outline on your fighter.', icon: '🌆', source: 'shop', coins: 1200, vis: { type: 'neon', c1: '#ff3df0', c2: '#3df0ff' } },
  { id: 'a_faiscas', kind: 'aura', name: 'Sparks', rarity: 'raro', desc: 'Golden sparks rise all around you.', icon: '✨', source: 'shop', coins: 3000, vis: { type: 'faiscas', c1: '#ffd23d', c2: '#fff6c2' } },
  { id: 'a_petalas', kind: 'aura', name: 'Sakura Petals', rarity: 'epico', desc: 'Cherry trees in the moonlight and dancing petals.', icon: '🌸', source: 'chest', vis: { type: 'petalas', c1: '#ff9ccf', c2: '#ffe3f1' } },
  { id: 'a_chamas', kind: 'aura', name: 'Flame Aura', rarity: 'epico', desc: 'A wall of fire blazes behind you.', icon: '🔥', source: 'shop', gems: 250, vis: { type: 'chamas', c1: '#ff5a00', c2: '#ffd000' } },
  { id: 'a_raio', kind: 'aura', name: 'Storm', rarity: 'lendario', desc: 'Dark clouds, rain and lightning dancing around you.', icon: '🌩️', source: 'chest', vis: { type: 'raio', c1: '#6ad4ff', c2: '#ffffff' } },
  { id: 'a_aurora', kind: 'aura', name: 'Northern Lights', rarity: 'lendario', desc: 'Curtains of green and violet light over frozen mountains.', icon: '🌌', source: 'shop', gems: 450, vis: { type: 'aurora', c1: '#3dffa8', c2: '#b05cff' } },
  { id: 'a_sombra', kind: 'aura', name: 'Abyssal Shadow', rarity: 'mitico', desc: 'The abyss stares back: black smoke, tentacles and eyes in the dark.', icon: '🌑', source: 'chest', vis: { type: 'sombra', c1: '#3a0a5c', c2: '#b25cff' } },
  { id: 'a_cosmos', kind: 'aura', name: 'Cosmos', rarity: 'celestial', desc: 'A spiral galaxy, planets and shooting stars.', icon: '🪐', source: 'mission', vis: { type: 'cosmos', c1: '#7a5cff', c2: '#7af7ff' } },

  // ───────────── Super ataques ─────────────
  { id: 's_supersoco', kind: 'super', name: 'Super Punch', rarity: 'comum', desc: 'A charged punch that shakes the ring.', icon: '👊', source: 'start', power: 1.0, vis: { type: 'supersoco' } },
  { id: 's_lariat', kind: 'super', name: 'Unstoppable Lariat', rarity: 'incomum', desc: 'Runs to the ropes and comes back like a freight train.', icon: '🚂', source: 'level', unlockLevel: 4, power: 1.1, vis: { type: 'lariat' } },
  { id: 's_relampago', kind: 'super', name: 'Lightning Combo', rarity: 'raro', desc: 'Eight punches at the speed of light.', icon: '⚡', source: 'level', unlockLevel: 10, power: 1.2, vis: { type: 'relampago' } },
  { id: 's_trovao', kind: 'super', name: 'Thunder Fist', rarity: 'raro', desc: 'An uppercut that calls lightning down from the sky.', icon: '🌩️', source: 'shop', coins: 3500, power: 1.25, vis: { type: 'trovao' } },
  { id: 's_tornado', kind: 'super', name: 'Spinning Tornado', rarity: 'epico', desc: 'Spins like a hurricane, hit after hit.', icon: '🌪️', source: 'chest', power: 1.35, vis: { type: 'tornado' } },
  { id: 's_dragao', kind: 'super', name: 'Fire Dragon', rarity: 'epico', desc: 'Unleashes a dragon made of flames.', icon: '🐉', source: 'shop', gems: 300, power: 1.4, vis: { type: 'dragao' } },
  { id: 's_meteoro', kind: 'super', name: 'Meteor Drop', rarity: 'lendario', desc: 'Leaps up to the rafters and crashes down like a meteor.', icon: '☄️', source: 'chest', power: 1.55, vis: { type: 'meteoro' } },
  { id: 's_atomico', kind: 'super', name: 'Atomic Suplex', rarity: 'lendario', desc: 'A suplex so powerful it sends out a shockwave.', icon: '☢️', source: 'level', unlockLevel: 30, power: 1.55, vis: { type: 'atomico' } },
  { id: 's_cosmico', kind: 'super', name: 'Cosmic Punch', rarity: 'mitico', desc: 'Stops time and lands a galactic punch.', icon: '🌌', source: 'chest', power: 1.75, vis: { type: 'cosmico' } },
  { id: 's_ira', kind: 'super', name: 'Celestial Wrath', rarity: 'celestial', desc: 'Wings of light and a divine bolt from the heavens.', icon: '😇', source: 'mission', power: 1.8, vis: { type: 'ira' } },

  // ───────────── Passivas ─────────────
  { id: 'p_ferro', kind: 'passive', name: 'Iron Skin', rarity: 'comum', desc: 'Take 8% less damage.', icon: '🛡️', source: 'start', power: 0.08 },
  { id: 'p_showman', kind: 'passive', name: 'Showman', rarity: 'incomum', desc: 'The crowd loves you: +30% Super charge.', icon: '🎤', source: 'level', unlockLevel: 3, power: 0.3 },
  { id: 'p_maos', kind: 'passive', name: 'Quick Hands', rarity: 'incomum', desc: 'Attacks are 12% faster.', icon: '🤚', source: 'shop', coins: 1200, power: 0.12 },
  { id: 'p_folego', kind: 'passive', name: 'Second Wind', rarity: 'raro', desc: 'Once per fight, recover 20% health when below 25%.', icon: '🌬️', source: 'level', unlockLevel: 12, power: 0.2 },
  { id: 'p_frio', kind: 'passive', name: 'Cold Blood', rarity: 'raro', desc: '+10% critical hit chance.', icon: '🧊', source: 'shop', coins: 3000, power: 0.1 },
  { id: 'p_vampiro', kind: 'passive', name: 'Vampire', rarity: 'epico', desc: 'Heal 7% of the damage you deal.', icon: '🧛', source: 'chest', power: 0.07 },
  { id: 'p_furia', kind: 'passive', name: 'Final Fury', rarity: 'epico', desc: '+35% damage when below 30% health.', icon: '😤', source: 'level', unlockLevel: 18, power: 0.35 },
  { id: 'p_muralha', kind: 'passive', name: 'The Wall', rarity: 'lendario', desc: '+15% block chance and stronger counters.', icon: '🧱', source: 'chest', power: 0.15 },
  { id: 'p_fenix', kind: 'passive', name: 'Phoenix', rarity: 'mitico', desc: 'Revive once with 35% health.', icon: '🐦‍🔥', source: 'chest', power: 0.35 },
  { id: 'p_bencao', kind: 'passive', name: 'Divine Blessing', rarity: 'celestial', desc: 'Start with half a Super and regenerate 1% health/s.', icon: '🕊️', source: 'mission', power: 0.01 },

  // ───────────── Golpes de assinatura (desbloqueiam com o nível ou compram-se com moedas até 3 níveis antes) ─────────────
  { id: 'm_stomp', kind: 'move', name: 'Stomps', rarity: 'comum', desc: 'Stomp on your downed opponent.', icon: '🦶', source: 'level', unlockLevel: 2, coins: 500, vis: { type: 'stomp' } },
  { id: 'm_dropkick', kind: 'move', name: 'Dropkick', rarity: 'comum', desc: 'A leap with both feet into the opponent\'s chest.', icon: '🦵', source: 'level', unlockLevel: 3, coins: 700, vis: { type: 'dropkick' } },
  { id: 'm_elbow', kind: 'move', name: 'Flying Elbow', rarity: 'comum', desc: 'Leap up and drop an elbow on a downed opponent.', icon: '💪', source: 'level', unlockLevel: 4, coins: 900, vis: { type: 'elbow' } },
  { id: 'm_irish', kind: 'move', name: 'Irish Whip', rarity: 'incomum', desc: 'Whip them into the ropes and meet them with a clothesline or a big boot.', icon: '🪢', source: 'level', unlockLevel: 5, coins: 1100, vis: { type: 'irish' } },
  { id: 'm_lariat', kind: 'move', name: 'Rope Lariat', rarity: 'incomum', desc: 'Bounce off the ropes and come back with an outstretched arm.', icon: '💨', source: 'level', unlockLevel: 6, coins: 1300, vis: { type: 'lariat' } },
  { id: 'm_spear', kind: 'move', name: 'Spear', rarity: 'raro', desc: 'A running tackle, shoulder to the gut.', icon: '🏈', source: 'level', unlockLevel: 7, coins: 1600, vis: { type: 'spear' } },
  { id: 'm_superkick', kind: 'move', name: 'Superkick', rarity: 'raro', desc: 'A sharp, high kick straight to the jaw.', icon: '👟', source: 'level', unlockLevel: 9, coins: 1900, vis: { type: 'superkick' } },
  { id: 'm_ddt', kind: 'move', name: 'DDT', rarity: 'raro', desc: 'A headlock and a head-first drop to the mat.', icon: '🔻', source: 'level', unlockLevel: 12, coins: 2300, vis: { type: 'ddt' } },
  { id: 'm_powerbomb', kind: 'move', name: 'Powerbomb', rarity: 'epico', desc: 'Lift them by the shoulders and slam them on their back.', icon: '💣', source: 'level', unlockLevel: 15, coins: 2900, vis: { type: 'powerbomb' } },
  { id: 'm_splash', kind: 'move', name: 'Top Rope Splash', rarity: 'epico', desc: 'Climb the corner and land full-body on your opponent.', icon: '🪂', source: 'level', unlockLevel: 18, coins: 3400, vis: { type: 'splash' } },
  { id: 'm_moonsault', kind: 'move', name: 'Moonsault', rarity: 'lendario', desc: 'A backflip off the top rope.', icon: '🌙', source: 'level', unlockLevel: 22, coins: 4200, vis: { type: 'moonsault' } },
  { id: 'm_chokeslam', kind: 'move', name: 'Chokeslam', rarity: 'lendario', desc: 'Grab them by the throat, lift them high and slam them down.', icon: '✋', source: 'level', unlockLevel: 26, coins: 5000, vis: { type: 'chokeslam' } },
  { id: 'm_cutter', kind: 'move', name: 'Cutter', rarity: 'mitico', desc: 'Leap, grab the head and fall back: out of nowhere!', icon: '⚡', source: 'level', unlockLevel: 30, coins: 6000, vis: { type: 'cutter' } },

  // ───────────── Estilos de golpe (só visual, mesmo dano) ─────────────
  { id: 'ms_dropkick_raio', kind: 'moveStyle', name: 'Electric Dropkick', rarity: 'epico', desc: 'Your Dropkick unleashes lightning on impact. Same damage, more spectacle.', icon: '⚡', source: 'shop', gems: 200, vis: { type: 'dropkick', style: 'raio', c1: '#7ad7ff' } },
  { id: 'ms_spear_fogo', kind: 'moveStyle', name: 'Flaming Spear', rarity: 'epico', desc: 'A fire trail and an explosion on impact of your Spear.', icon: '🔥', source: 'shop', gems: 250, vis: { type: 'spear', style: 'fogo', c1: '#ff6a00' } },
  { id: 'ms_superkick_ouro', kind: 'moveStyle', name: 'Golden Superkick', rarity: 'lendario', desc: 'A golden trail and a shower of sparks on your Superkick.', icon: '🥇', source: 'shop', gems: 350, vis: { type: 'superkick', style: 'ouro', c1: '#ffd23d' } },
  { id: 'ms_powerbomb_sismo', kind: 'moveStyle', name: 'Seismic Powerbomb', rarity: 'lendario', desc: 'The ring cracks and a shockwave sweeps the arena.', icon: '🌋', source: 'shop', gems: 400, vis: { type: 'powerbomb', style: 'sismo', c1: '#ff8a3d' } },
  { id: 'ms_moonsault_cosmos', kind: 'moveStyle', name: 'Cosmic Moonsault', rarity: 'mitico', desc: 'A trail of stars and a galactic explosion.', icon: '🌌', source: 'shop', gems: 600, vis: { type: 'moonsault', style: 'cosmos', c1: '#9b7aff' } },
  { id: 'ms_chokeslam_inferno', kind: 'moveStyle', name: 'Inferno Chokeslam', rarity: 'mitico', desc: 'Pillars of fire burst from the mat.', icon: '😈', source: 'shop', gems: 650, vis: { type: 'chokeslam', style: 'inferno', c1: '#ff2e2e' } },

  // ───────────── Entradas no ringue ─────────────
  { id: 'e_classica', kind: 'entrance', name: 'Classic Entrance', rarity: 'comum', desc: 'Spotlight, fists in the air and a cheering crowd.', icon: '🔦', source: 'start', vis: { type: 'classica', style: 'victory' } },
  { id: 'e_danca', kind: 'entrance', name: 'Dance Moves', rarity: 'incomum', desc: 'Dance your way in under disco lights.', icon: '🕺', source: 'shop', coins: 1500, vis: { type: 'danca', style: 'dance' } },
  { id: 'e_fumo', kind: 'entrance', name: 'Smoke Cannons', rarity: 'raro', desc: 'Emerge from a cloud of smoke.', icon: '🌫️', source: 'shop', coins: 3500, vis: { type: 'fumo', style: 'flex' } },
  { id: 'e_lasers', kind: 'entrance', name: 'Laser Show', rarity: 'epico', desc: 'Colorful lasers sweep the arena to the beat.', icon: '🔴', source: 'shop', gems: 250, vis: { type: 'lasers', style: 'dance' } },
  { id: 'e_pirotecnia', kind: 'entrance', name: 'Pyrotechnics', rarity: 'epico', desc: 'Pillars of fire erupt from all four corners of the ring.', icon: '🔥', source: 'shop', gems: 300, vis: { type: 'pirotecnia', style: 'flex' } },
  { id: 'e_fogos', kind: 'entrance', name: 'Fireworks', rarity: 'lendario', desc: 'Rockets, sky-high explosions and cascades of sparks from the ropes.', icon: '🎆', source: 'shop', gems: 550, vis: { type: 'fogos', style: 'point' } },
  { id: 'e_trovao', kind: 'entrance', name: 'Thunderstorm', rarity: 'lendario', desc: 'Lightning strikes around the ring with every step.', icon: '⛈️', source: 'chest', vis: { type: 'trovao', style: 'flex' } },
  { id: 'e_rei', kind: 'entrance', name: 'Royal Entrance', rarity: 'mitico', desc: 'A shower of golden confetti and spark fountains fit for a king.', icon: '👑', source: 'shop', gems: 900, vis: { type: 'rei', style: 'victory' } },
  { id: 'e_dragao', kind: 'entrance', name: 'Dragon Flight', rarity: 'mitico', desc: 'A fire dragon soars over the arena before you enter.', icon: '🐲', source: 'chest', vis: { type: 'dragao', style: 'point' } },
  { id: 'e_cosmica', kind: 'entrance', name: 'Cosmic Portal', rarity: 'celestial', desc: 'The arena turns into outer space and meteors rain down.', icon: '🌠', source: 'mission', vis: { type: 'cosmica', style: 'flex' } },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(I.map((i) => [i.id, i]));
export const ITEM_LIST = I;

export function item(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error('Item desconhecido: ' + id);
  return d;
}

export function itemsOfKind(kind: ItemKind): ItemDef[] {
  return I.filter((i) => i.kind === kind);
}

/** Itens que se podem trocar entre jogadores (skins e habilidades; não os itens iniciais). */
export function isTradeable(d: ItemDef): boolean {
  return d.source !== 'start';
}

/** Máximo de golpes de assinatura equipados (o 3.º espaço abre no nível MOVE_SLOT3_LEVEL). */
export const MOVE_SLOTS = 3;
export const MOVE_SLOT3_LEVEL = 8;
export const MOVE_EARLY_LEVELS = 3;

export const STARTER_ITEMS: string[] = I.filter((i) => i.source === 'start').map((i) => i.id);
