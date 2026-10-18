import { generarArena, type Arena } from '../core/arena';
import { ARMAS, multForja, PUNO_FUERTE, PUNOS, type Golpe, type IdArma } from '../core/armas';
import { aplicarBendiciones, RAREZAS, sortearBendiciones, type Oferta, type Stats, type Tomada } from '../core/bendiciones';
import { angulo, DANO_BLOQUEADO, danoFinal, defensa, enArco, yawHacia } from '../core/combate';
import { escalaReino, type Modo } from '../core/difficulty';
import { ENEMIGOS, type ColorAtaque, type DatosEnemigo, type DefAtaque, type TipoEnemigo } from '../core/enemigos';
import {
  biomaDe, ENCUENTROS, generarOleadas, generarPuertas, honorEncuentro, jefeDe, modificadorAzar, precios, type Bioma, type Modificador, type Recompensa,
} from '../core/expedicion';
import { moverCuerpo, Rejilla, type Cuerpo } from '../core/fisica';
import { Navegacion, type Punto } from '../core/navegacion';
import { nivelMejora, statsBase, type Mejoras } from '../core/progreso';
import { crearRng, type Rng } from '../core/rng';
import { actualizarEnemigo } from './ia';

export interface Controles {
  /** Movimiento relativo a la cámara: x = lateral, z = adelante (-1) / atrás (+1). */
  x: number;
  z: number;
  giroX: number;
  giroY: number;
  ligero: boolean;
  fuerte: boolean;
  esquivar: boolean;
  /** Mantener para cubrirse con el escudo. */
  bloquear: boolean;
  especial: boolean;
  runa1: boolean;
  runa2: boolean;
  furia: boolean;
  ejecutar: boolean;
  fijar: boolean;
}

export const controlesVacios = (): Controles => ({
  x: 0, z: 0, giroX: 0, giroY: 0, ligero: false, fuerte: false, esquivar: false, bloquear: false, especial: false, runa1: false, runa2: false, furia: false, ejecutar: false, fijar: false,
});

export type EstadoJugador = 'libre' | 'atacando' | 'esquivando' | 'tambaleo' | 'ejecutando' | 'muerto';

export interface Hacha {
  estado: 'mano' | 'vuela' | 'clavada' | 'vuelve';
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  recorrido: number;
  golpeados: Set<number>;
}

export interface Jugador {
  cuerpo: Cuerpo;
  yaw: number;
  vida: number;
  escudo: number;
  furia: number;
  /** Segundos de furia activa. */
  furiaT: number;
  estado: EstadoJugador;
  t: number;
  golpe: Golpe | null;
  golpeHecho: boolean;
  combo: number;
  /** Segundos desde el último golpe (el combo se reinicia si pasa mucho). */
  comboT: number;
  cola: 'ligero' | 'fuerte' | null;
  esquivaX: number;
  esquivaZ: number;
  invul: number;
  bloqueando: boolean;
  bloqueoT: number;
  /** Ventana para el golpe tras esquivar. */
  trasEsquiva: number;
  venganzaT: number;
  recargaEspecial: number;
  recargaRuna1: number;
  recargaRuna2: number;
  hacha: Hacha;
  moviendose: boolean;
  renacer: boolean;
  ejecutando: Enemigo | null;
}

export type EstadoEnemigo = 'aparecer' | 'mover' | 'aviso' | 'embestida' | 'recuperar' | 'aturdido' | 'tambaleo' | 'muerto';

export interface Enemigo {
  id: number;
  tipo: TipoEnemigo;
  d: DatosEnemigo;
  cuerpo: Cuerpo;
  yaw: number;
  vida: number;
  vidaMax: number;
  aturd: number;
  estado: EstadoEnemigo;
  t: number;
  ataque: DefAtaque | null;
  recargas: Record<string, number>;
  embX: number;
  embZ: number;
  golpeoEmbestida: boolean;
  hielo: number;
  congelado: number;
  fuego: number;
  veneno: number;
  venenoT: number;
  elite: boolean;
  fase2: boolean;
  /** Multiplicador de su daño (dificultad, reino y élite). */
  mult: number;
  velocidad: number;
  ruta: Punto[];
  rutaT: number;
  rodeo: number;
  /** Tiempo de la animación de muerte. */
  muerteT: number;
}

export interface Proyectil {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  dano: number;
  radio: number;
  color: ColorAtaque;
  delJugador: boolean;
  vida: number;
  tipo: 'flecha' | 'orbe' | 'roca' | 'pluma' | 'cuervo';
  origen: Enemigo | null;
}

/** Ataque de área avisado en el suelo: estalla cuando `t` llega a 0. */
export interface Area {
  x: number;
  z: number;
  r: number;
  t: number;
  total: number;
  dano: number;
  color: ColorAtaque;
  origen: Enemigo | null;
}

export type TipoEfecto = 'chispa' | 'hielo' | 'fuego' | 'rayo' | 'sangre' | 'onda' | 'parry' | 'ejecucion' | 'veneno';

export interface Efecto {
  tipo: TipoEfecto;
  x: number;
  y: number;
  z: number;
  /** Segundo punto (rayos) o radio (ondas). */
  x2: number;
  z2: number;
  t: number;
  total: number;
}

export interface NumeroDano {
  x: number;
  y: number;
  z: number;
  valor: number;
  t: number;
  critico: boolean;
  propio: boolean;
}

export type Fase = 'combate' | 'recompensa' | 'puertas' | 'jefeVencido' | 'fin';
export type Puerta = Recompensa | 'jefe';

export interface Resumen {
  reino: number;
  encuentro: number;
  bajas: number;
  honor: number;
  tiempo: number;
  voluntario: boolean;
  jefes: number;
}

export interface EventosPartida {
  acierto?: (critico: boolean) => void;
  dano?: () => void;
  parry?: () => void;
  bloqueo?: () => void;
  baja?: (e: Enemigo) => void;
  ejecucion?: () => void;
  lanzar?: () => void;
  atrapar?: () => void;
  runa?: () => void;
  encuentro?: () => void;
  fin?: (r: Resumen) => void;
}

export interface OpcionesPartida {
  modo: Modo;
  arma: IdArma;
  mejoras: Mejoras;
  semilla?: number;
  eventos?: EventosPartida;
}

const ESQUIVA_VEL = 11;
const ESQUIVA_DUR = 0.36;
const ALCANCE_EJECUCION = 2.8;

export class Partida {
  readonly modo: Modo;
  readonly arma: IdArma;
  readonly mejoras: Mejoras;
  rng: Rng;
  private eventos: EventosPartida;
  private semilla: number;

