import { shade } from '../data/appearance';
import type { Vis } from '../data/items';
import { flame, starTile, twinkle } from './costume';
import { C, OC, PS, TAU, glowSprite, hash, seg } from './paint';

/**
 * Luvas: desenhadas no referencial do punho (y local = direção do antebraço para o punho).
 * As mais raras deixam de ser luvas: pedregulhos, cabeças de dragão, punhos mecânicos, sóis…
 *
 * A luz vem de cima/à frente no ecrã (como no resto do corpo); como a luva roda com o antebraço,
 * a direção da luz é convertida para o referencial local, para o sombreado cel e os brilhos
 * ficarem sempre do lado certo, seja qual for o golpe.
 */

type V2 = [number, number];

/** Cache de tons (evita refazer contas de cor a cada frame). */
const shCache = new Map<string, string>();
function sh(hex: string, amt: number): string {
  const k = hex + amt;
  let v = shCache.get(k);
  if (v === undefined) {
    v = hex.length === 7 ? shade(hex, amt) : hex;
    shCache.set(k, v);
  }
  return v;
}

function add(ctx: CanvasRenderingContext2D, f: () => void) {
  if (PS.F) return;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  f();
  ctx.globalCompositeOperation = prev;
  ctx.globalAlpha = 1;
}

/** Direção do ecrã → referencial local da luva (que está rodado de -ang). */
function toLocal(ang: number, x: number, y: number): V2 {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [x * c - y * s, x * s + y * c];
}

const fillOf = (f: string | CanvasGradient) => (typeof f === 'string' ? C(f) : PS.F ? C('#ffffff') : f);

/** Pinta o caminho atual com contorno (o caminho fica ativo para um `cel` a seguir). */
function paint(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, lw = 3) {
  ctx.fillStyle = fillOf(fill);
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = OC();
    ctx.stroke();
  }
}

/**
 * Sombreado cel dentro do caminho atual: sombra do lado oposto à luz, brilho especular
 * alongado e um ponto de luz duro (dá o ar de vinil / couro envernizado).
 */
