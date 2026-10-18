import { angulo, enArco, yawHacia } from '../core/combate';
import { INVOCA, type DefAtaque } from '../core/enemigos';
import { moverCuerpo } from '../core/fisica';
import type { Enemigo, Partida } from './logica';

const CUERPO_A_CUERPO = new Set(['golpe', 'embestida', 'aullido']);
const MAX_ENEMIGOS = 10;

const atacandoCerca = (e: Enemigo) => (e.estado === 'aviso' || e.estado === 'embestida') && !!e.ataque && CUERPO_A_CUERPO.has(e.ataque.tipo);

/** Ataques que puede usar ahora (los jefes en la segunda fase tienen más). */
function ataquesDe(e: Enemigo): DefAtaque[] {
  return e.fase2 && e.d.fase2 ? [...e.d.ataques, ...e.d.fase2] : e.d.ataques;
}

function elegirAtaque(p: Partida, e: Enemigo, dist: number, turno: boolean, ve: boolean): DefAtaque | null {
  const posibles = ataquesDe(e).filter((a) => {
    if ((e.recargas[a.nombre] ?? 0) > 0) return false;
    if (CUERPO_A_CUERPO.has(a.tipo) && !turno) return false;
    if (a.tipo === 'golpe') return dist <= a.alcance + 0.2;
    if (a.tipo === 'aullido') return dist <= (a.radio ?? 3) * 0.8;
    if (a.tipo === 'embestida') return dist > 3 && dist <= a.alcance && ve;
    if (a.tipo === 'proyectil') return dist <= a.alcance && ve;
    if (a.tipo === 'invocar') return p.vivos.length < MAX_ENEMIGOS - (a.cantidad ?? 1);
    return dist <= a.alcance;
  });
  if (!posibles.length) return null;
  let t = p.rng.siguiente() * posibles.reduce((s, a) => s + a.peso, 0);
  for (const a of posibles) {
    t -= a.peso;
    if (t < 0) return a;
  }
  return posibles[0];
}

/** Empieza el aviso; las áreas se marcan ya en el suelo (bajo el jugador). */
function empezarAtaque(p: Partida, e: Enemigo, a: DefAtaque) {
  e.estado = 'aviso';
  e.ataque = a;
  e.t = 0;
  const aviso = p.avisoDe(e, a);
  const j = p.jugador.cuerpo;
  if (a.tipo === 'area') {
    const n = a.cantidad ?? 1;
    for (let i = 0; i < n; i++) {
      const dx = i === 0 ? 0 : p.rng.rango(-5, 5);
      const dz = i === 0 ? 0 : p.rng.rango(-5, 5);
      p.areas.push({ x: j.x + dx, z: j.z + dz, r: a.radio ?? 2, t: aviso + i * 0.15, total: aviso + i * 0.15, dano: a.dano * e.mult, color: a.color, origen: e });
    }
  } else if (a.tipo === 'aullido') {
    p.areas.push({ x: e.cuerpo.x, z: e.cuerpo.z, r: a.radio ?? 4, t: aviso, total: aviso, dano: a.dano * e.mult, color: a.color, origen: e });
  }
}