  fase: Fase = 'combate';
  reino = 1;
  /** 0 a 4: encuentros normales; 5: el jefe. */
  encuentro = 0;
  /** Cambia cada vez que hay una arena nueva (el render la reconstruye). */
  version = 0;
  tiempo = 0;
  pausada = false;

  arena!: Arena;
  rejilla!: Rejilla;
  nav!: Navegacion;
  bioma!: Bioma;
  modificador: Modificador | null = null;
  elite = false;

  jugador: Jugador;
  enemigos: Enemigo[] = [];
  proyectiles: Proyectil[] = [];
  areas: Area[] = [];
  efectos: Efecto[] = [];
  numeros: NumeroDano[] = [];
  senuelo: { x: number; z: number; t: number } | null = null;
  /** Enemigo fijado como objetivo (la cámara lo sigue). */
  fijado: Enemigo | null = null;
  autoFijar = false;
  ayudaEsquiva = false;
  /** La ayuda de esquiva está ralentizando el tiempo. */
  lento = false;
  camYaw = 0;
  camPitch = 0.42;

  tomadas: Tomada[] = [];
  stats: Stats;
  forja = 0;
  oro = 0;
  honor = 0;
  bajas = 0;
  jefes = 0;
  recompensa: Recompensa = 'bendicion';
  ofertas: Oferta[] = [];
  puertas: Puerta[] = [];
  mensaje = '';
  /** Segundos que se muestra el mensaje en el combate. */
  mensajeT = 0;
  private oleadas: Array<Array<{ tipo: TipoEnemigo; elite: boolean }>> = [];
  private oleada = 0;
  private siguienteId = 1;
  private cuervoT = 0;
  private terminado = false;

  constructor(o: OpcionesPartida) {
    this.modo = o.modo;
    this.arma = o.arma;
    this.mejoras = o.mejoras;
    this.semilla = o.semilla ?? Date.now();
    this.rng = crearRng(this.semilla);
    this.eventos = o.eventos ?? {};
    this.stats = statsBase(o.mejoras);
    this.jugador = {
      cuerpo: { x: 0, y: 0, z: 0, vy: 0, radio: 0.4, alto: 1.8, enSuelo: true },
      yaw: 0, vida: this.stats.vidaMax, escudo: 0, furia: 0, furiaT: 0, estado: 'libre', t: 0, golpe: null, golpeHecho: false, combo: 0, comboT: 9, cola: null,
      esquivaX: 0, esquivaZ: 0, invul: 0, bloqueando: false, bloqueoT: 9, trasEsquiva: 0, venganzaT: 0, recargaEspecial: 0, recargaRuna1: 0, recargaRuna2: 0,
      hacha: { estado: 'mano', x: 0, y: 0, z: 0, vx: 0, vz: 0, recorrido: 0, golpeados: new Set() },
      moviendose: false, renacer: nivelMejora(o.mejoras, 'renacer') > 0, ejecutando: null,
    };
    this.iniciarEncuentro();
  }

  /* ---------- Estructura de la expedición ---------- */

  get esJefe() {
    return this.encuentro >= ENCUENTROS;
  }

  get tieneGrito() {
    return nivelMejora(this.mejoras, 'grito') > 0;
  }

  private recalcular() {
    const antes = this.stats.vidaMax;
    this.stats = aplicarBendiciones(statsBase(this.mejoras), this.tomadas);
    // Subir la vida máxima también cura esa diferencia.
    if (this.stats.vidaMax > antes) this.jugador.vida += this.stats.vidaMax - antes;
    this.jugador.vida = Math.min(this.jugador.vida, this.stats.vidaMax);
  }

  iniciarEncuentro() {
    const sem = this.semilla + this.reino * 101 + this.encuentro * 13;
    this.rng = crearRng(sem);
    this.bioma = biomaDe(this.reino);
    this.elite = this.recompensa === 'elite';
    this.modificador = this.esJefe ? null : modificadorAzar(this.rng, this.reino);
    this.arena = generarArena(sem, this.esJefe, this.modificador === 'lava');
    this.rejilla = new Rejilla(this.arena.bloques);
    this.nav = new Navegacion(this.arena.bloques, this.arena.radio);
    this.oleadas = this.esJefe ? [[{ tipo: jefeDe(this.reino), elite: false }]] : generarOleadas(this.rng, this.reino, this.encuentro, this.elite);
    this.oleada = 0;
    this.enemigos = [];
    this.proyectiles = [];
    this.areas = [];
    this.efectos = [];
    this.numeros = [];
    this.fijado = null;
    this.senuelo = null;
    const j = this.jugador;
    Object.assign(j.cuerpo, { x: this.arena.inicio.x, y: 0, z: this.arena.inicio.z, vy: 0 });
    j.yaw = 0;
    this.camYaw = 0;
    j.estado = 'libre';
    j.escudo = this.stats.escudo;
    j.hacha.estado = 'mano';
    j.cola = null;
    this.fase = 'combate';
    this.mensaje = this.esJefe ? `👑 ${ENEMIGOS[jefeDe(this.reino)].nombre}` : '';
    this.mensajeT = this.esJefe ? 3 : 0;
    this.version++;
    this.sacarOleada();
  }

  private sacarOleada() {
    const lista = this.oleadas[this.oleada++] ?? [];
    const puntos = [...this.arena.apariciones];
    lista.forEach((e, i) => {
      const p = this.esJefe ? { x: 0, z: -this.arena.radio * 0.45 } : puntos.splice(this.rng.entero(0, puntos.length - 1), 1)[0] ?? this.arena.apariciones[i % this.arena.apariciones.length];
      this.crearEnemigo(e.tipo, p.x, p.z, e.elite);
    });
  }

  crearEnemigo(tipo: TipoEnemigo, x: number, z: number, elite = false): Enemigo {
    const d = ENEMIGOS[tipo];
    const esc = escalaReino(this.reino);
    const vida = d.vida * this.modo.vida * esc.vida * (elite ? 2 : 1) * (this.modificador === 'blindados' ? 1.4 : 1);
    const e: Enemigo = {
      id: this.siguienteId++, tipo, d, cuerpo: { x, y: 0, z, vy: 0, radio: d.radio, alto: 1.8 * d.escala, enSuelo: true },
      yaw: yawHacia(x, z, this.jugador.cuerpo.x, this.jugador.cuerpo.z), vida, vidaMax: vida, aturd: 0, estado: 'aparecer', t: 0.9, ataque: null, recargas: {},
      embX: 0, embZ: 0, golpeoEmbestida: false, hielo: 0, congelado: 0, fuego: 0, veneno: 0, venenoT: 0, elite, fase2: false,
      mult: this.modo.dano * esc.dano * (elite ? 1.3 : 1),
      velocidad: d.velocidad * (this.modificador === 'veloces' ? 1.3 : 1) * (elite ? 1.1 : 1),
      ruta: [], rutaT: 0, rodeo: this.rng.siguiente() < 0.5 ? 1 : -1, muerteT: 0,
    };
    // Que empiece con los ataques a distancia algo cargados (no disparan todos a la vez).
    for (const a of d.ataques) e.recargas[a.nombre] = this.rng.rango(0.3, 1.5);
    this.enemigos.push(e);
    return e;
  }