function cel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, L: V2, a = 0.3, hi = 0.55, dark = '#000000') {
  if (PS.F) return;
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = a;
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.rect(cx - r * 4, cy - r * 4, r * 8, r * 8);
  const ex = cx + L[0] * r * 0.4;
  const ey = cy + L[1] * r * 0.4;
  ctx.moveTo(ex + r * 1.02, ey);
  ctx.arc(ex, ey, r * 1.02, 0, TAU);
  ctx.fill('evenodd');
  if (hi > 0) {
    const ang = Math.atan2(L[1], L[0]) + Math.PI / 2;
    ctx.globalAlpha = hi * 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx + L[0] * r * 0.52, cy + L[1] * r * 0.52, r * 0.42, r * 0.15, ang, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, hi * 1.6);
    ctx.beginPath();
    ctx.arc(cx + L[0] * r * 0.55 + L[1] * r * 0.28, cy + L[1] * r * 0.55 - L[0] * r * 0.28, Math.max(0.8, r * 0.09), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Luz refletida fina na orla do lado da sombra (separa a luva do corpo). */
function rimLight(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, L: V2, col: string, a = 0.5) {
  if (PS.F) return;
  const th = Math.atan2(-L[1], -L[0]);
  ctx.globalAlpha = a;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1.8, th - 0.7, th + 0.7);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Gradiente metálico (cromado com reflexo de horizonte). */
function metal(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, base: string): string | CanvasGradient {
  if (PS.F) return base;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, sh(base, 0.55));
  g.addColorStop(0.3, base);
  g.addColorStop(0.48, sh(base, -0.42));
  g.addColorStop(0.58, sh(base, 0.2));
  g.addColorStop(1, sh(base, -0.25));
  return g;
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n = 5, k = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rr = i % 2 ? r * k : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** Corpo almofadado da luva de boxe (nós dos dedos para +y, polegar para +x). */
function fistPath(ctx: CanvasRenderingContext2D, k = 1) {
  ctx.beginPath();
  ctx.moveTo(-9.5 * k, -2);
  ctx.bezierCurveTo(-14.5 * k, 3, -14 * k, 14 * k, -9.5 * k, 19 * k);
  ctx.bezierCurveTo(-4.5 * k, 23.5 * k, 6 * k, 23.5 * k, 10.5 * k, 17.5 * k);
  ctx.bezierCurveTo(13.5 * k, 12 * k, 12.5 * k, 2.5, 9 * k, -2);
  ctx.closePath();
}

/**
 * Mão nua fechada em punho, vista pelas costas da mão (nós dos dedos para +y, polegar para +x):
 * pulso, costas da mão com tendões, quatro dedos dobrados (do mindinho, mais curto, ao indicador),
 * nós dos dedos com brilho, vincos das falanges e polegar a fechar por cima, com unha.
 * `wrap` (opcional) desenha por cima das costas da mão e dos nós — usado pelas ligaduras.
 */
function bareFist(ctx: CanvasRenderingContext2D, sk: string, L: V2, wrap?: (clip: () => void) => void) {
  const dk = sh(sk, -0.32);
  const lt = sh(sk, 0.22);
  // pulso + costas da mão
  const backPath = () => {
    ctx.beginPath();
    ctx.moveTo(-6.8, -13);
    ctx.lineTo(6.8, -13);
    ctx.bezierCurveTo(7.4, -7, 10.6, -3, 10.2, 3);
    ctx.lineTo(10, 8);
    ctx.lineTo(-10.4, 8);
    ctx.lineTo(-10.6, 3);
    ctx.bezierCurveTo(-10.8, -3, -7.4, -7, -6.8, -13);
    ctx.closePath();
  };
  backPath();
  paint(ctx, sk, 3);
  cel(ctx, 0, 0, 12, L, 0.22, 0.25);
  if (!PS.F && !wrap) {
    // tendões nas costas da mão
    ctx.strokeStyle = dk;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x = -5.2 + i * 4.3;
      ctx.moveTo(x * 0.55, -6);
      ctx.quadraticCurveTo(x * 0.85, 0, x, 6.5);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // dedos dobrados: mindinho (-x) → indicador (+x); o indicador fica à frente
  const FX = [-10.8, -5.6, -0.3, 4.9];
  const FW = [5.4, 5.8, 5.8, 5.6];
  const FT = [4.6, 3.8, 3.6, 3.9];
  const FB = [17, 19.4, 20.2, 19.2];
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.roundRect(FX[i], FT[i], FW[i], FB[i] - FT[i], [2.2, 2.2, 2.6, 2.6]);
    paint(ctx, i === 0 ? sh(sk, -0.06) : sk, 2.3);
  }
  if (wrap) wrap(() => {
    ctx.beginPath();
    ctx.rect(-12, -13, 24, 25.5);
  });
  if (!PS.F) {
    for (let i = 0; i < 4; i++) {
      const cx = FX[i] + FW[i] / 2;
      // vinco da articulação do meio
      ctx.strokeStyle = dk;
      ctx.lineWidth = 0.9;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx - FW[i] * 0.32, FB[i] - 4.6);
      ctx.quadraticCurveTo(cx, FB[i] - 3.6, cx + FW[i] * 0.32, FB[i] - 4.6);
      ctx.stroke();
      // sombra na ponta dobrada (a ponta do dedo enrola para dentro)
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#2a0f10';
      ctx.beginPath();
      ctx.roundRect(FX[i] + 0.9, FB[i] - 2.4, FW[i] - 1.8, 1.6, 0.8);
      ctx.fill();
      // brilho no nó do dedo
      ctx.globalAlpha = wrap ? 0.25 : 0.55;
      ctx.fillStyle = lt;
      ctx.beginPath();
      ctx.ellipse(cx - 0.3, FT[i] + 2.3, FW[i] * 0.3, 1.3, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // polegar: sai do lado +x e fecha por cima do indicador e do médio
  ctx.lineCap = 'round';
  ctx.strokeStyle = OC();
  ctx.lineWidth = 8.8;
  ctx.beginPath();
  ctx.moveTo(9.6, -2.5);
  ctx.quadraticCurveTo(11.4, 10.5, 2.4, 13.6);
  ctx.stroke();
  ctx.strokeStyle = C(sk);
  ctx.lineWidth = 6;
  ctx.stroke();
  if (!PS.F) {
    // sombra por baixo do polegar e brilho por cima
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = dk;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(8.2, 0.5);
    ctx.quadraticCurveTo(8.8, 9.8, 2.8, 12.2);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = lt;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(10.6, 0);
    ctx.quadraticCurveTo(11.6, 7.5, 7.8, 12);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // unha do polegar
    ctx.save();
    ctx.translate(3.4, 13.3);
    ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.roundRect(-2.1, -1.5, 3.2, 2.9, 1.2);
    ctx.fillStyle = sh(sk, 0.32);
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = dk;
    ctx.stroke();
    ctx.restore();
  }
  rimLight(ctx, 0, 6, 12, L, lt, 0.3);
}

/** Brilho de varrimento (luvas douradas e metais nobres), recortado pelo caminho atual. */
function sweep(ctx: CanvasRenderingContext2D, t: number, speed = 0.8, a = 0.75) {
  if (PS.F) return;
  const p = ((t * speed) % 1.6) - 0.3;
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = a;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-16, -14 + p * 44);
  ctx.lineTo(16, -22 + p * 44);
  ctx.lineTo(16, -16 + p * 44);
  ctx.lineTo(-16, -8 + p * 44);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Luva de boxe em couro/vinil: punho com atacadores ou velcro, costura, emblema e polegar. */
function boxGlove(ctx: CanvasRenderingContext2D, c1: string, c2: string, pro: boolean, t: number, L: V2, anim?: string) {
  const gold = anim === 'shine';
  const dk = sh(c1, -0.4);
  // punho (cano)
  ctx.beginPath();
  ctx.roundRect(-8.5, -16, 17, 16, 4);
  paint(ctx, gold ? metal(ctx, -8, -16, 8, 0, c1) : c1, 3);
  cel(ctx, 0, -8, 9, L, 0.28, 0.3);
  if (pro) {
    // fita de velcro a contrastar
    ctx.beginPath();
    ctx.roundRect(-9.6, -12.5, 19.2, 7, 2.2);
    paint(ctx, c2, 2.2);
    if (!PS.F) {
      ctx.fillStyle = sh(c2, -0.3);
      ctx.fillRect(-6.5, -9.6, 13, 1.3);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(-8.6, -11.8, 17, 1.1);
    }
  } else if (!PS.F) {
    // faixa branca do pulso + atacadores
    ctx.fillStyle = c2;
    ctx.fillRect(-7.8, -5.6, 15.6, 3.6);
    ctx.strokeStyle = sh(c2, -0.1);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const y = -15 + i * 3.1;
      ctx.moveTo(-3.6, y);
      ctx.lineTo(3.6, y + 3);
      ctx.moveTo(3.6, y);
      ctx.lineTo(-3.6, y + 3);
    }
    ctx.stroke();
    ctx.fillStyle = dk;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-4.6, -15 + i * 3.1 - 0.6, 1.2, 1.2);
      ctx.fillRect(3.4, -15 + i * 3.1 - 0.6, 1.2, 1.2);
    }
  }
  // corpo almofadado
  fistPath(ctx);
  paint(ctx, gold ? metal(ctx, -12, -2, 12, 22, c1) : c1, 3);
  cel(ctx, 0, 9, 13, L, 0.34, gold ? 0.8 : 0.6, dk);
  if (!PS.F) {
    // dobra dos dedos
    ctx.strokeStyle = dk;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(-12.2, 12);
    ctx.quadraticCurveTo(-1, 18.5, 10.8, 12.5);
    ctx.stroke();
    // costura pespontada nas costas da mão
    ctx.setLineDash([1.6, 1.9]);
    ctx.strokeStyle = sh(c1, 0.45);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-8, -0.5);
    ctx.bezierCurveTo(-12, 4, -11.8, 13, -8, 17.2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (pro) {
      ctx.strokeStyle = c2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12.8, 8);
      ctx.quadraticCurveTo(-1, 14.5, 11.8, 8.5);
      ctx.stroke();
    }
    // emblema da marca
    ctx.beginPath();
    ctx.ellipse(-5.6, 4.6, 3.6, 4.6, 0.12, 0, TAU);
    ctx.fillStyle = c2;
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = OC();
    ctx.stroke();
    ctx.fillStyle = gold ? '#b07d00' : c1 === c2 ? dk : c1;
    starPath(ctx, -5.6, 4.8, 2.5);
    ctx.fill();
  }
  // polegar
  ctx.beginPath();
  ctx.ellipse(10.4, 4.6, 4.4, 7.6, -0.22, 0, TAU);
  paint(ctx, gold ? metal(ctx, 6, -2, 14, 12, c1) : c1, 2.6);
  cel(ctx, 10.4, 4.6, 6.5, L, 0.3, 0.35, dk);
  if (!PS.F) {
    ctx.strokeStyle = dk;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(8.2, -0.5);
    ctx.quadraticCurveTo(7.4, 5, 9, 10);
    ctx.stroke();
  }
  rimLight(ctx, 0, 9, 13, L, sh(c1, 0.5), 0.35);
  if (gold && !PS.F) {
    fistPath(ctx);
    sweep(ctx, t);
    // cintilação
    const ph = (t * 0.7) % 1;
    if (ph < 0.35) {
      add(ctx, () => {
        ctx.globalAlpha = Math.sin((ph / 0.35) * Math.PI);
        twinkle(ctx, L[0] * 8, 8 + L[1] * 8, 6, '#ffffff');
      });
    }
  }
}

