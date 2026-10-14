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
  hair: 'Penteado',
  hairColor: 'Cor de cabelo',
  outfit: 'Traje',
  gloves: 'Luvas',
  mask: 'Máscara',
  aura: 'Aura',
  super: 'Super ataque',
  passive: 'Habilidade passiva',
  entrance: 'Entrada',
  move: 'Golpe de assinatura',
  moveStyle: 'Estilo de golpe',
};

const I: ItemDef[] = [
  // ───────────── Penteados ─────────────
  { id: 'h_careca', kind: 'hair', name: 'Careca', rarity: 'comum', desc: 'Brilha debaixo dos holofotes.', icon: '🥚', source: 'start', vis: { style: 'careca' } },
  { id: 'h_curto', kind: 'hair', name: 'Curto', rarity: 'comum', desc: 'Clássico e prático.', icon: '💇', source: 'start', vis: { style: 'curto' } },
  { id: 'h_moicano', kind: 'hair', name: 'Moicano', rarity: 'comum', desc: 'Atitude punk.', icon: '🦔', source: 'start', vis: { style: 'moicano' } },
  { id: 'h_afro', kind: 'hair', name: 'Afro', rarity: 'comum', desc: 'Volume máximo.', icon: '☁️', source: 'start', vis: { style: 'afro' } },
  { id: 'h_espetado', kind: 'hair', name: 'Espetado', rarity: 'comum', desc: 'Cada pico é uma ameaça.', icon: '⚡', source: 'start', vis: { style: 'espetado' } },
  { id: 'h_rabo', kind: 'hair', name: 'Rabo de cavalo', rarity: 'comum', desc: 'Balança a cada golpe.', icon: '🎀', source: 'start', vis: { style: 'rabo' } },
  { id: 'h_topete', kind: 'hair', name: 'Topete', rarity: 'comum', desc: 'Estilo rock dos anos 50.', icon: '🎸', source: 'start', vis: { style: 'topete' } },
  { id: 'h_longo', kind: 'hair', name: 'Longo', rarity: 'comum', desc: 'Cabelo ao vento.', icon: '🌊', source: 'start', vis: { style: 'longo' } },
  { id: 'h_mullet', kind: 'hair', name: 'Mullet', rarity: 'incomum', desc: 'Negócios à frente, festa atrás.', icon: '🦅', source: 'shop', coins: 900, vis: { style: 'mullet' } },
  { id: 'h_trancas', kind: 'hair', name: 'Tranças', rarity: 'raro', desc: 'Tranças guerreiras que chicoteiam o ar.', icon: '🪢', source: 'shop', coins: 2400, vis: { style: 'trancas' } },
  { id: 'h_samurai', kind: 'hair', name: 'Coque Samurai', rarity: 'raro', desc: 'Honra acima de tudo.', icon: '🗡️', source: 'shop', coins: 2600, vis: { style: 'samurai' } },
  { id: 'h_super', kind: 'hair', name: 'Super Espetado', rarity: 'epico', desc: 'Poder acima de 9000.', icon: '🌟', source: 'shop', gems: 180, vis: { style: 'super' } },
  { id: 'h_chamas', kind: 'hair', name: 'Cabelo em Chamas', rarity: 'lendario', desc: 'Literalmente a arder. Animado.', icon: '🔥', source: 'shop', gems: 450, vis: { style: 'chamas', anim: 'fire' } },
  { id: 'h_cometa', kind: 'hair', name: 'Cauda de Cometa', rarity: 'mitico', desc: 'Um rasto de luz segue cada movimento.', icon: '☄️', source: 'chest', vis: { style: 'cometa', anim: 'comet' } },
  { id: 'h_coroa', kind: 'hair', name: 'Coroa de Luz', rarity: 'celestial', desc: 'Só os eleitos dos deuses a usam.', icon: '👑', source: 'mission', vis: { style: 'coroa', anim: 'halo' } },

  // ───────────── Cores de cabelo ─────────────
  { id: 'hc_preto', kind: 'hairColor', name: 'Preto', rarity: 'comum', desc: '', icon: '⚫', source: 'start', vis: { c1: '#1b1714', c2: '#3a312a' } },
  { id: 'hc_castanho', kind: 'hairColor', name: 'Castanho', rarity: 'comum', desc: '', icon: '🟤', source: 'start', vis: { c1: '#5a3418', c2: '#83522b' } },
  { id: 'hc_loiro', kind: 'hairColor', name: 'Loiro', rarity: 'comum', desc: '', icon: '🟡', source: 'start', vis: { c1: '#e2b44a', c2: '#f7dc8a' } },
  { id: 'hc_ruivo', kind: 'hairColor', name: 'Ruivo', rarity: 'comum', desc: '', icon: '🟠', source: 'start', vis: { c1: '#b8461b', c2: '#e2763d' } },
  { id: 'hc_grisalho', kind: 'hairColor', name: 'Grisalho', rarity: 'comum', desc: '', icon: '⚪', source: 'start', vis: { c1: '#8d8f95', c2: '#c9cbd0' } },
  { id: 'hc_azul', kind: 'hairColor', name: 'Azul Neon', rarity: 'incomum', desc: 'Cor elétrica.', icon: '🔵', source: 'shop', coins: 600, vis: { c1: '#1c6dff', c2: '#6ad4ff' } },
  { id: 'hc_rosa', kind: 'hairColor', name: 'Rosa Choque', rarity: 'incomum', desc: 'Impossível não reparar.', icon: '🩷', source: 'shop', coins: 600, vis: { c1: '#ff2e93', c2: '#ff9bd0' } },
  { id: 'hc_verde', kind: 'hairColor', name: 'Verde Tóxico', rarity: 'raro', desc: 'Brilha no escuro.', icon: '🟢', source: 'chest', vis: { c1: '#2bd41f', c2: '#c7ff5e' } },
  { id: 'hc_roxo', kind: 'hairColor', name: 'Roxo Galáctico', rarity: 'epico', desc: 'Tons de nebulosa.', icon: '🟣', source: 'shop', gems: 120, vis: { c1: '#5a1fd1', c2: '#e078ff' } },
  { id: 'hc_ouro', kind: 'hairColor', name: 'Ouro Puro', rarity: 'lendario', desc: 'Reflexos de ouro maciço.', icon: '🏅', source: 'chest', vis: { c1: '#c98a00', c2: '#fff1a8', anim: 'shine' } },
  { id: 'hc_arcoiris', kind: 'hairColor', name: 'Arco-íris', rarity: 'mitico', desc: 'Muda de cor continuamente.', icon: '🌈', source: 'mission', vis: { c1: '#ff0000', c2: '#ffffff', anim: 'rainbow' } },

  // ───────────── Trajes ─────────────
  { id: 'o_classico', kind: 'outfit', name: 'Calções Clássicos', rarity: 'comum', desc: 'Vermelho de campeão.', icon: '🩳', source: 'start', vis: { style: 'trunks', c1: '#e3263b', c2: '#ffffff', boots: '#2a2a33', pattern: 'stripe' } },
  { id: 'o_azul', kind: 'outfit', name: 'Calções Azuis', rarity: 'comum', desc: 'Frio e calculista.', icon: '🩳', source: 'start', vis: { style: 'trunks', c1: '#2357d9', c2: '#ffd23d', boots: '#1d2235', pattern: 'stripe' } },
  { id: 'o_preto', kind: 'outfit', name: 'Calções Pretos', rarity: 'comum', desc: 'Sem conversa.', icon: '🩳', source: 'shop', coins: 300, vis: { style: 'trunks', c1: '#1e1e24', c2: '#e3263b', boots: '#0f0f12', pattern: 'stripe' } },
  { id: 'o_lima', kind: 'outfit', name: 'Singlet Lima', rarity: 'incomum', desc: 'Visto a quilómetros.', icon: '🟩', source: 'shop', coins: 800, vis: { style: 'singlet', c1: '#7bdc1f', c2: '#1b3d08', boots: '#1b3d08', pattern: 'none' } },
  { id: 'o_retro', kind: 'outfit', name: 'Retro 80', rarity: 'incomum', desc: 'Néon, fita na testa e muita atitude.', icon: '📼', source: 'chest', vis: { style: 'singlet', c1: '#ff4fa3', c2: '#3ee6ff', boots: '#ffffff', pattern: 'stripe', head: 'bandana' } },
  { id: 'o_leopardo', kind: 'outfit', name: 'Leopardo', rarity: 'incomum', desc: 'Selvagem por natureza.', icon: '🐆', source: 'shop', coins: 900, vis: { style: 'trunks', c1: '#e8a93b', c2: '#3a2310', boots: '#3a2310', pattern: 'spots' } },
  { id: 'o_luchador', kind: 'outfit', name: 'Luchador Estelar', rarity: 'raro', desc: 'Singlet de estrelas e capa curta para voar mais alto.', icon: '⭐', source: 'shop', coins: 2800, vis: { style: 'singlet', c1: '#1940c9', c2: '#ffd700', boots: '#ffd700', pattern: 'stars', back: 'cape', c3: '#1940c9', c4: '#ffd700' } },
  { id: 'o_ninja', kind: 'outfit', name: 'Ninja Sombrio', rarity: 'raro', desc: 'Capuz, fato negro e uma katana às costas.', icon: '🥷', source: 'chest', vis: { style: 'gi', suit: '#22232d', c1: '#20212b', c2: '#7f1dd1', boots: '#15151c', pattern: 'none', head: 'ninja', back: 'katana' } },
  { id: 'o_bairro', kind: 'outfit', name: 'Campeão de Bairro', rarity: 'raro', desc: 'Casaco de cetim e medalhão de ouro ao peito.', icon: '🏆', source: 'level', unlockLevel: 8, vis: { style: 'jacket', c1: '#d6202f', c2: '#f5f5f5', boots: '#f5f5f5', pattern: 'stripe', chest: 'medal' } },
  { id: 'o_samurai', kind: 'outfit', name: 'Samurai Carmesim', rarity: 'epico', desc: 'Armadura lacada, ombreiras e kabuto com crista dourada.', icon: '⛩️', source: 'shop', gems: 220, vis: { style: 'armor', c1: '#a3121f', c2: '#1a1a1a', c3: '#e8c25a', boots: '#1a1a1a', pattern: 'lacquer', head: 'kabuto', shoulders: 'samurai' } },
  { id: 'o_rocker', kind: 'outfit', name: 'Rocker Elétrico', rarity: 'epico', desc: 'Casaco de cabedal com picos e uma guitarra elétrica às costas.', icon: '🎸', source: 'chest', vis: { style: 'jacket', c1: '#151518', c2: '#ffe23d', boots: '#151518', pattern: 'lightning', back: 'guitar', shoulders: 'spikes' } },
  { id: 'o_gladiador', kind: 'outfit', name: 'Gladiador', rarity: 'epico', desc: 'Elmo de penacho, couraça de bronze e escudo romano.', icon: '🏛️', source: 'level', unlockLevel: 20, vis: { style: 'armor', c1: '#8a5a24', c2: '#c98d3a', c3: '#ffd27a', boots: '#3a2410', pattern: 'muscle', head: 'galea', back: 'shield', shoulders: 'bronze' } },
  { id: 'o_heroi', kind: 'outfit', name: 'Super-Herói', rarity: 'epico', desc: 'Fato justo, emblema ao peito e uma capa enorme a esvoaçar.', icon: '🦸', source: 'shop', gems: 280, vis: { style: 'trunks', suit: '#1f5ad9', c1: '#d6202f', c2: '#ffd23d', boots: '#d6202f', pattern: 'none', back: 'cape_long', c3: '#d6202f', c4: '#9e1220', chest: 'emblem', head: 'domino' } },
  { id: 'o_imperador', kind: 'outfit', name: 'Imperador Dourado', rarity: 'lendario', desc: 'Armadura de ouro maciço, coroa e manto real de veludo.', icon: '👑', source: 'shop', gems: 600, vis: { style: 'armor', c1: '#e0a800', c2: '#fff3b0', c3: '#ffffff', boots: '#b07d00', pattern: 'royal', anim: 'gold', head: 'crown', back: 'royalcape', shoulders: 'gold' } },
  { id: 'o_dragao', kind: 'outfit', name: 'Dragão Ancestral', rarity: 'lendario', desc: 'Escamas, chifres, asas e cauda de dragão. Brilha com fogo interior.', icon: '🐉', source: 'chest', vis: { style: 'none', mat: 'dragon', suit: '#1f8a4c', c1: '#0f7a3d', c2: '#ffb31a', c3: '#ffe08a', boots: '#07391c', pattern: 'none', anim: 'glow', head: 'horns', back: 'wings_dragon', tail: 'dragon' } },
  { id: 'o_astronauta', kind: 'outfit', name: 'Astronauta', rarity: 'lendario', desc: 'Fato espacial, capacete de vidro e mochila de propulsão com luzes.', icon: '👨‍🚀', source: 'shop', gems: 650, vis: { style: 'none', mat: 'astro', suit: '#f1f3f7', c1: '#f1f3f7', c2: '#ff7a1a', c3: '#3a8bff', boots: '#d9dde6', pattern: 'none', head: 'astro', back: 'astropack', chest: 'panel' } },
  { id: 'o_tubarao', kind: 'outfit', name: 'Tubarão Assassino', rarity: 'lendario', desc: 'Um disfarce de tubarão completo: a cara espreita entre os dentes!', icon: '🦈', source: 'shop', gems: 550, vis: { style: 'none', mat: 'shark', suit: '#6f8fa8', c1: '#6f8fa8', c2: '#f2f5f8', c3: '#ffffff', boots: '#4d6a80', pattern: 'none', head: 'shark', back: 'fin', tail: 'shark' } },
  { id: 'o_lava', kind: 'outfit', name: 'Golem de Lava', rarity: 'mitico', desc: 'O corpo inteiro é rocha vulcânica com magma a pulsar nas fendas.', icon: '🌋', source: 'chest', vis: { style: 'none', mat: 'lava', suit: '#3a2620', c1: '#2a1410', c2: '#ff5a00', c3: '#ffd000', boots: '#1a0c08', pattern: 'none', anim: 'lava', head: 'lava', shoulders: 'rock' } },
  { id: 'o_gelo', kind: 'outfit', name: 'Gigante de Gelo', rarity: 'mitico', desc: 'Um corpo de cristal gelado, coroa de estalactites e névoa congelada.', icon: '❄️', source: 'mission', vis: { style: 'none', mat: 'ice', suit: '#9fdcff', c1: '#bfefff', c2: '#3aa8ff', c3: '#ffffff', boots: '#6cc4ff', pattern: 'none', anim: 'ice', head: 'ice', shoulders: 'crystals' } },
  { id: 'o_mecha', kind: 'outfit', name: 'Mecha Titã', rarity: 'mitico', desc: 'Armadura robótica, núcleo de energia no peito e propulsores a jato.', icon: '🤖', source: 'shop', gems: 1200, vis: { style: 'none', mat: 'metal', suit: '#9aa6b8', c1: '#c3ccd8', c2: '#2be3ff', c3: '#ff4a3d', boots: '#59627a', pattern: 'none', head: 'robo', back: 'jetpack', chest: 'core', shoulders: 'mecha' } },
  { id: 'o_rex', kind: 'outfit', name: 'T-Rex', rarity: 'mitico', desc: 'Disfarce de dinossauro com mandíbulas gigantes, placas nas costas e cauda.', icon: '🦖', source: 'shop', gems: 1000, vis: { style: 'none', mat: 'dino', suit: '#4fae3a', c1: '#4fae3a', c2: '#f4d98a', c3: '#ffffff', boots: '#2f7a22', pattern: 'none', head: 'dino', back: 'plates', tail: 'dino' } },
  { id: 'o_cosmos', kind: 'outfit', name: 'Deus do Ringue', rarity: 'celestial', desc: 'O corpo é uma galáxia viva, com auréola e anéis planetários a orbitar.', icon: '🌌', source: 'mission', vis: { style: 'none', mat: 'cosmic', suit: '#1a0f4a', c1: '#0b0626', c2: '#7a5cff', c3: '#ffffff', boots: '#0b0626', pattern: 'none', anim: 'cosmic', head: 'halo', back: 'orbit' } },
  { id: 'o_fenix', kind: 'outfit', name: 'Fénix Imortal', rarity: 'celestial', desc: 'Penas de fogo, crista em chamas e asas ardentes que renascem a cada golpe.', icon: '🐦‍🔥', source: 'shop', gems: 2000, vis: { style: 'none', mat: 'feather', suit: '#e8461a', c1: '#d6301a', c2: '#ffb31a', c3: '#fff3a0', boots: '#7a1508', pattern: 'none', anim: 'fire', head: 'fenix', back: 'wings_fire', tail: 'fire' } },

  // ───────────── Luvas ─────────────
  { id: 'g_vermelhas', kind: 'gloves', name: 'Luvas Vermelhas', rarity: 'comum', desc: 'As de sempre.', icon: '🥊', source: 'start', vis: { style: 'boxe', c1: '#d91f2f', c2: '#ffffff' } },
  { id: 'g_azuis', kind: 'gloves', name: 'Luvas Azuis', rarity: 'comum', desc: 'Frescas como o mar.', icon: '🥊', source: 'start', vis: { style: 'boxe', c1: '#1f5ad9', c2: '#ffffff' } },
  { id: 'g_fita', kind: 'gloves', name: 'Ligaduras de Rua', rarity: 'incomum', desc: 'Luta à moda antiga, de punhos ligados.', icon: '🩹', source: 'shop', coins: 700, vis: { style: 'fita', c1: '#f2efe6', c2: '#c9c3b0' } },
  { id: 'g_pretas', kind: 'gloves', name: 'Luvas Noite', rarity: 'incomum', desc: 'Pretas com atacadores e logótipo dourado.', icon: '🥊', source: 'chest', vis: { style: 'pro', c1: '#18181d', c2: '#e2b44a' } },
  { id: 'g_ouro', kind: 'gloves', name: 'Luvas de Ouro', rarity: 'raro', desc: 'Ouro polido com reflexos que correm a cada soco.', icon: '🏅', source: 'shop', coins: 2200, vis: { style: 'pro', c1: '#e8b31c', c2: '#fff3b0', anim: 'shine' } },
  { id: 'g_picos', kind: 'gloves', name: 'Manoplas Cravejadas', rarity: 'raro', desc: 'Cabedal pesado com picos de metal nos nós dos dedos.', icon: '⛓️', source: 'chest', vis: { style: 'picos', c1: '#3a2418', c2: '#d9dde3' } },
  { id: 'g_garras', kind: 'gloves', name: 'Garras de Aço', rarity: 'epico', desc: 'Manopla de metal com três lâminas afiadas.', icon: '🦾', source: 'chest', vis: { style: 'garra', c1: '#7d8796', c2: '#eef3f8' } },
  { id: 'g_pedra', kind: 'gloves', name: 'Punhos de Pedra', rarity: 'epico', desc: 'Dois pedregulhos enormes com musgo e fendas.', icon: '🪨', source: 'shop', gems: 200, vis: { style: 'pedra', c1: '#7d7468', c2: '#4f8a3a' } },
  { id: 'g_tesla', kind: 'gloves', name: 'Manoplas Tesla', rarity: 'epico', desc: 'Bobinas de cobre e arcos elétricos entre os dedos.', icon: '⚡', source: 'chest', vis: { style: 'tesla', c1: '#3a3f4a', c2: '#7ad7ff', c3: '#d98a3a' } },
  { id: 'g_fogo', kind: 'gloves', name: 'Punhos de Fogo', rarity: 'lendario', desc: 'Os punhos são chamas vivas que sobem pelos braços.', icon: '🔥', source: 'shop', gems: 380, vis: { style: 'fogo', c1: '#ff5a00', c2: '#ffd000', anim: 'fire' } },
  { id: 'g_gelo', kind: 'gloves', name: 'Manoplas de Gelo', rarity: 'lendario', desc: 'Cristais de gelo eterno e névoa congelante.', icon: '🧊', source: 'chest', vis: { style: 'gelo', c1: '#bfefff', c2: '#3aa8ff' } },
  { id: 'g_dragao', kind: 'gloves', name: 'Cabeças de Dragão', rarity: 'lendario', desc: 'Cada punho é a cabeça de um dragão que abre a boca e deita fumo.', icon: '🐲', source: 'shop', gems: 480, vis: { style: 'dragao', c1: '#c4122c', c2: '#ffd23d' } },
  { id: 'g_mecha', kind: 'gloves', name: 'Punhos Mecha', rarity: 'mitico', desc: 'Punhos robóticos gigantes com pistões, luzes e propulsores.', icon: '🦿', source: 'shop', gems: 800, vis: { style: 'mecha', c1: '#9aa6b8', c2: '#2be3ff', c3: '#ff4a3d' } },
  { id: 'g_sombra', kind: 'gloves', name: 'Mãos da Sombra', rarity: 'mitico', desc: 'Garras fantasmagóricas de fumo roxo com olhos que brilham.', icon: '👻', source: 'chest', vis: { style: 'sombra', c1: '#2a0a45', c2: '#c77dff' } },
  { id: 'g_cosmicas', kind: 'gloves', name: 'Manoplas Cósmicas', rarity: 'celestial', desc: 'Galáxias nos punhos, com anéis planetários a orbitar.', icon: '✨', source: 'chest', vis: { style: 'cosmico', c1: '#2a1a7a', c2: '#9be8ff', anim: 'cosmic' } },
  { id: 'g_sol', kind: 'gloves', name: 'Punhos do Sol', rarity: 'celestial', desc: 'Dois sóis em miniatura com coroa de raios e chamas solares.', icon: '☀️', source: 'mission', vis: { style: 'sol', c1: '#ff9a00', c2: '#fff6b0' } },

  // ───────────── Máscaras ─────────────
  { id: 'm_luchador', kind: 'mask', name: 'Máscara Luchador', rarity: 'raro', desc: 'A tradição mexicana com estilo.', icon: '🎭', source: 'shop', coins: 2500, vis: { style: 'luchador', c1: '#1f5ad9', c2: '#ffffff' } },
  { id: 'm_luchador_r', kind: 'mask', name: 'Luchador Rubi', rarity: 'raro', desc: 'Vermelho-sangue e prata.', icon: '🎭', source: 'chest', vis: { style: 'luchador', c1: '#c4122c', c2: '#d9dde3' } },
  { id: 'm_caveira', kind: 'mask', name: 'Pintura Caveira', rarity: 'epico', desc: 'Assusta antes do primeiro golpe.', icon: '💀', source: 'chest', vis: { style: 'caveira', c1: '#f4f4f4', c2: '#111111' } },
  { id: 'm_demonio', kind: 'mask', name: 'Máscara Demónio', rarity: 'lendario', desc: 'Olhos que ardem no escuro.', icon: '👹', source: 'chest', vis: { style: 'demonio', c1: '#b3121f', c2: '#ffd000' } },
  { id: 'm_cyber', kind: 'mask', name: 'Visor Cyber', rarity: 'mitico', desc: 'Analisa o adversário em tempo real.', icon: '🤖', source: 'mission', vis: { style: 'cyber', c1: '#1a1d26', c2: '#00f0ff', anim: 'scan' } },

  // ───────────── Auras (efeito à volta do lutador + fundo nos menus) ─────────────
  { id: 'a_holofotes', kind: 'aura', name: 'Holofotes', rarity: 'comum', desc: 'Fundo de arena com holofotes a varrer o fumo.', icon: '🔦', source: 'shop', coins: 400, vis: { type: 'holofotes', c1: '#ffffff', c2: '#9ab8ff' } },
  { id: 'a_neon', kind: 'aura', name: 'Néon Retro', rarity: 'incomum', desc: 'Pôr do sol synthwave e grelha néon. Contorno néon no lutador.', icon: '🌆', source: 'shop', coins: 1200, vis: { type: 'neon', c1: '#ff3df0', c2: '#3df0ff' } },
  { id: 'a_faiscas', kind: 'aura', name: 'Faíscas', rarity: 'raro', desc: 'Faíscas douradas sobem à tua volta.', icon: '✨', source: 'shop', coins: 3000, vis: { type: 'faiscas', c1: '#ffd23d', c2: '#fff6c2' } },
  { id: 'a_petalas', kind: 'aura', name: 'Pétalas de Sakura', rarity: 'epico', desc: 'Cerejeiras ao luar e pétalas a dançar.', icon: '🌸', source: 'chest', vis: { type: 'petalas', c1: '#ff9ccf', c2: '#ffe3f1' } },
  { id: 'a_chamas', kind: 'aura', name: 'Aura de Chamas', rarity: 'epico', desc: 'Uma muralha de fogo arde atrás de ti.', icon: '🔥', source: 'shop', gems: 250, vis: { type: 'chamas', c1: '#ff5a00', c2: '#ffd000' } },
  { id: 'a_raio', kind: 'aura', name: 'Tempestade', rarity: 'lendario', desc: 'Nuvens negras, chuva e relâmpagos a dançar à tua volta.', icon: '🌩️', source: 'chest', vis: { type: 'raio', c1: '#6ad4ff', c2: '#ffffff' } },
  { id: 'a_aurora', kind: 'aura', name: 'Aurora Boreal', rarity: 'lendario', desc: 'Cortinas de luz verde e violeta sobre montanhas geladas.', icon: '🌌', source: 'shop', gems: 450, vis: { type: 'aurora', c1: '#3dffa8', c2: '#b05cff' } },
  { id: 'a_sombra', kind: 'aura', name: 'Sombra Abissal', rarity: 'mitico', desc: 'O abismo observa-te: fumo negro, tentáculos e olhos no escuro.', icon: '🌑', source: 'chest', vis: { type: 'sombra', c1: '#3a0a5c', c2: '#b25cff' } },
  { id: 'a_cosmos', kind: 'aura', name: 'Cosmos', rarity: 'celestial', desc: 'Uma galáxia em espiral, planetas e estrelas cadentes.', icon: '🪐', source: 'mission', vis: { type: 'cosmos', c1: '#7a5cff', c2: '#7af7ff' } },

  // ───────────── Super ataques ─────────────
  { id: 's_supersoco', kind: 'super', name: 'Super Soco', rarity: 'comum', desc: 'Um soco carregado que sacode o ringue.', icon: '👊', source: 'start', power: 1.0, vis: { type: 'supersoco' } },
  { id: 's_lariat', kind: 'super', name: 'Lariat Imparável', rarity: 'incomum', desc: 'Corre às cordas e volta como um comboio.', icon: '🚂', source: 'level', unlockLevel: 4, power: 1.1, vis: { type: 'lariat' } },
  { id: 's_relampago', kind: 'super', name: 'Combo Relâmpago', rarity: 'raro', desc: 'Oito socos à velocidade da luz.', icon: '⚡', source: 'level', unlockLevel: 10, power: 1.2, vis: { type: 'relampago' } },
  { id: 's_trovao', kind: 'super', name: 'Punho Trovão', rarity: 'raro', desc: 'Um uppercut que chama um raio do céu.', icon: '🌩️', source: 'shop', coins: 3500, power: 1.25, vis: { type: 'trovao' } },
  { id: 's_tornado', kind: 'super', name: 'Tornado Giratório', rarity: 'epico', desc: 'Gira como um furacão, golpe atrás de golpe.', icon: '🌪️', source: 'chest', power: 1.35, vis: { type: 'tornado' } },
  { id: 's_dragao', kind: 'super', name: 'Dragão de Fogo', rarity: 'epico', desc: 'Liberta um dragão de chamas.', icon: '🐉', source: 'shop', gems: 300, power: 1.4, vis: { type: 'dragao' } },
  { id: 's_meteoro', kind: 'super', name: 'Queda do Meteoro', rarity: 'lendario', desc: 'Salta até ao teto e cai como um meteoro.', icon: '☄️', source: 'chest', power: 1.55, vis: { type: 'meteoro' } },
  { id: 's_atomico', kind: 'super', name: 'Suplex Atómico', rarity: 'lendario', desc: 'Um suplex tão forte que cria uma onda de choque.', icon: '☢️', source: 'level', unlockLevel: 30, power: 1.55, vis: { type: 'atomico' } },
  { id: 's_cosmico', kind: 'super', name: 'Soco Cósmico', rarity: 'mitico', desc: 'Para o tempo e desfere um punho galáctico.', icon: '🌌', source: 'chest', power: 1.75, vis: { type: 'cosmico' } },
  { id: 's_ira', kind: 'super', name: 'Ira Celestial', rarity: 'celestial', desc: 'Asas de luz e um raio divino dos céus.', icon: '😇', source: 'mission', power: 1.8, vis: { type: 'ira' } },

  // ───────────── Passivas ─────────────
  { id: 'p_ferro', kind: 'passive', name: 'Pele de Ferro', rarity: 'comum', desc: 'Recebe menos 8% de dano.', icon: '🛡️', source: 'start', power: 0.08 },
  { id: 'p_showman', kind: 'passive', name: 'Showman', rarity: 'incomum', desc: 'O público adora-te: +30% carga de Super.', icon: '🎤', source: 'level', unlockLevel: 3, power: 0.3 },
  { id: 'p_maos', kind: 'passive', name: 'Mãos Rápidas', rarity: 'incomum', desc: 'Ataques 12% mais rápidos.', icon: '🤚', source: 'shop', coins: 1200, power: 0.12 },
  { id: 'p_folego', kind: 'passive', name: 'Segundo Fôlego', rarity: 'raro', desc: 'Uma vez por luta, recupera 20% da vida abaixo de 25%.', icon: '🌬️', source: 'level', unlockLevel: 12, power: 0.2 },
  { id: 'p_frio', kind: 'passive', name: 'Sangue Frio', rarity: 'raro', desc: '+10% de probabilidade de crítico.', icon: '🧊', source: 'shop', coins: 3000, power: 0.1 },
  { id: 'p_vampiro', kind: 'passive', name: 'Vampiro', rarity: 'epico', desc: 'Recupera 7% do dano que causas.', icon: '🧛', source: 'chest', power: 0.07 },
  { id: 'p_furia', kind: 'passive', name: 'Fúria Final', rarity: 'epico', desc: '+35% de dano abaixo de 30% de vida.', icon: '😤', source: 'level', unlockLevel: 18, power: 0.35 },
  { id: 'p_muralha', kind: 'passive', name: 'Muralha', rarity: 'lendario', desc: '+15% de bloqueio e contra-ataques mais fortes.', icon: '🧱', source: 'chest', power: 0.15 },
  { id: 'p_fenix', kind: 'passive', name: 'Fénix', rarity: 'mitico', desc: 'Renasce uma vez com 35% de vida.', icon: '🐦‍🔥', source: 'chest', power: 0.35 },
  { id: 'p_bencao', kind: 'passive', name: 'Bênção Divina', rarity: 'celestial', desc: 'Começa com meio Super e regenera 1% de vida/s.', icon: '🕊️', source: 'mission', power: 0.01 },

  // ───────────── Golpes de assinatura (desbloqueiam com o nível ou compram-se com moedas até 3 níveis antes) ─────────────
  { id: 'm_stomp', kind: 'move', name: 'Pisões', rarity: 'comum', desc: 'Pisa o adversário caído no chão.', icon: '🦶', source: 'level', unlockLevel: 2, coins: 500, vis: { type: 'stomp' } },
  { id: 'm_dropkick', kind: 'move', name: 'Dropkick', rarity: 'comum', desc: 'Salto com os dois pés ao peito do adversário.', icon: '🦵', source: 'level', unlockLevel: 3, coins: 700, vis: { type: 'dropkick' } },
  { id: 'm_elbow', kind: 'move', name: 'Cotovelada Voadora', rarity: 'comum', desc: 'Salta e cai de cotovelo sobre quem está no chão.', icon: '💪', source: 'level', unlockLevel: 4, coins: 900, vis: { type: 'elbow' } },
  { id: 'm_irish', kind: 'move', name: 'Mandar às Cordas', rarity: 'incomum', desc: 'Atira-o contra as cordas e recebe-o com uma clothesline ou big boot.', icon: '🪢', source: 'level', unlockLevel: 5, coins: 1100, vis: { type: 'irish' } },
  { id: 'm_lariat', kind: 'move', name: 'Lariat das Cordas', rarity: 'incomum', desc: 'Ressalta nas cordas e volta com o braço esticado.', icon: '💨', source: 'level', unlockLevel: 6, coins: 1300, vis: { type: 'lariat' } },
  { id: 'm_spear', kind: 'move', name: 'Spear', rarity: 'raro', desc: 'Placagem a correr, ombro ao abdómen.', icon: '🏈', source: 'level', unlockLevel: 7, coins: 1600, vis: { type: 'spear' } },
  { id: 'm_superkick', kind: 'move', name: 'Superkick', rarity: 'raro', desc: 'Pontapé alto e seco ao queixo.', icon: '👟', source: 'level', unlockLevel: 9, coins: 1900, vis: { type: 'superkick' } },
  { id: 'm_ddt', kind: 'move', name: 'DDT', rarity: 'raro', desc: 'Chave de cabeça e queda de cabeça no tapete.', icon: '🔻', source: 'level', unlockLevel: 12, coins: 2300, vis: { type: 'ddt' } },
  { id: 'm_powerbomb', kind: 'move', name: 'Powerbomb', rarity: 'epico', desc: 'Levanta-o pelos ombros e esmaga-o de costas.', icon: '💣', source: 'level', unlockLevel: 15, coins: 2900, vis: { type: 'powerbomb' } },
  { id: 'm_splash', kind: 'move', name: 'Splash da Corda de Cima', rarity: 'epico', desc: 'Sobe ao canto e cai de corpo inteiro sobre o adversário.', icon: '🪂', source: 'level', unlockLevel: 18, coins: 3400, vis: { type: 'splash' } },
  { id: 'm_moonsault', kind: 'move', name: 'Moonsault', rarity: 'lendario', desc: 'Mortal para trás da corda de cima.', icon: '🌙', source: 'level', unlockLevel: 22, coins: 4200, vis: { type: 'moonsault' } },
  { id: 'm_chokeslam', kind: 'move', name: 'Chokeslam', rarity: 'lendario', desc: 'Agarra pelo pescoço, levanta-o bem alto e atira-o ao chão.', icon: '✋', source: 'level', unlockLevel: 26, coins: 5000, vis: { type: 'chokeslam' } },
  { id: 'm_cutter', kind: 'move', name: 'Cutter', rarity: 'mitico', desc: 'Salta, agarra a cabeça e cai de costas: vem do nada!', icon: '⚡', source: 'level', unlockLevel: 30, coins: 6000, vis: { type: 'cutter' } },

  // ───────────── Estilos de golpe (só visual, mesmo dano) ─────────────
  { id: 'ms_dropkick_raio', kind: 'moveStyle', name: 'Dropkick Elétrico', rarity: 'epico', desc: 'O Dropkick solta relâmpagos no impacto. Mesmo dano, mais espetáculo.', icon: '⚡', source: 'shop', gems: 200, vis: { type: 'dropkick', style: 'raio', c1: '#7ad7ff' } },
  { id: 'ms_spear_fogo', kind: 'moveStyle', name: 'Spear em Chamas', rarity: 'epico', desc: 'Rasto de fogo e explosão no impacto do Spear.', icon: '🔥', source: 'shop', gems: 250, vis: { type: 'spear', style: 'fogo', c1: '#ff6a00' } },
  { id: 'ms_superkick_ouro', kind: 'moveStyle', name: 'Superkick Dourado', rarity: 'lendario', desc: 'Rasto dourado e chuva de faíscas no Superkick.', icon: '🥇', source: 'shop', gems: 350, vis: { type: 'superkick', style: 'ouro', c1: '#ffd23d' } },
  { id: 'ms_powerbomb_sismo', kind: 'moveStyle', name: 'Powerbomb Sísmico', rarity: 'lendario', desc: 'O ringue estala e a onda de choque varre a arena.', icon: '🌋', source: 'shop', gems: 400, vis: { type: 'powerbomb', style: 'sismo', c1: '#ff8a3d' } },
  { id: 'ms_moonsault_cosmos', kind: 'moveStyle', name: 'Moonsault Cósmico', rarity: 'mitico', desc: 'Rasto de estrelas e explosão galáctica.', icon: '🌌', source: 'shop', gems: 600, vis: { type: 'moonsault', style: 'cosmos', c1: '#9b7aff' } },
  { id: 'ms_chokeslam_inferno', kind: 'moveStyle', name: 'Chokeslam do Inferno', rarity: 'mitico', desc: 'Colunas de fogo rebentam do tapete.', icon: '😈', source: 'shop', gems: 650, vis: { type: 'chokeslam', style: 'inferno', c1: '#ff2e2e' } },

  // ───────────── Entradas no ringue ─────────────
  { id: 'e_classica', kind: 'entrance', name: 'Entrada Clássica', rarity: 'comum', desc: 'Holofote, punhos no ar e o público a aplaudir.', icon: '🔦', source: 'start', vis: { type: 'classica', style: 'victory' } },
  { id: 'e_danca', kind: 'entrance', name: 'Passo de Dança', rarity: 'incomum', desc: 'Entra a dançar com luzes de discoteca.', icon: '🕺', source: 'shop', coins: 1500, vis: { type: 'danca', style: 'dance' } },
  { id: 'e_fumo', kind: 'entrance', name: 'Canhões de Fumo', rarity: 'raro', desc: 'Surge do meio de uma nuvem de fumo.', icon: '🌫️', source: 'shop', coins: 3500, vis: { type: 'fumo', style: 'flex' } },
  { id: 'e_lasers', kind: 'entrance', name: 'Show de Lasers', rarity: 'epico', desc: 'Lasers coloridos varrem a arena ao ritmo da música.', icon: '🔴', source: 'shop', gems: 250, vis: { type: 'lasers', style: 'dance' } },
  { id: 'e_pirotecnia', kind: 'entrance', name: 'Pirotecnia', rarity: 'epico', desc: 'Colunas de fogo explodem nos quatro cantos do ringue.', icon: '🔥', source: 'shop', gems: 300, vis: { type: 'pirotecnia', style: 'flex' } },
  { id: 'e_fogos', kind: 'entrance', name: 'Fogo de Artifício', rarity: 'lendario', desc: 'Foguetes, explosões no céu e cascatas de faíscas das cordas.', icon: '🎆', source: 'shop', gems: 550, vis: { type: 'fogos', style: 'point' } },
  { id: 'e_trovao', kind: 'entrance', name: 'Tempestade', rarity: 'lendario', desc: 'Relâmpagos caem à volta do ringue a cada passo.', icon: '⛈️', source: 'chest', vis: { type: 'trovao', style: 'flex' } },
  { id: 'e_rei', kind: 'entrance', name: 'Entrada Real', rarity: 'mitico', desc: 'Chuva de confettis dourados e fontes de faíscas para o rei.', icon: '👑', source: 'shop', gems: 900, vis: { type: 'rei', style: 'victory' } },
  { id: 'e_dragao', kind: 'entrance', name: 'Voo do Dragão', rarity: 'mitico', desc: 'Um dragão de fogo sobrevoa a arena antes de entrares.', icon: '🐲', source: 'chest', vis: { type: 'dragao', style: 'point' } },
  { id: 'e_cosmica', kind: 'entrance', name: 'Portal Cósmico', rarity: 'celestial', desc: 'A arena transforma-se no espaço e chovem meteoros.', icon: '🌠', source: 'mission', vis: { type: 'cosmica', style: 'flex' } },
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

export const MOVE_SLOTS = 6;
export const MOVE_EARLY_LEVELS = 3;

export const STARTER_ITEMS: string[] = I.filter((i) => i.source === 'start').map((i) => i.id);