  get vivos(): Enemigo[] {
    return this.enemigos.filter((e) => e.estado !== 'muerto');
  }

  private encuentroTerminado() {
    this.honor += honorEncuentro(this.reino, this.esJefe) * this.modo.honor;
    this.eventos.encuentro?.();
    this.proyectiles = [];
    this.areas = [];
    if (this.esJefe) {
      this.jefes++;
      this.fase = 'jefeVencido';
      return;
    }
    this.fase = 'recompensa';
    const r = this.recompensa;
    this.mensaje = '';
    if (r === 'bendicion' || r === 'elite') {
      const n = nivelMejora(this.mejoras, 'eleccion') > 0 ? 4 : 3;
      this.ofertas = sortearBendiciones(this.rng, this.tomadas, n, (this.reino - 1) * 0.3 + (r === 'elite' ? 1 : 0), r === 'elite' ? 2 : 0);
      if (r === 'elite') this.honor += 15 * this.reino * this.modo.honor;
      if (!this.ofertas.length) this.mensaje = 'Los dioses ya te dieron todo lo que tenían.';
    } else if (r === 'forja') {
      this.forja++;
      this.mensaje = `Tu arma ahora hace un ${Math.round((multForja(this.forja) - 1) * 100)} % más de daño.`;
    } else if (r === 'fuente') {
      const cura = Math.round(this.stats.vidaMax * 0.5);
      this.jugador.vida = Math.min(this.stats.vidaMax, this.jugador.vida + cura);
      this.mensaje = `Recuperas ${cura} de vida.`;
    } else if (r === 'honor') {
      const h = Math.round((20 + this.reino * 10) * this.modo.honor);
      this.honor += h;
      this.mensaje = `+${h} de Honor.`;
    } else {
      this.mensaje = `Tienes ${Math.floor(this.oro)} de oro.`;
    }
  }

  elegirBendicion(i: number) {
    const o = this.ofertas[i];
    if (!o || this.fase !== 'recompensa') return;
    this.tomadas.push({ id: o.bendicion.id, rareza: o.rareza });
    this.ofertas = [];
    this.recalcular();
  }

  /** Mercader: devuelve true si se pudo comprar. */
  comprar(cosa: 'cura' | 'bendicion' | 'forja'): boolean {
    const precio = precios(this.reino)[cosa];
    if (this.oro < precio) return false;
    this.oro -= precio;
    if (cosa === 'cura') this.jugador.vida = Math.min(this.stats.vidaMax, this.jugador.vida + this.stats.vidaMax * 0.4);
    else if (cosa === 'forja') this.forja++;
    else {
      const o = sortearBendiciones(this.rng, this.tomadas, 1, 0.5)[0];
      if (o) {
        this.tomadas.push({ id: o.bendicion.id, rareza: o.rareza });
        this.recalcular();
        this.mensaje = `${o.bendicion.nombre} (${RAREZAS[o.rareza].nombre.toLowerCase()})`;
      }
    }
    return true;
  }

  /** Después de la recompensa se eligen las puertas. */
  terminarRecompensa() {
    if (this.fase !== 'recompensa') return;
    this.ofertas = [];
    this.puertas = this.encuentro + 1 >= ENCUENTROS ? ['jefe'] : generarPuertas(this.rng, this.encuentro + 1, this.honor < 50);
    this.fase = 'puertas';
  }

  elegirPuerta(i: number) {
    const p = this.puertas[i];
    if (!p || this.fase !== 'puertas') return;
    this.recompensa = p === 'jefe' ? 'bendicion' : p;
    this.encuentro++;
    this.iniciarEncuentro();
  }

  /** Tras el jefe: seguir al reino siguiente (más difícil) con algo de vida recuperada. */
  seguirReino() {
    if (this.fase !== 'jefeVencido') return;
    this.reino++;
    this.encuentro = 0;
    this.recompensa = 'bendicion';
    this.jugador.vida = Math.min(this.stats.vidaMax, this.jugador.vida + this.stats.vidaMax * 0.3);
    this.iniciarEncuentro();
  }

  /** Volver al Salón tras vencer al jefe: +25 % de Honor. */
  volverAlSalon() {
    if (this.fase !== 'jefeVencido') return;
    this.honor *= 1.25;
    this.terminar(true);
  }

  /** Abandonar desde la pausa: se conserva el Honor ganado. */
  abandonar() {
    this.terminar(false);
  }

  private terminar(voluntario: boolean) {
    if (this.terminado) return;
    this.terminado = true;
    this.fase = 'fin';
    this.eventos.fin?.({ reino: this.reino, encuentro: this.encuentro, bajas: this.bajas, honor: Math.round(this.honor), tiempo: Math.round(this.tiempo), voluntario, jefes: this.jefes });
  }

  /* ---------- Bucle ---------- */

  actualizar(dt: number, c: Controles) {
    if (this.pausada) return;
    for (const n of this.numeros) n.t -= dt;
    this.numeros = this.numeros.filter((n) => n.t > 0);
    for (const e of this.efectos) e.t -= dt;
    this.efectos = this.efectos.filter((e) => e.t > 0);
    if (this.fase !== 'combate') return;
    this.tiempo += dt;
    this.mensajeT = Math.max(0, this.mensajeT - dt);

    // Ayuda de esquiva: el mundo va más lento justo antes de un ataque rojo que te va a dar.
    this.lento = this.ayudaEsquiva && this.peligroRojo();
    const dtm = this.lento ? dt * 0.4 : dt;

    this.actualizarCamara(dt, c);
    this.actualizarJugador(dt, c);
    for (const e of this.enemigos) {
      if (e.estado === 'muerto') e.muerteT += dt;
      else actualizarEnemigo(this, e, dtm);
    }
    this.enemigos = this.enemigos.filter((e) => e.estado !== 'muerto' || e.muerteT < 1.6);
    this.separarEnemigos();
    this.actualizarProyectiles(dtm);
    this.actualizarAreas(dtm);
    this.actualizarHacha(dt);
    this.actualizarCuervos(dt);
    if (this.senuelo) {
      this.senuelo.t -= dt;
      if (this.senuelo.t <= 0) this.senuelo = null;
    }
    // Charcos ardientes.
    const j = this.jugador;
    for (const ch of this.arena.charcos) {
      if (j.estado !== 'muerto' && Math.hypot(j.cuerpo.x - ch.x, j.cuerpo.z - ch.z) < ch.r) this.danarJugadorDirecto(9 * dt);
    }

    if (this.fase !== 'combate') return;
    const vivos = this.vivos.length;
    if (this.oleada < this.oleadas.length && vivos <= (this.oleadas.length > 2 ? 2 : 1)) this.sacarOleada();
    else if (vivos === 0 && this.oleada >= this.oleadas.length) this.encuentroTerminado();
  }