export function drawGlove(ctx: CanvasRenderingContext2D, g: Vis, x: number, y: number, ang: number, t: number, skin: string, back: boolean) {
  const c1 = back ? sh(g.c1 ?? '#dd2222', -0.2) : g.c1 ?? '#dd2222';
  const c2 = g.c2 ?? '#ffffff';
  const c3 = g.c3 ?? c2;
  // luz de cima/à frente no ecrã → referencial local
  const L = toLocal(ang, 0.45, -0.89);
  // "para cima" no ecrã (as chamas e o fumo sobem sempre)
  const U = toLocal(ang, 0, -1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-ang);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (g.style) {
    case 'bare':
      // sem luvas: mão nua fechada em punho (um pouco maior, para se ler bem à escala da luta)
      ctx.scale(1.22, 1.22);
      bareFist(ctx, back ? sh(skin, -0.12) : skin, L);
      break;
    case 'fita': {
      // ligaduras de rua: pulso enrolado, nós dos dedos ligados, pontas dos dedos à mostra e ponta solta
      if (!PS.F) {
        const sw = Math.sin(t * 7) * 3;
        ctx.strokeStyle = OC();
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.moveTo(-6, -9);
        ctx.quadraticCurveTo(-13, -14 + sw * 0.4, -16 + sw, -21);
        ctx.stroke();
        ctx.strokeStyle = c1;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      const sk = back ? sh(skin, -0.12) : skin;
      ctx.scale(1.15, 1.15);
      bareFist(ctx, sk, L, (clip) => {
        // voltas da ligadura: pulso, costas da mão e nós dos dedos (as pontas dos dedos ficam nuas)
        ctx.save();
        clip();
        ctx.clip();
        for (let i = 0; i < 6; i++) {
          const yy = -11 + i * 3.7;
          ctx.strokeStyle = OC();
          ctx.lineWidth = 4.4;
          ctx.beginPath();
          ctx.moveTo(-14, yy - 1.6 + (i % 2) * 0.8);
          ctx.lineTo(14, yy + 1.6 - (i % 2) * 0.8);
          ctx.stroke();
          ctx.strokeStyle = i % 2 ? c2 : c1;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.restore();
      });
      break;
    }
    case 'buraco': {
      // buraco negro: horizonte de eventos, disco de acreção a rodar e anel de luz desviada por cima
      const hot = g.c2 ?? '#ff9a2a';
      const white = g.c3 ?? '#fff3d0';
      const cx = 0;
      const cy = 9;
      const spin = t * 2.4;
      // punho escuro com orla
      ctx.beginPath();
      ctx.roundRect(-8, -15, 16, 13, 4);
      paint(ctx, '#1a1030', 3);
      if (!PS.F) {
        ctx.fillStyle = hot;
        ctx.fillRect(-7, -6.5, 14, 2.2);
      }
      const disk = (a0: number, a1: number) => {
        if (PS.F) return;
        // disco inclinado: metade de trás antes da esfera, metade da frente depois
        add(ctx, () => {
          for (let k = 0; k < 3; k++) {
            ctx.globalAlpha = [0.35, 0.7, 0.95][k];
            ctx.strokeStyle = [hot, hot, white][k];
            ctx.lineWidth = [7, 3.6, 1.6][k];
            ctx.beginPath();
            ctx.ellipse(cx, cy, 24 - k * 1.5, 7 - k * 0.6, -0.35, a0, a1);
            ctx.stroke();
          }
          // grãos de matéria a cair em espiral
          for (let i = 0; i < 6; i++) {
            const a = spin * (1 + i * 0.13) + i * 1.05;
            const am = ((a % TAU) + TAU) % TAU;
            const inHalf = a0 < a1 ? am >= a0 && am <= a1 : am >= a0 || am <= a1;
            if (!inHalf) continue;
            const rr = 25 - ((t * 0.6 + i * 0.17) % 1) * 9;
            const px = cx + Math.cos(a) * rr;
            const py = cy + Math.sin(a) * rr * 0.3;
            const c = Math.cos(-0.35), sn = Math.sin(-0.35);
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = white;
            ctx.beginPath();
            ctx.arc(cx + (px - cx) * c - (py - cy) * sn, cy + (px - cx) * sn + (py - cy) * c, 1.3, 0, TAU);
            ctx.fill();
          }
        });
      };
      disk(Math.PI, TAU);
      if (!PS.F) {
        add(ctx, () => {
          ctx.globalAlpha = 0.55 + Math.sin(t * 3) * 0.15;
          ctx.drawImage(glowSprite(hot), cx - 30, cy - 30, 60, 60);
        });
      }
      // horizonte de eventos
      ctx.beginPath();
      ctx.arc(cx, cy, 12.5, 0, TAU);
      paint(ctx, g.c1 ?? '#05030a', 3);
      if (!PS.F) {
        // anel de fotões (luz desviada por cima e por baixo do buraco)
        add(ctx, () => {
          ctx.strokeStyle = white;
          ctx.globalAlpha = 0.9;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(cx, cy, 12.5, 0, TAU);
          ctx.stroke();
          ctx.strokeStyle = hot;
          ctx.globalAlpha = 0.75;
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.ellipse(cx, cy - 1, 15, 15, 0, Math.PI * 1.05, Math.PI * 1.95);
          ctx.stroke();
        });
      }
      disk(0, Math.PI);
      break;
    }
    case 'pro':
      boxGlove(ctx, c1, c2, true, t, L, g.anim);
      break;
    case 'picos': {
      // manopla de couro com cano alargado, pespontos e placa de nós cravejada
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-10.5, -18);
      ctx.quadraticCurveTo(0, -21, 10.5, -18);
      ctx.lineTo(8, 0);
      ctx.closePath();
      paint(ctx, sh(c1, -0.1), 3);
      cel(ctx, 0, -9, 10, L, 0.3, 0.2);
      if (!PS.F) {
        ctx.setLineDash([1.5, 1.8]);
        ctx.strokeStyle = sh(c1, 0.5);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(-8.5, -16.5);
        ctx.quadraticCurveTo(0, -19, 8.5, -16.5);
        ctx.moveTo(-7, -2);
        ctx.lineTo(7, -2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const sx of [-5, 0, 5]) {
        ctx.beginPath();
        ctx.arc(sx, -11, 2.1, 0, TAU);
        paint(ctx, c2, 1.3);
        if (!PS.F) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx - 1 + L[0], -12 + L[1], 1, 1);
        }
      }
      fistPath(ctx, 0.95);
      paint(ctx, c1, 3);
      cel(ctx, 0, 8, 12, L, 0.35, 0.45);
      // placa de metal nos nós dos dedos
      ctx.beginPath();
      ctx.roundRect(-11.5, 12.5, 22, 7, 3);
      paint(ctx, metal(ctx, 0, 12, 0, 20, c2), 2.4);
      for (let i = -1; i <= 1; i++) {
        const bx = i * 6.5;
        ctx.beginPath();
        ctx.moveTo(bx - 3.2, 18.5);
        ctx.lineTo(bx + i * 0.8, 28);
        ctx.lineTo(bx + 3.2, 18.5);
        ctx.closePath();
        paint(ctx, c2, 2);
        if (!PS.F) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.moveTo(bx + i * 0.8, 28);
          ctx.lineTo(bx + 3.2, 18.5);
          ctx.lineTo(bx + 0.5, 18.5);
          ctx.fill();
        }
      }
      rimLight(ctx, 0, 8, 12, L, sh(c1, 0.5), 0.4);
      break;
    }
    case 'cetro': {
      // punhos-cetro: manopla de ouro lavrado, gola de veludo com pedras e uma coroa nos nós
      // dos dedos a segurar uma grande ametista que brilha (a cabeça de um cetro real)
      const vel = g.c3 ?? '#5b1fa8';
      add(ctx, () => {
        ctx.globalAlpha = 0.55 + Math.sin(t * 4) * 0.2;
        ctx.drawImage(glowSprite(c2), -24, 6, 48, 48);
      });
      // cano em sino, de ouro
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-12, -17);
      ctx.quadraticCurveTo(0, -21, 12, -17);
      ctx.lineTo(8, 0);
      ctx.closePath();
      paint(ctx, metal(ctx, -12, -18, 12, 0, c1), 3);
      cel(ctx, 0, -9, 10, L, 0.25, 0.3, '#5a3a00');
      // faixa de veludo com pedras
      ctx.beginPath();
      ctx.roundRect(-11, -12, 22, 6.5, 2.5);
      paint(ctx, vel, 2.2);
      for (const sx of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.arc(sx, -8.8, sx ? 1.7 : 2.3, 0, TAU);
        paint(ctx, sx ? '#fff3b0' : c2, 1.2);
      }
      // punho de ouro com filigrana
      fistPath(ctx);
      paint(ctx, metal(ctx, -12, -2, 12, 22, c1), 3);
      cel(ctx, 0, 9, 13, L, 0.3, 0.75, '#6a4300');
      if (!PS.F) {
        ctx.strokeStyle = sh(c1, -0.45);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-10, 3);
        ctx.bezierCurveTo(-4, 0, -6, 8, 0, 6);
        ctx.bezierCurveTo(5, 4, 4, 11, 9, 9);
        ctx.moveTo(-11, 10);
        ctx.quadraticCurveTo(-1, 15.5, 11, 10.5);
        ctx.stroke();
        fistPath(ctx);
        sweep(ctx, t, 0.7, 0.6);
      }
      // polegar
      ctx.beginPath();
      ctx.ellipse(10.4, 4.6, 4.4, 7.6, -0.22, 0, TAU);
      paint(ctx, metal(ctx, 6, -2, 14, 12, c1), 2.6);
      // coroa nos nós dos dedos
      ctx.beginPath();
      ctx.moveTo(-10, 17);
      ctx.lineTo(-11, 24);
      ctx.lineTo(-6, 21);
      ctx.lineTo(0, 27);
      ctx.lineTo(6, 21);
      ctx.lineTo(11, 24);
      ctx.lineTo(10, 17);
      ctx.quadraticCurveTo(0, 20.5, -10, 17);
      ctx.closePath();
      paint(ctx, metal(ctx, -10, 16, 10, 27, c1), 2.2);
      // a ametista
      ctx.beginPath();
      ctx.arc(0, 29, 6.2, 0, TAU);
      paint(ctx, c2, 2.4);
      if (!PS.F) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = sh(c2, -0.4);
        ctx.beginPath();
        ctx.arc(-L[0] * 3, 29 - L[1] * 3, 6.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = sh(c2, 0.35);
        ctx.beginPath();
        ctx.moveTo(0, 23);
        ctx.lineTo(3.5, 29);
        ctx.lineTo(0, 35);
        ctx.lineTo(-3.5, 29);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        add(ctx, () => {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(L[0] * 2.5, 29 + L[1] * 2.5, 2, 1.3, 0.5, 0, TAU);
          ctx.fill();
          // faíscas a orbitar a pedra
          for (let i = 0; i < 2; i++) {
            const a = t * 3 + i * Math.PI;
            ctx.globalAlpha = 0.6 + Math.sin(t * 6 + i) * 0.4;
            twinkle(ctx, Math.cos(a) * 11, 29 + Math.sin(a) * 5, 2.6, i ? '#fff3b0' : '#ffffff');
          }
        });
      }
      break;
    }
    case 'garra': {
      // manopla de aço articulada com garras afiadas
      ctx.beginPath();
      ctx.roundRect(-8.5, -17, 17, 17, 3);
      paint(ctx, metal(ctx, -9, 0, 9, 0, sh(c1, -0.2)), 3);
      if (!PS.F) {
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = OC();
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-8, -13 + i * 4.5);
          ctx.quadraticCurveTo(0, -11 + i * 4.5, 8, -13 + i * 4.5);
          ctx.stroke();
          ctx.strokeStyle = sh(c1, 0.5);
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(-7, -12 + i * 4.5);
          ctx.quadraticCurveTo(0, -10 + i * 4.5, 7, -12 + i * 4.5);
          ctx.stroke();
        }
      }
      for (let i = -1; i <= 1; i++) {
        const bx = i * 6;
        ctx.beginPath();
        ctx.moveTo(bx - 2.6, 9);
        ctx.quadraticCurveTo(bx + i * 2 - 1, 26, bx + i * 3.5 + 1.5, 37);
        ctx.quadraticCurveTo(bx + i * 1.5 + 2, 22, bx + 2.6, 9);
        ctx.closePath();
        paint(ctx, metal(ctx, bx - 3, 0, bx + 3, 0, c2), 2);
        if (!PS.F) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.9;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(bx - 1.2, 12);
          ctx.quadraticCurveTo(bx + i * 2 - 0.4, 25, bx + i * 3.5 + 1.2, 34);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      ctx.beginPath();
      ctx.ellipse(0, 4, 11, 10.5, 0, 0, TAU);
      paint(ctx, metal(ctx, -11, -6, 11, 14, c1), 3);
      cel(ctx, 0, 4, 11, L, 0.25, 0.7);
      if (!PS.F) {
        // rebites
        ctx.fillStyle = sh(c1, -0.5);
        for (const [rx, ry] of [[-6, 0], [6, 0], [0, 9]] as const) {
          ctx.beginPath();
          ctx.arc(rx, ry, 1.3, 0, TAU);
          ctx.fill();
        }
        // brilho que corre pelas lâminas
        const p = (t * 1.1) % 1.4;
        if (p < 1) {
          add(ctx, () => {
            const k = Math.floor(t * 1.1) % 3 - 1;
            const yy = 12 + p * 24;
            ctx.globalAlpha = Math.sin(p * Math.PI);
            twinkle(ctx, k * 6 + k * 3 * p, yy, 5, '#ffffff');
          });
        }
      }
      break;
    }
    case 'pedra': {
      seg(ctx, 0, -12, 0, 0, 15, sh(c1, -0.2));
      // pedregulho facetado: cada faceta tem luz conforme a sua orientação
      const n = 9;
      const pts: V2[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const r = 15 + hash(i * 3.1) * 5;
        pts.push([Math.cos(a) * r, 6 + Math.sin(a) * r * 1.05]);
      }
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      paint(ctx, c1, 3.5);
      if (!PS.F) {
        const cx = 1.5;
        const cy = 5;
        for (let i = 0; i < n; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % n];
          const mx = (a[0] + b[0]) / 2 - cx;
          const my = (a[1] + b[1]) / 2 - cy;
          const l = Math.hypot(mx, my) || 1;
          const lam = (mx * L[0] + my * L[1]) / l;
          ctx.fillStyle = lam > 0.35 ? sh(c1, 0.22) : lam < -0.3 ? sh(c1, -0.38) : sh(c1, -0.1);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.fill();
        }
        // musgo
        ctx.save();
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.clip();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.ellipse(-9 + L[0] * 3, -3 + L[1] * 3, 8, 5, -0.4, 0, TAU);
        ctx.ellipse(-12, 6, 4, 3, 0.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = sh(c2, 0.3);
        ctx.beginPath();
        ctx.ellipse(-9 + L[0] * 4, -4 + L[1] * 4, 4, 2, -0.4, 0, TAU);
        ctx.fill();
        ctx.restore();
        // fendas
        ctx.strokeStyle = sh(c1, -0.6);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-10, 8);
        ctx.lineTo(-2, 11);
        ctx.lineTo(2, 4);
        ctx.lineTo(11, 9);
        ctx.moveTo(2, 4);
        ctx.lineTo(4, -5);
        ctx.stroke();
        // lascas que caem
        const ph = (t * 0.9) % 1;
        const D = toLocal(ang, 0, 1);
        ctx.globalAlpha = 1 - ph;
        ctx.fillStyle = sh(c1, -0.2);
        for (let i = 0; i < 2; i++) {
          const ox = (hash(Math.floor(t * 0.9) + i) - 0.5) * 18;
          ctx.fillRect(ox + D[0] * ph * 24 - 1.2, 8 + D[1] * ph * 24 - 1.2, 2.4 + i, 2.4 + i);
        }
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'tesla': {
      ctx.beginPath();
      ctx.roundRect(-8.5, -18, 17, 18, 3);
      paint(ctx, metal(ctx, -9, 0, 9, 0, c1), 3);
      // bobinas de cobre
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.roundRect(-10.5, -16 + i * 5, 21, 3.4, 1.7);
        paint(ctx, metal(ctx, 0, -16 + i * 5, 0, -12.6 + i * 5, c3), 1.8);
      }
      fistPath(ctx, 0.92);
      paint(ctx, sh(c1, 0.1), 3);
      cel(ctx, 0, 8, 12, L, 0.32, 0.45);
      // ampola de vidro com núcleo elétrico
      ctx.beginPath();
      ctx.arc(-1, 12, 5.6, 0, TAU);
      paint(ctx, sh(c2, -0.55), 2.2);
      add(ctx, () => {
        const fl = 0.7 + Math.sin(t * 23) * 0.2 + hash(Math.floor(t * 30)) * 0.15;
        ctx.globalAlpha = fl;
        ctx.drawImage(glowSprite(c2), -24, -12, 46, 48);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-1, 12, 2.2 + fl, 0, TAU);
        ctx.fill();
        // arcos
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        const k = Math.floor(t * 18);
        for (let j = 0; j < 3; j++) {
          let px = -6 + j * 6;
          let py = 16;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(px, py);
          for (let s = 0; s < 4; s++) {
            px += (hash(k * 7 + j * 3 + s) - 0.5) * 10;
            py += 4 + hash(k + s + j) * 3;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        // arco entre bobinas
        ctx.strokeStyle = c2;
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        let px = -10;
        ctx.moveTo(px, -14 + (k % 3) * 5);
        for (let s = 1; s <= 4; s++) {
          px = -10 + s * 5;
          ctx.lineTo(px, -14 + (k % 3) * 5 + (hash(k * 3 + s) - 0.5) * 6);
        }
        ctx.stroke();
      });
      if (!PS.F) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(-3, 10, 1.3, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'fogo': {
      // punho de magma envolto em chamas que sobem sempre (o fogo segue o ecrã, não o braço)
      const ux = U[0] * 0.75;
      const uy = U[1] * 0.75 - 0.45;
      const ul = Math.hypot(ux, uy) || 1;
      const fx = ux / ul;
      const fy = uy / ul;
      add(ctx, () => {
        ctx.globalAlpha = 0.8 + Math.sin(t * 9) * 0.15;
        ctx.drawImage(glowSprite(c1), -34, -28, 68, 68);
        // camada de trás (vermelha, grande)
        for (let i = 0; i < 5; i++) {
          ctx.globalAlpha = 0.85;
          flame(ctx, -9 + i * 4.5, 6 - (i % 2) * 3, fx + (i - 2) * 0.14, fy, 36 + (i % 2) * 12, 7, '#ff2a00', c1, t, i);
        }
        // camada da frente (amarela)
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 0.9;
          flame(ctx, -5 + i * 5, 4, fx + (i - 1) * 0.2, fy, 22 + (i % 2) * 6, 5, c1, c2, t * 1.3, i + 9);
        }
      });
      // núcleo de magma: crosta escura com fendas incandescentes que pulsam
      fistPath(ctx, 0.9);
      paint(ctx, '#4a1608', 3);
      if (!PS.F) {
        ctx.save();
        fistPath(ctx, 0.9);
        ctx.clip();
        // lado quente (virado para a luz / para as chamas)
        ctx.globalAlpha = 0.9;
        ctx.drawImage(glowSprite('#ff7a00'), L[0] * 6 - 14, 7 + L[1] * 6 - 14, 28, 28);
        ctx.restore();
        add(ctx, () => {
          const pulse = 0.65 + Math.sin(t * 6) * 0.25;
          ctx.globalAlpha = pulse;
          ctx.strokeStyle = c1;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-9, 2);
          ctx.lineTo(-3, 6);
          ctx.lineTo(-5, 12);
          ctx.lineTo(1, 17);
          ctx.moveTo(-3, 6);
          ctx.lineTo(4, 4);
          ctx.lineTo(9, 9);
          ctx.moveTo(4, 4);
          ctx.lineTo(3, -1);
          ctx.moveTo(1, 17);
          ctx.lineTo(7, 15);
          ctx.stroke();
          ctx.strokeStyle = '#fff3a0';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          // brasas a subir
          for (let i = 0; i < 4; i++) {
            const ph = (t * 1.6 + i / 4) % 1;
            const k = Math.floor(t * 1.6 + i / 4);
            const ox = (hash(k * 5 + i) - 0.5) * 18;
            ctx.globalAlpha = 1 - ph;
            ctx.fillStyle = i % 2 ? c2 : '#ffffff';
            ctx.fillRect(ox + fx * ph * 38 + Math.sin(t * 7 + i) * 2, 4 + fy * ph * 38, 2.4, 2.4);
          }
        });
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(L[0] * 7, 7 + L[1] * 7, 1.6, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'gelo': {
      ctx.beginPath();
      ctx.roundRect(-7.5, -15, 15, 14, 3);
      paint(ctx, sh(c2, 0.45), 3);
      cel(ctx, 0, -8, 8, L, 0.25, 0.5, c2);
      // cristais facetados (metade clara, metade escura)
      const shards: [number, number, number, number][] = [[-9, 4, -0.5, 16], [0, 6, 0, 23], [9, 4, 0.5, 16], [-6, -4, -1.1, 13], [6, -4, 1.1, 13]];
      for (const [bx, by, a, l] of shards) {
        const tx = bx + Math.sin(a) * l;
        const ty = by + Math.cos(a) * l;
        const lx = bx - Math.cos(a) * 5;
        const ly = by + Math.sin(a) * 5;
        const rx = bx + Math.cos(a) * 5;
        const ry = by - Math.sin(a) * 5;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(tx, ty);
        ctx.lineTo(rx, ry);
        ctx.closePath();
        paint(ctx, c1, 2.2);
        if (!PS.F) {
          const lit = (lx - bx) * L[0] + (ly - by) * L[1] > 0;
          ctx.fillStyle = lit ? '#ffffff' : sh(c2, -0.1);
          ctx.globalAlpha = lit ? 0.65 : 0.45;
          ctx.beginPath();
          ctx.moveTo(lit ? lx : rx, lit ? ly : ry);
          ctx.lineTo(tx, ty);
          ctx.lineTo(bx, by);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      ctx.beginPath();
      ctx.ellipse(0, 4, 10.5, 11, 0, 0, TAU);
      paint(ctx, '#d8f6ff', 3);
      cel(ctx, 0, 4, 10.5, L, 0.22, 0.9, c2);
      if (!PS.F) {
        // facetas internas
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(-7, -2);
        ctx.lineTo(-1, 3);
        ctx.lineTo(6, -3);
        ctx.moveTo(-1, 3);
        ctx.lineTo(1, 13);
        ctx.stroke();
        ctx.globalAlpha = 1;
        add(ctx, () => {
          ctx.globalAlpha = 0.4;
          ctx.drawImage(glowSprite(c2), -24, -18, 48, 48);
          // névoa fria que cai
          const D = toLocal(ang, 0, 1);
          for (let i = 0; i < 3; i++) {
            const ph = (t * 0.7 + i / 3) % 1;
            ctx.globalAlpha = 0.4 * (1 - ph);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(Math.sin(i * 2 + t) * 9 + D[0] * ph * 20, 8 + D[1] * ph * 20, 3 + ph * 4, 0, TAU);
            ctx.fill();
          }
          // cintilações
          for (let i = 0; i < 3; i++) {
            const ph = (t * 0.9 + i * 0.37) % 1;
            const k = Math.floor(t * 0.9 + i * 0.37);
            ctx.globalAlpha = Math.sin(ph * Math.PI);
            twinkle(ctx, (hash(k * 3 + i) - 0.5) * 30, (hash(k * 7 + i) - 0.3) * 30, 3 + ph * 3, '#ffffff');
          }
        });
      }
      break;
    }
    case 'dragao': {
      seg(ctx, 0, -14, 0, -2, 16, sh(c1, -0.2));
      if (!PS.F) {
        ctx.strokeStyle = sh(c1, -0.5);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          ctx.moveTo(5, -12 + i * 4);
          ctx.arc(0, -12 + i * 4, 5, 0.3, Math.PI - 0.3);
        }
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
      paint(ctx, sh(c1, -0.15), 2.5);
      // boca a brilhar por dentro
      if (!PS.F && open > 0.3) {
        add(ctx, () => {
          ctx.globalAlpha = (open - 0.3) * 1.2;
          ctx.drawImage(glowSprite(c2), -14 - open * 3, 8, 20, 20);
          flame(ctx, -2 - open * 4, 25, -0.15, 1, 10 + open * 14, 3.5, '#ff5a00', c2, t, 4);
        });
      }
      // cabeça e focinho
      ctx.beginPath();
      ctx.moveTo(-9, -4);
      ctx.quadraticCurveTo(-12, 6, -6, 10);
      ctx.lineTo(4, 28);
      ctx.quadraticCurveTo(9, 30, 9, 24);
      ctx.quadraticCurveTo(12, 8, 10, -2);
      ctx.quadraticCurveTo(0, -10, -9, -4);
      ctx.closePath();
      paint(ctx, c1, 3);
      cel(ctx, 0, 8, 13, L, 0.32, 0.5);
      if (!PS.F) {
        // escamas e crista
        ctx.strokeStyle = sh(c1, -0.4);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 2; j++) {
            const sx = 4 + j * 3.5 - i * 0.8;
            const sy = 4 + i * 5 + j * 2;
            ctx.moveTo(sx - 2, sy);
            ctx.quadraticCurveTo(sx, sy + 2.4, sx + 2, sy);
          }
        }
        ctx.stroke();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.ellipse(8, 25, 1.2, 0.8, 0.6, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = C('#ffffff');
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-5 + i * 2.5, 12 + i * 5);
        ctx.lineTo(-8 + i * 2.5, 15 + i * 5);
        ctx.lineTo(-4 + i * 2.5, 16 + i * 5);
        ctx.fill();
      }
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sd * 6, -4);
        ctx.quadraticCurveTo(sd * 12, -14, sd * 9, -22);
        ctx.lineTo(sd * 4, -6);
        ctx.closePath();
        paint(ctx, '#f2e6d0', 2);
        if (!PS.F) {
          ctx.strokeStyle = '#b8a888';
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(sd * 6.5, -9);
          ctx.lineTo(sd * 8.5, -10);
          ctx.moveTo(sd * 7.5, -14);
          ctx.lineTo(sd * 9.5, -15);
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.ellipse(5, 4, 3.6, 2.6, 0.3, 0, TAU);
      paint(ctx, c2, 1.5);
      if (!PS.F) {
        ctx.fillStyle = '#1a1220';
        ctx.fillRect(4.5, 2.5, 1.4, 3);
        add(ctx, () => {
          ctx.globalAlpha = 0.65 + Math.sin(t * 5) * 0.2;
          ctx.drawImage(glowSprite(c2), -4, -5, 18, 18);
          for (let i = 0; i < 3; i++) {
            const ph = (t * 0.9 + i / 3) % 1;
            ctx.globalAlpha = 0.3 * (1 - ph);
            ctx.fillStyle = '#c9c3b0';
            ctx.beginPath();
            ctx.arc(6 + U[0] * ph * 22, 28 + U[1] * ph * 22, 3 + ph * 7, 0, TAU);
            ctx.fill();
          }
        });
      }
      break;
    }
    case 'mecha': {
      // pistões do pulso
      seg(ctx, -5, -18, -5, -2, 6, '#59627a');
      seg(ctx, 5, -18, 5, -4, 6, '#59627a');
      seg(ctx, 5, -16, 5, -10 + Math.sin(t * 8) * 2, 3, '#e8eef5', false);
      ctx.beginPath();
      ctx.roundRect(-13, -6, 26, 26, 6);
      paint(ctx, metal(ctx, -13, -6, 13, 20, c1), 3);
      cel(ctx, 0, 7, 14, L, 0.25, 0.5);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.roundRect(-12 + i * 6.2, 17, 5.6, 8.5, 2);
        paint(ctx, sh(c1, -0.12), 2);
        if (!PS.F) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(-11 + i * 6.2, 18.5, 1.2, 5);
        }
      }
      if (!PS.F) {
        // juntas e parafusos
        ctx.strokeStyle = sh(c1, -0.45);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-11, 6);
        ctx.lineTo(11, 6);
        ctx.moveTo(0, -5);
        ctx.lineTo(0, 6);
        ctx.stroke();
        ctx.fillStyle = sh(c1, -0.5);
        for (const [rx, ry] of [[-9.5, -2.5], [9.5, -2.5], [-9.5, 14], [9.5, 14]] as const) {
          ctx.beginPath();
          ctx.arc(rx, ry, 1.2, 0, TAU);
          ctx.fill();
        }
        add(ctx, () => {
          const on = Math.floor(t * 6) % 4;
          for (let i = 0; i < 4; i++) {
            ctx.globalAlpha = i === on ? 1 : 0.5;
            ctx.fillStyle = i === on ? '#ffffff' : c2;
            ctx.fillRect(-11 + i * 6.2, 11, 4, 2.6);
          }
          ctx.globalAlpha = 0.55 + Math.sin(t * 4) * 0.15;
          ctx.drawImage(glowSprite(c2), -16, 2, 32, 22);
          // propulsor
          ctx.globalAlpha = 0.9;
          flame(ctx, 0, -20, 0, -1, 18, 5, '#4ac8ff', '#e8ffff', t * 2, 3);
          ctx.globalAlpha = 0.6;
          ctx.drawImage(glowSprite('#4ac8ff'), -10, -30, 20, 20);
        });
        // olho vermelho de estado
        ctx.fillStyle = Math.floor(t * 2) % 2 ? c3 : sh(c3, -0.4);
        ctx.beginPath();
        ctx.arc(-6, 1, 1.8, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'sombra': {
      add(ctx, () => {
        ctx.globalAlpha = 0.55 + Math.sin(t * 3) * 0.1;
        ctx.drawImage(glowSprite(c2), -28, -22, 56, 60);
      });
      // fumo de sombra que sobe em espiral (segue o ecrã)
      if (!PS.F) {
        for (let i = 0; i < 6; i++) {
          const ph = (t * 0.8 + i / 6) % 1;
          const sw = Math.sin(t * 2.5 + i * 2.3) * (4 + ph * 6);
          const px = (i % 3 - 1) * 4 + U[0] * ph * 34 - U[1] * sw;
          const py = 4 + U[1] * ph * 34 + U[0] * sw;
          const r = 5 + ph * 7;
          ctx.globalAlpha = 0.7 * (1 - ph);
          ctx.fillStyle = i % 2 ? c1 : sh(c1, 0.12);
          ctx.beginPath();
          ctx.arc(px, py, r, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 0.5 * (1 - ph);
          ctx.strokeStyle = c2;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(px, py, r, -Math.PI * 0.9, -Math.PI * 0.4);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.ellipse(0, 4, 11, 12, 0, 0, TAU);
      paint(ctx, c1, 2.5);
      cel(ctx, 0, 4, 11, L, 0.4, 0, '#000000');
      rimLight(ctx, 0, 4, 11, L, c2, 0.8);
      for (let i = -1.5; i <= 1.5; i++) {
        const bx = i * 5;
        const sw = Math.sin(t * 4 + i) * 2;
        ctx.beginPath();
        ctx.moveTo(bx - 2.5, 12);
        ctx.quadraticCurveTo(bx + sw + i * 2, 22, bx + i * 3 + sw, 31);
        ctx.quadraticCurveTo(bx + i, 20, bx + 2.5, 12);
        paint(ctx, sh(c1, 0.15), 2);
      }
      add(ctx, () => {
        const blink = t % 2.6 < 0.12 ? 0.3 : 1;
        ctx.globalAlpha = 0.7;
        ctx.drawImage(glowSprite(c2), -10, -5, 20, 14);
        ctx.fillStyle = c2;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.ellipse(-4, 2, 2.4, 1.6 * blink, 0.3, 0, TAU);
        ctx.ellipse(4, 2, 2.4, 1.6 * blink, -0.3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-4.5, 1.5, 1, 1);
        ctx.fillRect(3.5, 1.5, 1, 1);
      });
      break;
    }
    case 'cosmico': {
      add(ctx, () => {
        ctx.globalAlpha = 0.7 + Math.sin(t * 5) * 0.2;
        ctx.drawImage(glowSprite(c2), -28, -22, 56, 56);
        for (let i = 0; i < 6; i++) {
          const ph = (t * 0.8 + i / 6) % 1;
          ctx.globalAlpha = 1 - ph;
          ctx.fillStyle = i % 2 ? '#ffffff' : c2;
          const s = 2.4 - ph;
          ctx.fillRect(Math.sin(i * 3.1) * 8 - 1 + U[0] * ph * 30, 4 + U[1] * ph * 30, s, s);
        }
      });
      // punho = janela para o espaço (campo de estrelas a deslizar)
      ctx.beginPath();
      ctx.ellipse(0, 5, 12, 12.5, 0, 0, TAU);
      paint(ctx, g.anim === 'cosmic' ? `hsl(${250 + Math.sin(t * 1.3) * 25} 70% 22%)` : c1, 3);
      if (!PS.F) {
        ctx.save();
        ctx.clip();
        const tile = starTile(c2);
        const ox = -((t * 6) % 64);
        ctx.drawImage(tile, ox - 12, -12, 64, 64);
        ctx.drawImage(tile, ox + 52, -12, 64, 64);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-L[0] * 6, 5 - L[1] * 6, 12, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
        add(ctx, () => {
          ctx.globalAlpha = 0.6;
          ctx.drawImage(glowSprite('#b05cff'), -11, -6, 22, 22);
          for (let i = 0; i < 3; i++) {
            const a = t * 2 + i * 2.1;
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5 + i);
            twinkle(ctx, Math.cos(a) * 7, 5 + Math.sin(a * 1.3) * 7, 2.2, '#ffffff');
          }
        });
        rimLight(ctx, 0, 5, 12, L, c2, 0.8);
      }
      // anel planetário (a metade de trás fica por baixo do punho? simples: desenha à frente)
      const tilt = 0.35 + Math.sin(t) * 0.1;
      ctx.beginPath();
      ctx.ellipse(0, 5, 19, 5, tilt, 0, TAU);
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = OC();
      ctx.stroke();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = C(c2);
      ctx.stroke();
      if (!PS.F) {
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 5, 17.5, 4.2, tilt, 0, TAU);
        ctx.stroke();
      }
      const ma = t * 2;
      const mx = Math.cos(ma) * 19;
      const my = Math.sin(ma) * 5;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      ctx.beginPath();
      ctx.arc(mx * ct - my * st, 5 + mx * st + my * ct, 3, 0, TAU);
      paint(ctx, '#ffd23d', 2);
      add(ctx, () => {
        ctx.globalAlpha = 0.8;
        ctx.drawImage(glowSprite('#ffd23d'), mx * ct - my * st - 7, 5 + mx * st + my * ct - 7, 14, 14);
      });
      break;
    }
    case 'sol': {
      add(ctx, () => {
        ctx.globalAlpha = 0.9;
        ctx.drawImage(glowSprite(c1), -38, -32, 76, 76);
        // coroa: raios cónicos que rodam e pulsam
        ctx.fillStyle = c2;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU + t * 0.8;
          const l = 21 + (i % 2) * 8 + Math.sin(t * 6 + i * 1.7) * 3;
          const w = 0.16;
          ctx.moveTo(Math.cos(a - w) * 12, 6 + Math.sin(a - w) * 12);
          ctx.lineTo(Math.cos(a) * l, 6 + Math.sin(a) * l);
          ctx.lineTo(Math.cos(a + w) * 12, 6 + Math.sin(a + w) * 12);
          ctx.closePath();
        }
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 6, 16 + Math.sin(t * 5) * 1.5, 0, TAU);
        ctx.stroke();
        // proeminências solares (arcos)
        ctx.strokeStyle = '#ff7a00';
        ctx.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          const a = t * 0.6 + i * Math.PI;
          const h = 5 + Math.sin(t * 2 + i) * 2;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 14, 6 + Math.sin(a) * 14, h, a - Math.PI / 2, a + Math.PI / 2);
          ctx.stroke();
        }
        for (let i = 0; i < 2; i++) {
          ctx.globalAlpha = 0.8;
          flame(ctx, -6 + i * 12, -2, U[0] + (i - 0.5) * 0.4, U[1], 20, 5, '#ff7a00', '#fff6b0', t, i + 7);
        }
      });
      ctx.beginPath();
      ctx.arc(0, 6, 13, 0, TAU);
      paint(ctx, '#ffc21a', 3);
      if (!PS.F) {
        // granulação do plasma a rodar
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#ff8a00';
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = t * 0.9 + i * 1.05;
          const r = 4 + (i % 3) * 3;
          const px = Math.cos(a) * r;
          const py = 6 + Math.sin(a) * r;
          ctx.moveTo(px + 2.6, py);
          ctx.arc(px, py, 2.6, 0, TAU);
        }
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      add(ctx, () => {
        ctx.globalAlpha = 0.85 + Math.sin(t * 7) * 0.15;
        ctx.fillStyle = '#fffbe0';
        ctx.beginPath();
        ctx.arc(L[0] * 2, 6 + L[1] * 2, 7, 0, TAU);
        ctx.fill();
      });
      break;
    }
    default:
      boxGlove(ctx, c1, c2, false, t, L);
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
  // sola
  seg(ctx, fx - Math.cos(ang) * 6 + sx, fy + Math.sin(ang) * 6 + sy, tx + sx * 0.6, ty + sy * 0.6, big ? 6 : 4, big ? '#59627a' : '#e8e4dc', false);
  if (!PS.F) {
    // brilho do couro / metal ao longo do cano (lado da luz: para a frente e para cima)
    const dx = fx - bx;
    const dy = fy - by;
    const l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l;
    let ny = dx / l;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const o = big ? 6.5 : 5.5;
    ctx.globalAlpha = big ? 0.6 : 0.35;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = big ? 2.6 : 2;
    ctx.beginPath();
    ctx.moveTo(bx + dx * 0.2 + nx * o, by + dy * 0.2 + ny * o);
    ctx.lineTo(bx + dx * 0.8 + nx * o, by + dy * 0.8 + ny * o);
    ctx.stroke();
    // biqueira
    ctx.globalAlpha = big ? 0.55 : 0.3;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(fx + (tx - fx) * 0.35 + nx * 3.5, fy + (ty - fy) * 0.35 + ny * 3.5 - 1);
    ctx.lineTo(fx + (tx - fx) * 0.75 + nx * 3, fy + (ty - fy) * 0.75 + ny * 3 - 1);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (!PS.F && !big) {
    // atacadores cruzados
    ctx.strokeStyle = sh(color, 0.5);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const u = 0.22 + i * 0.22;
      const lx = bx + (fx - bx) * u;
      const ly = by + (fy - by) * u;
      const u2 = u + 0.11;
      const mx = bx + (fx - bx) * u2;
      const my = by + (fy - by) * u2;
      ctx.moveTo(lx + Math.cos(ang) * 3, ly - Math.sin(ang) * 3);
      ctx.lineTo(mx + Math.cos(ang) * 9, my - Math.sin(ang) * 9);
      ctx.moveTo(lx + Math.cos(ang) * 9, ly - Math.sin(ang) * 9);
      ctx.lineTo(mx + Math.cos(ang) * 3, my - Math.sin(ang) * 3);
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  seg(ctx, bx, by, bx + (fx - bx) * 0.14, by + (fy - by) * 0.14, big ? 22 : 19, sh(color, big ? -0.25 : 0.3), false);
  ctx.lineCap = 'round';
  if (big && !PS.F) {
    // rebites da bota metálica
    ctx.fillStyle = sh(color, -0.45);
    for (const u of [0.35, 0.7]) {
      ctx.beginPath();
      ctx.arc(bx + (fx - bx) * u, by + (fy - by) * u, 1.5, 0, TAU);
      ctx.fill();
    }
  }
}
