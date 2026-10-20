/**
 * Tutoriais por secção: um botão "?" em cada ecrã abre um guia curto, passo a passo.
 * Abre sozinho na primeira visita a cada secção (por perfil) e pode ser revisto a qualquer momento.
 */
import { sfx } from '../audio/sfx';
import { el, esc } from './dom';
import { ico } from './icons';

export type TutId = 'home' | 'fighter' | 'shop' | 'collection' | 'missions' | 'career' | 'gym' | 'daily' | 'pass' | 'forge' | 'fight';

interface Step {
  icon: string;
  title: string;
  text: string;
  /** Cor de destaque do passo. */
  c?: string;
}

interface Tut {
  name: string;
  icon: string;
  steps: Step[];
}

export const TUTORIALS: Record<TutId, Tut> = {
  home: {
    name: 'The Ring',
    icon: 'ring',
    steps: [
      { icon: 'glove', title: 'Fights are automatic', text: 'Tap <b>FIGHT</b> and watch the show: your fighter battles on their own using your stats, moves and Supers.', c: '#ffd23d' },
      { icon: 'tag', title: 'Pick a mode', text: '<b>1 vs 1</b> for quick wins, <b>Tag Team</b> 2 vs 2 with a partner, and <b>Champion</b> for a tough fight with bigger prizes.', c: '#3aa0ff' },
      { icon: 'road', title: 'More ways to play', text: '<b>Career</b> levels, the interactive <b>Gym</b>, <b>Daily</b> rewards and the <b>Fight Pass</b>. Red badges show what is waiting for you.', c: '#ff5a5a' },
      { icon: 'chest', title: 'Open your chests', text: 'Wins give chests. Tap one to open it, or <b>Open all</b> at once. A free chest refills over time.', c: '#b45cff' },
      { icon: 'fighter', title: 'Your fighter', text: 'Tap your fighter to change gear, appearance and stats.', c: '#4cd964' },
    ],
  },
  fighter: {
    name: 'Fighter',
    icon: 'fighter',
    steps: [
      { icon: 'shirt', title: 'Gear up', text: 'Equip <b>outfits, gloves, masks, hair and auras</b>. Every slot can also be emptied.', c: '#3aa0ff' },
      { icon: 'abilities', title: 'Supers & passives', text: 'Supers are big finishing moves. Passives give constant bonuses. Higher levels unlock extra slots.', c: '#ffd23d' },
      { icon: 'moves', title: 'Moves, taunts & entrance', text: 'Choose which wrestling moves you use, two crowd taunts and your ring entrance.', c: '#ff5a5a' },
      { icon: 'chart', title: 'Spend stat points', text: 'Each level gives points. Put them into Power, Speed, Defence, Stamina and more to build your style.', c: '#4cd964' },
    ],
  },
  shop: {
    name: 'Shop',
    icon: 'shop',
    steps: [
      { icon: 'coin', title: 'Coins & gems', text: 'Buy items with <b>coins</b> (earned by fighting) or <b>gems</b> (premium). Prices are on every card.', c: '#ffd23d' },
      { icon: 'star', title: 'Daily featured', text: 'A few items are on sale every day — check back often.', c: '#ff5a5a' },
      { icon: 'chest', title: 'Chests', text: 'Buy chests and see the exact <b>drop rates</b> before you buy.', c: '#b45cff' },
    ],
  },
  collection: {
    name: 'Collection',
    icon: 'collection',
    steps: [
      { icon: 'collection', title: 'Everything in one place', text: 'Browse every item in the game. Filter by type or tap a rarity to see only that rarity.', c: '#3aa0ff' },
      { icon: 'eye', title: 'Tap to preview', text: 'Tap any item to see it on your fighter, equip it or read where it comes from.', c: '#4cd964' },
      { icon: 'anvil', title: 'Duplicates go to the Forge', text: 'Extra copies can be recycled into <b>Shards</b> in the <b>Forge</b>.', c: '#b48cff' },
      { icon: 'swap', title: 'Trades', text: 'Send items to a friend with a trade code.', c: '#ffd23d' },
    ],
  },
  missions: {
    name: 'Missions',
    icon: 'missions',
    steps: [
      { icon: 'check', title: 'Daily & weekly missions', text: 'Complete simple goals while you play and tap <b>Claim</b> for rewards.', c: '#4cd964' },
      { icon: 'crown', title: 'Legendary challenges', text: 'Long-term goals with the best rewards in the game.', c: '#ffd23d' },
    ],
  },
  career: {
    name: 'Career',
    icon: 'road',
    steps: [
      { icon: 'road', title: 'Road to the Title', text: 'Fight your way from Backyard Brawls to the World Title, stage by stage.', c: '#ff8a3d' },
      { icon: 'star', title: 'Earn 3 stars', text: 'Win faster and cleaner for more stars. Stars open star chests.', c: '#ffd23d' },
      { icon: 'crown', title: 'Beat the bosses', text: 'Each chapter ends with a named boss with their own gear and Super.', c: '#ff3d6e' },
    ],
  },
  gym: {
    name: 'Gym',
    icon: 'glove',
    steps: [
      { icon: 'glove', title: 'Train for real', text: 'Play mini-games — Heavy Bag, Speed Bag, Power Press and Reflex Pads.', c: '#3aa0ff' },
      { icon: 'chart', title: 'Permanent gains', text: 'S/A/B/C scores train your stats for good and earn coins.', c: '#4cd964' },
      { icon: 'fire', title: 'Energy & streak', text: 'Training uses energy that refills over time. Train daily to keep your streak.', c: '#ff8a3d' },
    ],
  },
  daily: {
    name: 'Daily',
    icon: 'gift',
    steps: [
      { icon: 'calendar', title: 'Login calendar', text: 'Come back every day — the rewards grow each day of the week.', c: '#3aa0ff' },
      { icon: 'star', title: 'Lucky Wheel', text: 'A free spin every day, plus bonus spins from wins. Hit the jackpot for a Legendary item!', c: '#ffd23d' },
      { icon: 'sparkle', title: 'Scratch cards & gifts', text: 'Scratch to reveal prizes, and grab the Mystery Gift every few hours.', c: '#b45cff' },
      { icon: 'fire', title: 'Daily challenges', text: 'Three quick challenges every day and Hot Streak bonuses.', c: '#ff5a5a' },
    ],
  },
  pass: {
    name: 'Fight Pass',
    icon: 'star',
    steps: [
      { icon: 'star', title: 'Season rewards', text: 'Earn Pass XP from every fight to climb 40 tiers.', c: '#b45cff' },
      { icon: 'crown', title: 'Free & Premium tracks', text: 'Everyone gets the free track. Premium unlocks exclusive items you cannot get anywhere else.', c: '#ffd23d' },
      { icon: 'fire', title: 'Weekly challenges', text: 'Complete them for big chunks of Pass XP.', c: '#ff5a5a' },
    ],
  },
  forge: {
    name: 'The Forge',
    icon: 'anvil',
    steps: [
      { icon: 'shard', title: 'Recycle duplicates', text: 'Turn every extra copy into <b>Shards</b>. You always keep one of each item.', c: '#b48cff' },
      { icon: 'anvil', title: 'Craft what you want', text: 'Spend Shards to make exactly the item you are missing. Weekly deals are 30% off.', c: '#ffb84a' },
      { icon: 'sparkle', title: 'Fuse for luck', text: 'Combine 5 duplicates of a rarity into 1 random item of the next rarity — with a small chance of a double upgrade!', c: '#ffd23d' },
    ],
  },
  fight: {
    name: 'Fights',
    icon: 'glove',
    steps: [
      { icon: 'bolt', title: 'Watch the battle', text: 'Fighters punch, kick, grapple and fly off the ropes on their own. Your stats and gear decide who wins.', c: '#ffd23d' },
      { icon: 'abilities', title: 'Supers', text: 'The blue bar fills as you fight. When full, your fighter unleashes a Super move.', c: '#3aa0ff' },
      { icon: 'fast', title: 'Speed & skip', text: 'Use <b>2x</b> to speed up or <b>Skip</b> to jump to the result.', c: '#4cd964' },
    ],
  },
};