  private peligroRojo(): boolean {
    const j = this.jugador.cuerpo;
    for (const e of this.enemigos) {
      const a = e.ataque;
      if (e.estado !== 'aviso' || !a || a.color !== 'rojo' || a.tipo === 'area') continue;
      const falta = this.avisoDe(e, a) - e.t;
      if (falta < 0.3 && Math.hypot(e.cuerpo.x - j.x, e.cuerpo.z - j.z) < a.alcance + (a.radio ?? 0) + 1.5) return true;
    }
    return this.areas.some((a) => a.color === 'rojo' && a.t < 0.3 && Math.hypot(a.x - j.x, a.z - j.z) < a.r + 0.5);
  }

  /** Duración del aviso de un ataque (los jefes en la segunda fase avisan menos). */
  avisoDe(e: Enemigo, a: DefAtaque) {
    return a.aviso * (e.fase2 ? 0.8 : 1);
  }

  private actualizarCamara(dt: number, c: Controles) {
    this.camYaw -= c.giroX;
    this.camPitch = Math.max(0.15, Math.min(0.95, this.camPitch + c.giroY * 0.6));
    if (this.fijado && this.fijado.estado === 'muerto') this.fijado = null;
    if (this.autoFijar && !this.fijado) {
      const cerca = this.masCercano(10);
      if (cerca) this.fijado = cerca;
    }
    const f = this.fijado;
    if (f) {
      const j = this.jugador.cuerpo;
      const objetivo = yawHacia(j.x, j.z, f.cuerpo.x, f.cuerpo.z);
      this.camYaw += angulo(objetivo - this.camYaw) * Math.min(1, dt * 4);
    }
  }

  masCercano(max: number, desdeYaw?: number): Enemigo | null {
    const j = this.jugador.cuerpo;
    let mejor: Enemigo | null = null;
    let d = max;
    for (const e of this.vivos) {
      if (e.estado === 'aparecer') continue;
      let dist = Math.hypot(e.cuerpo.x - j.x, e.cuerpo.z - j.z);
      // Se prefieren los que están delante.
      if (desdeYaw !== undefined) dist += Math.abs(angulo(yawHacia(j.x, j.z, e.cuerpo.x, e.cuerpo.z) - desdeYaw)) * 1.5;
      if (dist < d) {
        d = dist;
        mejor = e;
      }
    }
    return mejor;
  }

  /* ---------- Jugador ---------- */

  private golpesArma(): { ligero: Golpe[]; fuerte: Golpe } {
    if (this.arma === 'hacha' && this.jugador.hacha.estado !== 'mano') return { ligero: PUNOS, fuerte: PUNO_FUERTE };
    const a = ARMAS[this.arma];
    return { ligero: a.ligero, fuerte: a.fuerte };
  }

  private empezarGolpe(g: Golpe) {
    const j = this.jugador;
    j.estado = 'atacando';
    j.golpe = g;
    j.t = 0;
    j.golpeHecho = false;
    j.cola = null;
    j.bloqueando = false;
    // Se gira hacia el objetivo (fijado o el más cercano delante).
    const obj = this.fijado ?? this.masCercano(6, j.yaw);
    if (obj) j.yaw = yawHacia(j.cuerpo.x, j.cuerpo.z, obj.cuerpo.x, obj.cuerpo.z);
  }

  private ataqueLigero() {
    const j = this.jugador;
    if (j.trasEsquiva > 0 && !(this.arma === 'hacha' && j.hacha.estado !== 'mano')) {
      j.trasEsquiva = 0;
      j.combo = 0;
      return this.empezarGolpe(ARMAS[this.arma].trasEsquiva);
    }
    const lista = this.golpesArma().ligero;
    if (j.comboT > 0.55) j.combo = 0;
    const g = lista[j.combo % lista.length];
    j.combo = (j.combo + 1) % lista.length;
    this.empezarGolpe(g);
  }

