/**
 * Narrador do combate (em inglês, estilo comentador de wrestling): frases com muita energia,
 * lidas em voz alta (Web Speech API, quando existe) e mostradas como legenda no ecrã.
 * Desligado nas definições = sem voz e sem legendas.
 */

type Lines = string[];

const L: Record<string, Lines> = {
  start: [
    "Ring the bell! Let's get it on!",
    'Here we go! {a} versus {b}!',
    "It's on! Who's going to own this ring tonight?",
    'Fight! {a} and {b}, face to face!',
    "Ladies and gentlemen, it's fight time!",
    'The bell rings and this place explodes!',
    "Let's get ready to rumble!",
    'No more talking! {a} and {b} settle it right here!',
    'The bell has rung and there is no turning back!',
    'Lock it up! This one is underway!',
    'Here we go! {a} looks fired up!',
    "Buckle up, folks! This is going to be a war!",
  ],
  entranceFirst: [
    'Ladies and gentlemen! Introducing first... {a}!',
    'Hungry for victory... make some noise for {a}!',
    'Making his way to the ring... the fearsome {a}!',
    'Get on your feet for... {a}!',
    'Hailing from parts unknown... {a}!',
    'The first competitor... {a}!',
    'Here comes trouble... it is {a}!',
    'Listen to this crowd! Here comes {a}!',
  ],
  entranceSecond: [
    'And his opponent... the one you all came to see... {a}!',
    'And now... the star of the night... {a}!',
    'On your feet! {a} has arrived!',
    'With the {x} entrance... here is {a}!',
    'The whole arena is shaking... it is {a}!',
    'Oh, you know that music! It is {a}!',
    'And the challenger... {a}!',
    'The roof is about to come off... here comes {a}!',
    'Fireworks for... {a}!',
  ],
  move: [
    '{a} with a {x}!',
    'What a {x}!',
    '{x}! The crowd goes wild!',
    'Look at that {x} from {a}!',
    'I cannot believe it! {x}!',
    'A picture-perfect {x}!',
    'What a way to hit the {x}!',
    'That was a textbook {x}!',
    '{x}! Out of nowhere!',
    'BAH GAWD! {x}!',
    '{a} nails the {x}!',
    'Oh my! {x} by {a}!',
    'Signature move! {x}!',
    '{x}! Somebody call a doctor!',
    'Here it comes... {x}!',
    'Vintage {a}! {x}!',
  ],
  super: [
    "It's the super of {a}! {x}!",
    'Look out! {a} is going for the {x}!',
    '{x}! That is devastating!',
    'Oh my God! {x}!',
    'Everything {a} has, in one shot! {x}!',
    'Here it comes! {x}!',
    'The power is unreal! {x}!',
    '{a} is charged up! {x}!',
    'This could end it! {x}!',
    'Stop the match! {x}!',
    'Unbelievable power from {a}!',
    'By God, that was a {x}!',
  ],
  down: [
    '{a} hits the mat!',
    "He's down!",
    "What a fall! {a} is in trouble!",
    'Down goes {a}! {b} put him there!',
    '{a} is kissing the canvas!',
    'Ouch! I felt that one from here!',
    'Timber! {a} goes down hard!',
    '{a} is flat on his back!',
    "Down he goes! Can he get up?",
    '{b} drops him like a sack of bricks!',
    'The mat shook on that one!',
    '{a} is seeing the lights!',
  ],
  stun: [
    '{a} is seeing stars!',
    "He's stunned! It's now or never!",
    '{a} is out on his feet!',
    'The legs of {a} are like jelly!',
    '{a} does not know where he is!',
    "He's wobbly! Finish him!",
    '{a} is in la-la land!',
    'Out on his feet! {b} smells blood!',
  ],
  combo: [
    'What a flurry from {a}!',
    '{x} hits in a row!',
    '{a} will not stop swinging!',
    'A storm of blows from {a}!',
    'Combo! {a} is on fire!',
    'Left, right, left! {a} is unloading!',
    'Somebody stop {a}!',
    'Machine-gun punches from {a}!',
  ],
  lowhp: [
    '{a} is hanging by a thread!',
    '{a} is running on fumes!',
    'This could be over any second!',
    'Hang in there, {a}!',
    '{a} is on his last legs!',
    'One more big shot and it is lights out for {a}!',
    '{a} is in serious danger!',
    'The tank is almost empty for {a}!',
  ],
  counter: [
    'Counter by {a}!',
    'What reflexes from {a}!',
    '{a} saw it coming and fired back!',
    'Reversal! {a} turns the tables!',
    'Too slow! {a} makes him pay!',
    'Countered! {a} read him like a book!',
    'Out of nowhere, {a} strikes back!',
    'Not so fast! {a} with the counter!',
  ],
  tag: [
    'Tag! {a} is in the ring!',
    'Hot tag! {a} is fresh and fired up!',
    'Switch! Now it is {a}!',
    'The tag is made! {a} comes in like a house on fire!',
    'Here comes {a}! Fresh legs!',
    'Tag! {a} wants a piece of the action!',
    'The partner is in! {a} is ready to go!',
    'Hot tag to {a}! The crowd erupts!',
  ],
  climb: [
    '{a} is going to the top rope!',
    'Oh no, he is going to fly!',
    'Up top... look out below!',
    '{a} is risking it all!',
    'He is climbing the turnbuckle!',
    'High risk! {a} is going airborne!',
    '{a} is on the top rope! Do not do it!',
    'Somebody stop him! {a} is going to fly!',
  ],
  taunt: [
    '{a} is firing up the crowd!',
    'The fans love {a}!',
    'Look at the confidence of {a}!',
    '{a} is soaking it all in!',
    '{a} is showing off!',
    'The crowd is eating out of the hand of {a}!',
    'Listen to them! {a} owns this place!',
    '{a} wants more noise!',
  ],
  revive: [
    'Unbelievable! {a} rises from the ashes!',
    'This is impossible! {a} is back on his feet!',
    'He will not stay down! {a} is back!',
    'Like a phoenix! {a} returns!',
    'Are you kidding me? {a} is alive!',
    'The comeback is on! {a} is back!',
    'Nobody believed it! {a} is up!',
    'What heart from {a}!',
  ],
  elim: [
    '{a} is eliminated!',
    'Gone! {a} is done for the night!',
    '{a} has been eliminated!',
    'That is it for {a}!',
    '{a} is out! The partner has to step up!',
    'Goodbye, {a}!',
    '{b} sends {a} packing!',
    'One down! {a} is finished!',
  ],
  ko: [
    'K.O.! It is all over!',
    'It is over! It is all over!',
    'Knockout! {b} destroyed him!',
    'Good night, {a}!',
    'Lights out for {a}!',
    'He is out cold!',
    'Stick a fork in him, he is done!',
    'Sweet dreams, {a}!',
    'Down and out! What a finish!',
    'That is all she wrote!',
  ],
  win: [
    'And the winner is... {a}!',
    '{a} is the king of the ring!',
    'Victory for {a}! What a show!',
    '{a} raises his arms! Victory!',
    'Your winner... {a}!',
    '{a} wins it! What a performance!',
    'Crown him! {a} takes it!',
    '{a} stands tall tonight!',
    'Nobody can stop {a}!',
    'History is made! {a} wins!',
  ],
  filler: [
    'What a fantastic fight!',
    'This crowd is on fire!',
    'Nobody wants to give an inch!',
    'The intensity is incredible!',
    'They are leaving it all in the ring!',
    'This is a close one!',
    'The whole arena is on its feet!',
    'What a night of fighting, my friends!',
    'Who is going to win this?',
    'You could cut the tension with a knife!',
    'These two really do not like each other!',
    'This is what we came to see!',
    'Back and forth, back and forth!',
    'I have never seen anything like this!',
    'You can hear a pin drop... no, wait, it is chaos!',
    'Fight of the year candidate, folks!',
  ],
};

