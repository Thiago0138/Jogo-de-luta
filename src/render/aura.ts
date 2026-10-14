import type { Vis } from '../data/items';
import { flame } from './costume';
import { PS, TAU, circle, glowSprite, hash } from './paint';
import { J_HIP, J_NECK, type Skel } from './pose';

/**
 * Auras: efeito à volta do lutador (lutas e menus) e cenário de fundo animado nos menus.
 */

function add(ctx: CanvasRenderingContext2D, f: () => void) {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  f();
  ctx.globalCompositeOperation = prev;
  ctx.globalAlpha = 1;
}

/** Aura em volta do corpo, centrada no tronco e alinhada com ele (deitado, a aura deita-se também). */
export function drawAura(ctx: CanvasRenderingContext2D, a: Vis, s: Skel, t: number, low: boolean) {
  if (PS.F) return;
  const c1 = a.c1 ?? '#fff';
  const c2 = a.c2 ?? '#fff';
  const cx = (s.x[J_HIP] + s.x[J_NECK]) / 2;
  const cy = (s.y[J_HIP] + s.y[J_NECK]) / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(s.torsoA - s.torsoA * 0.0);
  const n = low ? 6 : 14;
  const pulse = 0.55 + Math.sin(t * 3) * 0.12;
  if (a.type !== 'sombra') {
    add(ctx, () => {
      ctx.globalAlpha = pulse * 0.5;
      ctx.drawImage(glowSprite(c1), -95, -120, 190, 230);
    });
  }
  switch (a.type) {
    case 'holofotes':
      add(ctx, () => {
        for (let i = 0; i < 2; i++) {
          const sw = Math.sin(t * 0.9 + i * 2.5) * 30;
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = i ? c2 : c1;
          ctx.beginPath();
          ctx.moveTo(sw - 10, -200);
          ctx.lineTo(sw + 10, -200);
          ctx.lineTo(sw * 0.3 + 55, 110);
          ctx.lineTo(sw * 0.3 - 55, 110);
          ctx.fill();
        }
      });
      break;
    case 'neon': {
      add(ctx, () => {
        const h = (t * 60) % 360;
        ctx.lineWidth = 3;
        for (let i = 0; i < 2; i++) {
          ctx.globalAlpha = 0.55 - i * 0.2;
          ctx.strokeStyle = i ? c2 : c1;
          ctx.beginPath();
          ctx.ellipse(0, 110, 70 + i * 16 + Math.sin(t * 4 + i) * 4, 13 + i * 3, 0, 0, TAU);
          ctx.stroke();
        }
        for (let i = 0; i < n / 2; i++) {
          const ph = (t * 0.7 + hash(i)) % 1;
          ctx.globalAlpha = (1 - ph) * 0.8;
          ctx.fillStyle = `hsl(${(h + i * 40) % 360} 100% 65%)`;
          const x = (hash(i + 4) - 0.5) * 120;
          ctx.fillRect(x - 1, 100 - ph * 200, 2, 14);
        }
      });
      break;
    }
    case 'faiscas':
      add(ctx, () => {
        for (let i = 0; i < n; i++) {
          const ph = (t * 0.6 + hash(i)) % 1;
          const x = (hash(i + 9) - 0.5) * 120 + Math.sin(t * 3 + i) * 8;
          const y = 100 - ph * 220;
          const sz = 3 * (1 - ph) + 1;
          ctx.globalAlpha = 1 - ph;
          ctx.fillStyle = i % 2 ? c1 : c2;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(t * 3 + i);
          ctx.fillRect(-sz, -sz * 0.3, sz * 2, sz * 0.6);
          ctx.fillRect(-sz * 0.3, -sz, sz * 0.6, sz * 2);
          ctx.restore();
        }
      });
      break;
    case 'petalas':
      for (let i = 0; i < n; i++) {
        const ph = (t * 0.22 + hash(i)) % 1;
        const x = (hash(i + 3) - 0.5) * 160 + Math.sin(t * 2 + i * 2) * 20;
        const y = -130 + ph * 250;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 2 + i);
        ctx.scale(1, 0.4 + Math.abs(Math.sin(t * 3 + i)) * 0.6);
        ctx.globalAlpha = Math.sin(ph * Math.PI);
        ctx.fillStyle = i % 3 ? c1 : c2;
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.quadraticCurveTo(6, -2, 0, 6);
        ctx.quadraticCurveTo(-6, -2, 0, -5);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      break;
    case 'chamas':
      add(ctx, () => {
        for (let i = 0; i < n; i++) {
          const x = (hash(i + 5) - 0.5) * 110;
          const ph = (t * 1.1 + hash(i)) % 1;
          ctx.globalAlpha = 0.7 * (1 - ph * 0.6);
          flame(ctx, x, 100 - ph * 40, 0, -1, 70 + hash(i + 1) * 60, 9 + hash(i + 2) * 6, i % 2 ? c1 : '#ff2a00', c2, t, i);
        }
      });
      break;
    case 'raio': {
      add(ctx, () => {
        const k = Math.floor(t * 12);
        ctx.lineWidth = 2.5;
        for (let j = 0; j < 3; j++) {
          if (hash(k + j * 31) < 0.5) continue;
          let x = (hash(k * 3 + j) - 0.5) * 120;
          let y = -120 + hash(k * 7 + j) * 30;
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = c2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let q = 0; q < 7; q++) {
            x += (hash(k * 13 + q + j * 5) - 0.5) * 40;
            y += 32;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 7;
          ctx.strokeStyle = c1;
          ctx.stroke();
          ctx.lineWidth = 2.5;
        }
        for (let i = 0; i < n / 2; i++) {
          const ang = t * 4 + i * 1.3;
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = c1;
          ctx.fillRect(Math.cos(ang) * 62 - 2, Math.sin(ang * 1.7) * 90 - 2, 4, 4);
        }
      });
      break;
    }
    case 'aurora':
      add(ctx, () => {
        for (let b = 0; b < 3; b++) {
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = b % 2 ? c2 : c1;
          ctx.beginPath();
          for (let i = 0; i <= 12; i++) {
            const y = -130 + i * 20;
            const x = -60 + b * 40 + Math.sin(t * 1.5 + i * 0.6 + b) * 18;
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          for (let i = 12; i >= 0; i--) {
            const y = -130 + i * 20;
            const x = -48 + b * 40 + Math.sin(t * 1.5 + i * 0.6 + b + 0.6) * 18;
            ctx.lineTo(x, y);
          }
          ctx.fill();
        }
      });
      break;
    case 'sombra': {
      for (let i = 0; i < n; i++) {
        const ph = (t * 0.4 + hash(i)) % 1;
        const x = (hash(i + 7) - 0.5) * 130 + Math.sin(t + i) * 10;
        const y = 100 - ph * 210;
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.5;
        ctx.fillStyle = i % 2 ? c1 : '#000000';
        ctx.beginPath();
        ctx.arc(x, y, 24 * (1 - ph * 0.5), 0, TAU);
        ctx.fill();
      }
      // tentáculos
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const sx = -50 + i * 50;
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = '#120420';
        ctx.lineWidth = 9 - i;
        ctx.beginPath();
        ctx.moveTo(sx, 110);
        ctx.bezierCurveTo(sx + Math.sin(t * 2 + i) * 30, 50, sx - Math.sin(t * 1.6 + i) * 30, 0, sx + Math.sin(t * 2.3 + i) * 20, -40 - i * 10);
        ctx.stroke();
      }
      add(ctx, () => {
        ctx.globalAlpha = 0.8;
        for (let i = 0; i < 5; i++) {
          const ph = (t * 0.7 + hash(i + 40)) % 1;
          ctx.fillStyle = c2;
          ctx.fillRect((hash(i + 50) - 0.5) * 110, 100 - ph * 200, 3, 3);
        }
      });
      break;
    }
    case 'cosmos': {
      add(ctx, () => {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = c2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(0, -10, 88, 22, -0.25, 0, TAU);
        ctx.stroke();
        for (let i = 0; i < n; i++) {
          const ang = t * (0.8 + hash(i) * 0.6) + i * 2.1;
          const rx = 60 + hash(i + 2) * 40;
          const x = Math.cos(ang) * rx;
          const y = -10 + Math.sin(ang) * rx * 0.3 - x * 0.25;
          const tw = 0.5 + Math.sin(t * 6 + i) * 0.5;
          ctx.globalAlpha = 0.5 + tw * 0.5;
          ctx.fillStyle = i % 3 ? '#ffffff' : c1;
          const sz = 1.5 + tw * 2;
          ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
      });
      const pa = t * 0.9;
      circle(ctx, Math.cos(pa) * 92, -10 + Math.sin(pa) * 25 - Math.cos(pa) * 22, 6, c1, false);
      break;
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ───────────────────────── Cenários de fundo (menus) ─────────────────────────

function vgrad(ctx: CanvasRenderingContext2D, H: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (const [k, c] of stops) g.addColorStop(k, c);
  return g;
}

function stars(ctx: CanvasRenderingContext2D, W: number, H: number, n: number, t: number, maxY = 1) {
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    const x = hash(i * 1.7) * W;
    const y = hash(i * 2.3 + 5) * H * maxY;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (1 + hash(i) * 2) + i));
    ctx.globalAlpha = tw;
    const s = hash(i + 9) < 0.15 ? 2 : 1.2;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

/**
 * Cenário completo atrás do lutador nos menus. `fy` é a altura do chão (onde estão os pés),
 * `k` é a escala do lutador (para dimensionar os elementos).
 */
export function drawBackdrop(ctx: CanvasRenderingContext2D, a: Vis | null, W: number, H: number, t: number, fy: number, k: number) {
  const cx = W / 2;
  const type = a?.type ?? '';
  const c1 = a?.c1 ?? '#7a5cff';
  const c2 = a?.c2 ?? '#ffffff';
  ctx.save();
  switch (type) {
    case 'holofotes': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#0c0f1c'], [0.7, '#161a2e'], [1, '#07080f']]);
      ctx.fillRect(0, 0, W, H);
      add(ctx, () => {
        for (let i = 0; i < 3; i++) {
          const ox = W * (0.15 + i * 0.35);
          const tx = cx + Math.sin(t * 0.7 + i * 2.1) * W * 0.35;
          ctx.globalAlpha = 0.13;
          ctx.fillStyle = i === 1 ? c2 : c1;
          ctx.beginPath();
          ctx.moveTo(ox - 8, -10);
          ctx.lineTo(ox + 8, -10);
          ctx.lineTo(tx + W * 0.16, fy + 10);
          ctx.lineTo(tx - W * 0.16, fy + 10);
          ctx.fill();
          ctx.globalAlpha = 0.25;
          ctx.drawImage(glowSprite(c2), tx - W * 0.2, fy - H * 0.05, W * 0.4, H * 0.1);
        }
        // poeira no ar
        for (let i = 0; i < 26; i++) {
          const x = (hash(i) * W + t * 6 * (hash(i + 3) - 0.5) * 4 + W) % W;
          const y = (hash(i + 7) * H * 0.9 - t * 4) % H;
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, (y + H) % H, 1.5, 1.5);
        }
      });
      // silhuetas do público
      ctx.fillStyle = '#05060b';
      for (let i = 0; i < 14; i++) {
        const x = (i / 13) * W;
        const r = (16 + hash(i) * 8) * k;
        const bob = Math.abs(Math.sin(t * 3 + i)) * 4 * k;
        ctx.beginPath();
        ctx.arc(x, H - r * 0.6 - bob, r * 0.55, 0, TAU);
        ctx.fill();
        ctx.fillRect(x - r * 0.8, H - r * 0.3 - bob, r * 1.6, r * 2);
      }
      break;
    }
    case 'neon': {
      const hz = fy - H * 0.12;
      ctx.fillStyle = vgrad(ctx, hz, [[0, '#12052e'], [0.6, '#5a0f6e'], [1, '#ff4f8b']]);
      ctx.fillRect(0, 0, W, hz);
      stars(ctx, W, hz, 30, t, 0.6);
      // sol às riscas
      const sr = Math.min(W, H) * 0.26;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, hz);
      ctx.clip();
      const sg = ctx.createLinearGradient(0, hz - sr * 1.6, 0, hz);
      sg.addColorStop(0, '#ffe45c');
      sg.addColorStop(1, '#ff2f8f');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, hz - sr * 0.35, sr, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5a0f6e';
      for (let i = 0; i < 6; i++) {
        const y = hz - sr * 0.35 + i * sr * 0.14 + ((t * 8) % (sr * 0.14));
        ctx.fillRect(0, y, W, 2 + i * 1.2);
      }
      ctx.restore();
      // montanhas
      ctx.fillStyle = '#1b0630';
      ctx.beginPath();
      ctx.moveTo(0, hz);
      for (let i = 0; i <= 10; i++) ctx.lineTo((i / 10) * W, hz - (i % 2 ? 0.06 : 0.14) * H * (0.6 + hash(i) * 0.6));
      ctx.lineTo(W, hz);
      ctx.fill();
      // grelha
      ctx.fillStyle = '#12021f';
      ctx.fillRect(0, hz, W, H - hz);
      add(ctx, () => {
        ctx.strokeStyle = c1;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        for (let i = -10; i <= 10; i++) {
          ctx.moveTo(cx + i * W * 0.04, hz);
          ctx.lineTo(cx + i * W * 0.22, H);
        }
        const off = (t * 0.6) % 1;
        for (let j = 0; j < 8; j++) {
          const q = Math.pow((j + off) / 8, 2);
          const y = hz + q * (H - hz);
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = c2;
        ctx.beginPath();
        ctx.moveTo(0, hz);
        ctx.lineTo(W, hz);
        ctx.stroke();
      });
      break;
    }
    case 'faiscas': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#1a1006'], [0.6, '#3a2208'], [1, '#120a03']]);
      ctx.fillRect(0, 0, W, H);
      add(ctx, () => {
        for (let i = 0; i < 16; i++) {
          const x = hash(i * 3.3) * W;
          const y = hash(i * 5.1) * H * 0.8;
          const r = (14 + hash(i) * 30) * k;
          ctx.globalAlpha = 0.12 + 0.08 * Math.sin(t + i);
          ctx.drawImage(glowSprite(i % 2 ? c1 : '#ff9a3d'), x - r, y - r, r * 2, r * 2);
        }
        for (let i = 0; i < 40; i++) {
          const ph = (t * (0.15 + hash(i) * 0.2) + hash(i + 2)) % 1;
          const x = hash(i + 11) * W + Math.sin(t * 2 + i) * 10;
          const y = H - ph * H * 1.1;
          ctx.globalAlpha = (1 - ph) * 0.9;
          ctx.fillStyle = i % 3 ? c1 : c2;
          ctx.fillRect(x, y, 2.2, 2.2);
        }
      });
      break;
    }
    case 'petalas': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#2a1a4a'], [0.55, '#a8507e'], [1, '#ffb3c9']]);
      ctx.fillRect(0, 0, W, H);
      add(ctx, () => {
        ctx.globalAlpha = 0.9;
        ctx.drawImage(glowSprite('#fff2e0'), W * 0.62, H * 0.06, W * 0.34, W * 0.34);
      });
      ctx.fillStyle = '#fff6ec';
      ctx.beginPath();
      ctx.arc(W * 0.79, H * 0.06 + W * 0.17, W * 0.07, 0, TAU);
      ctx.fill();
      // monte distante
      ctx.fillStyle = '#7a3a64';
      ctx.beginPath();
      ctx.moveTo(0, fy);
      ctx.quadraticCurveTo(W * 0.3, fy - H * 0.22, W * 0.55, fy - H * 0.08);
      ctx.quadraticCurveTo(W * 0.8, fy - H * 0.18, W, fy - H * 0.05);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.fill();
      // ramos de cerejeira
      for (const [sx, dir] of [[0, 1], [W, -1]] as const) {
        ctx.strokeStyle = '#2a1420';
        ctx.lineCap = 'round';
        ctx.lineWidth = 7 * k;
        ctx.beginPath();
        ctx.moveTo(sx, H * 0.12);
        ctx.quadraticCurveTo(sx + dir * W * 0.2, H * 0.1, sx + dir * W * 0.32, H * 0.2);
        ctx.stroke();
        ctx.lineWidth = 3.5 * k;
        ctx.beginPath();
        ctx.moveTo(sx + dir * W * 0.14, H * 0.11);
        ctx.quadraticCurveTo(sx + dir * W * 0.2, H * 0.02, sx + dir * W * 0.28, H * 0.04);
        ctx.stroke();
        for (let i = 0; i < 18; i++) {
          const x = sx + dir * hash(i + (dir > 0 ? 0 : 50)) * W * 0.34;
          const y = H * (0.02 + hash(i * 1.9 + (dir > 0 ? 3 : 70)) * 0.2);
          ctx.fillStyle = i % 3 ? c1 : c2;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(x, y, (5 + hash(i + 4) * 6) * k, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // pétalas a cair
      for (let i = 0; i < 30; i++) {
        const ph = (t * (0.05 + hash(i) * 0.05) + hash(i + 1)) % 1;
        const x = (hash(i + 2) * W + Math.sin(t + i) * 30 + ph * W * 0.3) % W;
        const y = ph * H;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 2 + i);
        ctx.scale(k, k * (0.4 + Math.abs(Math.sin(t * 2 + i)) * 0.6));
        ctx.fillStyle = i % 3 ? c1 : c2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 3, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'chamas': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#120302'], [0.6, '#3a0a04'], [1, '#6a1806']]);
      ctx.fillRect(0, 0, W, H);
      add(ctx, () => {
        ctx.globalAlpha = 0.5;
        ctx.drawImage(glowSprite('#ff5a00'), -W * 0.2, fy - H * 0.5, W * 1.4, H * 0.9);
        for (let i = 0; i < 16; i++) {
          const x = (i / 15) * W;
          ctx.globalAlpha = 0.42;
          flame(ctx, x, fy + 14 * k, 0, -1, (H * 0.18 + hash(i) * H * 0.22), (14 + hash(i + 3) * 10) * k, i % 2 ? c1 : '#ff2a00', '#ff9a1a', t, i);
        }
        for (let i = 0; i < 30; i++) {
          const ph = (t * (0.2 + hash(i) * 0.2) + hash(i + 2)) % 1;
          ctx.globalAlpha = 1 - ph;
          ctx.fillStyle = i % 2 ? c2 : '#ff7a1a';
          ctx.fillRect(hash(i + 5) * W + Math.sin(t * 3 + i) * 12, fy - ph * H, 2.5, 2.5);
        }
      });
      break;
    }
    case 'raio': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#060a16'], [0.6, '#141f38'], [1, '#0a0f1c']]);
      ctx.fillRect(0, 0, W, H);
      const k2 = Math.floor(t * 1.4);
      const flash = hash(k2) > 0.55 ? Math.max(0, 1 - ((t * 1.4) % 1) * 5) : 0;
      if (flash > 0) {
        ctx.fillStyle = `rgba(170,210,255,${flash * 0.35})`;
        ctx.fillRect(0, 0, W, H);
        add(ctx, () => {
          let x = W * (0.15 + hash(k2 + 3) * 0.7);
          let y = 0;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.globalAlpha = flash;
          ctx.beginPath();
          ctx.moveTo(x, y);
          while (y < fy) {
            x += (hash(x + y) - 0.5) * 50 * k;
            y += 26 * k;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.lineWidth = 10;
          ctx.strokeStyle = c1;
          ctx.globalAlpha = flash * 0.4;
          ctx.stroke();
        });
      }
      // nuvens
      for (let i = 0; i < 9; i++) {
        const x = ((hash(i) * W * 1.4 + t * 8 * (1 + hash(i + 1))) % (W * 1.4)) - W * 0.2;
        const y = H * (0.02 + hash(i + 4) * 0.18);
        const r = (40 + hash(i + 2) * 50) * k;
        ctx.fillStyle = flash > 0 ? '#3a4a70' : '#1c2742';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.45, 0, 0, TAU);
        ctx.ellipse(x + r * 0.6, y + r * 0.1, r * 0.7, r * 0.35, 0, 0, TAU);
        ctx.fill();
      }
      // chuva
      ctx.strokeStyle = '#9ab8ff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      for (let i = 0; i < 60; i++) {
        const x = (hash(i) * W + t * 120) % W;
        const y = (hash(i + 7) * H + t * 600 * (0.8 + hash(i) * 0.4)) % H;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + 14);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'aurora': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#020814'], [0.7, '#0b1a33'], [1, '#13284a']]);
      ctx.fillRect(0, 0, W, H);
      stars(ctx, W, H, 60, t, 0.7);
      add(ctx, () => {
        for (let b = 0; b < 4; b++) {
          const g = ctx.createLinearGradient(0, H * 0.05, 0, H * 0.55);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(0.5, b % 2 ? c2 : c1);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = g;
          ctx.beginPath();
          for (let i = 0; i <= 16; i++) {
            const x = (i / 16) * W;
            const y = H * (0.12 + b * 0.05) + Math.sin(t * 0.8 + i * 0.5 + b * 1.7) * H * 0.05;
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          for (let i = 16; i >= 0; i--) {
            const x = (i / 16) * W;
            const y = H * (0.42 + b * 0.04) + Math.sin(t * 0.6 + i * 0.4 + b) * H * 0.04;
            ctx.lineTo(x, y);
          }
          ctx.fill();
        }
      });
      // montanhas nevadas
      for (const [base, col, amp] of [[fy - H * 0.04, '#1a2c4a', 0.22], [fy + H * 0.02, '#0e1a30', 0.12]] as const) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let i = 0; i <= 8; i++) ctx.lineTo((i / 8) * W, base - (i % 2 ? amp : amp * 0.3) * H * (0.6 + hash(i + amp * 10) * 0.6));
        ctx.lineTo(W, H);
        ctx.fill();
      }
      break;
    }
    case 'sombra': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#050208'], [0.6, '#140620'], [1, '#05010a']]);
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 14; i++) {
        const a0 = t * 0.2 + i * 0.9;
        const r = (W * 0.25 + hash(i) * W * 0.3);
        const x = cx + Math.cos(a0) * r;
        const y = H * 0.45 + Math.sin(a0) * r * 0.5;
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = i % 2 ? c1 : '#000000';
        ctx.beginPath();
        ctx.arc(x, y, (40 + hash(i + 3) * 50) * k, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // tentáculos do chão
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const sx = (i / 5) * W;
        ctx.strokeStyle = '#0b0214';
        ctx.lineWidth = (16 - (i % 3) * 3) * k;
        ctx.beginPath();
        ctx.moveTo(sx, H);
        ctx.bezierCurveTo(sx + Math.sin(t + i) * 40 * k, H * 0.75, sx - Math.sin(t * 0.8 + i) * 50 * k, H * 0.6, sx + Math.sin(t * 1.2 + i) * 30 * k, H * (0.42 + hash(i) * 0.15));
        ctx.stroke();
      }
      // olhos no escuro
      add(ctx, () => {
        for (let i = 0; i < 6; i++) {
          const x = hash(i * 4.1) * W;
          const y = H * (0.1 + hash(i * 2.7) * 0.4);
          if (Math.abs(x - cx) < W * 0.18) continue;
          const blink = (t + hash(i) * 5) % 4 < 0.15 ? 0.15 : 1;
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = c2;
          const s = 3 * k;
          ctx.beginPath();
          ctx.ellipse(x - s * 2, y, s, s * 0.6 * blink, 0.2, 0, TAU);
          ctx.ellipse(x + s * 2, y, s, s * 0.6 * blink, -0.2, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 0.3;
          ctx.drawImage(glowSprite(c2), x - s * 8, y - s * 5, s * 16, s * 10);
        }
      });
      break;
    }
    case 'cosmos': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#03010c'], [1, '#0b0626']]);
      ctx.fillRect(0, 0, W, H);
      stars(ctx, W, H, 80, t);
      add(ctx, () => {
        ctx.globalAlpha = 0.35;
        ctx.drawImage(glowSprite(c1), -W * 0.1, H * 0.05, W * 0.8, H * 0.5);
        ctx.globalAlpha = 0.25;
        ctx.drawImage(glowSprite(c2), W * 0.4, H * 0.3, W * 0.7, H * 0.5);
        // galáxia em espiral
        const gx = cx;
        const gy = H * 0.32;
        for (let i = 0; i < 160; i++) {
          const arm = i % 2;
          const r = (i / 160) * W * 0.42;
          const a = r * 0.03 / k + arm * Math.PI + t * 0.08;
          const x = gx + Math.cos(a) * r + (hash(i) - 0.5) * 10 * k;
          const y = gy + Math.sin(a) * r * 0.35 + (hash(i + 1) - 0.5) * 6 * k;
          ctx.globalAlpha = 0.7 * (1 - i / 200);
          ctx.fillStyle = i % 5 ? '#d8d0ff' : c2;
          ctx.fillRect(x, y, 1.6, 1.6);
        }
        ctx.globalAlpha = 0.7;
        ctx.drawImage(glowSprite('#fff4d0'), gx - 22 * k, gy - 12 * k, 44 * k, 24 * k);
        // estrela cadente
        const ph = (t * 0.35) % 1;
        if (ph < 0.3) {
          const sx = W * (1.1 - ph * 3);
          const sy = H * (0.05 + ph * 0.6);
          ctx.globalAlpha = 1 - ph / 0.3;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + 60 * k, sy - 20 * k);
          ctx.stroke();
        }
      });
      // planeta com anel
      const px = W * 0.16;
      const py = H * 0.62;
      const pr = 26 * k;
      const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
      pg.addColorStop(0, '#ffb36a');
      pg.addColorStop(1, '#7a2a50');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ffd8a8';
      ctx.lineWidth = 3 * k;
      ctx.beginPath();
      ctx.ellipse(px, py, pr * 1.8, pr * 0.45, -0.3, 0, TAU);
      ctx.stroke();
      break;
    }
    default: {
      const g = ctx.createRadialGradient(cx, fy - H * 0.3, 10, cx, fy - H * 0.3, Math.max(W, H) * 0.75);
      g.addColorStop(0, '#2c2160');
      g.addColorStop(0.6, '#151032');
      g.addColorStop(1, '#0a0818');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      add(ctx, () => {
        ctx.globalAlpha = 0.35;
        ctx.drawImage(glowSprite(c1), cx - W * 0.45, fy - H * 0.12, W * 0.9, H * 0.24);
      });
    }
  }
  // chão / vinheta
  ctx.globalAlpha = 1;
  const vg = ctx.createRadialGradient(cx, H * 0.5, Math.min(W, H) * 0.3, cx, H * 0.5, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(cx, fy, 52 * k, 10 * k, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}
