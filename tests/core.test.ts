import { describe, expect, it } from 'vitest';
import { generarArena } from '../src/core/arena';
import { ARMAS } from '../src/core/armas';
import { aplicarBendiciones, BENDICIONES, sortearBendiciones, statsVacias } from '../src/core/bendiciones';
import { defensa, enArco, yawHacia } from '../src/core/combate';
import { MODOS } from '../src/core/difficulty';
import { ENEMIGOS } from '../src/core/enemigos';
import { biomaDe, generarOleadas, generarPuertas, jefeDe } from '../src/core/expedicion';
import { PASO } from '../src/core/loop';
import { comprar, puedeComprar, statsBase } from '../src/core/progreso';
import { crearRng } from '../src/core/rng';
import { controlesVacios, Partida, type Controles } from '../src/game/logica';
import { normalizarConfig } from '../src/settings';
import { anotarExpedicion, guardadoNuevo, normalizarGuardado } from '../src/storage';

describe('combate', () => {
  it('arco de golpe y orientación', () => {
    expect(yawHacia(0, 0, 0, -5)).toBeCloseTo(0);
    expect(enArco(0, 0, 0, 0, -2, 0.4, 2.5, 1.6)).toBe(true);
    expect(enArco(0, 0, 0, 0, 2, 0.4, 2.5, 1.6)).toBe(false);
    expect(enArco(0, 0, 0, 0, 2, 0.4, 2.5, Math.PI * 2)).toBe(true);
    expect(enArco(0, 0, 0, 0, -4, 0.4, 2.5, 1.6)).toBe(false);
  });

  it('bloqueo, bloqueo perfecto y ataques rojos', () => {
    expect(defensa('amarillo', true, 0.1, 0.18, true)).toBe('parry');
    expect(defensa('amarillo', true, 0.5, 0.18, true)).toBe('bloqueo');
    expect(defensa('rojo', true, 0.05, 0.18, true)).toBe('golpe');
    expect(defensa('azul', true, 0.05, 0.18, false)).toBe('golpe');
    expect(defensa('amarillo', false, 0, 0.18, true)).toBe('golpe');
    expect(MODOS.muyFacil.parry).toBeGreaterThan(MODOS.desafio.parry);
  });
});

describe('expedición', () => {
  it('arenas con apariciones libres y lejos del inicio', () => {
    for (let s = 1; s < 10; s++) {
      const a = generarArena(s, s % 3 === 0, s % 2 === 0);
      expect(a.apariciones.length).toBeGreaterThanOrEqual(5);
      for (const p of a.apariciones) expect(Math.hypot(p.x - a.inicio.x, p.z - a.inicio.z)).toBeGreaterThan(7);
    }
  });

  it('oleadas crecen con el reino; puertas sin repetir; reinos y jefes en ciclo', () => {
    const rng = crearRng(3);
    const coste = (r: number) => generarOleadas(crearRng(r), r, 4, false).flat().reduce((s, e) => s + ENEMIGOS[e.tipo].coste, 0);
    expect(coste(6)).toBeGreaterThan(coste(1));
    for (let i = 0; i < 50; i++) {
      const p = generarPuertas(rng, 2);
      expect(new Set(p).size).toBe(p.length);
      expect(p.length).toBeGreaterThanOrEqual(2);
    }
    expect(biomaDe(6).id).toBe(biomaDe(1).id);
    expect(jefeDe(5)).toBe(jefeDe(1));
  });

  it('bendiciones: no repite y las dobles piden dos dioses', () => {
    const rng = crearRng(5);
    const o = sortearBendiciones(rng, [], 3);
    expect(o).toHaveLength(3);
    expect(o.every((x) => !x.bendicion.requiere)).toBe(true);
    const todas = BENDICIONES.filter((b) => !b.requiere).map((b) => ({ id: b.id, rareza: 0 as const }));
    const quedan = sortearBendiciones(rng, todas, 3);
    expect(quedan.length).toBeGreaterThan(0);
    expect(quedan.every((x) => x.bendicion.requiere)).toBe(true);
    const s = aplicarBendiciones(statsVacias(), [{ id: 'freya-vida', rareza: 2 }]);
    expect(s.vidaMax).toBeGreaterThan(statsVacias().vidaMax + 20);
  });

  it('mejoras del Salón', () => {
    const m = {};
    expect(puedeComprar(m, 'vida', 10)).toBe(false);
    expect(comprar(m, 'vida', 100)).toBe(60);
    expect(statsBase(m).vidaMax).toBe(115);
    expect(comprar(m, 'renacer', 299)).toBe(299);
  });
});