  private actualizarJugador(dt: number, c: Controles) {
    const j = this.jugador;
    if (j.estado === 'muerto') return;
    j.invul = Math.max(0, j.invul - dt);
    j.trasEsquiva = Math.max(0, j.trasEsquiva - dt);
    j.venganzaT = Math.max(0, j.venganzaT - dt);
    j.recargaEspecial = Math.max(0, j.recargaEspecial - dt);
    j.recargaRuna1 = Math.max(0, j.recargaRuna1 - dt);
    j.recargaRuna2 = Math.max(0, j.recargaRuna2 - dt);
    j.comboT += dt;
    if (j.furiaT > 0) {
      j.furiaT -= dt;
      j.vida = Math.min(this.stats.vidaMax, j.vida + 2.5 * dt);
    }

    if (c.fijar) this.fijado = this.fijado ? null : this.masCercano(16, this.camYaw);

    // Dirección de movimiento según la cámara.
    const largo = Math.hypot(c.x, c.z);
    const mx = largo > 1 ? c.x / largo : c.x;
    const mz = largo > 1 ? c.z / largo : c.z;
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    const dx = mx * cos + mz * sin;
    const dz = -mx * sin + mz * cos;
    j.moviendose = false;

    const puedeEsquivar = j.estado === 'libre' || (j.estado === 'atacando' && j.golpeHecho);
    if (c.esquivar && puedeEsquivar) {
      j.estado = 'esquivando';
      j.t = 0;
      j.bloqueando = false;
      const l = Math.hypot(dx, dz);
      if (l > 0.1) {
        j.esquivaX = dx / l;
        j.esquivaZ = dz / l;
      } else {
        // Sin dirección: hacia atrás.
        j.esquivaX = Math.sin(j.yaw);
        j.esquivaZ = Math.cos(j.yaw);
      }
      j.invul = 0.3;
      if (this.stats.senuelo) this.senuelo = { x: j.cuerpo.x, z: j.cuerpo.z, t: 2.5 };
    }

    switch (j.estado) {
      case 'tambaleo':
        j.t -= dt;
        if (j.t <= 0) j.estado = 'libre';
        this.mover(0, 0, dt);
        return;
      case 'ejecutando': {
        j.t -= dt;
        j.invul = 0.2;
        if (j.t <= 0) this.terminarEjecucion();
        return;
      }
      case 'esquivando': {
        j.t += dt;
        this.mover(j.esquivaX * ESQUIVA_VEL, j.esquivaZ * ESQUIVA_VEL, dt);
        if (j.t >= ESQUIVA_DUR) {
          j.estado = 'libre';
          j.trasEsquiva = 0.45;
        }
        return;
      }
      case 'atacando': {
        const g = j.golpe!;
        j.t += dt;
        const fr = j.t / g.duracion;
        if (fr < g.impacto) this.mover(-Math.sin(j.yaw) * g.avance * 3, -Math.cos(j.yaw) * g.avance * 3, dt);
        if (!j.golpeHecho && fr >= g.impacto) {
          j.golpeHecho = true;
          this.aplicarGolpe(g);
        }
        if (fr > 0.3 && (c.ligero || c.fuerte)) j.cola = c.ligero ? 'ligero' : 'fuerte';
        if (fr >= 1) {
          j.estado = 'libre';
          j.comboT = 0;
          const cola = j.cola;
          j.cola = null;
          if (cola === 'ligero') this.ataqueLigero();
          else if (cola === 'fuerte') {
            j.combo = 0;
            this.empezarGolpe(this.golpesArma().fuerte);
          }
        }
        return;
      }
    }

    // Libre: moverse, cubrirse y empezar acciones.
    const levantado = c.bloquear;
    if (levantado && !j.bloqueando) j.bloqueoT = 0;
    j.bloqueando = levantado;
    if (j.bloqueando) j.bloqueoT += dt;

    const vel = this.stats.velocidad * (j.bloqueando ? 0.4 : 1);
    const l = Math.hypot(dx, dz);
    if (l > 0.1) {
      j.moviendose = true;
      if (!j.bloqueando) j.yaw += angulo(Math.atan2(-dx, -dz) - j.yaw) * Math.min(1, dt * 14);
    }
    if (j.bloqueando) {
      // Con el escudo se mira al enemigo fijado o hacia la cámara.
      const f = this.fijado;
      const objetivo = f ? yawHacia(j.cuerpo.x, j.cuerpo.z, f.cuerpo.x, f.cuerpo.z) : this.camYaw;
      j.yaw += angulo(objetivo - j.yaw) * Math.min(1, dt * 12);
    }
    this.mover(dx * vel, dz * vel, dt);

    if (j.bloqueando) return;
    if (c.ejecutar || ((c.ligero || c.fuerte) && this.ejecutable())) {
      if (this.ejecutar()) return;
    }
    if (c.ligero) return this.ataqueLigero();
    if (c.fuerte) {
      j.combo = 0;
      return this.empezarGolpe(this.golpesArma().fuerte);
    }
    if (c.especial) this.especial();
    if (c.runa1) this.runa1();
    if (c.runa2) this.runa2();
    if (c.furia && j.furia >= 100 && j.furiaT <= 0) {
      j.furia = 0;
      j.furiaT = 8;
      this.efecto('onda', j.cuerpo.x, 1, j.cuerpo.z, 4, 0, 0.5);
      this.eventos.runa?.();
    }
  }

  private mover(vx: number, vz: number, dt: number) {
    const c = this.jugador.cuerpo;
    moverCuerpo(c, vx * dt, vz * dt, dt, this.rejilla);
    const r = Math.hypot(c.x, c.z);
    const max = this.arena.radio - 0.5;
    if (r > max) {
      c.x = (c.x / r) * max;
      c.z = (c.z / r) * max;
    }
  }

  /** Enemigo aturdido a mano para rematarlo. */
  ejecutable(): Enemigo | null {
    const j = this.jugador.cuerpo;
    let mejor: Enemigo | null = null;
    let d = ALCANCE_EJECUCION;
    for (const e of this.enemigos) {
      if (e.estado !== 'aturdido') continue;
      const dist = Math.hypot(e.cuerpo.x - j.x, e.cuerpo.z - j.z) - e.d.radio;
      if (dist < d) {
        d = dist;
        mejor = e;
      }
    }
    return mejor;
  }

  private ejecutar(): boolean {
    const e = this.ejecutable();
    if (!e) return false;
    const j = this.jugador;
    j.estado = 'ejecutando';
    j.t = 0.75;
    j.ejecutando = e;
    j.yaw = yawHacia(j.cuerpo.x, j.cuerpo.z, e.cuerpo.x, e.cuerpo.z);
    e.t = Math.max(e.t, 1);
    return true;
  }

  private terminarEjecucion() {
    const j = this.jugador;
    const e = j.ejecutando;
    j.estado = 'libre';
    j.ejecutando = null;
    if (!e || e.estado === 'muerto') return;
    this.efecto('ejecucion', e.cuerpo.x, 1.2, e.cuerpo.z, 0, 0, 0.6);
    j.vida = Math.min(this.stats.vidaMax, j.vida + this.stats.vidaMax * this.stats.curaEjecucion);
    j.furia = Math.min(100, j.furia + 15);
    this.eventos.ejecucion?.();
    // Los jefes pierden un buen trozo de vida; los demás caen.
    const dano = e.d.jefe ? e.vidaMax * 0.15 : e.vida + 1;
    e.aturd = 0;
    e.estado = 'mover';
    this.herirEnemigo(e, dano, 0, 0, 'ejecucion');
  }

  private multDano() {
    const j = this.jugador;
    return this.stats.dano * multForja(this.forja) * (j.furiaT > 0 ? 1.5 : 1) * (j.venganzaT > 0 ? 1.6 : 1);
  }

  private aplicarGolpe(g: Golpe) {
    const j = this.jugador;
    let alguno = false;
    for (const e of this.vivos) {
      if (e.estado === 'aparecer') continue;
      if (!enArco(j.cuerpo.x, j.cuerpo.z, j.yaw, e.cuerpo.x, e.cuerpo.z, e.d.radio, g.alcance, g.arco)) continue;
      this.herirEnemigo(e, g.dano, g.aturd, g.elemento, 'golpe');
      alguno = true;
    }
    if (g.arco >= Math.PI * 2 - 0.01) this.efecto('onda', j.cuerpo.x, 1, j.cuerpo.z, g.alcance, 0, 0.35);
    if (!alguno) j.comboT = 0;
  }

