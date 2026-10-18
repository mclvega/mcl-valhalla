import type { Rng } from './rng';

/** Valores del guerrero en una expedición: base del Salón + bendiciones + forja. */
export interface Stats {
  vidaMax: number;
  /** Multiplicador del daño. */
  dano: number;
  critico: number;
  multCritico: number;
  /** Fracción del daño recibido que se ignora (0 a 0,6). */
  defensa: number;
  velocidad: number;
  /** Fracción de la vida máxima que cura una ejecución. */
  curaEjecucion: number;
  furiaGanancia: number;
  aturdimiento: number;
  /** Carga extra de hielo o fuego. */
  elemento: number;
  /** Rayos de Thor: probabilidad por golpe y daño. */
  rayo: number;
  danoRayo: number;
  /** Cuervos de Odín que atacan solos. */
  cuervos: number;
  /** Veneno de Loki: daño por segundo que deja cada golpe. */
  veneno: number;
  /** Escudo de Freya al empezar cada encuentro. */
  escudo: number;
  curaAlMatar: number;
  /** Multiplicador del tiempo de recarga de las runas (menor = más rápido). */
  recargaRunas: number;
  oro: number;
  /** Daño extra tras un bloqueo perfecto (s de bonificación). */
  venganza: number;
  /** La esquiva deja un señuelo que distrae (Loki). */
  senuelo: boolean;
  /** Daño a los enemigos alrededor al bloquear perfectamente (Tyr). */
  ondaParry: number;
}

export function statsVacias(): Stats {
  return {
    vidaMax: 100, dano: 1, critico: 0.05, multCritico: 1.8, defensa: 0, velocidad: 5.2, curaEjecucion: 0.08, furiaGanancia: 1, aturdimiento: 1, elemento: 1,
    rayo: 0, danoRayo: 0, cuervos: 0, veneno: 0, escudo: 0, curaAlMatar: 0, recargaRunas: 1, oro: 1, venganza: 0, senuelo: false, ondaParry: 0,
  };
}

export type Dios = 'thor' | 'freya' | 'odin' | 'tyr' | 'skadi' | 'loki';

export const DIOSES: Record<Dios, { nombre: string; icono: string; color: string }> = {
  thor: { nombre: 'Thor', icono: '⚡', color: '#5ab0ff' },
  freya: { nombre: 'Freya', icono: '🛡️', color: '#5ad18a' },
  odin: { nombre: 'Odín', icono: '🐦', color: '#c9a7ff' },
  tyr: { nombre: 'Tyr', icono: '⚔️', color: '#ff7a5a' },
  skadi: { nombre: 'Skadi', icono: '❄️', color: '#9fe8ff' },
  loki: { nombre: 'Loki', icono: '🐍', color: '#9ad13c' },
};

/** 0 común, 1 rara, 2 épica: multiplican el efecto. */
export type Rareza = 0 | 1 | 2;
export const RAREZAS = [
  { nombre: 'Común', mult: 1, color: '#cfcfcf' },
  { nombre: 'Rara', mult: 1.5, color: '#4fa8ff' },
  { nombre: 'Épica', mult: 2.1, color: '#c060ff' },
];