const PRIORITY: Record<string, number> = {
  win: 9, ko: 9, count: 9, super: 8, revive: 8, elim: 7, entranceFirst: 7, entranceSecond: 7,
  start: 7, move: 6, tag: 6, climb: 5, down: 4, stun: 4, lowhp: 4, counter: 3, combo: 3, taunt: 2, filler: 1,
};

function pick(arr: Lines, avoid?: string): string {
  let s = arr[Math.floor(Math.random() * arr.length)];
  if (s === avoid && arr.length > 1) s = arr[Math.floor(Math.random() * arr.length)];
  return s;
}

/** Escolhe uma voz inglesa (de preferência americana/britânica e masculina). */
export function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  const vs = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (!vs.length) return null;
  for (const name of ['Google US English', 'Daniel', 'Alex', 'Male']) {
    const v = vs.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return (
    vs.find((v) => v.lang === 'en-US' || v.lang === 'en_US') ??
    vs.find((v) => v.lang === 'en-GB' || v.lang === 'en_GB') ??
    vs[0]
  );
}

export class Announcer {
  private voice: SpeechSynthesisVoice | null = null;
  private speakingPrio = 0;
  private busyUntil = 0;
  private quietT = 0;
  private now = 0;
  private lastByKey = new Map<string, number>();
  private lastText = new Map<string, string>();
  private entranceCount = 0;
  /** Desligado: sem voz e sem legendas. */
  enabled: boolean;
  volume: number;
  onCaption: (text: string, prio: number) => void;

