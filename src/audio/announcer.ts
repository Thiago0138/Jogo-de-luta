/**
 * Narrador do combate: frases com muita energia, lidas em voz alta (Web Speech API, quando existe)
 * e sempre mostradas como legenda no ecrã.
 */

type Lines = string[];

const L: Record<string, Lines> = {
  start: [
    'Toca o sino! Que comece o combate!',
    'Aqui vamos nós! {a} contra {b}!',
    'Está lançado! Quem é que vai mandar neste ringue?',
    'Luta! {a} e {b} frente a frente!',
    'Senhoras e senhores, é hora de luta!',
    'O sino tocou e a arena explode!',
  ],
  entranceFirst: [
    'Senhoras e senhores! No canto azul... {a}!',
    'Do canto azul, com fome de vitória... {a}!',
    'Primeiro a entrar... o temível {a}!',
    'Façam barulho para... {a}!',
  ],
  entranceSecond: [
    'E agora... o lutador que todos querem ver... {a}!',
    'No canto vermelho... a estrela da noite... {a}!',
    'Levantem-se! Chegou {a}!',
    'Com a entrada {x}... aqui está {a}!',
    'A arena treme... é {a}!',
  ],
  move: [
    '{a} com um {x}!',
    'Que {x}!',
    '{x}! O público vai à loucura!',
    'Olha o {x} de {a}!',
    'Não acredito! {x}!',
    '{x} perfeito!',
    'Que maneira de aplicar o {x}!',
    'Isto foi um {x} de manual!',
  ],
  super: [
    'É o super de {a}! {x}!',
    'Atenção! {a} vai usar {x}!',
    '{x}! Isto é devastador!',
    'Meu Deus! {x}!',
    'Toda a energia de {a} num só golpe! {x}!',
  ],
  down: [
    '{a} vai ao tapete!',
    'Está no chão!',
    'Que queda! {a} está em apuros!',
    'Abaixo! {b} derrubou-o!',
    '{a} beija a lona!',
    'Ui! Isso doeu até aqui!',
  ],
  stun: ['{a} está a ver estrelas!', 'Atordoado! É agora ou nunca!', '{a} está tonto!', 'As pernas de {a} estão a tremer!'],
  combo: ['Que sequência de {a}!', 'Combinação de {x} golpes!', '{a} não pára de bater!', 'Chuva de golpes de {a}!'],
  lowhp: ['{a} está por um fio!', '{a} quase sem energia!', 'Isto pode acabar a qualquer momento!', 'Aguenta, {a}, aguenta!'],
  counter: ['Contra-ataque de {a}!', 'Que reflexos de {a}!', '{a} leu tudo e respondeu!'],
  tag: ['Tag! {a} entra no ringue!', 'Toca na mão! {a} está fresco e cheio de vontade!', 'Troca! Agora é {a}!'],
  climb: ['{a} sobe à corda de cima!', 'Oh não, ele vai voar!', 'Lá do alto... cuidado!', '{a} vai arriscar tudo!'],
  taunt: ['{a} está a puxar pelo público!', 'O público adora {a}!', 'Que confiança de {a}!'],
  potion: ['{a} recupera com {x}!', '{a} bebe {x} e volta à carga!'],
  revive: ['Inacreditável! {a} renasceu das cinzas!', 'Isto é impossível! {a} está de pé outra vez!'],
  elim: ['{a} está eliminado!', 'Fora! {a} já não volta!'],
  ko: ['K.O.! Acabou!', 'Está tudo acabado!', 'Nocaute! {b} arrasou!', 'Boa noite, {a}!'],
  win: ['E o vencedor é... {a}!', '{a} é o rei do ringue!', 'Vitória de {a}! Que espetáculo!', '{a} levanta os braços! Vitória!'],
  filler: [
    'Que combate fantástico!',
    'O público está ao rubro!',
    'Ninguém quer ceder!',
    'Que intensidade!',
    'Estão a dar tudo neste ringue!',
    'Isto está renhido!',
    'A arena inteira está de pé!',
    'Que noite de luta, meus amigos!',
    'Quem vai ganhar isto?',
  ],
};

