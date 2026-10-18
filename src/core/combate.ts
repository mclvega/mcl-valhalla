import type { ColorAtaque } from './enemigos';

/** Diferencia de ángulos en [-π, π]. */
export const angulo = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Ángulo de mirada (yaw) de A hacia B. Adelante es -z, como en la cámara. */
export const yawHacia = (ax: number, az: number, bx: number, bz: number) => Math.atan2(-(bx - ax), -(bz - az));

/** ¿Está B (con su radio) dentro del arco de un golpe que sale de A mirando a `yaw`? */
export function enArco(ax: number, az: number, yaw: number, bx: number, bz: number, radioB: number, alcance: number, arco: number): boolean {
  const d = Math.hypot(bx - ax, bz - az);
  if (d > alcance + radioB) return false;
  if (arco >= Math.PI * 2 - 1e-6 || d < radioB) return true;
  return Math.abs(angulo(yawHacia(ax, az, bx, bz) - yaw)) <= arco / 2 + Math.atan2(radioB, Math.max(d, 0.01));
}

export type Defensa = 'parry' | 'bloqueo' | 'golpe';

/**
 * Resultado de un ataque contra el jugador:
 * - Los rojos no se pueden bloquear.
 * - El escudo solo para lo que viene de delante (unos 200°).
 * - Si el escudo se levantó hace menos de `ventana` segundos, es un bloqueo perfecto.
 */
export function defensa(color: ColorAtaque, bloqueando: boolean, tiempoBloqueo: number, ventana: number, deFrente: boolean): Defensa {
  if (!bloqueando || color === 'rojo' || !deFrente) return 'golpe';
  return tiempoBloqueo <= ventana ? 'parry' : 'bloqueo';
}

/** El escudo para el 80 % del daño. */
export const DANO_BLOQUEADO = 0.2;

/** Daño final con crítico (el número aleatorio se pasa para poder probarlo). */
export function danoFinal(base: number, mult: number, critico: number, multCritico: number, azar: number): { dano: number; critico: boolean } {
  const esCritico = azar < critico;
  return { dano: base * mult * (esCritico ? multCritico : 1), critico: esCritico };
}
