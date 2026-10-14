import { shade } from '../data/appearance';
import type { Vis } from '../data/items';
import { flame } from './costume';
import { C, OC, PS, TAU, circle, glowSprite, hash, seg } from './paint';

/**
 * Luvas: desenhadas no referencial do punho (y local = direção do antebraço para o punho).
 * As mais raras deixam de ser luvas: pedregulhos, cabeças de dragão, punhos mecânicos, sóis…
 */

function add(ctx: CanvasRenderingContext2D, f: () => void) {
  if (PS.F) return;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  f();
  ctx.globalCompositeOperation = prev;
  ctx.globalAlpha = 1;
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, lw = 3, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fillStyle = C(fill);
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = OC();
    ctx.stroke();
  }
}

function shadeIn(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.4) {
  if (PS.F) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 3, rx * 0.8, ry * 0.55, 0, 0, Math.PI);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function shine(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a = 0.6) {
  if (PS.F) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.35, r * 0.2, -0.6, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Luva de boxe com volume (base das luvas comuns e das "pro"). */
function boxGlove(ctx: CanvasRenderingContext2D, c1: string, c2: string, pro: boolean, t: number, anim?: string) {
  // punho / cano
  ctx.lineCap = 'round';
  seg(ctx, 0, -11, 0, -2, 16, pro ? c1 : c2);
  if (pro) {
    seg(ctx, 0, -10, 0, -6, 17, c2, false);
    if (!PS.F) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(-4, -4 + i * 2.5 - 8);
        ctx.lineTo(4, -2 + i * 2.5 - 8);
      }
      ctx.stroke();
    }
  }
  ellipse(ctx, 0, 5, 12, 13.5, c1);
  // polegar
  ellipse(ctx, 8, 2, 5, 6, c1, 2.5, 0.4);
  shadeIn(ctx, 0, 5, 12, 13.5);
  if (pro && !PS.F) {
    ctx.strokeStyle = c2;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 5, 8.5, Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();
  }
  shine(ctx, 0, 5, 12);
  if (anim === 'shine' && !PS.F) {
    const p = ((t * 0.8) % 1.6) - 0.3;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 5, 12, 13.5, 0, 0, TAU);
    ctx.clip();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-14, -10 + p * 30);
    ctx.lineTo(14, -16 + p * 30);
    ctx.lineTo(14, -11 + p * 30);
    ctx.lineTo(-14, -5 + p * 30);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export function drawGlove(ctx: CanvasRenderingContext2D, g: Vis, x: number, y: number, ang: number, t: number, skin: string, back: boolean) {
  const c1 = back ? shade(g.c1 ?? '#d22', -0.2) : g.c1 ?? '#d22';
  const c2 = g.c2 ?? '#fff';
  const c3 = g.c3 ?? c2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-ang);
  ctx.lineJoin = 'round';
  switch (g.style) {
    case 'fita': {
      circle(ctx, 0, 2, 9.5, skin);
      ctx.strokeStyle = C(c1);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(-8, -1 + i * 3.5);
        ctx.lineTo(8, 1 + i * 3.5);
      }
      ctx.stroke();
      seg(ctx, 0, -10, 0, -2, 13, c1, false);
      if (!PS.F) {
        ctx.strokeStyle = c2;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-6, -9);
        ctx.lineTo(6, -6);
        ctx.moveTo(-6, -5);
        ctx.lineTo(6, -2);
        ctx.stroke();
      }
      break;
    }
    case 'pro':
      boxGlove(ctx, c1, c2, true, t, g.anim);
      break;
    case 'picos': {
      seg(ctx, 0, -12, 0, -1, 17, shade(c1, -0.15));
      ellipse(ctx, 0, 5, 11.5, 12, c1);
      shadeIn(ctx, 0, 5, 11.5, 12);
      // tachas e picos nos nós dos dedos
      for (let i = -1; i <= 1; i++) {
        const bx = i * 6;
        ctx.beginPath();
        ctx.moveTo(bx - 3, 14);
        ctx.lineTo(bx, 24);
        ctx.lineTo(bx + 3, 14);
        ctx.closePath();
        ctx.fillStyle = C(c2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = OC();
        ctx.stroke();
      }
      for (let i = -1; i <= 1; i += 2) circle(ctx, i * 5, -7, 2, c2, false);
      shine(ctx, 0, 5, 11);
      break;
    }
    case 'garra': {
      seg(ctx, 0, -14, 0, -1, 17, shade(c1, -0.25));
      // placas articuladas
      for (let i = 0; i < 3; i++) seg(ctx, -7, -12 + i * 4, 7, -12 + i * 4, 2, shade(c1, 0.3), false);
      ellipse(ctx, 0, 4, 11, 11, c1);
      for (let i = -1; i <= 1; i++) {
        const bx = i * 6;
        ctx.beginPath();
        ctx.moveTo(bx - 2.2, 10);
        ctx.quadraticCurveTo(bx + i * 2, 26, bx + i * 3 + 1, 36);
        ctx.lineTo(bx + 2.2, 10);
        ctx.closePath();
        ctx.fillStyle = C(c2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = OC();
        ctx.stroke();
      }
      if (!PS.F) {
        const p = (t * 1.2) % 1;
        ctx.globalAlpha = 0.9 * (1 - p);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(6 * Math.sin(p * 6), 12 + p * 22, 2.4, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      shine(ctx, 0, 4, 11);
      break;
    }
    case 'pedra': {
      seg(ctx, 0, -12, 0, 0, 15, shade(c1, -0.2));
      // pedregulho irregular
      ctx.beginPath();
      const n = 9;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        const r = 15 + hash(i * 3.1) * 5;
        const px = Math.cos(a) * r;
        const py = 6 + Math.sin(a) * r * 1.05;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = OC();
      ctx.stroke();
      ctx.fillStyle = C(c1);
      ctx.fill();
      if (!PS.F) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = shade(c1, -0.35);
        ctx.beginPath();
        ctx.ellipse(6, 12, 14, 10, 0.4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.ellipse(-8, -2, 8, 5, -0.4, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = shade(c1, -0.5);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 6);
        ctx.lineTo(-2, 10);
        ctx.lineTo(2, 4);
        ctx.lineTo(10, 8);
        ctx.moveTo(2, 4);
        ctx.lineTo(4, -4);
        ctx.stroke();
        ctx.restore();
        shine(ctx, -2, 2, 14, 0.35);
      }
      break;
    }
    case 'tesla': {
      seg(ctx, 0, -14, 0, 0, 17, c1);
      // bobinas de cobre
      for (let i = 0; i < 3; i++) seg(ctx, -9, -12 + i * 4, 9, -12 + i * 4, 3, c3);
      ellipse(ctx, 0, 6, 11, 12, shade(c1, 0.1));
      for (let i = -1; i <= 1; i++) circle(ctx, i * 6, 14, 3, shade(c1, 0.3));
      add(ctx, () => {
        ctx.globalAlpha = 0.7 + Math.sin(t * 20) * 0.25;
        ctx.drawImage(glowSprite(c2), -22, -14, 44, 44);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        const k = Math.floor(t * 18);
        for (let j = 0; j < 3; j++) {
          let px = -6 + j * 6;
          let py = 14;
          ctx.beginPath();
          ctx.moveTo(px, py);
          for (let s = 0; s < 4; s++) {
            px += (hash(k * 7 + j * 3 + s) - 0.5) * 10;
            py += 4 + hash(k + s + j) * 3;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.strokeStyle = c2;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(0, -8, 11, -0.4 + (k % 4), 1 + (k % 4));
        ctx.stroke();
      });
      break;
    }
    case 'fogo': {
      add(ctx, () => {
        ctx.globalAlpha = 0.85 + Math.sin(t * 9) * 0.15;
        ctx.drawImage(glowSprite(c1), -30, -26, 60, 60);
        // chamas a subir pelo antebraço
        for (let i = 0; i < 5; i++) {
          ctx.globalAlpha = 0.9;
          flame(ctx, -8 + i * 4, 2 - (i % 2) * 4, (i - 2) * 0.12, -1, 30 + (i % 2) * 10, 6, c1, c2, t, i);
        }
      });
      ellipse(ctx, 0, 5, 11, 12, '#ffb000', 3);
      if (!PS.F) {
        add(ctx, () => {
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#fff6c0';
          ctx.beginPath();
          ctx.ellipse(-1, 4, 7, 8, 0, 0, TAU);
          ctx.fill();
          for (let i = 0; i < 3; i++) {
            const ph = (t * 2 + i / 3) % 1;
            ctx.globalAlpha = 1 - ph;
            ctx.fillStyle = c2;
            ctx.fillRect(-8 + hash(i + Math.floor(t * 2)) * 16, -6 - ph * 34, 2.5, 2.5);
          }
        });
      }
      break;
    }
    case 'gelo': {
      seg(ctx, 0, -12, 0, 0, 15, shade(c2, 0.2));
      const shards: [number, number, number, number][] = [[-9, 4, -0.5, 16], [0, 6, 0, 22], [9, 4, 0.5, 16], [-5, -4, -1.1, 12], [6, -4, 1.1, 12]];
      for (const [bx, by, a, l] of shards) {
        const tx = bx + Math.sin(a) * l;
        const ty = by + Math.cos(a) * l;
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(a) * 5, by + Math.sin(a) * 5);
        ctx.lineTo(tx, ty);
        ctx.lineTo(bx + Math.cos(a) * 5, by - Math.sin(a) * 5);
        ctx.closePath();
        ctx.fillStyle = C(c1);
        ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = OC();
        ctx.stroke();
      }
      ellipse(ctx, 0, 4, 10.5, 11, '#d8f6ff');
      if (!PS.F) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(-6, -2);
        ctx.lineTo(0, -5);
        ctx.lineTo(-2, 6);
        ctx.fill();
        ctx.globalAlpha = 1;
        add(ctx, () => {
          ctx.globalAlpha = 0.45;
          ctx.drawImage(glowSprite(c2), -24, -18, 48, 48);
          for (let i = 0; i < 4; i++) {
            const ph = (t * 0.7 + i / 4) % 1;
            ctx.globalAlpha = 0.5 * (1 - ph);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(Math.sin(i * 2 + t) * 12, 8 + ph * 20, 3 + ph * 4, 0, TAU);
            ctx.fill();
          }
        });
      }
      break;
    }
    case 'dragao': {
      seg(ctx, 0, -14, 0, -2, 16, shade(c1, -0.2));
      // escamas do pescoço
      if (!PS.F) {
        ctx.strokeStyle = shade(c1, -0.45);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) ctx.arc(0, -12 + i * 4, 5, 0.3, Math.PI - 0.3);
        ctx.stroke();
      }
      const open = (Math.sin(t * 3) + 1) * 0.5;
      // maxila de baixo
      ctx.beginPath();
      ctx.moveTo(-8, 2);
      ctx.quadraticCurveTo(-9 - open * 3, 14, -4 - open * 5, 24);
      ctx.lineTo(-1 - open * 3, 22);
      ctx.quadraticCurveTo(-2, 10, 2, 4);
      ctx.closePath();
      ctx.fillStyle = C(shade(c1, -0.15));
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = OC();
      ctx.stroke();
      // cabeça e focinho
      ctx.beginPath();
      ctx.moveTo(-9, -4);
      ctx.quadraticCurveTo(-12, 6, -6, 10);
      ctx.lineTo(4, 28);
      ctx.quadraticCurveTo(9, 30, 9, 24);
      ctx.quadraticCurveTo(12, 8, 10, -2);
      ctx.quadraticCurveTo(0, -10, -9, -4);
      ctx.closePath();
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.stroke();
      // dentes
      ctx.fillStyle = C('#ffffff');
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-5 + i * 2.5, 12 + i * 5);
        ctx.lineTo(-8 + i * 2.5, 15 + i * 5);
        ctx.lineTo(-4 + i * 2.5, 16 + i * 5);
        ctx.fill();
      }
      // chifres e olho
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sd * 6, -4);
        ctx.quadraticCurveTo(sd * 12, -14, sd * 9, -22);
        ctx.lineTo(sd * 4, -6);
        ctx.closePath();
        ctx.fillStyle = C('#f2e6d0');
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = OC();
        ctx.stroke();
      }
      ellipse(ctx, 5, 4, 3.6, 2.6, c2, 1.5, 0.3);
      if (!PS.F) {
        ctx.fillStyle = '#1a1220';
        ctx.fillRect(4.5, 2.5, 1.4, 3);
        add(ctx, () => {
          ctx.globalAlpha = 0.6;
          ctx.drawImage(glowSprite(c2), -3, -4, 16, 16);
          for (let i = 0; i < 3; i++) {
            const ph = (t * 0.9 + i / 3) % 1;
            ctx.globalAlpha = 0.35 * (1 - ph);
            ctx.fillStyle = '#c9c3b0';
            ctx.beginPath();
            ctx.arc(6 + ph * 6, 30 + ph * 18, 3 + ph * 7, 0, TAU);
            ctx.fill();
          }
        });
      }
      break;
    }
    case 'mecha': {
      // pistão do pulso
      seg(ctx, -5, -18, -5, -2, 6, '#59627a');
      seg(ctx, 5, -18, 5, -4, 6, '#59627a');
      seg(ctx, 5, -16, 5, -10 + Math.sin(t * 8) * 2, 3, '#e8eef5', false);
      ctx.beginPath();
      ctx.roundRect(-13, -6, 26, 26, 6);
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.stroke();
      // dedos
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.roundRect(-12 + i * 6.2, 17, 5.6, 8, 2);
        ctx.fillStyle = C(shade(c1, -0.12));
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = OC();
        ctx.stroke();
      }
      if (!PS.F) {
        ctx.fillStyle = shade(c1, -0.4);
        ctx.fillRect(-10, 6, 20, 2);
        add(ctx, () => {
          const on = Math.floor(t * 4) % 4;
          for (let i = 0; i < 4; i++) {
            ctx.globalAlpha = i === on ? 1 : 0.55;
            ctx.fillStyle = i === on ? '#ffffff' : c2;
            ctx.fillRect(-11 + i * 6.2, 12, 4, 2.5);
          }
          ctx.globalAlpha = 0.6;
          ctx.drawImage(glowSprite(c2), -16, 2, 32, 22);
          // propulsor
          ctx.globalAlpha = 0.9;
          flame(ctx, 0, -20, 0, -1, 18, 5, '#4ac8ff', '#e8ffff', t * 2, 3);
        });
        shine(ctx, -3, 2, 12, 0.45);
      }
      break;
    }
    case 'sombra': {
      add(ctx, () => {
        ctx.globalAlpha = 0.6;
        ctx.drawImage(glowSprite(c2), -26, -20, 52, 56);
      });
      // fumo
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.8 + i / 4) % 1;
        ctx.globalAlpha = PS.F ? 1 : 0.55 * (1 - ph);
        ctx.fillStyle = C(c1);
        ctx.beginPath();
        ctx.arc(Math.sin(t * 2 + i * 2) * 6, -6 - ph * 26, 6 + ph * 6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ellipse(ctx, 0, 4, 11, 12, c1, 2.5);
      // garras
      for (let i = -1.5; i <= 1.5; i++) {
        const bx = i * 5;
        const sw = Math.sin(t * 4 + i) * 2;
        ctx.beginPath();
        ctx.moveTo(bx - 2.5, 12);
        ctx.quadraticCurveTo(bx + sw + i * 2, 22, bx + i * 3 + sw, 30);
        ctx.quadraticCurveTo(bx + i, 20, bx + 2.5, 12);
        ctx.fillStyle = C(shade(c1, 0.15));
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = OC();
        ctx.stroke();
      }
      add(ctx, () => {
        ctx.fillStyle = c2;
        ctx.globalAlpha = 0.95;
        const blink = t % 2.6 < 0.12 ? 0.3 : 1;
        ctx.beginPath();
        ctx.ellipse(-4, 2, 2.4, 1.6 * blink, 0.3, 0, TAU);
        ctx.ellipse(4, 2, 2.4, 1.6 * blink, -0.3, 0, TAU);
        ctx.fill();
      });
      break;
    }
    case 'cosmico': {
      add(ctx, () => {
        ctx.globalAlpha = 0.75 + Math.sin(t * 5) * 0.2;
        ctx.drawImage(glowSprite(c2), -26, -20, 52, 52);
        // rasto de estrelas
        for (let i = 0; i < 6; i++) {
          const ph = (t * 0.8 + i / 6) % 1;
          ctx.globalAlpha = 1 - ph;
          ctx.fillStyle = i % 2 ? '#ffffff' : c2;
          ctx.fillRect(Math.sin(i * 3.1) * 8 - 1, -8 - ph * 30, 2.2, 2.2);
        }
      });
      ellipse(ctx, 0, 5, 12, 12.5, g.anim === 'cosmic' ? `hsl(${250 + Math.sin(t * 1.3) * 25} 70% 22%)` : c1);
      add(ctx, () => {
        ctx.globalAlpha = 0.7;
        ctx.drawImage(glowSprite('#b05cff'), -10, -6, 22, 22);
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 6; i++) {
          const a = t * 2 + i * 1.1;
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5 + i);
          ctx.fillRect(Math.cos(a) * 7 - 0.8, 5 + Math.sin(a * 1.3) * 7 - 0.8, 1.6, 1.6);
        }
      });
      // anel planetário
      ctx.beginPath();
      ctx.ellipse(0, 5, 19, 5, 0.35 + Math.sin(t) * 0.1, 0, TAU);
      ctx.lineWidth = 4;
      ctx.strokeStyle = OC();
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = C(c2);
      ctx.stroke();
      circle(ctx, Math.cos(t * 2) * 19, 5 + Math.sin(t * 2) * 5, 3, '#ffd23d', true);
      break;
    }
    case 'sol': {
      add(ctx, () => {
        ctx.globalAlpha = 0.9;
        ctx.drawImage(glowSprite(c1), -36, -30, 72, 72);
        ctx.strokeStyle = c2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU + t * 0.8;
          const l = 20 + (i % 2) * 6 + Math.sin(t * 6 + i) * 2;
          ctx.moveTo(Math.cos(a) * 14, 6 + Math.sin(a) * 14);
          ctx.lineTo(Math.cos(a) * l, 6 + Math.sin(a) * l);
        }
        ctx.stroke();
        for (let i = 0; i < 2; i++) {
          ctx.globalAlpha = 0.8;
          flame(ctx, -6 + i * 12, -4, (i - 0.5) * 0.4, -1, 20, 5, '#ff7a00', '#fff6b0', t, i + 7);
        }
      });
      ellipse(ctx, 0, 6, 13, 13, '#ffc21a', 3);
      add(ctx, () => {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fffbe0';
        ctx.beginPath();
        ctx.arc(-1, 5, 8, 0, TAU);
        ctx.fill();
      });
      break;
    }
    default:
      boxGlove(ctx, c1, c2, false, t);
  }
  ctx.restore();
}