const KEY = 'kotr-tut-v1';

function seen(): Record<string, 1> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, 1>;
  } catch {
    return {};
  }
}

function markSeen(id: TutId): void {
  try {
    const s = seen();
    s[id] = 1;
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sem armazenamento */
  }
}

export function resetTutorials(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sem armazenamento */
  }
}

let open = false;

/** Abre o guia de uma secção (carrossel de passos). */
export function openTutorial(id: TutId, onDone?: () => void): void {
  if (open) return;
  open = true;
  markSeen(id);
  const t = TUTORIALS[id];
  let i = 0;
  const back = el('div', 'tut-back');
  const box = el('div', 'tut');
  back.appendChild(box);
  document.body.appendChild(back);
  const close = () => {
    open = false;
    back.classList.add('out');
    setTimeout(() => back.remove(), 200);
    onDone?.();
  };
  const draw = (dir = 0) => {
    const s = t.steps[i];
    const last = i === t.steps.length - 1;
    box.style.setProperty('--tc', s.c ?? '#ffd23d');
    box.innerHTML = `
      <div class="tut-head"><span class="tut-sec">${ico(t.icon)} ${esc(t.name)}</span><span class="tut-n">${i + 1} / ${t.steps.length}</span><button class="tut-x" aria-label="Close">${ico('close')}</button></div>
      <div class="tut-step ${dir > 0 ? 'in-r' : dir < 0 ? 'in-l' : ''}">
        <div class="tut-art"><i class="tut-glow"></i>${ico(s.icon)}</div>
        <h3>${esc(s.title)}</h3>
        <p>${s.text}</p>
      </div>
      <div class="tut-dots">${t.steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tut-foot">
        <button class="btn btn-ghost tut-prev" ${i === 0 ? 'disabled' : ''}>Back</button>
        <button class="btn btn-gold tut-next">${last ? `Got it! ${ico('check')}` : 'Next'}</button>
      </div>`;
    (box.querySelector('.tut-x') as HTMLElement).onclick = () => {
      sfx.click();
      close();
    };
    (box.querySelector('.tut-prev') as HTMLElement).onclick = () => {
      if (i === 0) return;
      sfx.click();
      i--;
      draw(-1);
    };
    (box.querySelector('.tut-next') as HTMLElement).onclick = () => {
      sfx.click();
      if (last) close();
      else {
        i++;
        draw(1);
      }
    };
  };
  // deslizar com o dedo para mudar de passo
  let sx = 0;
  box.addEventListener('pointerdown', (e) => (sx = e.clientX));
  box.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx;
    if (Math.abs(dx) < 50) return;
    if (dx < 0 && i < t.steps.length - 1) {
      i++;
      draw(1);
    } else if (dx > 0 && i > 0) {
      i--;
      draw(-1);
    }
  });
  back.onclick = (e) => {
    if (e.target === back) close();
  };
  draw();
}