  constructor(enabled: boolean, volume: number, onCaption: (text: string, prio: number) => void) {
    this.enabled = enabled;
    this.volume = volume;
    this.onCaption = onCaption;
    if (typeof speechSynthesis !== 'undefined') {
      const pickVoice = () => {
        this.voice = pickEnglishVoice();
      };
      pickVoice();
      speechSynthesis.onvoiceschanged = pickVoice;
    }
  }

  /** Liga/desliga o narrador (corta a frase em curso ao desligar). */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stop();
  }

  /** Chamado a cada frame com o tempo real e o entusiasmo do público. */
  tick(dt: number, fighting: boolean): void {
    this.now += dt;
    if (!fighting) return;
    this.quietT += dt;
    if (this.quietT > 7 + Math.random() * 3) this.say('filler', {});
  }

  event(ev: string, a?: string, b?: string, x?: string): void {
    if (!this.enabled) return;
    let key = ev;
    if (ev === 'entrance') key = this.entranceCount++ === 0 ? 'entranceFirst' : 'entranceSecond';
    if (ev === 'count') {
      this.speak(x === '3' ? 'THREE!' : x === '2' ? 'TWO!' : 'ONE!', 9, true);
      return;
    }
    if (!L[key]) return;
    this.say(key, { a, b, x });
  }

  private say(key: string, v: { a?: string; b?: string; x?: string }): void {
    if (!this.enabled) return;
    const prio = PRIORITY[key] ?? 1;
    const last = this.lastByKey.get(key) ?? -99;
    // não repetir o mesmo tipo de frase demasiado seguido
    const gap = prio >= 7 ? 0 : prio >= 5 ? 2.5 : 5;
    if (this.now - last < gap) return;
    if (this.now < this.busyUntil && prio <= this.speakingPrio) return;
    this.lastByKey.set(key, this.now);
    let text = pick(L[key], this.lastText.get(key));
    this.lastText.set(key, text);
    text = text
      .replace(/\{a\}/g, v.a ?? '')
      .replace(/\{b\}/g, v.b ?? '')
      .replace(/\{x\}/g, v.x ?? '')
      .replace(/\{A\}/g, (v.a ?? '').toUpperCase())
      .replace(/\{X\}/g, (v.x ?? '').toUpperCase());
    this.speak(text, prio, prio >= 6);
  }

  private speak(text: string, prio: number, excited: boolean): void {
    if (!this.enabled) return;
    this.quietT = 0;
    this.speakingPrio = prio;
    const dur = 0.6 + text.length * 0.055;
    this.busyUntil = this.now + dur;
    this.onCaption(text, prio);
    if (typeof speechSynthesis === 'undefined' || this.volume <= 0) return;
    try {
      if (speechSynthesis.speaking) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.lang = this.voice?.lang ?? 'en-US';
      u.rate = excited ? 1.15 : 1.05;
      u.pitch = excited ? 1.1 : 0.95;
      u.volume = Math.min(1, this.volume);
      speechSynthesis.speak(u);
    } catch {
      /* sem voz disponível: fica só a legenda */
    }
  }

  stop(): void {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }
}
