import { locomotion, type AnimName } from '../../../fight/anims';
import { G, STATIONS, type StationId } from '../../../core/gymStore';
import { Rig, drawBarbell, drawHeavyBag, drawPad, drawSpeedBag, gymBackdrop, outlined, rr, shadow, star } from './kit';

/**
 * Cena do ginásio: as quatro estações e o lutador do jogador, que caminha até à escolhida.
 * Só anima enquanto o canvas estiver na página e não houver um mini-jogo aberto.
 */
export class HubScene {
  canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private rig = new Rig();
  private W = 0;
  private H = 0;
  private dpr = 1;
  private x = -1;
  private facing: 1 | -1 = 1;
  private walk = 0;
  private sel: number;
  private idleT = 0;
  private bagAng = 0;
  private bagV = 0;
  private spAng = 0;
  private spV = 0;
  private padRot = 0;
  private padV = 0.8;
  private last = performance.now();

  constructor(sel: StationId) {
    this.canvas.className = 'gym-hub';
    this.sel = Math.max(0, STATIONS.findIndex((s) => s.id === sel));
    requestAnimationFrame(this.tick);
  }

  select(id: StationId): void {
    this.sel = Math.max(0, STATIONS.findIndex((s) => s.id === id));
  }

  private sx(i: number): number {
    return this.W * (0.125 + i * 0.25);
  }

  private get sc(): number {
    return Rig.scaleFor(this.H * 0.56);
  }

  /** Onde o lutador fica em cada estação. */
  private spot(i: number): number {
    const sc = this.sc;
    return this.sx(i) - (i === 2 ? 0 : 52 * sc);
  }

