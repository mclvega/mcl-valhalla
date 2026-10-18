import { bloque, type Bloque } from './fisica';
import { crearRng } from './rng';

/** Arena circular de cada encuentro, con pilares y ruinas para cubrirse de las flechas. */
export interface Arena {
  radio: number;
  bloques: Bloque[];
  /** Puntos de aparición de los enemigos (en el borde). */
  apariciones: Array<{ x: number; z: number }>;
  inicio: { x: number; z: number };
  /** Charcos que queman (modificador «Suelo ardiente»). */
  charcos: Array<{ x: number; z: number; r: number }>;
  /** Adornos del borde (solo visuales). */
  adornos: Array<{ x: number; z: number; escala: number; giro: number }>;
}

export function generarArena(semilla: number, jefe: boolean, lava: boolean): Arena {
  const rng = crearRng(semilla * 31 + 7);
  const radio = jefe ? 20 : rng.rango(15, 18.5);
  const inicio = { x: 0, z: radio * 0.62 };
  const bloques: Bloque[] = [];
  const lejos = (x: number, z: number, d: number) =>
    Math.hypot(x - inicio.x, z - inicio.z) > 4 && Math.hypot(x, z) > d && bloques.every((b) => Math.hypot(b.x - x, b.z - z) > 4.5);

  // Pilares y ruinas (menos en las arenas de jefe, que necesitan espacio).
  const n = jefe ? rng.entero(2, 4) : rng.entero(4, 7);
  for (let i = 0, intentos = 0; i < n && intentos < 200; intentos++) {
    const a = rng.siguiente() * Math.PI * 2;
    const r = rng.rango(4.5, radio - 3.5);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!lejos(x, z, 4)) continue;
    if (rng.siguiente() < 0.55) bloques.push(bloque('torre', x, z, 1.3, 1.3, 4.5, 0, 0));
    else if (rng.siguiente() < 0.5) bloques.push(bloque('pared', x, z, rng.rango(2.5, 4), 0.7, 1.4, 0, 1));
    else bloques.push(bloque('roca', x, z, rng.rango(1.4, 2.4), rng.rango(1.4, 2.4), rng.rango(1, 1.8), 0, 2));
    i++;
  }

  const apariciones: Arena['apariciones'] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rng.rango(-0.15, 0.15);
    const x = Math.cos(a) * (radio - 2);
    const z = Math.sin(a) * (radio - 2);
    // Lejos de donde empieza el jugador.
    if (Math.hypot(x - inicio.x, z - inicio.z) < 8) continue;
    if (bloques.some((b) => Math.abs(b.x - x) < b.w / 2 + 1 && Math.abs(b.z - z) < b.d / 2 + 1)) continue;
    apariciones.push({ x, z });
  }

  const charcos: Arena['charcos'] = [];
  if (lava) {
    for (let i = 0, intentos = 0; i < 5 && intentos < 100; intentos++) {
      const a = rng.siguiente() * Math.PI * 2;
      const r = rng.rango(3, radio - 3);
      const c = { x: Math.cos(a) * r, z: Math.sin(a) * r, r: rng.rango(1.4, 2.4) };
      if (Math.hypot(c.x - inicio.x, c.z - inicio.z) < c.r + 3) continue;
      charcos.push(c);
      i++;
    }
  }

  const adornos: Arena['adornos'] = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rng.rango(-0.08, 0.08);
    const r = radio + rng.rango(1.5, 6);
    adornos.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, escala: rng.rango(0.8, 1.5), giro: rng.siguiente() * Math.PI * 2 });
  }
  return { radio, bloques, apariciones, inicio, charcos, adornos };
}