/** Jugador automático sencillo: se acerca, ataca, esquiva los rojos y se cubre de los demás. */
function piloto(p: Partida, rng: () => number): Controles {
  const c = controlesVacios();
  const j = p.jugador;
  const e = p.masCercano(40);
  if (!e) return c;
  const d = Math.hypot(e.cuerpo.x - j.cuerpo.x, e.cuerpo.z - j.cuerpo.z);
  p.camYaw = yawHacia(j.cuerpo.x, j.cuerpo.z, e.cuerpo.x, e.cuerpo.z);
  const peligro = p.vivos.find((o) => o.estado === 'aviso' && o.ataque && Math.hypot(o.cuerpo.x - j.cuerpo.x, o.cuerpo.z - j.cuerpo.z) < o.ataque.alcance + 1.5 && o.t > p.avisoDe(o, o.ataque) - 0.25);
  if (peligro?.ataque?.color === 'rojo') {
    c.esquivar = true;
    c.x = 1;
  } else if (peligro) c.bloquear = true;
  else if (d > 2.2) c.z = -1;
  else c.ligero = rng() < 0.5;
  if (p.ejecutable()) c.ejecutar = true;
  if (j.furia >= 100) c.furia = true;
  c.runa1 = true;
  return c;
}

describe('partida', () => {
  it('se juega una expedición: encuentros, recompensas, puertas y jefe', () => {
    const rng = crearRng(1);
    const p = new Partida({ modo: MODOS.muyFacil, arma: 'hacha', mejoras: { vida: 6, dano: 6 }, semilla: 9 });
    let encuentros = 0;
    let jefe = false;
    for (let i = 0; i < 60 * 60 * 25 && p.fase !== 'fin' && p.reino < 2; i++) {
      if (p.fase === 'combate') p.actualizar(PASO, piloto(p, rng.siguiente));
      else if (p.fase === 'recompensa') {
        if (p.ofertas.length) p.elegirBendicion(0);
        p.terminarRecompensa();
        encuentros++;
      } else if (p.fase === 'puertas') p.elegirPuerta(0);
      else if (p.fase === 'jefeVencido') {
        jefe = true;
        p.seguirReino();
      }
    }
    expect(encuentros).toBeGreaterThanOrEqual(3);
    expect(p.bajas).toBeGreaterThan(5);
    expect(p.honor).toBeGreaterThan(0);
    expect(p.tomadas.length).toBeGreaterThan(0);
    expect(jefe || p.fase === 'fin').toBe(true);
  });

  it('el hacha se lanza y vuelve; sin ella se pelea a puñetazos', () => {
    const p = new Partida({ modo: MODOS.normal, arma: 'hacha', mejoras: {}, semilla: 2 });
    p.actualizar(PASO, { ...controlesVacios(), especial: true });
    expect(p.jugador.hacha.estado).toBe('vuela');
    for (let i = 0; i < 60; i++) p.actualizar(PASO, controlesVacios());
    expect(p.jugador.hacha.estado).toBe('clavada');
    p.actualizar(PASO, { ...controlesVacios(), especial: true });
    for (let i = 0; i < 120 && p.jugador.hacha.estado !== 'mano'; i++) p.actualizar(PASO, controlesVacios());
    expect(p.jugador.hacha.estado).toBe('mano');
  });

  it('el bloqueo perfecto aturde y el rojo no se bloquea', () => {
    const p = new Partida({ modo: MODOS.normal, arma: 'hacha', mejoras: {}, semilla: 4 });
    const j = p.jugador;
    const e = p.enemigos[0];
    j.bloqueando = true;
    j.bloqueoT = 0.05;
    j.yaw = yawHacia(j.cuerpo.x, j.cuerpo.z, e.cuerpo.x, e.cuerpo.z);
    const vida = j.vida;
    expect(p.golpearJugador(20, 'azul', e.cuerpo.x, e.cuerpo.z, e)).toBe('parry');
    expect(j.vida).toBe(vida);
    expect(['tambaleo', 'aturdido']).toContain(e.estado);
    expect(p.golpearJugador(20, 'rojo', e.cuerpo.x, e.cuerpo.z, e)).toBe('golpe');
    expect(j.vida).toBeLessThan(vida);
  });

  it('la runa de renacer salva una vez', () => {
    const p = new Partida({ modo: MODOS.normal, arma: 'cuchillas', mejoras: { renacer: 1 }, semilla: 1 });
    p.golpearJugador(9999, 'rojo', 0, 0, null);
    expect(p.jugador.vida).toBeGreaterThan(0);
    p.jugador.invul = 0;
    p.golpearJugador(9999, 'rojo', 0, 0, null);
    expect(p.fase).toBe('fin');
    expect(ARMAS.cuchillas.ligero.length).toBe(4);
  });
});

describe('guardado', () => {
  it('normaliza y guarda el Honor', () => {
    const g = normalizarGuardado({ honor: 50, mejoras: { vida: 99, raro: 3 }, arma: 'cuchillas', look: { gender: 'alien' } });
    expect(g.mejoras.vida).toBe(6);
    expect(g.arma).toBe('hacha');
    expect(g.look.gender).toBe('boy');
    anotarExpedicion(g, { reino: 3, encuentro: 2, bajas: 30, honor: 120, jefes: 2 }, 'a');
    expect(g.honor).toBe(170);
    expect(g.estadisticas.reinoMax).toBe(3);
    expect(guardadoNuevo().honor).toBe(0);
    expect(normalizarConfig({}).pantallaCompleta).toBe(true);
  });
});
