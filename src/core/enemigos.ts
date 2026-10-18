/**
 * Datos de los enemigos y los jefes. Cada ataque avisa con un color:
 * amarillo = se puede bloquear, rojo = solo esquivar, azul = el bloqueo perfecto lo devuelve con mucho aturdimiento.
 */

export type ColorAtaque = 'amarillo' | 'rojo' | 'azul';
export type TipoAtaque = 'golpe' | 'area' | 'proyectil' | 'embestida' | 'invocar' | 'aullido';

export interface DefAtaque {
  nombre: string;
  tipo: TipoAtaque;
  color: ColorAtaque;
  /** Segundos de aviso antes del impacto y de recuperación después. */
  aviso: number;
  recuperacion: number;
  /** Distancia a la que lo usa. */
  alcance: number;
  arco: number;
  dano: number;
  /** Radio del área (ataques de área y aullido). */
  radio?: number;
  /** Proyectiles: velocidad y cantidad (en abanico). */
  velocidad?: number;
  cantidad?: number;
  peso: number;
  recarga: number;
}

export type TipoEnemigo =
  | 'draugr' | 'escudero' | 'arquero' | 'lobo' | 'berserker' | 'espectro' | 'nigromante' | 'trollPequeno'
  | 'troll' | 'valquiria' | 'jarl' | 'granLobo';

export interface DatosEnemigo {
  nombre: string;
  vida: number;
  velocidad: number;
  radio: number;
  /** Escala del modelo. */
  escala: number;
  aturdMax: number;
  /** Distancia a la que prefiere quedarse. */
  distancia: number;
  ataques: DefAtaque[];
  /** Ataques que añade en la segunda fase (jefes, por debajo de la mitad de vida). */
  fase2?: DefAtaque[];
  /** Coste en el presupuesto de la oleada, oro y Honor que da. */
  coste: number;
  oro: number;
  honor: number;
  /** No se tambalea con los golpes (élites, jefes y berserkers). */
  firme?: boolean;
  /** Bloquea de frente hasta que se le rompe la guardia (aturdimiento). */
  guardia?: boolean;
  vuela?: boolean;
  jefe?: boolean;
  /** Primer reino en que aparece. */
  desde: number;
}

const golpe = (dano: number, color: ColorAtaque = 'amarillo', extra: Partial<DefAtaque> = {}): DefAtaque => ({
  nombre: 'Golpe', tipo: 'golpe', color, aviso: 0.65, recuperacion: 0.7, alcance: 2.3, arco: 1.6, dano, peso: 3, recarga: 1.2, ...extra,
});