function lanzarAtaque(p: Partida, e: Enemigo, a: DefAtaque) {
  const j = p.jugador.cuerpo;
  e.recargas[a.nombre] = a.recarga * (e.fase2 ? 0.75 : 1);
  switch (a.tipo) {
    case 'golpe':
      if (enArco(e.cuerpo.x, e.cuerpo.z, e.yaw, j.x, j.z, j.radio, a.alcance + 0.3, a.arco)) p.golpearJugador(a.dano * e.mult, a.color, e.cuerpo.x, e.cuerpo.z, e);
      break;
    case 'proyectil': {
      const n = a.cantidad ?? 1;
      const base = yawHacia(e.cuerpo.x, e.cuerpo.z, j.x, j.z);
      const tipo = e.tipo === 'arquero' ? 'flecha' : e.tipo === 'troll' ? 'roca' : e.tipo === 'valquiria' ? 'pluma' : 'orbe';
      for (let i = 0; i < n; i++) {
        const yaw = base + (n > 1 ? (i - (n - 1) / 2) * 0.22 : 0);
        const v = a.velocidad ?? 12;
        p.proyectiles.push({
          x: e.cuerpo.x - Math.sin(yaw) * (e.d.radio + 0.3), y: tipo === 'roca' ? 1.8 : 1.3, z: e.cuerpo.z - Math.cos(yaw) * (e.d.radio + 0.3),
          vx: -Math.sin(yaw) * v, vz: -Math.cos(yaw) * v, dano: a.dano * e.mult, radio: tipo === 'roca' ? 0.6 : 0.3, color: a.color, delJugador: false, vida: 3, tipo, origen: e,
        });
      }
      break;
    }
    case 'embestida':
      e.estado = 'embestida';
      e.t = a.alcance / 14;
      e.embX = -Math.sin(e.yaw);
      e.embZ = -Math.cos(e.yaw);
      e.golpeoEmbestida = false;
      return;
    case 'invocar': {
      const tipo = INVOCA[e.tipo] ?? 'draugr';
      const n = Math.min(a.cantidad ?? 1, MAX_ENEMIGOS - p.vivos.length);
      for (let i = 0; i < n; i++) {
        const ang = p.rng.siguiente() * Math.PI * 2;
        const x = e.cuerpo.x + Math.cos(ang) * 2.5;
        const z = e.cuerpo.z + Math.sin(ang) * 2.5;
        if (Math.hypot(x, z) < p.arena.radio - 1) p.crearEnemigo(tipo, x, z);
      }
      break;
    }
  }
  e.estado = 'recuperar';
  e.t = a.recuperacion;
}

function moverEnemigo(p: Partida, e: Enemigo, vx: number, vz: number, dt: number) {
  moverCuerpo(e.cuerpo, vx * dt, vz * dt, dt, p.rejilla);
  const r = Math.hypot(e.cuerpo.x, e.cuerpo.z);
  const max = p.arena.radio - 0.6;
  if (r > max) {
    e.cuerpo.x = (e.cuerpo.x / r) * max;
    e.cuerpo.z = (e.cuerpo.z / r) * max;
  }
}

/** Camina hacia un punto: en línea recta si se puede; si no, por el camino de A*. */
function irHacia(p: Partida, e: Enemigo, x: number, z: number, vel: number, dt: number) {
  const desde = { x: e.cuerpo.x, z: e.cuerpo.z };
  let objetivo = { x, z };
  if (!p.nav.recto(desde, objetivo)) {
    e.rutaT -= dt;
    if (e.rutaT <= 0 || !e.ruta.length) {
      e.ruta = p.nav.camino(desde, objetivo) ?? [];
      e.rutaT = 0.6;
    }
    while (e.ruta.length && Math.hypot(e.ruta[0].x - desde.x, e.ruta[0].z - desde.z) < 0.6) e.ruta.shift();
    if (e.ruta.length) objetivo = e.ruta[0];
  } else e.ruta = [];
  const dx = objetivo.x - desde.x;
  const dz = objetivo.z - desde.z;
  const d = Math.hypot(dx, dz) || 1;
  moverEnemigo(p, e, (dx / d) * vel, (dz / d) * vel, dt);
}