/** Bota no fim da perna; os fatos especiais trocam-na por garras, botas lunares ou metal. */
export function drawBoot(ctx: CanvasRenderingContext2D, kx: number, ky: number, fx: number, fy: number, ang: number, color: string, mat?: string) {
  const big = mat === 'astro' || mat === 'metal';
  drawBootTo(ctx, kx, ky, fx, fy, fx + Math.cos(ang) * (big ? 18 : 16), fy - Math.sin(ang) * (big ? 18 : 16), ang, color, mat);
}

/** Bota com a ponta do pé num ponto dado (na vista 3D o pé encurta quando aponta para quem vê). */
export function drawBootTo(ctx: CanvasRenderingContext2D, kx: number, ky: number, fx: number, fy: number, tx: number, ty: number, ang: number, color: string, mat?: string) {
  const bx = kx + (fx - kx) * 0.45;
  const by = ky + (fy - ky) * 0.45;
  const big = mat === 'astro' || mat === 'metal';
  seg(ctx, bx, by, fx, fy, big ? 23 : 20, color);
  seg(ctx, fx - Math.cos(ang) * 4, fy + Math.sin(ang) * 4, tx, ty, big ? 17 : 14, color);
  const sx = Math.sin(ang) * 6;
  const sy = Math.cos(ang) * 6;
  if (mat === 'dino' || mat === 'dragon' || mat === 'feather') {
    // garras
    for (let i = -1; i <= 1; i++) {
      const cx = tx + Math.cos(ang + i * 0.5) * 6;
      const cy = ty - Math.sin(ang + i * 0.5) * 6 + 2;
      ctx.beginPath();
      ctx.moveTo(cx - 2.5, cy - 2);
      ctx.lineTo(cx + Math.cos(ang) * 7, cy - Math.sin(ang) * 7 + 3);
      ctx.lineTo(cx + 2.5, cy + 2);
      ctx.closePath();
      ctx.fillStyle = C(mat === 'feather' ? '#ffd23d' : '#f2e6d0');
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = OC();
      ctx.stroke();
    }
    return;
  }
  if (mat === 'lava' || mat === 'ice' || mat === 'cosmic' || mat === 'shark') return;
  seg(ctx, fx - Math.cos(ang) * 6 + sx, fy + Math.sin(ang) * 6 + sy, tx + sx * 0.6, ty + sy * 0.6, big ? 6 : 4, big ? '#59627a' : '#e8e4dc', false);
  if (!PS.F && !big) {
    ctx.strokeStyle = shade(color, 0.45);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const u = 0.25 + i * 0.22;
      const lx = bx + (fx - bx) * u;
      const ly = by + (fy - by) * u;
      ctx.moveTo(lx + Math.cos(ang) * 3, ly - Math.sin(ang) * 3);
      ctx.lineTo(lx + Math.cos(ang) * 9, ly - Math.sin(ang) * 9);
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  seg(ctx, bx, by, bx + (fx - bx) * 0.14, by + (fy - by) * 0.14, big ? 22 : 19, shade(color, big ? -0.25 : 0.3), false);
  ctx.lineCap = 'round';
}