export const ENEMIGOS: Record<TipoEnemigo, DatosEnemigo> = {
  draugr: {
    nombre: 'Draugr', vida: 60, velocidad: 2.6, radio: 0.4, escala: 1, aturdMax: 50, distancia: 1.8, coste: 2, oro: 6, honor: 2, desde: 1,
    ataques: [golpe(10), golpe(16, 'rojo', { nombre: 'Tajo pesado', aviso: 0.9, alcance: 2.5, peso: 1, recarga: 4 })],
  },
  escudero: {
    nombre: 'Draugr escudero', vida: 70, velocidad: 2.3, radio: 0.45, escala: 1.05, aturdMax: 45, distancia: 1.8, coste: 3, oro: 8, honor: 3, guardia: true, desde: 1,
    ataques: [golpe(12, 'azul', { nombre: 'Embate de escudo', aviso: 0.7 }), golpe(9)],
  },
  arquero: {
    nombre: 'Draugr arquero', vida: 40, velocidad: 2.4, radio: 0.4, escala: 1, aturdMax: 35, distancia: 9, coste: 2, oro: 7, honor: 2, desde: 1,
    ataques: [{ nombre: 'Flecha', tipo: 'proyectil', color: 'amarillo', aviso: 0.8, recuperacion: 0.8, alcance: 14, arco: 0, dano: 9, velocidad: 16, cantidad: 1, peso: 3, recarga: 2.2 }],
  },
  lobo: {
    nombre: 'Lobo', vida: 35, velocidad: 4.6, radio: 0.45, escala: 1, aturdMax: 30, distancia: 1.6, coste: 1, oro: 4, honor: 1, desde: 1,
    ataques: [golpe(7, 'amarillo', { nombre: 'Mordisco', aviso: 0.45, recuperacion: 0.5, alcance: 1.9 }), { nombre: 'Salto', tipo: 'embestida', color: 'amarillo', aviso: 0.55, recuperacion: 0.8, alcance: 6, arco: 0.6, dano: 10, peso: 1, recarga: 4 }],
  },
  berserker: {
    nombre: 'Berserker', vida: 120, velocidad: 3.2, radio: 0.5, escala: 1.2, aturdMax: 80, distancia: 2, coste: 5, oro: 14, honor: 6, firme: true, desde: 2,
    ataques: [golpe(14, 'amarillo', { alcance: 2.6 }), golpe(24, 'rojo', { nombre: 'Golpe salvaje', aviso: 0.8, alcance: 2.8, arco: 2.4, peso: 2, recarga: 3 }), { nombre: 'Carga', tipo: 'embestida', color: 'rojo', aviso: 0.7, recuperacion: 1, alcance: 8, arco: 0.5, dano: 18, peso: 1, recarga: 6 }],
  },
  espectro: {
    nombre: 'Espectro', vida: 45, velocidad: 3.4, radio: 0.4, escala: 1, aturdMax: 30, distancia: 6, coste: 3, oro: 9, honor: 3, vuela: true, desde: 2,
    ataques: [{ nombre: 'Orbe', tipo: 'proyectil', color: 'azul', aviso: 0.7, recuperacion: 0.6, alcance: 12, arco: 0, dano: 11, velocidad: 9, cantidad: 3, peso: 2, recarga: 3 }, golpe(9, 'amarillo', { nombre: 'Zarpazo', aviso: 0.5 })],
  },
  nigromante: {
    nombre: 'Nigromante', vida: 55, velocidad: 2.2, radio: 0.4, escala: 1, aturdMax: 35, distancia: 10, coste: 4, oro: 12, honor: 5, desde: 3,
    ataques: [{ nombre: 'Alzar muertos', tipo: 'invocar', color: 'azul', aviso: 1.2, recuperacion: 1, alcance: 20, arco: 0, dano: 0, cantidad: 2, peso: 1, recarga: 9 }, { nombre: 'Maldición', tipo: 'area', color: 'rojo', aviso: 1.1, recuperacion: 0.8, alcance: 14, arco: 0, dano: 14, radio: 2.2, peso: 2, recarga: 4 }],
  },
  trollPequeno: {
    nombre: 'Troll', vida: 240, velocidad: 2.2, radio: 0.9, escala: 1.6, aturdMax: 120, distancia: 2.6, coste: 8, oro: 25, honor: 10, firme: true, desde: 2,
    ataques: [golpe(20, 'amarillo', { alcance: 3.3, arco: 2.2, aviso: 0.85 }), { nombre: 'Pisotón', tipo: 'aullido', color: 'rojo', aviso: 1, recuperacion: 1.2, alcance: 3.5, arco: 0, dano: 22, radio: 4, peso: 1, recarga: 5 }],
  },
  troll: {
    nombre: 'Troll de piedra', vida: 900, velocidad: 2.4, radio: 1.2, escala: 2.3, aturdMax: 260, distancia: 3, coste: 0, oro: 80, honor: 40, firme: true, jefe: true, desde: 1,
    ataques: [golpe(24, 'amarillo', { nombre: 'Barrido', alcance: 4.2, arco: 2.6, aviso: 0.9 }), { nombre: 'Pisotón', tipo: 'aullido', color: 'rojo', aviso: 1.1, recuperacion: 1.2, alcance: 4, arco: 0, dano: 26, radio: 5, peso: 1, recarga: 5 }, { nombre: 'Roca', tipo: 'proyectil', color: 'azul', aviso: 1, recuperacion: 1, alcance: 18, arco: 0, dano: 22, velocidad: 13, cantidad: 1, peso: 1, recarga: 4 }],
    fase2: [{ nombre: 'Lluvia de rocas', tipo: 'area', color: 'rojo', aviso: 1.2, recuperacion: 1, alcance: 20, arco: 0, dano: 20, radio: 2.6, cantidad: 4, peso: 2, recarga: 6 }],
  },
  valquiria: {
    nombre: 'Valquiria', vida: 750, velocidad: 4.2, radio: 0.6, escala: 1.35, aturdMax: 220, distancia: 3, coste: 0, oro: 80, honor: 45, firme: true, jefe: true, vuela: true, desde: 1,
    ataques: [golpe(18, 'amarillo', { nombre: 'Lanzada', alcance: 3, arco: 0.9, aviso: 0.55 }), golpe(16, 'azul', { nombre: 'Tajo alado', alcance: 3, arco: 2.4, aviso: 0.6 }), { nombre: 'Picado', tipo: 'area', color: 'rojo', aviso: 1.1, recuperacion: 1, alcance: 20, arco: 0, dano: 30, radio: 3, peso: 2, recarga: 5 }],
    fase2: [{ nombre: 'Plumas', tipo: 'proyectil', color: 'amarillo', aviso: 0.6, recuperacion: 0.6, alcance: 16, arco: 0, dano: 10, velocidad: 17, cantidad: 5, peso: 2, recarga: 4 }],
  },
  jarl: {
    nombre: 'Jarl draugr', vida: 820, velocidad: 2.9, radio: 0.6, escala: 1.5, aturdMax: 230, distancia: 2.4, coste: 0, oro: 80, honor: 40, firme: true, jefe: true, desde: 1,
    ataques: [golpe(20, 'amarillo', { nombre: 'Mandoble', alcance: 3, arco: 2, aviso: 0.7 }), golpe(30, 'rojo', { nombre: 'Golpe del jarl', aviso: 1, alcance: 3.2, arco: 2.6, peso: 2, recarga: 4 }), { nombre: 'Llamar al séquito', tipo: 'invocar', color: 'azul', aviso: 1.3, recuperacion: 1, alcance: 30, arco: 0, dano: 0, cantidad: 3, peso: 1, recarga: 14 }],
    fase2: [{ nombre: 'Carga', tipo: 'embestida', color: 'rojo', aviso: 0.8, recuperacion: 1.1, alcance: 10, arco: 0.5, dano: 26, peso: 2, recarga: 5 }],
  },
  granLobo: {
    nombre: 'Gran lobo', vida: 700, velocidad: 5.4, radio: 1.1, escala: 2.4, aturdMax: 200, distancia: 2.8, coste: 0, oro: 80, honor: 40, firme: true, jefe: true, desde: 1,
    ataques: [golpe(18, 'amarillo', { nombre: 'Mordisco', alcance: 3.4, arco: 1.4, aviso: 0.5 }), { nombre: 'Salto', tipo: 'embestida', color: 'amarillo', aviso: 0.6, recuperacion: 0.9, alcance: 12, arco: 0.5, dano: 22, peso: 2, recarga: 3 }, { nombre: 'Aullido', tipo: 'aullido', color: 'rojo', aviso: 1, recuperacion: 1, alcance: 6, arco: 0, dano: 12, radio: 7, peso: 1, recarga: 8 }],
    fase2: [{ nombre: 'Llamar a la manada', tipo: 'invocar', color: 'azul', aviso: 1, recuperacion: 0.8, alcance: 30, arco: 0, dano: 0, cantidad: 3, peso: 1, recarga: 12 }],
  },
};

export const JEFES: TipoEnemigo[] = ['troll', 'valquiria', 'jarl', 'granLobo'];
export const COMUNES: TipoEnemigo[] = ['draugr', 'escudero', 'arquero', 'lobo', 'berserker', 'espectro', 'nigromante', 'trollPequeno'];

/** A quién invoca cada uno. */
export const INVOCA: Partial<Record<TipoEnemigo, TipoEnemigo>> = { nigromante: 'draugr', jarl: 'draugr', granLobo: 'lobo' };
