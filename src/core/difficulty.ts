export type Dificultad = 'muyFacil' | 'facil' | 'normal' | 'desafio';

export interface Modo {
  nombre: string;
  /** Multiplicador de la vida de los enemigos. */
  vida: number;
  /** Multiplicador del daño de los enemigos. */
  dano: number;
  /** Ventana del bloqueo perfecto, en segundos. */
  parry: number;
  /** Multiplicador del Honor ganado. */
  honor: number;
  /** Enemigos que pueden atacarte cuerpo a cuerpo a la vez. */
  atacantes: number;
}

export const MODOS: Record<Dificultad, Modo> = {
  muyFacil: { nombre: 'Muy fácil', vida: 0.5, dano: 0.4, parry: 0.35, honor: 0.8, atacantes: 1 },
  facil: { nombre: 'Fácil', vida: 0.75, dano: 0.7, parry: 0.25, honor: 0.9, atacantes: 2 },
  normal: { nombre: 'Normal', vida: 1, dano: 1, parry: 0.18, honor: 1, atacantes: 2 },
  desafio: { nombre: 'Desafío', vida: 1.3, dano: 1.35, parry: 0.12, honor: 1.25, atacantes: 3 },
};

export const DIFICULTADES = Object.keys(MODOS) as Dificultad[];

/** Escala de los enemigos según el reino (no hay final: crece sin límite). */
export function escalaReino(reino: number) {
  const n = Math.max(0, reino - 1);
  return { vida: 1 + n * 0.28, dano: 1 + n * 0.14, presupuesto: 1 + n * 0.35 };
}