  private tick = (now: number): void => {
    if (!this.canvas.isConnected) return;
    requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (document.hidden || document.querySelector('.gym-play')) return;
    const c = this.canvas;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w !== this.W || h !== this.H || dpr !== this.dpr) {
      this.W = w;
      this.H = h;
      this.dpr = dpr;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      if (this.x < 0) this.x = this.spot(this.sel);
    }
    this.update(dt, now / 1000);
    this.draw(now / 1000);
  };

  private update(dt: number, t: number): void {
    const target = this.spot(this.sel);
    const d = target - this.x;
    const r = this.rig;
    const sc = this.sc;
    if (Math.abs(d) > 2) {
      const v = Math.sign(d) * Math.min(Math.abs(d), 260 * sc * dt * 1.6);
      this.x += v;
      this.facing = d > 0 ? 1 : -1;
      this.walk += dt * 11;
      r.anim = 'guard';
      r.post = (p) => {
        locomotion(p, this.walk, true, false);
      };
      this.idleT = 0.5;
    } else {
      this.x = target;
      this.facing = 1;
      if (this.sel === 2) {
        // na prensa: curl com halteres enquanto espera
        r.post = (p, tt) => {
          const c = (Math.sin(tt * 3) + 1) / 2;
          p.fa1 = 0.25;
          p.fa2 = 0.4 + c * 2.1;
          p.ba1 = 0.3;
          p.ba2 = 0.4 + (1 - c) * 2.1;
        };
        if (r.anim !== 'guard') r.play('guard');
      } else {
        r.post = null;
        this.idleT -= dt;
        if (this.idleT <= 0) {
          const id = STATIONS[this.sel].id;
          const moves: AnimName[] = id === 'speed' ? ['jab', 'cross'] : ['jab', 'cross', 'hook'];
          r.play(moves[Math.floor(Math.random() * moves.length)]);
          this.idleT = id === 'speed' ? 0.42 : 1.3 + Math.random() * 0.8;
          setTimeout(() => {
            if (id === 'bag') this.bagV += 1.6;
            else if (id === 'speed') this.spV += 18 * (Math.random() < 0.5 ? 1 : -1);
            else this.padV += 4;
          }, 160);
        }
      }
    }
    this.bagV += (-12 * this.bagAng - this.bagV * 1.8) * dt;
    this.bagAng += this.bagV * dt;
    this.spV += (-260 * this.spAng - this.spV * 7) * dt;
    this.spAng += this.spV * dt;
    this.padV += (0.8 - this.padV) * dt * 1.5;
    this.padRot += this.padV * dt;
    r.update(dt, t);
  }

  private draw(t: number): void {
    const { W, H, dpr, ctx } = this;
    const sc = this.sc;
    const floorY = Math.round(H * 0.84);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(gymBackdrop(W, H, floorY, dpr), 0, 0, W, H);
    // luz sobre a estação escolhida
    const lx = this.sx(this.sel);
    const g = ctx.createLinearGradient(0, 0, 0, floorY);
    g.addColorStop(0, 'rgba(255,220,120,0.32)');
    g.addColorStop(1, 'rgba(255,220,120,0.04)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(lx - W * 0.03, 0);
    ctx.lineTo(lx + W * 0.03, 0);
    ctx.lineTo(lx + W * 0.11, floorY + 8);
    ctx.lineTo(lx - W * 0.11, floorY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,120,0.16)';
    ctx.beginPath();
    ctx.ellipse(lx, floorY + 6, W * 0.11, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // estações
    for (let i = 0; i < 4; i++) {
      const x = this.sx(i);
      const id = STATIONS[i].id;
      if (id === 'bag') {
        ctx.fillStyle = '#2a1a40';
        ctx.fillRect(x - 40 * sc, 0, 80 * sc, 7);
        shadow(ctx, x + 10 * sc, floorY + 3, 26 * sc);
        drawHeavyBag(ctx, x + 10 * sc, 4, floorY - 200 * sc - 4, 46 * sc, 150 * sc, this.bagAng * 0.5);
      } else if (id === 'speed') {
        drawSpeedBag(ctx, x + 22 * sc, floorY - 182 * sc, 13 * sc, this.spAng, 0, 1);
      } else if (id === 'press') {
        // suporte
        ctx.fillStyle = '#4a3a66';
        ctx.strokeStyle = '#140a1c';
        ctx.lineWidth = 2.5;
        for (const s of [-1, 1]) {
          rr(ctx, x + s * 70 * sc - 5 * sc, floorY - 175 * sc, 10 * sc, 175 * sc, 3);
          ctx.fill();
          ctx.stroke();
        }
        rr(ctx, x - 82 * sc, floorY - 8 * sc, 164 * sc, 10 * sc, 3);
        ctx.fill();
        ctx.stroke();
        // pilha de discos
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = ['#d23048', '#2a6fd1', '#ffb31a'][k];
          rr(ctx, x + 88 * sc, floorY - (k + 1) * 9 * sc, 34 * sc, 8 * sc, 3);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        // máquina de reflexos: poste com dois braços giratórios
        ctx.fillStyle = '#3a3050';
        ctx.strokeStyle = '#140a1c';
        ctx.lineWidth = 2.5;
        const px = x + 28 * sc;
        rr(ctx, px - 5 * sc, floorY - 170 * sc, 10 * sc, 170 * sc, 3);
        ctx.fill();
        ctx.stroke();
        rr(ctx, px - 30 * sc, floorY - 6 * sc, 60 * sc, 8 * sc, 3);
        ctx.fill();
        ctx.stroke();
        const cy = floorY - 160 * sc;
        const L = 42 * sc;
        for (const k of [0, Math.PI]) {
          const a = this.padRot + k;
          const ex = px + Math.cos(a) * L;
          const ey = cy + Math.sin(a) * L * 0.25;
          ctx.strokeStyle = '#8c8aa0';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px, cy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          drawPad(ctx, ex, ey, 10 * sc, k ? '#3aa0ff' : '#ff3d6e');
        }
      }
    }
    const atPress = this.sel === 2 && Math.abs(this.x - this.spot(2)) < 3;
    drawBarbell(ctx, this.sx(2), floorY - 165 * sc, 150 * sc, 14 * sc);
    // lutador
    shadow(ctx, this.x, floorY + 3, 34 * sc);
    const bell = (j: number) => {
      const [hx, hy] = this.rig.joint(j, this.x, floorY, sc, 1);
      ctx.fillStyle = '#c9c6d8';
      ctx.strokeStyle = '#140a1c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, 9 * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2a6fd1';
      ctx.beginPath();
      ctx.arc(hx, hy, 5 * sc, 0, Math.PI * 2);
      ctx.fill();
    };
    if (atPress) bell(7);
    this.rig.draw(ctx, this.x, floorY, sc, this.facing, t);
    if (atPress) bell(5);

    // placas com nomes + nota
    for (let i = 0; i < 4; i++) {
      const s = STATIONS[i];
      const x = this.sx(i);
      const on = i === this.sel;
      const y = H * 0.12;
      const label = s.name.toUpperCase();
      const fs = Math.max(11, Math.min(17, W / 48));
      ctx.font = `${fs}px "Luckiest Guy", Impact, sans-serif`;
      const tw = ctx.measureText(label).width + 22;
      ctx.fillStyle = on ? 'rgba(255,210,61,0.95)' : 'rgba(12,7,24,0.78)';
      ctx.strokeStyle = on ? '#140a1c' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      rr(ctx, x - tw / 2, y - fs * 0.85, tw, fs * 1.7, fs * 0.6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = on ? '#3a1c00' : '#f6f2ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y + 1);
      const gr = G.bestGrade[s.id];
      if (gr) {
        const bx = x + tw / 2 - 2;
        ctx.fillStyle = gr === 'S' ? '#ff7ae0' : gr === 'A' ? '#ffd23d' : gr === 'B' ? '#5ef0c0' : '#a9b4c2';
        ctx.strokeStyle = '#140a1c';
        ctx.beginPath();
        ctx.arc(bx, y - fs * 0.7, fs * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        outlined(ctx, gr, bx, y - fs * 0.7, fs * 0.85, '#fff');
      }
      if (on) {
        const b = Math.sin(t * 5) * 3;
        ctx.fillStyle = '#ffd23d';
        star(ctx, x - tw / 2 - 10, y + b, 6, t);
        ctx.fill();
      }
    }
  }
}