  /** Daño a un enemigo con todos los efectos (crítico, elemento, veneno, rayos, guardia y aturdimiento). */
  herirEnemigo(e: Enemigo, base: number, aturd: number, elemento: number, fuente: 'golpe' | 'hacha' | 'rayo' | 'runa' | 'cuervo' | 'efecto' | 'ejecucion') {
    if (e.estado === 'muerto') return;
    const j = this.jugador;
    const directo = fuente === 'efecto' || fuente === 'ejecucion';
    let { dano, critico } = directo ? { dano: base, critico: false } : danoFinal(base, this.multDano(), this.stats.critico, this.stats.multCritico, this.rng.siguiente());
    // Escuderos: de frente bloquean casi todo hasta que se les rompe la guardia.
    if (e.d.guardia && e.estado !== 'aturdido' && (fuente === 'golpe' || fuente === 'hacha')) {
      const deFrente = Math.abs(angulo(yawHacia(e.cuerpo.x, e.cuerpo.z, j.cuerpo.x, j.cuerpo.z) - e.yaw)) < 1.1;
      if (deFrente) {
        dano *= 0.15;
        aturd *= 1.6;
        this.efecto('chispa', e.cuerpo.x, 1.2, e.cuerpo.z, 0, 0, 0.25);
      }
    }
    if (e.congelado > 0) dano *= 1.3;
    e.vida -= dano;
    if (fuente !== 'efecto') {
      this.numeros.push({ x: e.cuerpo.x, y: e.cuerpo.alto + 0.4, z: e.cuerpo.z, valor: Math.round(dano), t: 0.8, critico, propio: false });
      this.efecto(fuente === 'rayo' ? 'rayo' : 'sangre', e.cuerpo.x, 1.1, e.cuerpo.z, e.cuerpo.x, e.cuerpo.z, 0.3);
      this.eventos.acierto?.(critico);
    }
    if (j.furiaT <= 0) j.furia = Math.min(100, j.furia + dano * 0.12 * this.stats.furiaGanancia);

    // Aturdimiento: al llenarse la barra, se le puede ejecutar.
    if (e.estado !== 'aturdido' && aturd > 0) {
      e.aturd += aturd * this.stats.aturdimiento;
      if (e.aturd >= e.d.aturdMax * (e.elite ? 1.5 : 1)) {
        e.estado = 'aturdido';
        e.t = e.d.jefe ? 3 : 3.5;
        e.ataque = null;
      }
    }
    // Hielo o fuego.
    if (elemento > 0) {
      if (ARMAS[this.arma].elemento === 'hielo') {
        e.hielo += elemento * this.stats.elemento;
        if (e.hielo >= 100) {
          e.hielo = 0;
          e.congelado = e.d.jefe ? 1.2 : 2.5;
          this.efecto('hielo', e.cuerpo.x, 1, e.cuerpo.z, 0, 0, 0.5);
        }
      } else {
        e.fuego = Math.max(e.fuego, 1 + elemento * 0.08 * this.stats.elemento);
      }
    }
    if (this.stats.veneno > 0 && fuente === 'golpe') {
      e.veneno = this.stats.veneno * multForja(this.forja);
      e.venenoT = 4;
    }
    // Tambaleo: los pequeños se interrumpen con los golpes (menos en ataques rojos).
    const firme = e.d.firme || e.elite || (e.estado === 'aviso' && e.ataque?.color === 'rojo');
    if (!firme && aturd >= 6 && (e.estado === 'mover' || e.estado === 'aviso' || e.estado === 'recuperar')) {
      e.estado = 'tambaleo';
      e.t = 0.32;
      e.ataque = null;
    }
    // Rayos de Thor encadenados.
    if (fuente === 'golpe' && this.stats.rayo > 0 && this.rng.siguiente() < this.stats.rayo) this.rayo(e);

    if (e.d.jefe && !e.fase2 && e.vida < e.vidaMax * 0.5) e.fase2 = true;
    if (e.vida <= 0) this.morir(e);
  }

  private rayo(origen: Enemigo) {
    let desde = origen;
    const tocados = new Set<number>([origen.id]);
    this.herirEnemigo(origen, this.stats.danoRayo, 4, 0, 'rayo');
    for (let k = 0; k < 3; k++) {
      let sig: Enemigo | null = null;
      let d = 6;
      for (const e of this.vivos) {
        if (tocados.has(e.id)) continue;
        const dist = Math.hypot(e.cuerpo.x - desde.cuerpo.x, e.cuerpo.z - desde.cuerpo.z);
        if (dist < d) {
          d = dist;
          sig = e;
        }
      }
      if (!sig) break;
      tocados.add(sig.id);
      this.efecto('rayo', desde.cuerpo.x, 1.2, desde.cuerpo.z, sig.cuerpo.x, sig.cuerpo.z, 0.25);
      this.herirEnemigo(sig, this.stats.danoRayo * 0.7, 4, 0, 'rayo');
      desde = sig;
    }
  }

  private morir(e: Enemigo) {
    e.estado = 'muerto';
    e.muerteT = 0;
    e.vida = 0;
    const j = this.jugador;
    const extra = e.elite ? 2 : 1;
    this.oro += e.d.oro * this.stats.oro * extra * (1 + (this.reino - 1) * 0.1);
    this.honor += e.d.honor * extra * this.modo.honor;
    this.bajas++;
    j.vida = Math.min(this.stats.vidaMax, j.vida + this.stats.curaAlMatar);
    if (j.furiaT <= 0) j.furia = Math.min(100, j.furia + 6 * this.stats.furiaGanancia);
    if (this.fijado === e) this.fijado = null;
    if (this.modificador === 'explosivos' && !e.d.jefe) this.areas.push({ x: e.cuerpo.x, z: e.cuerpo.z, r: 2.6, t: 1.2, total: 1.2, dano: 14 * e.mult, color: 'rojo', origen: null });
    this.eventos.baja?.(e);
  }