export function actualizarEnemigo(p: Partida, e: Enemigo, dt: number) {
  // Efectos que duran.
  if (e.fuego > 0) {
    e.fuego -= dt;
    p.herirEnemigo(e, 5 * dt, 0, 0, 'efecto');
    if (Math.random() < dt * 6) p.efecto('fuego', e.cuerpo.x, 1, e.cuerpo.z, 0, 0, 0.4);
  }
  if (e.venenoT > 0) {
    e.venenoT -= dt;
    p.herirEnemigo(e, e.veneno * dt, 0, 0, 'efecto');
  }
  if (e.estado === 'muerto') return;
  for (const k in e.recargas) e.recargas[k] -= dt;
  if (e.congelado > 0) {
    e.congelado -= dt;
    return;
  }
  e.hielo = Math.max(0, e.hielo - dt * 6);

  const j = p.jugador;
  // Persiguen al señuelo de Loki si lo hay.
  const obj = p.senuelo ?? { x: j.cuerpo.x, z: j.cuerpo.z };
  const dx = obj.x - e.cuerpo.x;
  const dz = obj.z - e.cuerpo.z;
  const dist = Math.hypot(dx, dz) - e.d.radio;

  switch (e.estado) {
    case 'aparecer':
      e.t -= dt;
      if (e.t <= 0) e.estado = 'mover';
      return;
    case 'aturdido':
      e.t -= dt;
      if (e.t <= 0) {
        e.estado = 'mover';
        e.aturd = 0;
      }
      return;
    case 'tambaleo':
    case 'recuperar':
      e.t -= dt;
      if (e.t <= 0) e.estado = 'mover';
      return;
    case 'aviso': {
      const a = e.ataque!;
      e.t += dt;
      const aviso = p.avisoDe(e, a);
      // Sigue al objetivo durante casi todo el aviso; al final se queda fijo (así se puede esquivar).
      if (e.t < aviso * 0.75) e.yaw += angulo(yawHacia(e.cuerpo.x, e.cuerpo.z, obj.x, obj.z) - e.yaw) * Math.min(1, dt * 8);
      if (e.t >= aviso) lanzarAtaque(p, e, a);
      return;
    }
    case 'embestida': {
      const a = e.ataque!;
      e.t -= dt;
      moverEnemigo(p, e, e.embX * 14, e.embZ * 14, dt);
      if (!e.golpeoEmbestida && Math.hypot(j.cuerpo.x - e.cuerpo.x, j.cuerpo.z - e.cuerpo.z) < e.d.radio + j.cuerpo.radio + 0.4) {
        e.golpeoEmbestida = true;
        p.golpearJugador(a.dano * e.mult, a.color, e.cuerpo.x, e.cuerpo.z, e);
      }
      if (e.t <= 0) {
        e.estado = 'recuperar';
        e.t = a.recuperacion;
      }
      return;
    }
  }

  // Mover: decidir ataque o acercarse/rodear.
  e.yaw += angulo(yawHacia(e.cuerpo.x, e.cuerpo.z, obj.x, obj.z) - e.yaw) * Math.min(1, dt * 6);
  const ojoE = { x: e.cuerpo.x, y: 1.4, z: e.cuerpo.z };
  const ve = p.nav.recto(ojoE, obj);
  // Turno de ataque: solo unos pocos atacan cuerpo a cuerpo a la vez (los jefes siempre).
  const ocupados = p.vivos.filter((o) => o !== e && atacandoCerca(o)).length;
  const turno = e.d.jefe || ocupados < p.modo.atacantes;
  if (j.estado !== 'muerto') {
    const a = elegirAtaque(p, e, dist, turno, ve);
    if (a) return empezarAtaque(p, e, a);
  }

  const vel = e.velocidad;
  const lejos = e.d.distancia;
  if (dist > lejos + 0.3) {
    // Sin turno, los de cuerpo a cuerpo esperan en círculo a unos metros.
    if (!turno && lejos < 4 && dist < 5) {
      const tx = -dz / (Math.hypot(dx, dz) || 1);
      const tz = dx / (Math.hypot(dx, dz) || 1);
      const acercar = dist > 4.2 ? 0.5 : dist < 3.2 ? -0.5 : 0;
      moverEnemigo(p, e, (tx * e.rodeo + (dx / (dist + e.d.radio)) * acercar) * vel * 0.45, (tz * e.rodeo + (dz / (dist + e.d.radio)) * acercar) * vel * 0.45, dt);
      if (p.rng.siguiente() < dt * 0.3) e.rodeo *= -1;
      return;
    }
    irHacia(p, e, obj.x, obj.z, vel, dt);
  } else if (lejos > 4 && dist < lejos * 0.55) {
    // Los de distancia se alejan si te acercas.
    moverEnemigo(p, e, (-dx / (dist + 0.01)) * vel * 0.8, (-dz / (dist + 0.01)) * vel * 0.8, dt);
  }
}
