export interface PatchNote {
  version: string;
  date: string;
  title: string;
  items: string[];
}

/** Mais recente primeiro. Atualizar sempre que houver uma nova versão. */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: '1.2.0',
    date: '2026-10-14',
    title: 'Entradas, estamina e luta mais realista',
    items: [
      'NOVO: Entradas no ringue! Holofote, salto pelas cordas e pose de estrela antes de cada luta.',
      '10 entradas para colecionar: Clássica, Dança, Fumo, Lasers, Pirotecnia, Fogo de Artifício, Tempestade, Real, Dragão e Portal Cósmico (nova aba "Entradas" na Loja).',
      'Toca no ecrã para saltar as entradas.',
      'Estamina: os golpes cansam. Lutadores cansados ficam mais lentos, batem menos e param para recuperar o fôlego.',
      'Atordoamento: golpes acumulados na cabeça deixam o adversário a ver estrelas; um golpe forte nessa altura derruba-o.',
      'Footwork de boxe, fintas e clinches quando os dois estão cansados.',
      'Tag Team: corrigido o bug em que um lutador ficava preso dentro do ringue depois da troca.',
      'Tag Team: os lutadores trocam muito antes de chegarem ao K.O. (cansados, magoados ou há muito tempo no ringue).',
      'Gráficos: rastos nos golpes, onomatopeias BAM/POW, névoa de arena, LEDs no avental, tapete com textura e barras de cinema.',
      'Nova barra de estamina azul no HUD.',
    ],
  },
  {
    version: '1.1.2',
    date: '2026-10-14',
    title: 'Controlo de volume',
    items: [
      'Novo controlo de volume nas Definições e também durante a luta.',
      'A barra de vida já não pisca quando está baixa (continua a ficar vermelha).',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-10-14',
    title: 'Chuva de gemas!',
    items: ['Todos os jogadores recebem 100 000 💎 de presente (uma única vez).'],
  },
  {
    version: '1.1.0',
    date: '2026-10-14',
    title: 'Lutadores renovados',
    items: [
      'Novo corpo musculado: braços, coxas e gémeos com forma, tronco em V com peitorais e abdominais.',
      'Sombreamento cel-shading e brilhos em todo o corpo.',
      'Cabeça com maxilar, nariz cartoon e brilho na testa.',
      'Calções justos, joelheiras, botas com sola e atacadores, luvas de boxe com volume.',
      'Holofotes iluminam os lutadores no tapete e a câmara aproxima-se mais no telemóvel.',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-10-14',
    title: 'Tudo desbloqueado!',
    items: [
      'Todas as skins, penteados, cores, máscaras, auras, supers e passivas ficam desbloqueados.',
      '99 unidades de cada poção.',
      'Os 2 espaços de super, 2 de passiva e 3 do cinto ficam disponíveis desde o nível 1.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-13',
    title: 'Abertura do Ringue!',
    items: [
      'Lutas automáticas 1 contra 1 com boxe, wrestling e super ataques de fantasia.',
      'Tag Team 2 contra 2: o parceiro espera no avental e entra quando lhe tocas na mão.',
      'Desafio do Campeão: adversários mais fortes com recompensas maiores.',
      'Criador de personagem: pele, olhos, sobrancelhas, boca, barba, cabelo, cor e altura.',
      '10 atributos para evoluir: Força, Agarrão, Velocidade, Esquiva, Defesa, Vitalidade, Resistência, Precisão, Carisma e Contra-ataque.',
      '7 raridades: Comum, Incomum, Raro, Épico, Lendário, Mítico e Celestial.',
      '10 super ataques, 10 habilidades passivas e 7 poções que são usadas automaticamente.',
      'Baús de Bronze, Prata, Ouro, Lendário e Mítico abertos no centro do ringue.',
      'Missões diárias, semanais e Desafios Lendários com skins exclusivas.',
      'Ligas por troféus: Bronze, Prata, Ouro, Platina, Diamante, Mestre e Lenda.',
      'Trocas entre jogadores com códigos de transferência.',
      'Instalável como aplicação (PWA) e jogável offline.',
    ],
  },
];

export const CURRENT_VERSION = PATCH_NOTES[0].version;
