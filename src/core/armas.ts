/** Armas del guerrero: combos de golpes en arco delante de él. */

export type IdArma = 'hacha' | 'cuchillas';
export type Elemento = 'hielo' | 'fuego';

export interface Golpe {
  dano: number;
  /** Alcance en metros y apertura del arco en radianes. */
  alcance: number;
  arco: number;
  /** Duración total y momento del impacto (fracción de la duración). */
  duracion: number;
  impacto: number;
  /** Carga de la barra de aturdimiento. */
  aturd: number;
  /** Paso hacia delante al golpear. */
  avance: number;
  /** Carga del elemento (hielo o fuego). */
  elemento: number;
}

export interface Arma {
  nombre: string;
  icono: string;
  elemento: Elemento;
  ligero: Golpe[];
  fuerte: Golpe;
  trasEsquiva: Golpe;
  /** Acción especial (E): lanzar el hacha o el torbellino de cadenas. */
  especial: string;
  /** Habilidad rúnica propia del arma. */
  runa: { nombre: string; icono: string; recarga: number };
}

const g = (dano: number, alcance: number, arco: number, duracion: number, aturd: number, extra: Partial<Golpe> = {}): Golpe => ({
  dano, alcance, arco, duracion, impacto: 0.45, aturd, avance: 0.6, elemento: 12, ...extra,
});

export const ARMAS: Record<IdArma, Arma> = {
  hacha: {
    nombre: 'Hacha de escarcha',
    icono: '🪓',
    elemento: 'hielo',
    ligero: [g(14, 2.6, 1.8, 0.42, 8), g(14, 2.6, 1.8, 0.4, 8), g(17, 2.7, 2.2, 0.48, 10), g(24, 2.9, 2.6, 0.62, 16, { avance: 1.2, elemento: 22 })],
    fuerte: g(34, 3.0, 1.6, 0.85, 26, { impacto: 0.6, avance: 1.4, elemento: 30 }),
    trasEsquiva: g(22, 2.8, 2.4, 0.45, 14, { avance: 1.6 }),
    especial: 'Lanzar el hacha',
    runa: { nombre: 'Tormenta de escarcha', icono: '❄️', recarga: 9 },
  },
  cuchillas: {
    nombre: 'Cuchillas ígneas',
    icono: '⛓️',
    elemento: 'fuego',
    ligero: [g(9, 4.2, 1.4, 0.34, 5), g(9, 4.2, 1.4, 0.32, 5), g(11, 4.4, 2.8, 0.4, 6), g(13, 4.6, Math.PI * 2, 0.55, 9, { elemento: 20 })],
    fuerte: g(26, 5.2, 1.0, 0.75, 18, { impacto: 0.55, avance: 0.4, elemento: 28 }),
    trasEsquiva: g(16, 4.4, 2.6, 0.4, 9, { avance: 1.2 }),
    especial: 'Torbellino de cadenas',
    runa: { nombre: 'Erupción', icono: '🔥', recarga: 10 },
  },
};

/** Puños: con el hacha lanzada se pelea a puñetazos (poco daño, mucho aturdimiento). */
export const PUNOS: Golpe[] = [g(6, 2, 1.4, 0.3, 14, { elemento: 0 }), g(6, 2, 1.4, 0.3, 14, { elemento: 0 }), g(9, 2.1, 1.6, 0.42, 22, { elemento: 0 })];
export const PUNO_FUERTE = g(12, 2.2, 1.4, 0.6, 34, { elemento: 0 });

/** Daño del arma con la forja (+15 % por nivel). */
export const multForja = (nivel: number) => 1 + nivel * 0.15;
