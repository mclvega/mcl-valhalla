import { escalaReino } from './difficulty';
import { COMUNES, ENEMIGOS, JEFES, type TipoEnemigo } from './enemigos';
import type { Rng } from './rng';

/** Los reinos se repiten en ciclo y cada vuelta es más difícil: la expedición no tiene final. */
export type IdBioma = 'midgard' | 'muspelheim' | 'niflheim' | 'helheim' | 'asgard';

export interface Bioma {
  id: IdBioma;
  nombre: string;
  suelo: number;
  piedra: number;
  cielo: number;
  niebla: number;
  /** Decoración del borde de la arena. */
  decor: 'pino' | 'lava' | 'cristal' | 'lapida' | 'columna';
  /** Color de la luz ambiental. */
  luz: number;
}

export const BIOMAS: Bioma[] = [
  { id: 'midgard', nombre: 'Midgard', suelo: 0xdfe8ee, piedra: 0x7d858f, cielo: 0xb8cde0, niebla: 0xb8cde0, decor: 'pino', luz: 0xeaf4ff },
  { id: 'muspelheim', nombre: 'Muspelheim', suelo: 0x4a2a22, piedra: 0x2e211d, cielo: 0x6b2414, niebla: 0x7a2a12, decor: 'lava', luz: 0xffb37a },
  { id: 'niflheim', nombre: 'Niflheim', suelo: 0x9fb4b8, piedra: 0x5c6f75, cielo: 0x8aa0a8, niebla: 0x9fb4b8, decor: 'cristal', luz: 0xcff4ff },
  { id: 'helheim', nombre: 'Helheim', suelo: 0x3a3f4a, piedra: 0x262a33, cielo: 0x1d2230, niebla: 0x2a3040, decor: 'lapida', luz: 0x9fb0ff },
  { id: 'asgard', nombre: 'Asgard', suelo: 0xe9d9a8, piedra: 0xc9a85a, cielo: 0x9fd6ff, niebla: 0xcfe6ff, decor: 'columna', luz: 0xfff3d0 },
];

export const biomaDe = (reino: number) => BIOMAS[(reino - 1) % BIOMAS.length];

/** Encuentros normales antes del jefe de cada reino. */
export const ENCUENTROS = 5;

export type Recompensa = 'bendicion' | 'forja' | 'fuente' | 'honor' | 'elite' | 'mercader';

export const RECOMPENSAS: Record<Recompensa, { nombre: string; icono: string; texto: string }> = {
  bendicion: { nombre: 'Bendición', icono: '⚡', texto: 'Elige 1 de los dones de un dios.' },
  forja: { nombre: 'Forja', icono: '🔨', texto: 'Mejora el daño de tu arma.' },
  fuente: { nombre: 'Fuente', icono: '❤️', texto: 'Recupera vida.' },
  honor: { nombre: 'Honor', icono: '🏅', texto: 'Honor para las mejoras del Salón.' },
  elite: { nombre: 'Prueba de élite', icono: '💀', texto: 'Enemigos más duros y una bendición épica.' },
  mercader: { nombre: 'Mercader', icono: '🛒', texto: 'Gasta el oro de la expedición.' },
};

export type Modificador = 'explosivos' | 'veloces' | 'niebla' | 'lava' | 'blindados';

export const MODIFICADORES: Record<Modificador, { nombre: string; texto: string }> = {
  explosivos: { nombre: 'Muertos inquietos', texto: 'Los enemigos explotan al caer.' },
  veloces: { nombre: 'Viento del norte', texto: 'Los enemigos van más rápido.' },
  niebla: { nombre: 'Niebla espesa', texto: 'Apenas se ve a lo lejos.' },
  lava: { nombre: 'Suelo ardiente', texto: 'Hay charcos que queman.' },
  blindados: { nombre: 'Huesos de hierro', texto: 'Los enemigos tienen más vida.' },
};

/** Puertas que se ofrecen tras un encuentro (2 o 3, sin repetir). Antes del jefe solo hay una. */
export function generarPuertas(rng: Rng, encuentro: number, honorBajo = false): Recompensa[] {
  if (encuentro >= ENCUENTROS) return [];
  const pesos: Array<[Recompensa, number]> = [['bendicion', 34], ['forja', 12], ['fuente', 14], ['honor', honorBajo ? 18 : 12], ['elite', 10], ['mercader', 10]];
  const n = rng.siguiente() < 0.45 ? 3 : 2;
  const fuera: Recompensa[] = [];
  while (fuera.length < n) {
    const libres = pesos.filter(([r]) => !fuera.includes(r));
    let t = rng.siguiente() * libres.reduce((a, [, p]) => a + p, 0);
    for (const [r, p] of libres) {
      t -= p;
      if (t < 0) {
        fuera.push(r);
        break;
      }
    }
  }
  return fuera;
}

/** Modificadores de arena: a partir del reino 3, cada vez más frecuentes. */
export function modificadorAzar(rng: Rng, reino: number): Modificador | null {
  if (reino < 3 || rng.siguiente() > Math.min(0.75, 0.25 + (reino - 3) * 0.1)) return null;
  return rng.elegir(Object.keys(MODIFICADORES) as Modificador[]);
}

/**
 * Oleadas de un encuentro, elegidas con un presupuesto de puntos que crece con el reino y el encuentro.
 * Devuelve listas de enemigos (con la marca de élite).
 */
export function generarOleadas(rng: Rng, reino: number, encuentro: number, elite: boolean): Array<Array<{ tipo: TipoEnemigo; elite: boolean }>> {
  const disponibles = COMUNES.filter((t) => ENEMIGOS[t].desde <= reino);
  let presupuesto = (6 + encuentro * 2) * escalaReino(reino).presupuesto * (elite ? 1.4 : 1);
  const oleadas = rng.siguiente() < 0.5 || presupuesto > 16 ? 3 : 2;
  const fuera: Array<Array<{ tipo: TipoEnemigo; elite: boolean }>> = Array.from({ length: oleadas }, () => []);
  const probElite = Math.min(0.5, (elite ? 0.25 : 0.04) + (reino - 1) * 0.04);
  let i = 0;
  let intentos = 0;
  while (presupuesto > 0.5 && intentos++ < 200) {
    const tipo = rng.elegir(disponibles);
    const coste = ENEMIGOS[tipo].coste;
    if (coste > presupuesto + 1) continue;
    const esElite = rng.siguiente() < probElite;
    // Como mucho 7 a la vez por oleada (rendimiento y claridad en el móvil).
    if (fuera[i].length >= 7) {
      if (i === oleadas - 1) break;
      i++;
    }
    fuera[i].push({ tipo, elite: esElite });
    presupuesto -= coste * (esElite ? 1.8 : 1);
    i = (i + 1) % oleadas;
  }
  return fuera.filter((o) => o.length);
}

/** Jefe del reino: rotan y en cada vuelta del ciclo son más fuertes (por la escala del reino). */
export const jefeDe = (reino: number): TipoEnemigo => JEFES[(reino - 1) % JEFES.length];

export const honorEncuentro = (reino: number, jefe: boolean) => (jefe ? 40 + reino * 15 : 5 + reino * 2);

/** Precios del mercader según el reino. */
export const precios = (reino: number) => ({ cura: 40 + reino * 8, bendicion: 90 + reino * 15, forja: 80 + reino * 12 });