  /** Daño de un enemigo al jugador: esquiva, escudo, bloqueo perfecto, escudo de Freya y tambaleo. */
  golpearJugador(dano: number, color: ColorAtaque, ox: number, oz: number, atacante: Enemigo | null): 'esquivado' | 'parry' | 'bloqueo' | 'golpe' {
    const j = this.jugador;
    if (j.estado === 'muerto') return 'esquivado';
    if (j.invul > 0) return 'esquivado';
    const deFrente = Math.abs(angulo(yawHacia(j.cuerpo.x, j.cuerpo.z, ox, oz) - j.yaw)) < 1.75;
    const def = defensa(color, j.bloqueando && j.estado === 'libre', j.bloqueoT, this.modo.parry, deFrente);
    if (def === 'parry') {
      this.efecto('parry', j.cuerpo.x - Math.sin(j.yaw) * 0.6, 1.3, j.cuerpo.z - Math.cos(j.yaw) * 0.6, 0, 0, 0.4);
      j.venganzaT = this.stats.venganza;
      j.furia = Math.min(100, j.furia + 10);
      if (atacante && atacante.estado !== 'muerto') {
        const extra = color === 'azul' ? 3 : 1.2;
        atacante.aturd += 30 * extra * this.stats.aturdimiento;
        if (atacante.aturd >= atacante.d.aturdMax * (atacante.elite ? 1.5 : 1)) {
          atacante.estado = 'aturdido';
          atacante.t = 3;
        } else if (!atacante.d.jefe) {
          atacante.estado = 'tambaleo';
          atacante.t = color === 'azul' ? 1.2 : 0.7;
        }
        atacante.ataque = null;
      }
      if (this.stats.ondaParry > 0) {
        for (const e of this.vivos) if (Math.hypot(e.cuerpo.x - j.cuerpo.x, e.cuerpo.z - j.cuerpo.z) < 4) this.herirEnemigo(e, this.stats.ondaParry, 10, 0, 'runa');
        this.efecto('onda', j.cuerpo.x, 1, j.cuerpo.z, 4, 0, 0.4);
      }
      this.eventos.parry?.();
      return 'parry';
    }
    if (def === 'bloqueo') {
      dano *= DANO_BLOQUEADO;
      this.efecto('chispa', j.cuerpo.x - Math.sin(j.yaw) * 0.6, 1.3, j.cuerpo.z - Math.cos(j.yaw) * 0.6, 0, 0, 0.25);
      this.eventos.bloqueo?.();
    }
    dano *= (1 - this.stats.defensa) * (j.furiaT > 0 ? 0.7 : 1);
    const absorbido = Math.min(j.escudo, dano);
    j.escudo -= absorbido;
    dano -= absorbido;
    j.vida -= dano;
    this.numeros.push({ x: j.cuerpo.x, y: 2.2, z: j.cuerpo.z, valor: Math.round(dano + absorbido), t: 0.8, critico: false, propio: true });
    if (j.furiaT <= 0) j.furia = Math.min(100, j.furia + dano * 0.4 * this.stats.furiaGanancia);
    if (def === 'golpe') {
      this.eventos.dano?.();
      if (dano >= 12 && j.furiaT <= 0 && j.estado !== 'ejecutando') {
        j.estado = 'tambaleo';
        j.t = 0.35;
        j.bloqueando = false;
      }
    }
    if (j.vida <= 0) this.caer();
    return def;
  }

  /** Daño que no se puede bloquear ni esquivar (charcos ardientes). */
  private danarJugadorDirecto(dano: number) {
    const j = this.jugador;
    j.vida -= dano;
    if (j.vida <= 0) this.caer();
  }

  private caer() {
    const j = this.jugador;
    if (j.renacer) {
      j.renacer = false;
      j.vida = this.stats.vidaMax * 0.5;
      j.invul = 2;
      j.estado = 'libre';
      this.efecto('onda', j.cuerpo.x, 1, j.cuerpo.z, 6, 0, 0.8);
      for (const e of this.vivos) if (Math.hypot(e.cuerpo.x - j.cuerpo.x, e.cuerpo.z - j.cuerpo.z) < 6) e.aturd += 40;
      this.mensaje = '🔆 ¡La runa de renacer te devuelve al combate!';
      this.mensajeT = 3;
      return;
    }
    j.vida = 0;
    j.estado = 'muerto';
    this.terminar(false);
  }

  /* ---------- Hacha, runas y cuervos ---------- */

  private especial() {
    const j = this.jugador;
    if (this.arma === 'hacha') {
      const h = j.hacha;
      if (h.estado === 'mano') {
        const obj = this.fijado ?? this.masCercano(18, j.yaw);
        const yaw = obj ? yawHacia(j.cuerpo.x, j.cuerpo.z, obj.cuerpo.x, obj.cuerpo.z) : j.yaw;
        j.yaw = yaw;
        Object.assign(h, { estado: 'vuela', x: j.cuerpo.x - Math.sin(yaw) * 0.8, y: 1.3, z: j.cuerpo.z - Math.cos(yaw) * 0.8, vx: -Math.sin(yaw) * 30, vz: -Math.cos(yaw) * 30, recorrido: 0 });
        h.golpeados.clear();
        this.eventos.lanzar?.();
      } else if (h.estado === 'clavada' || h.estado === 'vuela') {
        h.estado = 'vuelve';
        h.golpeados.clear();
      }
      return;
    }
    // Cuchillas: torbellino de cadenas alrededor.
    if (j.recargaEspecial > 0) return;
    j.recargaEspecial = 4;
    this.empezarGolpe({ dano: 16, alcance: 4.6, arco: Math.PI * 2, duracion: 0.5, impacto: 0.5, aturd: 10, avance: 0, elemento: 22 });
  }

  private actualizarHacha(dt: number) {
    const j = this.jugador;
    const h = j.hacha;
    if (h.estado === 'vuela') {
      h.x += h.vx * dt;
      h.z += h.vz * dt;
      h.recorrido += 30 * dt;
      for (const e of this.vivos) {
        if (e.estado === 'aparecer' || h.golpeados.has(e.id)) continue;
        if (Math.hypot(e.cuerpo.x - h.x, e.cuerpo.z - h.z) < e.d.radio + 0.45) {
          h.golpeados.add(e.id);
          this.herirEnemigo(e, 18, 12, 45, 'hacha');
          h.estado = 'clavada';
          h.y = 0.3;
          return;
        }
      }
      const fuera = Math.hypot(h.x, h.z) > this.arena.radio - 0.3;
      const pared = this.rejilla.cerca(h.x, h.z).some((b) => Math.abs(h.x - b.x) < b.w / 2 && Math.abs(h.z - b.z) < b.d / 2 && h.y < b.y1);
      if (fuera || pared || h.recorrido > 20) {
        h.estado = 'clavada';
        h.y = fuera || pared ? h.y : 0.3;
        if (fuera || pared) {
          h.x -= h.vx * dt;
          h.z -= h.vz * dt;
        }
      }
    } else if (h.estado === 'vuelve') {
      const dx = j.cuerpo.x - h.x;
      const dz = j.cuerpo.z - h.z;
      const d = Math.hypot(dx, dz);
      if (d < 1) {
        h.estado = 'mano';
        j.furia = Math.min(100, j.furia + 3);
        this.eventos.atrapar?.();
        return;
      }
      const v = Math.min(d, 34 * dt);
      h.x += (dx / d) * v;
      h.z += (dz / d) * v;
      h.y += (1.3 - h.y) * Math.min(1, dt * 6);
      for (const e of this.vivos) {
        if (e.estado === 'aparecer' || h.golpeados.has(e.id)) continue;
        if (Math.hypot(e.cuerpo.x - h.x, e.cuerpo.z - h.z) < e.d.radio + 0.5) {
          h.golpeados.add(e.id);
          this.herirEnemigo(e, 14, 10, 30, 'hacha');
        }
      }
    }
  }