const PRIORITY: Record<string, number> = {
  win: 9, ko: 9, count: 9, super: 8, revive: 8, elim: 7, entranceFirst: 7, entranceSecond: 7,
  start: 7, move: 6, tag: 6, climb: 5, down: 4, stun: 4, lowhp: 4, counter: 3, combo: 3, potion: 3, taunt: 2, filler: 1,
};

function pick(arr: Lines): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class Announcer {
  private voice: SpeechSynthesisVoice | null = null;
  private speakingPrio = 0;
  private busyUntil = 0;
  private quietT = 0;
  private now = 0;
  private lastByKey = new Map<string, number>();
  private entranceCount = 0;
  enabled: boolean;
  volume: number;
  onCaption: (text: string, prio: number) => void;

  constructor(enabled: boolean, volume: number, onCaption: (text: string, prio: number) => void) {
    this.enabled = enabled;
    this.volume = volume;
    this.onCaption = onCaption;
    if (typeof speechSynthesis !== 'undefined') {
      const pickVoice = () => {
        const vs = speechSynthesis.getVoices();
        this.voice =
          vs.find((v) => v.lang === 'pt-PT') ??
          vs.find((v) => v.lang.startsWith('pt-PT')) ??
          vs.find((v) => v.lang.startsWith('pt')) ??
          null;
      };
      pickVoice();
      speechSynthesis.onvoiceschanged = pickVoice;
    }
  }

  /** Chamado a cada frame com o tempo real e o entusiasmo do público. */
  tick(dt: number, fighting: boolean): void {
    this.now += dt;
    if (!fighting) return;
    this.quietT += dt;
    if (this.quietT > 7 + Math.random() * 3) this.say('filler', {});
  }

  event(ev: string, a?: string, b?: string, x?: string): void {
    let key = ev;
    if (ev === 'entrance') key = this.entranceCount++ === 0 ? 'entranceFirst' : 'entranceSecond';
    if (ev === 'count') {
      this.speak(x === '3' ? 'TRÊS!' : x === '2' ? 'Dois!' : 'Um!', 9, true);
      return;
    }
    if (!L[key]) return;
    this.say(key, { a, b, x });
  }

  private say(key: string, v: { a?: string; b?: string; x?: string }): void {
    const prio = PRIORITY[key] ?? 1;
    const last = this.lastByKey.get(key) ?? -99;
    // não repetir o mesmo tipo de frase demasiado seguido
    const gap = prio >= 7 ? 0 : prio >= 5 ? 2.5 : 5;
    if (this.now - last < gap) return;
    if (this.now < this.busyUntil && prio <= this.speakingPrio) return;
    this.lastByKey.set(key, this.now);
    let text = pick(L[key]);
    text = text
      .replace(/\{a\}/g, v.a ?? '')
      .replace(/\{b\}/g, v.b ?? '')
      .replace(/\{x\}/g, v.x ?? '')
      .replace(/\{A\}/g, (v.a ?? '').toUpperCase())
      .replace(/\{X\}/g, (v.x ?? '').toUpperCase());
    this.speak(text, prio, prio >= 6);
  }

  private speak(text: string, prio: number, excited: boolean): void {
    this.quietT = 0;
    this.speakingPrio = prio;
    const dur = 0.6 + text.length * 0.055;
    this.busyUntil = this.now + dur;
    this.onCaption(text, prio);
    if (!this.enabled || typeof speechSynthesis === 'undefined' || this.volume <= 0) return;
    try {
      if (speechSynthesis.speaking) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.lang = this.voice?.lang ?? 'pt-PT';
      u.rate = excited ? 1.18 : 1.08;
      u.pitch = excited ? 1.15 : 1;
      u.volume = this.volume;
      speechSynthesis.speak(u);
    } catch {
      /* sem voz disponível: fica só a legenda */
    }
  }

  stop(): void {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }
}
