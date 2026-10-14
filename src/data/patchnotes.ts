export interface PatchNote {
  version: string;
  date: string;
  title: string;
  items: string[];
}

/** Mais recente primeiro. Atualizar sempre que houver uma nova versão. */
export const PATCH_NOTES: PatchNote[] = [
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