/** Abre o guia automaticamente na primeira visita (uma vez por perfil). */
export function tutorialSeen(id: TutId): boolean {
  return !!seen()[id];
}

export function autoTutorial(id: TutId, delay = 450): void {
  if (seen()[id]) return;
  setTimeout(() => {
    if (!seen()[id] && !document.querySelector('.modal-back, .chest-root, .fight-layer, .tut-back')) openTutorial(id);
  }, delay);
}

/** Botão "?" para pôr num ecrã. */
export function helpButton(id: TutId, cls = ''): HTMLButtonElement {
  const b = el('button', `tut-btn ${cls}`, `${ico('info')}<span>Guide</span>`);
  b.setAttribute('aria-label', `How ${TUTORIALS[id].name} works`);
  b.onclick = (e) => {
    e.stopPropagation();
    sfx.click();
    openTutorial(id);
  };
  return b;
}

/** Lista de todos os guias (para as definições). */
export function openTutorialList(): void {
  const back = el('div', 'tut-back');
  const box = el('div', 'tut tut-list');
  box.innerHTML = `<div class="tut-head"><span class="tut-sec">${ico('info')} Guides</span><span></span><button class="tut-x" aria-label="Close">${ico('close')}</button></div><div class="tut-grid"></div>`;
  const grid = box.querySelector('.tut-grid') as HTMLElement;
  const close = () => {
    back.classList.add('out');
    setTimeout(() => back.remove(), 200);
  };
  for (const id of Object.keys(TUTORIALS) as TutId[]) {
    const t = TUTORIALS[id];
    const b = el('button', 'tut-item', `${ico(t.icon)}<b>${esc(t.name)}</b><small>${t.steps.length} steps</small>`);
    b.onclick = () => {
      sfx.click();
      close();
      setTimeout(() => openTutorial(id), 220);
    };
    grid.appendChild(b);
  }
  (box.querySelector('.tut-x') as HTMLElement).onclick = () => {
    sfx.click();
    close();
  };
  back.onclick = (e) => {
    if (e.target === back) close();
  };
  back.appendChild(box);
  document.body.appendChild(back);
}
