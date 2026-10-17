import type { FightReport, Mode } from '../fight/engine';

/** Fim de um combate normal (1v1, tag, campeão) — os modos (Fight Pass, Daily…) ouvem isto. */
export interface FightEndEvent {
  mode: Mode;
  won: boolean;
  report: FightReport;
}

type Cb = (e: FightEndEvent) => void;
const cbs: Cb[] = [];

export function onFightEnd(cb: Cb): void {
  cbs.push(cb);
}

export function emitFightEnd(e: FightEndEvent): void {
  for (const cb of cbs) {
    try {
      cb(e);
    } catch {
      /* um ouvinte com erro não pode estragar o fim do combate */
    }
  }
}
