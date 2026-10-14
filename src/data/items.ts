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
  | 'potion'
  | 'entrance';

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
  /** Número do efeito (ex.: multiplicador de dano do super, % de cura da poção). */
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
  potion: 'Poção',
  entrance: 'Entrada',
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
  { id: 'o_retro', kind: 'outfit', name: 'Retro 80', rarity: 'incomum', desc: 'Néon, laca e muita atitude.', icon: '📼', source: 'chest', vis: { style: 'singlet', c1: '#ff4fa3', c2: '#3ee6ff', boots: '#ffffff', pattern: 'stripe' } },
  { id: 'o_leopardo', kind: 'outfit', name: 'Leopardo', rarity: 'incomum', desc: 'Selvagem por natureza.', icon: '🐆', source: 'shop', coins: 900, vis: { style: 'trunks', c1: '#e8a93b', c2: '#3a2310', boots: '#3a2310', pattern: 'spots' } },
  { id: 'o_luchador', kind: 'outfit', name: 'Luchador Estelar', rarity: 'raro', desc: 'Voa mais alto que todos.', icon: '⭐', source: 'shop', coins: 2800, vis: { style: 'singlet', c1: '#1940c9', c2: '#ffd700', boots: '#ffd700', pattern: 'stars' } },
  { id: 'o_ninja', kind: 'outfit', name: 'Ninja Sombrio', rarity: 'raro', desc: 'Silencioso como a noite.', icon: '🥷', source: 'chest', vis: { style: 'gi', c1: '#20212b', c2: '#7f1dd1', boots: '#15151c', pattern: 'none' } },
  { id: 'o_bairro', kind: 'outfit', name: 'Campeão de Bairro', rarity: 'raro', desc: 'Respeitado em todas as ruas.', icon: '🏆', source: 'level', unlockLevel: 8, vis: { style: 'jacket', c1: '#d6202f', c2: '#f5f5f5', boots: '#f5f5f5', pattern: 'stripe' } },
  { id: 'o_samurai', kind: 'outfit', name: 'Samurai Carmesim', rarity: 'epico', desc: 'Armadura forjada em batalha.', icon: '⛩️', source: 'shop', gems: 220, vis: { style: 'armor', c1: '#a3121f', c2: '#1a1a1a', c3: '#e8c25a', boots: '#1a1a1a', pattern: 'none' } },
  { id: 'o_rocker', kind: 'outfit', name: 'Rocker Elétrico', rarity: 'epico', desc: 'Cada golpe é um solo de guitarra.', icon: '🎸', source: 'chest', vis: { style: 'jacket', c1: '#151518', c2: '#ffe23d', boots: '#151518', pattern: 'lightning' } },
  { id: 'o_gladiador', kind: 'outfit', name: 'Gladiador', rarity: 'epico', desc: 'Pelo coliseu e pela glória.', icon: '🏛️', source: 'level', unlockLevel: 20, vis: { style: 'armor', c1: '#8a5a24', c2: '#3a2410', c3: '#d4a24a', boots: '#3a2410', pattern: 'none' } },
  { id: 'o_imperador', kind: 'outfit', name: 'Imperador Dourado', rarity: 'lendario', desc: 'Ouro maciço que reflete os holofotes.', icon: '👑', source: 'shop', gems: 600, vis: { style: 'armor', c1: '#e0a800', c2: '#fff3b0', c3: '#ffffff', boots: '#b07d00', pattern: 'none', anim: 'gold' } },
  { id: 'o_dragao', kind: 'outfit', name: 'Dragão Ancestral', rarity: 'lendario', desc: 'Escamas que brilham com fogo interior.', icon: '🐉', source: 'chest', vis: { style: 'gi', c1: '#0f7a3d', c2: '#ffb31a', boots: '#07391c', pattern: 'scales', anim: 'glow' } },
  { id: 'o_lava', kind: 'outfit', name: 'Lava Viva', rarity: 'mitico', desc: 'Fissuras de magma pulsam a cada respiração.', icon: '🌋', source: 'chest', vis: { style: 'armor', c1: '#2a1410', c2: '#ff5a00', c3: '#ffd000', boots: '#1a0c08', pattern: 'cracks', anim: 'lava' } },
  { id: 'o_gelo', kind: 'outfit', name: 'Gelo Eterno', rarity: 'mitico', desc: 'Forjado no coração de um glaciar.', icon: '❄️', source: 'mission', vis: { style: 'armor', c1: '#bfefff', c2: '#3aa8ff', c3: '#ffffff', boots: '#6cc4ff', pattern: 'crystals', anim: 'ice' } },
  { id: 'o_cosmos', kind: 'outfit', name: 'Deus do Ringue', rarity: 'celestial', desc: 'Um universo inteiro a vestir um lutador.', icon: '🌌', source: 'mission', vis: { style: 'armor', c1: '#0b0626', c2: '#7a5cff', c3: '#ffffff', boots: '#0b0626', pattern: 'cosmos', anim: 'cosmic' } },

  // ───────────── Luvas ─────────────
  { id: 'g_vermelhas', kind: 'gloves', name: 'Luvas Vermelhas', rarity: 'comum', desc: 'As de sempre.', icon: '🥊', source: 'start', vis: { style: 'boxe', c1: '#d91f2f', c2: '#ffffff' } },
  { id: 'g_azuis', kind: 'gloves', name: 'Luvas Azuis', rarity: 'comum', desc: 'Frescas como o mar.', icon: '🥊', source: 'start', vis: { style: 'boxe', c1: '#1f5ad9', c2: '#ffffff' } },
  { id: 'g_fita', kind: 'gloves', name: 'Ligaduras de Rua', rarity: 'incomum', desc: 'Luta à moda antiga.', icon: '🩹', source: 'shop', coins: 700, vis: { style: 'fita', c1: '#f2efe6', c2: '#c9c3b0' } },
  { id: 'g_pretas', kind: 'gloves', name: 'Luvas Noite', rarity: 'incomum', desc: 'Pretas com detalhe dourado.', icon: '🥊', source: 'chest', vis: { style: 'boxe', c1: '#18181d', c2: '#e2b44a' } },
  { id: 'g_ouro', kind: 'gloves', name: 'Luvas de Ouro', rarity: 'raro', desc: 'Para quem nasceu campeão.', icon: '🏅', source: 'shop', coins: 2200, vis: { style: 'boxe', c1: '#e8b31c', c2: '#fff3b0' } },
  { id: 'g_garras', kind: 'gloves', name: 'Garras de Aço', rarity: 'epico', desc: 'Metal frio e afiado.', icon: '🦾', source: 'chest', vis: { style: 'garra', c1: '#9aa4b2', c2: '#e8eef5' } },
  { id: 'g_fogo', kind: 'gloves', name: 'Punhos de Fogo', rarity: 'lendario', desc: 'Cada soco deixa um rasto de chamas.', icon: '🔥', source: 'shop', gems: 380, vis: { style: 'fogo', c1: '#ff5a00', c2: '#ffd000', anim: 'fire' } },
  { id: 'g_cosmicas', kind: 'gloves', name: 'Manoplas Cósmicas', rarity: 'celestial', desc: 'Contêm o poder de mil estrelas.', icon: '✨', source: 'chest', vis: { style: 'cosmico', c1: '#2a1a7a', c2: '#9be8ff', anim: 'cosmic' } },

  // ───────────── Máscaras ─────────────
  { id: 'm_luchador', kind: 'mask', name: 'Máscara Luchador', rarity: 'raro', desc: 'A tradição mexicana com estilo.', icon: '🎭', source: 'shop', coins: 2500, vis: { style: 'luchador', c1: '#1f5ad9', c2: '#ffffff' } },
  { id: 'm_luchador_r', kind: 'mask', name: 'Luchador Rubi', rarity: 'raro', desc: 'Vermelho-sangue e prata.', icon: '🎭', source: 'chest', vis: { style: 'luchador', c1: '#c4122c', c2: '#d9dde3' } },
  { id: 'm_caveira', kind: 'mask', name: 'Pintura Caveira', rarity: 'epico', desc: 'Assusta antes do primeiro golpe.', icon: '💀', source: 'chest', vis: { style: 'caveira', c1: '#f4f4f4', c2: '#111111' } },
  { id: 'm_demonio', kind: 'mask', name: 'Máscara Demónio', rarity: 'lendario', desc: 'Olhos que ardem no escuro.', icon: '👹', source: 'chest', vis: { style: 'demonio', c1: '#b3121f', c2: '#ffd000' } },
  { id: 'm_cyber', kind: 'mask', name: 'Visor Cyber', rarity: 'mitico', desc: 'Analisa o adversário em tempo real.', icon: '🤖', source: 'mission', vis: { style: 'cyber', c1: '#1a1d26', c2: '#00f0ff', anim: 'scan' } },

  // ───────────── Auras ─────────────
  { id: 'a_faiscas', kind: 'aura', name: 'Faíscas', rarity: 'raro', desc: 'Pequenas faíscas douradas à tua volta.', icon: '✨', source: 'shop', coins: 3000, vis: { type: 'faiscas', c1: '#ffd23d', c2: '#fff6c2' } },
  { id: 'a_petalas', kind: 'aura', name: 'Pétalas de Sakura', rarity: 'epico', desc: 'Elegância mortal.', icon: '🌸', source: 'chest', vis: { type: 'petalas', c1: '#ff9ccf', c2: '#ffe3f1' } },
  { id: 'a_chamas', kind: 'aura', name: 'Aura de Chamas', rarity: 'epico', desc: 'O ringue aquece contigo.', icon: '🔥', source: 'shop', gems: 250, vis: { type: 'chamas', c1: '#ff5a00', c2: '#ffd000' } },
  { id: 'a_raio', kind: 'aura', name: 'Tempestade', rarity: 'lendario', desc: 'Relâmpagos dançam à tua volta.', icon: '🌩️', source: 'chest', vis: { type: 'raio', c1: '#6ad4ff', c2: '#ffffff' } },
  { id: 'a_sombra', kind: 'aura', name: 'Sombra Abissal', rarity: 'mitico', desc: 'A escuridão obedece-te.', icon: '🌑', source: 'chest', vis: { type: 'sombra', c1: '#3a0a5c', c2: '#b25cff' } },
  { id: 'a_cosmos', kind: 'aura', name: 'Cosmos', rarity: 'celestial', desc: 'Galáxias inteiras orbitam o teu corpo.', icon: '🪐', source: 'mission', vis: { type: 'cosmos', c1: '#7a5cff', c2: '#7af7ff' } },

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
  { id: 's_ira', kind: 'super', name: 'Ira Celestial', rarity: 'celestial', desc: 'Asas de luz e um raio divino dos céus.', icon: '😇', source: 'mission', power: 2.0, vis: { type: 'ira' } },

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

  // ───────────── Poções / energias ─────────────
  { id: 'c_vida', kind: 'potion', name: 'Poção de Vida', rarity: 'comum', desc: 'Recupera 20% da vida quando estás em apuros.', icon: '🧪', source: 'shop', coins: 120, power: 0.2 },
  { id: 'c_energia', kind: 'potion', name: 'Bebida Energética', rarity: 'incomum', desc: 'Enche 60% do Super de uma vez.', icon: '🥤', source: 'shop', coins: 220, power: 60 },
  { id: 'c_ferro', kind: 'potion', name: 'Tónico de Ferro', rarity: 'incomum', desc: 'Recebe menos 40% de dano durante 10s.', icon: '🍶', source: 'shop', coins: 260, power: 0.4 },
  { id: 'c_grande', kind: 'potion', name: 'Grande Poção', rarity: 'raro', desc: 'Recupera 40% da vida.', icon: '⚗️', source: 'shop', coins: 520, power: 0.4 },
  { id: 'c_furia', kind: 'potion', name: 'Elixir de Fúria', rarity: 'raro', desc: '+35% de dano durante 10s.', icon: '🍷', source: 'shop', coins: 480, power: 0.35 },
  { id: 'c_estrelas', kind: 'potion', name: 'Pó de Estrelas', rarity: 'epico', desc: 'Super cheio e +25% de velocidade durante 8s.', icon: '🌠', source: 'chest', power: 0.25 },
  { id: 'c_fenix', kind: 'potion', name: 'Néctar de Fénix', rarity: 'lendario', desc: 'Ao cair a 0 de vida, renasce com 40%.', icon: '🪶', source: 'chest', power: 0.4 },
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

/** Itens que se podem trocar entre jogadores (skins, habilidades e poções; não os itens iniciais). */
export function isTradeable(d: ItemDef): boolean {
  return d.source !== 'start';
}

export const STARTER_ITEMS: string[] = I.filter((i) => i.source === 'start').map((i) => i.id);
