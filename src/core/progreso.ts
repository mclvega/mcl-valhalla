import { statsVacias, type Stats } from './bendiciones';

/** Mejoras permanentes que se compran con Honor en el Salón. */
export type IdMejora = 'vida' | 'dano' | 'ejecucion' | 'furia' | 'renacer' | 'eleccion' | 'cuchillas' | 'grito' | 'oro';

export interface Mejora {
  id: IdMejora;
  nombre: string;
  icono: string;
  texto: string;
  max: number;
  coste: (nivel: number) => number;
}

export const MEJORAS: Mejora[] = [
  { id: 'vida', nombre: 'Vigor', icono: '❤️', texto: '+15 de vida máxima por nivel.', max: 6, coste: (n) => 40 + n * 35 },
  { id: 'dano', nombre: 'Filo', icono: '🗡️', texto: '+8 % de daño por nivel.', max: 6, coste: (n) => 50 + n * 40 },
  { id: 'ejecucion', nombre: 'Rito de sangre', icono: '🩸', texto: 'Las ejecuciones curan un 4 % más por nivel.', max: 4, coste: (n) => 45 + n * 40 },
  { id: 'furia', nombre: 'Corazón de berserker', icono: '😡', texto: 'La furia se llena un 15 % más rápido por nivel.', max: 4, coste: (n) => 40 + n * 35 },
  { id: 'oro', nombre: 'Codicia', icono: '💰', texto: '+15 % de oro en las expediciones por nivel.', max: 3, coste: (n) => 35 + n * 30 },
  { id: 'renacer', nombre: 'Runa de renacer', icono: '🔆', texto: 'Una vez por expedición, al caer vuelves con la mitad de la vida.', max: 1, coste: () => 300 },
  { id: 'eleccion', nombre: 'Favor divino', icono: '🌟', texto: 'Los dioses ofrecen 4 bendiciones en vez de 3.', max: 1, coste: () => 260 },
  { id: 'grito', nombre: 'Grito de guerra', icono: '📯', texto: 'Segunda runa (2): aturde y empuja a los cercanos y te cura un poco.', max: 1, coste: () => 180 },
  { id: 'cuchillas', nombre: 'Cuchillas ígneas', icono: '⛓️', texto: 'Desbloquea la segunda arma: mucho alcance y golpes de fuego en área.', max: 1, coste: () => 220 },
];

export type Mejoras = Partial<Record<IdMejora, number>>;

export const nivelMejora = (m: Mejoras, id: IdMejora) => m[id] ?? 0;

/** ¿Se puede comprar el siguiente nivel con este Honor? */
export function puedeComprar(m: Mejoras, id: IdMejora, honor: number): boolean {
  const def = MEJORAS.find((x) => x.id === id)!;
  const n = nivelMejora(m, id);
  return n < def.max && honor >= def.coste(n);
}

/** Compra un nivel: devuelve el Honor que queda (o el mismo si no se pudo). */
export function comprar(m: Mejoras, id: IdMejora, honor: number): number {
  if (!puedeComprar(m, id, honor)) return honor;
  const def = MEJORAS.find((x) => x.id === id)!;
  const n = nivelMejora(m, id);
  m[id] = n + 1;
  return honor - def.coste(n);
}

/** Stats de partida según las mejoras del Salón. */
export function statsBase(m: Mejoras): Stats {
  const s = statsVacias();
  s.vidaMax += 15 * nivelMejora(m, 'vida');
  s.dano += 0.08 * nivelMejora(m, 'dano');
  s.curaEjecucion += 0.04 * nivelMejora(m, 'ejecucion');
  s.furiaGanancia += 0.15 * nivelMejora(m, 'furia');
  s.oro += 0.15 * nivelMejora(m, 'oro');
  return s;
}