export interface Bendicion {
  id: string;
  dios: Dios;
  nombre: string;
  /** Texto con el valor según la rareza. */
  texto: (k: number) => string;
  aplicar: (s: Stats, k: number) => void;
  /** Bendición doble: hace falta tener una de cada uno de estos dioses. */
  requiere?: [Dios, Dios];
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

export const BENDICIONES: Bendicion[] = [
  // Thor
  { id: 'thor-rayo', dios: 'thor', nombre: 'Martillo del trueno', texto: (k) => `Tus golpes tienen un ${pct(0.12 * k)} de lanzar un rayo encadenado.`, aplicar: (s, k) => { s.rayo += 0.12 * k; s.danoRayo += 14 * k; } },
  { id: 'thor-fuerza', dios: 'thor', nombre: 'Fuerza de Mjolnir', texto: (k) => `+${pct(0.12 * k)} de daño.`, aplicar: (s, k) => { s.dano += 0.12 * k; } },
  { id: 'thor-tormenta', dios: 'thor', nombre: 'Cielo partido', texto: (k) => `Los rayos hacen +${Math.round(10 * k)} de daño.`, aplicar: (s, k) => { s.danoRayo += 10 * k; s.rayo += 0.04; } },
  { id: 'thor-furia', dios: 'thor', nombre: 'Ira del tronante', texto: (k) => `La furia se llena un ${pct(0.35 * k)} más rápido.`, aplicar: (s, k) => { s.furiaGanancia += 0.35 * k; } },
  // Freya
  { id: 'freya-escudo', dios: 'freya', nombre: 'Manto de Freya', texto: (k) => `Empiezas cada encuentro con ${Math.round(15 * k)} de escudo.`, aplicar: (s, k) => { s.escudo += 15 * k; } },
  { id: 'freya-vida', dios: 'freya', nombre: 'Corazón de Vanaheim', texto: (k) => `+${Math.round(20 * k)} de vida máxima.`, aplicar: (s, k) => { s.vidaMax += 20 * k; } },
  { id: 'freya-cura', dios: 'freya', nombre: 'Lágrimas de oro', texto: (k) => `Te curas ${Math.round(3 * k)} al acabar con un enemigo.`, aplicar: (s, k) => { s.curaAlMatar += 3 * k; } },
  { id: 'freya-ejecucion', dios: 'freya', nombre: 'Bendición de la vida', texto: (k) => `Las ejecuciones curan un ${pct(0.06 * k)} más.`, aplicar: (s, k) => { s.curaEjecucion += 0.06 * k; } },
  // Odín
  { id: 'odin-cuervo', dios: 'odin', nombre: 'Huginn', texto: () => 'Un cuervo ataca solo a los enemigos.', aplicar: (s) => { s.cuervos += 1; } },
  { id: 'odin-critico', dios: 'odin', nombre: 'Ojo del Padre de Todos', texto: (k) => `+${pct(0.08 * k)} de probabilidad de crítico.`, aplicar: (s, k) => { s.critico += 0.08 * k; } },
  { id: 'odin-sabiduria', dios: 'odin', nombre: 'Sabiduría de Mimir', texto: (k) => `Las runas se recargan un ${pct(0.15 * k)} más rápido.`, aplicar: (s, k) => { s.recargaRunas *= 1 - Math.min(0.5, 0.15 * k); } },
  { id: 'odin-golpe', dios: 'odin', nombre: 'Lanza Gungnir', texto: (k) => `Los críticos hacen +${pct(0.4 * k)} de daño.`, aplicar: (s, k) => { s.multCritico += 0.4 * k; } },
  // Tyr
  { id: 'tyr-aturdir', dios: 'tyr', nombre: 'Puño de Tyr', texto: (k) => `+${pct(0.3 * k)} de aturdimiento.`, aplicar: (s, k) => { s.aturdimiento += 0.3 * k; } },
  { id: 'tyr-defensa', dios: 'tyr', nombre: 'Piel de guerra', texto: (k) => `Recibes un ${pct(0.08 * k)} menos de daño.`, aplicar: (s, k) => { s.defensa = Math.min(0.6, s.defensa + 0.08 * k); } },
  { id: 'tyr-venganza', dios: 'tyr', nombre: 'Venganza', texto: (k) => `Tras un bloqueo perfecto, +60 % de daño durante ${(1.5 * k).toFixed(1)} s.`, aplicar: (s, k) => { s.venganza += 1.5 * k; } },
  { id: 'tyr-onda', dios: 'tyr', nombre: 'Escudo del juramento', texto: (k) => `Los bloqueos perfectos dañan ${Math.round(15 * k)} a todos los cercanos.`, aplicar: (s, k) => { s.ondaParry += 15 * k; } },
  // Skadi
  { id: 'skadi-hielo', dios: 'skadi', nombre: 'Aliento invernal', texto: (k) => `+${pct(0.35 * k)} de hielo o fuego en tus golpes.`, aplicar: (s, k) => { s.elemento += 0.35 * k; } },
  { id: 'skadi-veloz', dios: 'skadi', nombre: 'Esquís de Skadi', texto: (k) => `+${pct(0.08 * k)} de velocidad.`, aplicar: (s, k) => { s.velocidad *= 1 + 0.08 * k; } },
  { id: 'skadi-cazadora', dios: 'skadi', nombre: 'Cazadora', texto: (k) => `+${pct(0.1 * k)} de daño y +${pct(0.04 * k)} de crítico.`, aplicar: (s, k) => { s.dano += 0.1 * k; s.critico += 0.04 * k; } },
  // Loki
  { id: 'loki-veneno', dios: 'loki', nombre: 'Colmillo de serpiente', texto: (k) => `Tus golpes envenenan (${Math.round(3 * k)} de daño por segundo).`, aplicar: (s, k) => { s.veneno += 3 * k; } },
  { id: 'loki-oro', dios: 'loki', nombre: 'Bolsa del embaucador', texto: (k) => `+${pct(0.4 * k)} de oro.`, aplicar: (s, k) => { s.oro += 0.4 * k; } },
  { id: 'loki-senuelo', dios: 'loki', nombre: 'Doble engañoso', texto: () => 'Al esquivar dejas un señuelo que distrae a los enemigos.', aplicar: (s) => { s.senuelo = true; } },
  { id: 'loki-critico', dios: 'loki', nombre: 'Puñalada trapera', texto: (k) => `+${pct(0.06 * k)} de crítico y +${pct(0.25 * k)} de daño crítico.`, aplicar: (s, k) => { s.critico += 0.06 * k; s.multCritico += 0.25 * k; } },
  // Dobles
  { id: 'doble-tormenta', dios: 'thor', requiere: ['thor', 'odin'], nombre: 'Tormenta de cuervos', texto: () => 'Un cuervo más, y tus rayos son más frecuentes.', aplicar: (s) => { s.cuervos += 1; s.rayo += 0.1; } },
  { id: 'doble-valquiria', dios: 'freya', requiere: ['freya', 'tyr'], nombre: 'Juramento de valquiria', texto: () => '+30 de escudo por encuentro y +10 % de defensa.', aplicar: (s) => { s.escudo += 30; s.defensa = Math.min(0.6, s.defensa + 0.1); } },
  { id: 'doble-ventisca', dios: 'skadi', requiere: ['skadi', 'thor'], nombre: 'Ventisca eléctrica', texto: () => '+50 % de elemento y los rayos hacen +15.', aplicar: (s) => { s.elemento += 0.5; s.danoRayo += 15; } },
  { id: 'doble-ponzona', dios: 'loki', requiere: ['loki', 'odin'], nombre: 'Ponzoña de Jormungandr', texto: () => '+6 de veneno por segundo y +10 % de crítico.', aplicar: (s) => { s.veneno += 6; s.critico += 0.1; } },
  { id: 'doble-berserk', dios: 'tyr', requiere: ['tyr', 'skadi'], nombre: 'Frenesí del lobo', texto: () => '+20 % de daño y la furia se llena un 50 % más rápido.', aplicar: (s) => { s.dano += 0.2; s.furiaGanancia += 0.5; } },
];

export const bendicionPorId = (id: string) => BENDICIONES.find((b) => b.id === id);

export interface Tomada {
  id: string;
  rareza: Rareza;
}

export interface Oferta {
  bendicion: Bendicion;
  rareza: Rareza;
}

const diosesTomados = (tomadas: Tomada[]) => new Set(tomadas.map((t) => bendicionPorId(t.id)?.dios).filter((d): d is Dios => !!d));

/** Rareza al azar; `suerte` > 0 la mejora (élites, reinos altos). */
export function rarezaAzar(rng: Rng, suerte = 0): Rareza {
  const r = rng.siguiente() + suerte * 0.15;
  return r > 0.93 ? 2 : r > 0.68 ? 1 : 0;
}

/** Ofrece `n` bendiciones que aún no tiene (las dobles solo si tiene los dos dioses). */
export function sortearBendiciones(rng: Rng, tomadas: Tomada[], n = 3, suerte = 0, minRareza: Rareza = 0): Oferta[] {
  const tiene = new Set(tomadas.map((t) => t.id));
  const dioses = diosesTomados(tomadas);
  const posibles = BENDICIONES.filter((b) => !tiene.has(b.id) && (!b.requiere || (dioses.has(b.requiere[0]) && dioses.has(b.requiere[1]))));
  const dobles = posibles.filter((b) => b.requiere);
  const fuera: Oferta[] = [];
  // Si hay una doble disponible, suele salir (es la recompensa por combinar dioses).
  if (dobles.length && rng.siguiente() < 0.6) fuera.push({ bendicion: rng.elegir(dobles), rareza: 2 });
  const resto = posibles.filter((b) => !b.requiere);
  while (fuera.length < n && resto.length) {
    const b = resto.splice(rng.entero(0, resto.length - 1), 1)[0];
    fuera.push({ bendicion: b, rareza: Math.max(minRareza, rarezaAzar(rng, suerte)) as Rareza });
  }
  // Si ya no quedan normales, se completan con las dobles que falten.
  for (const b of dobles) {
    if (fuera.length >= n) break;
    if (!fuera.some((o) => o.bendicion === b)) fuera.push({ bendicion: b, rareza: 2 });
  }
  return fuera;
}

/** Stats de la expedición: base + bendiciones tomadas. */
export function aplicarBendiciones(base: Stats, tomadas: Tomada[]): Stats {
  const s = { ...base };
  for (const t of tomadas) {
    const b = bendicionPorId(t.id);
    if (b) b.aplicar(s, b.requiere ? 1 : RAREZAS[t.rareza].mult);
  }
  return s;
}
