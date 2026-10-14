export interface PatchNote {
  version: string;
  date: string;
  title: string;
  items: string[];
}

/** Mais recente primeiro. Atualizar sempre que houver uma nova versão. */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: '1.6.0',
    date: '2026-10-14',
    title: 'Ícones novos e saídas realistas no Tag Team',
    items: [
      'Tag Team: quem é eliminado já não sai a deslizar. Levanta-se a cambalear e sai pelas cordas, ou o árbitro entra no ringue e leva-o para fora.',
      'Novo árbitro com camisa às riscas.',
      'Adeus emojis: todos os menus têm agora ícones desenhados à mão no estilo do jogo (moedas, gemas, troféus, baús, atributos, definições, separadores…).',
      'Emblemas de liga em forma de escudo, com a cor e o símbolo de cada liga.',
      'Miniaturas ilustradas: os golpes mostram o teu lutador a aplicá-los num adversário, os supers mostram a pose e o efeito, e as entradas mostram o cenário (holofote, discoteca, fumo, lasers, fogo, foguetes, trovoada, passadeira real…).',
      'Os menus já não voltam ao início quando equipas algo: mantêm o separador, o scroll e a rotação do lutador.',
      'Definições durante a luta: novo botão ⚙ que põe o combate em pausa.',
      'Sons totalmente refeitos: socos com estalo de cabedal e impacto, quedas no ringue com estrondo das tábuas e das molas, ressalto nas cordas, sino de boxe real e reverberação de pavilhão.',
      'Público novo: acabou o ruído tipo chuva. Agora ouves vozes, gritos, palmas e "uuuh!" nos golpes brutais.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-10-14',
    title: 'Trajes épicos, rotação 360° e narrador em inglês',
    items: [
      'NOVO: Rotação 360° do lutador! Arrasta para rodar na Aparência, no Lutador, no Ringue e nas pré-visualizações dos itens (toque duplo volta à vista inicial).',
      'Trajes renovados: os básicos continuam simples, os raros viram disfarces completos — T-Rex, Tubarão Assassino, Astronauta, Mecha Titã, Golem de Lava, Gigante de Gelo, Fénix Imortal, Super-Herói e mais.',
      'Capas, asas, caudas, capacetes, mochilas a jato, escudos, guitarras e ombreiras animados, visíveis nas lutas e nos menus.',
      'Luvas reinventadas por raridade: manoplas cravejadas, punhos de pedra, manoplas Tesla, gelo, cabeças de dragão, punhos mecha, mãos da sombra, punhos cósmicos e punhos do sol.',
      'Auras melhoradas e agora também são o fundo animado do teu lutador nos menus: holofotes, néon retro, faíscas, sakura, fogo, tempestade, aurora boreal, abismo e cosmos.',
      'Coleção: ao abrir uma entrada vês a entrada completa a acontecer.',
      'Corrigido o dado 🎲 da Aparência.',
      'As poções foram retiradas do jogo.',
      'Narrador todo em inglês, com volume próprio nas Definições e botão 🎙️ para o ligar/desligar durante a luta.',
      'Câmara lenta cinematográfica nos golpes de assinatura e nos supers, com zoom no impacto.',
      'Golpes corrigidos: contacto mais preciso, transições suaves, projeções sem saltos, Dropkick, Spear, DDT, Chokeslam e mergulhos da corda de cima refeitos.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-10-14',
    title: 'Golpes de assinatura, narrador e música!',
    items: [
      'NOVO: Golpes de assinatura! 13 golpes (Drop Kick, Spear, Superkick, DDT, Powerbomb, Moonsault, Chokeslam, Cutter…) desbloqueados por nível.',
      'Treina golpes até 3 níveis mais cedo com moedas e equipa até 6 no ecrã do Lutador.',
      'Estilos de golpe com gemas (Raio, Fogo, Ouro, Sismo, Cosmos, Inferno): só visuais, sem vantagem na luta.',
      'Modo "Tudo desbloqueado" nas Definições (ligado por omissão).',
      'Drop Kick refeito: salto com os dois pés no peito no ponto mais alto e kip-up para se levantar.',
      'Ida às cordas refeita: o lutador corre, as cordas esticam e ele é projetado de volta com velocidade.',
      'Menos quedas: os lutadores aguentam muito mais golpes antes de ir ao tapete e levantam-se mais depressa.',
      'NOVO: Narrador com dezenas de frases para dar hype ao combate (voz + legendas; pode ser desligado).',
      'Golpes especiais e supers mostram o nome do ataque em grande, colorido, com a imagem do lutador.',
      'Público muito mais real: pessoas com cabelos, chapéus, cartazes, bandeiras e braços no ar que reagem ao combate.',
      '10 entradas totalmente diferentes: moonwalk na bola de espelhos, fumo, grelha de lasers, colunas de fogo, foguetes, relâmpagos, passadeira real, asas de dragão e portal cósmico.',
      'NOVO: Música nos menus e música acelerada durante as lutas (volume próprio nas Definições).',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-14',
    title: 'Contacto perfeito e lutadores mais bonitos',
    items: [
      'Golpes com contacto exato: cada soco e pontapé para precisamente na cara ou no peito do adversário, com o impacto no sítio certo.',
      'Os corpos já não se atravessam: os lutadores encostam-se mas nunca se sobrepõem.',
      'Projeções reais: o adversário é segurado e levantado pelas mãos do atacante em suplex, body slam, DDT e no novo Powerbomb.',
      'Novos golpes: Superkick ao queixo, Spear (placagem a correr) e Powerbomb.',
      'Caras redesenhadas: nariz no sítio, olhos e boca alinhados, orelha correta e sem manchas na bochecha.',
      'Cabelo assente na cabeça: nova linha do cabelo, patilhas e madeixas; a cauda de cometa já não flutua.',
      'Luz de recorte colorida nos lutadores e sombras suaves no tapete.',
      'Supers equilibrados: cada super tem um limite de dano por uso (sem K.O. instantâneos) e a barra de Super enche mais devagar.',
      'Golpes normais ligeiramente mais fortes para manter o ritmo das lutas; Tag Team com 180 segundos.',
    ],
  },
  {
    version: '1.2.1',
    date: '2026-10-14',
    title: 'Botão de recarregar',
    items: ['Novo botão 🔄 no topo do ecrã para recarregar o jogo (e procurar atualizações).'],
  },
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