  private runa1() {
    const j = this.jugador;
    if (j.recargaRuna1 > 0) return;
    const runa = ARMAS[this.arma].runa;
    j.recargaRuna1 = runa.recarga * this.stats.recargaRunas;
    if (this.arma === 'hacha') {
      // Tormenta de escarcha: cono de hielo delante.
      const obj = this.fijado ?? this.masCercano(8, j.yaw);
      if (obj) j.yaw = yawHacia(j.cuerpo.x, j.cuerpo.z, obj.cuerpo.x, obj.cuerpo.z);
      for (const e of this.vivos) if (enArco(j.cuerpo.x, j.cuerpo.z, j.yaw, e.cuerpo.x, e.cuerpo.z, e.d.radio, 7, 1.4)) this.herirEnemigo(e, 26, 18, 75, 'runa');
      for (let k = 1; k <= 5; k++) this.efecto('hielo', j.cuerpo.x - Math.sin(j.yaw) * k * 1.3, 0.5, j.cuerpo.z - Math.cos(j.yaw) * k * 1.3, 0, 0, 0.6);
    } else {
      // Erupción: anillo de fuego alrededor.
      for (const e of this.vivos) if (Math.hypot(e.cuerpo.x - j.cuerpo.x, e.cuerpo.z - j.cuerpo.z) < 6 + e.d.radio) this.herirEnemigo(e, 30, 16, 70, 'runa');
      this.efecto('fuego', j.cuerpo.x, 0.3, j.cuerpo.z, 6, 0, 0.7);
    }
    j.estado = 'tambaleo';
    j.t = 0.35;
    this.eventos.runa?.();
  }

  private runa2() {
    const j = this.jugador;
    if (!this.tieneGrito || j.recargaRuna2 > 0) return;
    j.recargaRuna2 = 15 * this.stats.recargaRunas;
    j.vida = Math.min(this.stats.vidaMax, j.vida + 10);
    for (const e of this.vivos) {
      const dx = e.cuerpo.x - j.cuerpo.x;
      const dz = e.cuerpo.z - j.cuerpo.z;
      const d = Math.hypot(dx, dz);
      if (d > 6.5) continue;
      this.herirEnemigo(e, 8, 45, 0, 'runa');
      if (!e.d.jefe && e.estado !== 'muerto') moverCuerpo(e.cuerpo, (dx / (d || 1)) * 2.5, (dz / (d || 1)) * 2.5, 0, this.rejilla, 0);
    }
    this.efecto('onda', j.cuerpo.x, 1, j.cuerpo.z, 6.5, 0, 0.5);
    this.eventos.runa?.();
  }

  private actualizarCuervos(dt: number) {
    if (this.stats.cuervos <= 0) return;
    this.cuervoT -= dt;
    if (this.cuervoT > 0) return;
    this.cuervoT = 2.6 / this.stats.cuervos;
    const j = this.jugador.cuerpo;
    const obj = this.masCercano(16);
    if (!obj) return;
    this.proyectiles.push({ x: j.x, y: 2.6, z: j.z, vx: 0, vz: 0, dano: 9, radio: 0.3, color: 'amarillo', delJugador: true, vida: 3, tipo: 'cuervo', origen: obj });
  }

  /* ---------- Proyectiles y áreas ---------- */

  private actualizarProyectiles(dt: number) {
    const j = this.jugador;
    for (const p of this.proyectiles) {
      p.vida -= dt;
      if (p.tipo === 'cuervo' && p.origen) {
        // Los cuervos persiguen a su presa.
        const o = p.origen;
        const dx = o.cuerpo.x - p.x;
        const dz = o.cuerpo.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        p.vx = (dx / d) * 14;
        p.vz = (dz / d) * 14;
        p.y += (1.2 - p.y) * Math.min(1, dt * 3);
        if (o.estado === 'muerto') p.vida = 0;
      }
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      if (p.delJugador) {
        for (const e of this.vivos) {
          if (e.estado === 'aparecer') continue;
          if (Math.hypot(e.cuerpo.x - p.x, e.cuerpo.z - p.z) < e.d.radio + p.radio) {
            this.herirEnemigo(e, p.dano, 10, 0, p.tipo === 'cuervo' ? 'cuervo' : 'runa');
            p.vida = 0;
            break;
          }
        }
      } else if (Math.hypot(j.cuerpo.x - p.x, j.cuerpo.z - p.z) < j.cuerpo.radio + p.radio && p.y < 2.2) {
        const r = this.golpearJugador(p.dano, p.color, p.x - p.vx * 0.1, p.z - p.vz * 0.1, p.origen);
        if (r === 'parry') {
          // El bloqueo perfecto devuelve el proyectil contra quien lo lanzó.
          p.delJugador = true;
          p.vx = -p.vx * 1.3;
          p.vz = -p.vz * 1.3;
          p.dano *= 2;
          p.vida = 2;
          continue;
        }
        if (r !== 'esquivado') p.vida = 0;
      }
      if (Math.hypot(p.x, p.z) > this.arena.radio + 2) p.vida = 0;
      if (p.tipo !== 'cuervo' && this.rejilla.cerca(p.x, p.z).some((b) => Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.z - b.z) < b.d / 2 && p.y < b.y1)) p.vida = 0;
    }
    this.proyectiles = this.proyectiles.filter((p) => p.vida > 0);
  }

  private actualizarAreas(dt: number) {
    const j = this.jugador;
    for (const a of this.areas) {
      a.t -= dt;
      if (a.t > 0) continue;
      if (Math.hypot(j.cuerpo.x - a.x, j.cuerpo.z - a.z) < a.r + j.cuerpo.radio) this.golpearJugador(a.dano, a.color, a.x, a.z, a.origen);
      this.efecto('onda', a.x, 0.3, a.z, a.r, 0, 0.35);
    }
    this.areas = this.areas.filter((a) => a.t > 0);
  }

  efecto(tipo: TipoEfecto, x: number, y: number, z: number, x2: number, z2: number, t: number) {
    if (this.efectos.length > 80) this.efectos.shift();
    this.efectos.push({ tipo, x, y, z, x2, z2, t, total: t });
  }

  /** Separa a los enemigos para que no se amontonen en el mismo sitio. */
  private separarEnemigos() {
    const vivos = this.vivos;
    for (let i = 0; i < vivos.length; i++) {
      for (let k = i + 1; k < vivos.length; k++) {
        const a = vivos[i].cuerpo;
        const b = vivos[k].cuerpo;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = a.radio + b.radio + 0.1;
        if (d >= min || d < 1e-4) continue;
        const emp = (min - d) / 2;
        a.x -= (dx / d) * emp;
        a.z -= (dz / d) * emp;
        b.x += (dx / d) * emp;
        b.z += (dz / d) * emp;
      }
    }
  }
}
