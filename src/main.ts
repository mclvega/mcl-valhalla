import './styles.css';

import { app } from './app';
import { audio } from './audio';
import { ARMAS, multForja, type IdArma } from './core/armas';
import { bendicionPorId, DIOSES, RAREZAS } from './core/bendiciones';
import { MODOS } from './core/difficulty';
import { ENEMIGOS } from './core/enemigos';
import { biomaDe, ENCUENTROS, jefeDe, MODIFICADORES, precios, RECOMPENSAS } from './core/expedicion';
import { Entrada } from './core/input';
import { iniciarBucle } from './core/loop';
import { comprar, MEJORAS, nivelMejora, puedeComprar } from './core/progreso';
import { iniciarPantallaCompleta } from './fullscreen';
import { controlesVacios, Partida, type Resumen } from './game/logica';
import type { Render3D } from './game/render3d';
import { Rendimiento, tamanoSombras } from './rendimiento';
import { anotarExpedicion, limpiarNombre } from './storage';
import { panelConfiguracion } from './ui/configuracion';
import { boton, h, mostrarPanel } from './ui/dom';
import { ControlesPsp } from './ui/psp';

const hud = document.getElementById('lienzo') as HTMLCanvasElement;
const ctx = hud.getContext('2d')!;
const lienzo3d = document.createElement('canvas');
lienzo3d.id = 'lienzo3d';
hud.before(lienzo3d);
const controles = document.getElementById('controles')!;
// Teclado y mando. En el mando, la misma disposición que la PSP: ✕ esquivar, ○ hacha, □ ligero, △ fuerte, L bloquear, R magia.
const entrada = new Entrada(
  [
    { nombre: 'ligero', teclas: [], mando: 2, etiqueta: '⚔️' },
    { nombre: 'fuerte', teclas: [], mando: 3, etiqueta: '💥' },
    { nombre: 'esquivar', teclas: ['Space'], mando: 0, etiqueta: '💨' },
    { nombre: 'bloquear', teclas: ['KeyQ', 'ShiftLeft'], mando: 4, etiqueta: '🛡️' },
    { nombre: 'especial', teclas: ['KeyE'], mando: 1, etiqueta: '🪓' },
    { nombre: 'runa1', teclas: ['Digit1'], mando: 5, etiqueta: '❄️' },
    { nombre: 'runa2', teclas: ['Digit2'], mando: 6, etiqueta: '📯' },
    { nombre: 'furia', teclas: ['KeyF'], mando: 10, etiqueta: '😡' },
    { nombre: 'fijar', teclas: ['Tab'], mando: 8, etiqueta: '🎯' },
    { nombre: 'pausa', teclas: [], mando: 9, etiqueta: '⏸' },
    { nombre: 'ejecutar', teclas: ['KeyR'], mando: 7, etiqueta: '💀' },
  ],
  controles,
);
const tactil = matchMedia('(pointer: coarse)').matches || (import.meta.env.DEV && location.search.includes('tactil'));
if (tactil) document.body.classList.add('tactil');

/* Mando PSP en pantalla (como PPSSPP): R + □ / △ / ○ lanza la magia, como en los juegos de acción de PSP. */
const psp = new ControlesPsp(controles, {
  cuadrado: 'Ligero', triangulo: 'Fuerte', cruz: 'Esquivar', circulo: 'Hacha · Rematar', L: 'Escudo', R: 'Magia', select: 'Fijar', start: 'Pausa',
});

let partida: Partida | null = null;
let render: Render3D | null = null;
let modulo3d: Promise<typeof import('./game/render3d')> | null = null;
const cargar3d = () => (modulo3d ??= import('./game/render3d'));

iniciarPantallaCompleta(() => app.g.config.pantallaCompleta);
app.aplicarConfig();

/* ---------- Tamaño ---------- */

const rend = new Rendimiento(() => app.g.config.calidad, () => app.g.config.limiteFps, () => ajustar());
let ancho = innerWidth;
let alto = innerHeight;
function ajustar() {
  ancho = innerWidth;
  alto = innerHeight;
  const dpr = Math.min(2, devicePixelRatio || 1);
  for (const c of [hud, lienzo3d]) {
    c.style.width = `${ancho}px`;
    c.style.height = `${alto}px`;
  }
  hud.width = Math.round(ancho * dpr);
  hud.height = Math.round(alto * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render?.ajustar(ancho, alto, rend.ratio);
}
addEventListener('resize', ajustar);
ajustar();

/* ---------- Cámara y ataques con el ratón ---------- */

let giroX = 0;
let giroY = 0;
let ligeroPendiente = false;
let fuertePendiente = false;
const sensibilidad = () => app.g.config.sensibilidad / 5;

addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== lienzo3d) return;
  giroX += e.movementX * 0.0025 * sensibilidad();
  giroY += e.movementY * 0.0025 * sensibilidad();
});
lienzo3d.addEventListener('mousedown', (e) => {
  if (!partida || tactil) return;
  if (document.pointerLockElement !== lienzo3d) {
    void lienzo3d.requestPointerLock();
    return;
  }
  if (e.button === 0) ligeroPendiente = true;
  if (e.button === 2) fuertePendiente = true;
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  if (e.code === 'Tab' && partida) e.preventDefault();
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== lienzo3d && partida?.fase === 'combate' && !partida.pausada && !tactil && document.body.classList.contains('jugando')) pausar();
});

// Táctil: arrastrar en la mitad derecha mueve la cámara.
const GIRO_TACTIL = 0.006;
const zonaMirar = h('div', { class: 'zona-mirar' });
controles.prepend(zonaMirar);
let toque = { id: -1, x: 0, y: 0 };
zonaMirar.addEventListener('pointerdown', (e) => {
  if (toque.id !== -1) return;
  zonaMirar.setPointerCapture(e.pointerId);
  toque = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
zonaMirar.addEventListener('pointermove', (e) => {
  if (e.pointerId !== toque.id) return;
  giroX += (e.clientX - toque.x) * GIRO_TACTIL * sensibilidad();
  giroY += (e.clientY - toque.y) * GIRO_TACTIL * sensibilidad();
  toque.x = e.clientX;
  toque.y = e.clientY;
});
const soltarToque = (e: PointerEvent) => e.pointerId === toque.id && (toque.id = -1);
zonaMirar.addEventListener('pointerup', soltarToque);
zonaMirar.addEventListener('pointercancel', soltarToque);

document.body.append(h('button', { type: 'button', class: 'boton-pausa', 'aria-label': 'Pausa', text: '⏸', onclick: () => pausar() }));

const vibrar = (ms: number) => app.g.config.vibracion && navigator.vibrate?.(ms);

/* ---------- Pantallas ---------- */

function jugando(si: boolean) {
  document.body.classList.toggle('jugando', si);
  if (!si) {
    entrada.limpiar();
    psp.limpiar();
    if (document.pointerLockElement) document.exitPointerLock();
  } else if (!tactil) void lienzo3d.requestPointerLock?.();
}

const AYUDA = tactil
  ? 'Mando de PSP: stick o cruceta para moverte; arrastra en la pantalla para la cámara. □ ligero, △ fuerte, ✕ esquivar, ○ hacha (o rematar al aturdido). L: escudo (justo a tiempo: bloqueo perfecto). R + □: runa, R + △: grito, R + ○: furia. SELECT fija el objetivo y START pausa. Aviso amarillo: bloquea. Rojo: esquiva. Azul: bloqueo perfecto.'
  : 'WASD para moverte y ratón para la cámara. Clic izquierdo: ligero; derecho: fuerte. Espacio esquiva; Q o Mayús bloquea (justo a tiempo: bloqueo perfecto). E lanza y llama al hacha. 1 y 2: runas. F: furia. R: rematar. Tab fija el objetivo. Aviso amarillo: bloquea. Rojo: esquiva. Azul: bloqueo perfecto.';

function bienvenida() {
  jugando(false);
  const campo = h('input', { type: 'text', maxlength: '20', placeholder: 'Tu nombre', 'aria-label': 'Tu nombre' }) as HTMLInputElement;
  const error = h('p', { class: 'error-campo', 'aria-live': 'polite' });
  const seguir = () => {
    const nombre = limpiarNombre(campo.value);
    if (!nombre) {
      error.textContent = 'Escribe tu nombre (hasta 20 caracteres).';
      return;
    }
    app.g.nombre = nombre;
    app.guardar();
    menu();
  };
  campo.addEventListener('keydown', (e) => e.key === 'Enter' && seguir());
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h1', { text: '🪓 McL Valhalla' }),
      h('p', { class: 'texto-suave', text: 'Cruza los reinos nórdicos uno tras otro. Cada expedición es distinta y no tiene final: los dioses te bendicen y el Honor que ganes te hace más fuerte.' }),
      campo,
      error,
      boton('Empezar', seguir, { variante: 'primario' }),
    ),
  );
  campo.focus();
}

function menu() {
  jugando(false);
  partida = null;
  const e = app.g.estadisticas;
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h1', { text: '🪓 McL Valhalla' }),
      h('p', { class: 'texto-suave', text: `¡Salve, ${app.nombre()}! · 🏅 ${app.g.honor} de Honor · Mejor: reino ${e.reinoMax}` }),
      boton('Jugar (ir al Salón)', salon, { variante: 'primario', icono: '▶' }),
      boton(`Dificultad: ${MODOS[app.g.config.dificultad].nombre}`, () => configuracion(), { icono: '🎯' }),
      boton('Personaje', () => void import('./ui/personaje').then((m) => m.pantallaPersonaje(menu)), { icono: '👕' }),
      boton('Récords', records, { icono: '🏆' }),
      boton('Configuración', () => configuracion(), { icono: '⚙️' }),
      h('p', { class: 'texto-suave ayuda-texto', text: AYUDA }),
    ),
  );
}

/** El Salón: mejoras permanentes con Honor, elegir arma y partir. */
function salon() {
  jugando(false);
  const g = app.g;
  const filas = MEJORAS.map((m) => {
    const n = nivelMejora(g.mejoras, m.id);
    const max = n >= m.max;
    const coste = m.coste(n);
    return h('div', { class: 'mejora' },
      h('div', { class: 'mejora-texto' }, h('strong', { text: `${m.icono} ${m.nombre} ${m.max > 1 ? `(${n}/${m.max})` : n ? '✔' : ''}` }), h('small', { text: m.texto })),
      boton(max ? 'Completa' : `🏅 ${coste}`, () => {
        g.honor = comprar(g.mejoras, m.id, g.honor);
        app.guardar();
        salon();
      }, { variante: puedeComprar(g.mejoras, m.id, g.honor) ? 'primario' : 'suave' }),
    );
  });
  // Botones de compra que no se pueden usar, deshabilitados.
  filas.forEach((f, i) => {
    const b = f.querySelector('button')!;
    if (!puedeComprar(g.mejoras, MEJORAS[i].id, g.honor)) b.disabled = true;
  });
  const armas = (Object.keys(ARMAS) as IdArma[]).map((id) => {
    const bloqueada = id === 'cuchillas' && !nivelMejora(g.mejoras, 'cuchillas');
    const b = boton(`${ARMAS[id].icono} ${ARMAS[id].nombre}${bloqueada ? ' 🔒' : ''}`, () => {
      g.arma = id;
      app.guardar();
      salon();
    });
    b.setAttribute('aria-pressed', String(g.arma === id));
    b.disabled = bloqueada;
    return b;
  });
  mostrarPanel(
    h('div', { class: 'tarjeta ancha' },
      h('div', { class: 'cabecera' }, boton('Menú', menu, { icono: '←' }), h('h2', { text: '🏛️ El Salón' })),
      h('p', { class: 'texto-suave', text: `🏅 ${g.honor} de Honor. Lo ganas en cada expedición, aunque caigas.` }),
      h('div', { class: 'segmentado' }, ...armas),
      boton(`Partir a ${biomaDe(1).nombre}`, empezar, { variante: 'primario', icono: '⚔️' }),
      h('h2', { text: 'Mejoras permanentes' }),
      ...filas,
    ),
  );
}

function configuracion(volver: () => void = menu, enJuego = false) {
  mostrarPanel(
    h('div', { class: 'tarjeta ancha' },
      h('div', { class: 'cabecera' }, boton('Volver', () => volver(), { icono: '←' }), h('h2', { text: '⚙️ Configuración' })),
      panelConfiguracion({ enJuego, alReiniciar: () => (app.g.nombre ? configuracion(volver, enJuego) : bienvenida()) }),
    ),
  );
}

function records() {
  const e = app.g.estadisticas;
  const dato = (t: string, v: string | number) => h('div', { class: 'fila-mejora' }, h('span', { text: t }), h('strong', { text: String(v) }));
  const filas = app.g.records.length
    ? app.g.records.map((r, i) => h('div', { class: 'fila-mejora' }, h('span', { text: `${i + 1}. ${r.nombre}` }), h('span', { text: `Reino ${r.reino} (${r.encuentro + 1}) · ${r.bajas} bajas · 🏅 ${r.honor}` })))
    : [h('p', { class: 'texto-suave', text: 'Aún no hay récords. ¡Parte a tu primera expedición!' })];
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h2', { text: '🏆 Récords' }),
      dato('Reino más alto', e.reinoMax),
      dato('Expediciones', e.expediciones),
      dato('Jefes vencidos', e.jefes),
      dato('Bajas totales', e.bajas),
      dato('Más bajas en una expedición', e.bajasMax),
      dato('Honor ganado en total', e.honorTotal),
      h('h2', { text: 'Mejores expediciones' }),
      ...filas,
      boton('Volver', menu, { icono: '←' }),
    ),
  );
}

/* ---------- Expedición ---------- */

let marcaDano = 0;
let marcaParry = 0;
let resumenFinal: Resumen | null = null;
let faseMostrada = '';

async function empezar() {
  audio.iniciar();
  const mod = await cargar3d();
  resumenFinal = null;
  faseMostrada = '';
  const p = new Partida({
    modo: MODOS[app.g.config.dificultad],
    arma: app.g.arma,
    mejoras: app.g.mejoras,
    eventos: {
      acierto: (c) => audio.efecto(c ? 'explosion' : 'golpe'),
      dano: () => {
        marcaDano = 0.6;
        audio.efecto('dano');
        vibrar(40);
      },
      parry: () => {
        marcaParry = 0.35;
        audio.efecto('nivel');
        vibrar(25);
      },
      bloqueo: () => audio.efecto('boton'),
      baja: () => audio.efecto('muerte'),
      ejecucion: () => audio.efecto('explosion'),
      lanzar: () => audio.efecto('disparo'),
      atrapar: () => audio.efecto('recoger'),
      runa: () => audio.efecto('nivel'),
      encuentro: () => audio.efecto('nivel'),
      fin: (r) => {
        resumenFinal = r;
        anotarExpedicion(app.g, r, app.nombre());
        app.guardar();
      },
    },
  });
  partida = p;
  if (import.meta.env.DEV) (window as unknown as { __partida: Partida }).__partida = p;
  if (!render) render = new mod.Render3D(lienzo3d);
  ajustar();
  mostrarPanel(null);
  jugando(true);
}

function pausar() {
  const p = partida;
  if (!p || p.fase !== 'combate' || p.pausada) return;
  p.pausada = true;
  jugando(false);
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h2', { text: '⏸ Pausa' }),
      h('p', { class: 'texto-suave', text: `Reino ${p.reino} · ${p.bioma.nombre} · Encuentro ${Math.min(p.encuentro + 1, ENCUENTROS + 1)} · ${p.bajas} bajas · 🏅 ${Math.round(p.honor)}` }),
      boton('Continuar', continuar, { variante: 'primario', icono: '▶' }),
      boton('Mis bendiciones', () => misBendiciones(pausar2), { icono: '⚡' }),
      boton('Configuración', () => configuracion(pausar2, true), { icono: '⚙️' }),
      boton('Abandonar la expedición', () => {
        if (!confirm('Volverás al Salón con el Honor ganado hasta ahora. ¿Seguro?')) return;
        p.pausada = false;
        p.abandonar();
      }, { icono: '🚪' }),
    ),
  );
}

function pausar2() {
  if (!partida) return menu();
  partida.pausada = false;
  pausar();
}

function continuar() {
  if (!partida) return;
  partida.pausada = false;
  mostrarPanel(null);
  jugando(true);
}

function misBendiciones(volver: () => void) {
  const p = partida!;
  const lista = p.tomadas.length
    ? p.tomadas.map((t) => {
        const b = bendicionPorId(t.id)!;
        const k = b.requiere ? 1 : RAREZAS[t.rareza].mult;
        return h('div', { class: 'bendicion' }, h('strong', { text: `${DIOSES[b.dios].icono} ${b.nombre}`, style: `color:${DIOSES[b.dios].color}` }), h('small', { text: b.texto(k) }));
      })
    : [h('p', { class: 'texto-suave', text: 'Aún no tienes bendiciones.' })];
  mostrarPanel(
    h('div', { class: 'tarjeta ancha' },
      h('div', { class: 'cabecera' }, boton('Volver', volver, { icono: '←' }), h('h2', { text: '⚡ Mis bendiciones' })),
      h('p', { class: 'texto-suave', text: `${ARMAS[p.arma].nombre} · forja +${Math.round((multForja(p.forja) - 1) * 100)} % · 💰 ${Math.floor(p.oro)}` }),
      ...lista,
    ),
  );
}

/** Pantallas entre combates, según la fase de la expedición. */
function pantallaFase(p: Partida) {
  jugando(false);
  if (p.fase === 'recompensa') {
    const r = p.recompensa;
    if ((r === 'bendicion' || r === 'elite') && p.ofertas.length) {
      const dios = DIOSES[p.ofertas[0].bendicion.dios];
      mostrarPanel(
        h('div', { class: 'tarjeta ancha' },
          h('h2', { text: r === 'elite' ? '💀 ¡Prueba superada! Elige una bendición' : `${dios.icono} Los dioses te ofrecen un don` }),
          ...p.ofertas.map((o, i) => {
            const d = DIOSES[o.bendicion.dios];
            const k = o.bendicion.requiere ? 1 : RAREZAS[o.rareza].mult;
            const b = h('button', { type: 'button', class: 'btn btn-secundario oferta', style: `border-color:${RAREZAS[o.rareza].color}` },
              h('strong', { text: `${d.icono} ${o.bendicion.nombre}`, style: `color:${d.color}` }),
              h('small', { text: `${d.nombre} · ${o.bendicion.requiere ? 'Doble' : RAREZAS[o.rareza].nombre}` }),
              h('span', { text: o.bendicion.texto(k) }),
            );
            b.addEventListener('click', () => {
              audio.efecto('recoger');
              p.elegirBendicion(i);
              p.terminarRecompensa();
            });
            return b;
          }),
        ),
      );
      return;
    }
    if (r === 'mercader') return mercader(p);
    mostrarPanel(
      h('div', { class: 'tarjeta' },
        h('h2', { text: `${RECOMPENSAS[r].icono} ${RECOMPENSAS[r].nombre}` }),
        h('p', { class: 'texto-suave', text: p.mensaje || RECOMPENSAS[r].texto }),
        boton('Seguir', () => p.terminarRecompensa(), { variante: 'primario', icono: '▶' }),
      ),
    );
    return;
  }
  if (p.fase === 'puertas') {
    mostrarPanel(
      h('div', { class: 'tarjeta ancha' },
        h('h2', { text: '🚪 Elige tu camino' }),
        h('p', { class: 'texto-suave', text: `Reino ${p.reino} · ${p.bioma.nombre} · ❤️ ${Math.ceil(p.jugador.vida)}/${p.stats.vidaMax} · 💰 ${Math.floor(p.oro)} · 🏅 ${Math.round(p.honor)}` }),
        ...p.puertas.map((pu, i) => {
          const info = pu === 'jefe' ? { icono: '👑', nombre: `Guardián: ${ENEMIGOS[jefeDe(p.reino)].nombre}`, texto: 'El jefe del reino. Al vencerlo podrás volver al Salón o seguir.' } : RECOMPENSAS[pu];
          const b = h('button', { type: 'button', class: 'btn btn-secundario oferta' }, h('strong', { text: `${info.icono} ${info.nombre}` }), h('span', { text: info.texto }));
          b.addEventListener('click', () => {
            audio.efecto('boton');
            p.elegirPuerta(i);
            mostrarPanel(null);
            jugando(true);
          });
          return b;
        }),
        boton('Mis bendiciones', () => misBendiciones(() => pantallaFase(p)), { icono: '⚡', variante: 'suave' }),
      ),
    );
    return;
  }
  if (p.fase === 'jefeVencido') {
    mostrarPanel(
      h('div', { class: 'tarjeta' },
        h('h2', { text: `👑 ¡${p.bioma.nombre} conquistado!` }),
        h('p', { class: 'texto-suave', text: `Llevas 🏅 ${Math.round(p.honor)} de Honor. Si vuelves ahora al Salón, ganas un 25 % más. Si sigues, el reino ${p.reino + 1} (${biomaDe(p.reino + 1).nombre}) será más duro.` }),
        boton(`Seguir a ${biomaDe(p.reino + 1).nombre}`, () => {
          p.seguirReino();
          mostrarPanel(null);
          jugando(true);
        }, { variante: 'primario', icono: '⚔️' }),
        boton('Volver al Salón (+25 % de Honor)', () => p.volverAlSalon(), { icono: '🏛️' }),
      ),
    );
    return;
  }
  if (p.fase === 'fin' && resumenFinal) {
    const r = resumenFinal;
    mostrarPanel(
      h('div', { class: 'tarjeta' },
        h('h2', { text: r.voluntario ? '🏛️ De vuelta en el Salón' : '💀 Has caído' }),
        h('p', { class: 'texto-suave', text: `Reino ${r.reino} (${biomaDe(r.reino).nombre}) · encuentro ${Math.min(r.encuentro + 1, ENCUENTROS + 1)} · ${r.bajas} bajas · ${r.jefes} jefes · ${Math.floor(r.tiempo / 60)}:${String(r.tiempo % 60).padStart(2, '0')}` }),
        h('p', { class: 'texto-suave', text: `+🏅 ${r.honor} de Honor (ahora tienes ${app.g.honor}).` }),
        boton('Ir al Salón', salon, { variante: 'primario', icono: '🏛️' }),
        boton('Reintentar', empezar, { icono: '↻' }),
        boton('Menú', menu, { icono: '🏠' }),
      ),
    );
  }
}

function mercader(p: Partida) {
  const pr = precios(p.reino);
  const item = (texto: string, precio: number, cosa: 'cura' | 'bendicion' | 'forja') => {
    const b = boton(`${texto} · 💰 ${precio}`, () => {
      if (p.comprar(cosa)) audio.efecto('recoger');
      mercader(p);
    });
    b.disabled = p.oro < precio;
    return b;
  };
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h2', { text: '🛒 El mercader' }),
      h('p', { class: 'texto-suave', text: `Tienes 💰 ${Math.floor(p.oro)} · ❤️ ${Math.ceil(p.jugador.vida)}/${p.stats.vidaMax}${p.mensaje && p.mensaje.indexOf('oro') === -1 ? ` · ${p.mensaje}` : ''}` }),
      item('❤️ Curar el 40 %', pr.cura, 'cura'),
      item('⚡ Bendición al azar', pr.bendicion, 'bendicion'),
      item('🔨 Mejorar el arma', pr.forja, 'forja'),
      boton('Seguir', () => p.terminarRecompensa(), { variante: 'primario', icono: '▶' }),
    ),
  );
}

addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' || (e.code === 'Escape' && tactil)) pausar();
});
document.addEventListener('visibilitychange', () => document.hidden && pausar());

/* ---------- HUD ---------- */

const COLOR_AVISO = { amarillo: '#ffd23f', rojo: '#ff3030', azul: '#3cb4ff' };

const sombra = (texto: string, x: number, y: number, color = '#fff') => {
  ctx.fillStyle = '#000a';
  ctx.fillText(texto, x + 1.5, y + 1.5);
  ctx.fillStyle = color;
  ctx.fillText(texto, x, y);
};

function barra(x: number, y: number, w: number, hh: number, valor: number, color: string, fondo = '#000a') {
  ctx.fillStyle = fondo;
  ctx.fillRect(x, y, w, hh);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * Math.min(1, Math.max(0, valor))), hh - 2);
}

function recarga(x: number, y: number, icono: string, falta: number, total: number, tecla: string, listo = falta <= 0) {
  ctx.fillStyle = '#000a';
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.fill();
  if (!listo && total > 0) {
    ctx.fillStyle = '#ffffff33';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - falta / total));
    ctx.fill();
  }
  ctx.strokeStyle = listo ? '#ffd23f' : '#fff5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.globalAlpha = listo ? 1 : 0.5;
  sombra(icono, x, y + 1);
  ctx.globalAlpha = 1;
  if (!tactil) {
    ctx.font = 'bold 10px system-ui, sans-serif';
    sombra(tecla, x + 13, y + 14, '#ddd');
  }
}

function dibujarHud(p: Partida, dt: number) {
  ctx.clearRect(0, 0, ancho, alto);
  ctx.textBaseline = 'middle';
  marcaDano = Math.max(0, marcaDano - dt);
  marcaParry = Math.max(0, marcaParry - dt);
  const j = p.jugador;
  const cx = ancho / 2;

  if (marcaDano > 0 || j.vida < p.stats.vidaMax * 0.25) {
    const g = ctx.createRadialGradient(cx, alto / 2, Math.min(ancho, alto) * 0.3, cx, alto / 2, Math.max(ancho, alto) * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(200,0,0,${Math.max(marcaDano * 0.6, j.vida < p.stats.vidaMax * 0.25 ? 0.3 : 0)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ancho, alto);
  }
  if (marcaParry > 0) {
    ctx.fillStyle = `rgba(120,210,255,${marcaParry * 0.5})`;
    ctx.fillRect(0, 0, ancho, alto);
  }
  if (p.lento) {
    ctx.fillStyle = 'rgba(255,40,40,0.08)';
    ctx.fillRect(0, 0, ancho, alto);
  }

  // Barras y avisos sobre los enemigos.
  if (render) {
    for (const e of p.enemigos) {
      if (e.estado === 'muerto' || e.estado === 'aparecer') continue;
      const alturaCabeza = 2.1 * e.d.escala + (e.d.vuela ? 0.5 : 0);
      const pt = render.proyectar(e.cuerpo.x, alturaCabeza, e.cuerpo.z, ancho, alto);
      if (!pt.visible) {
        // Fuera de la pantalla: flecha en el borde si te va a atacar.
        if (e.estado === 'aviso' && e.ataque) {
          const ex = pt.detras ? ancho - pt.x : pt.x;
          const ey = pt.detras ? alto - pt.y : pt.y;
          const ang = Math.atan2(ey - alto / 2, ex - cx);
          const r = Math.min(ancho, alto) * 0.42;
          const ax = cx + Math.cos(ang) * r;
          const ay = alto / 2 + Math.sin(ang) * r;
          ctx.fillStyle = COLOR_AVISO[e.ataque.color];
          ctx.beginPath();
          ctx.moveTo(ax + Math.cos(ang) * 16, ay + Math.sin(ang) * 16);
          ctx.lineTo(ax + Math.cos(ang + 2.4) * 12, ay + Math.sin(ang + 2.4) * 12);
          ctx.lineTo(ax + Math.cos(ang - 2.4) * 12, ay + Math.sin(ang - 2.4) * 12);
          ctx.fill();
        }
        continue;
      }
      if (e.d.jefe) continue;
      const w = e.elite ? 64 : 48;
      barra(pt.x - w / 2, pt.y, w, 6, e.vida / e.vidaMax, e.elite ? '#ffb020' : '#e53935');
      barra(pt.x - w / 2, pt.y + 7, w, 4, e.estado === 'aturdido' ? 1 : e.aturd / (e.d.aturdMax * (e.elite ? 1.5 : 1)), e.estado === 'aturdido' ? '#fff' : '#ffd23f');
      if (e.estado === 'aviso' && e.ataque) {
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        sombra('!', pt.x, pt.y - 14, COLOR_AVISO[e.ataque.color]);
      }
      if (e.estado === 'aturdido') {
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        sombra(tactil ? '○ Rematar' : '[R] Rematar', pt.x, pt.y - 12, '#fff');
      }
    }
    ctx.textAlign = 'center';
    for (const n of p.numeros) {
      const pt = render.proyectar(n.x, n.y + (0.8 - n.t) * 0.8, n.z, ancho, alto);
      if (!pt.visible) continue;
      ctx.font = `bold ${n.critico ? 22 : 16}px system-ui, sans-serif`;
      sombra(String(n.valor), pt.x, pt.y, n.propio ? '#ff6a6a' : n.critico ? '#ffd23f' : '#fff');
    }
  }

  // Vida, escudo y furia (arriba a la izquierda).
  // En táctil, a la derecha del botón L.
  const bx = tactil ? 112 : 14;
  const by = 14;
  const bw = tactil ? Math.min(190, ancho * 0.22) : Math.min(260, ancho * 0.36);
  barra(bx, by, bw, 18, j.vida / p.stats.vidaMax, j.vida > p.stats.vidaMax * 0.3 ? '#5ad13c' : '#ff5a5a');
  if (j.escudo > 0) barra(bx, by + 19, bw * Math.min(1, j.escudo / 60), 6, 1, '#5ab0ff', '#0000');
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  sombra(`❤️ ${Math.ceil(j.vida)}/${p.stats.vidaMax}${j.escudo > 0 ? `  🛡️ ${Math.ceil(j.escudo)}` : ''}${j.renacer ? '  🔆' : ''}`, bx + 6, by + 9);
  barra(bx, by + 27, bw * 0.75, 10, j.furiaT > 0 ? j.furiaT / 8 : j.furia / 100, j.furiaT > 0 ? '#ff5a2a' : j.furia >= 100 ? '#ffb020' : '#b5562a');
  ctx.font = 'bold 10px system-ui, sans-serif';
  sombra(j.furiaT > 0 ? '😡 ¡FURIA!' : j.furia >= 100 ? `😡 Furia lista ${tactil ? '' : '[F]'}` : '😡 Furia', bx + 6, by + 32);

  // Runas, hacha y bendiciones.
  const ry = by + 62;
  const arma = ARMAS[p.arma];
  const h2 = j.hacha;
  if (p.arma === 'hacha') recarga(bx + 18, ry, h2.estado === 'mano' ? '🪓' : '↩️', 0, 0, 'E', true);
  else recarga(bx + 18, ry, '🌀', j.recargaEspecial, 4, 'E');
  recarga(bx + 58, ry, arma.runa.icono, j.recargaRuna1, arma.runa.recarga * p.stats.recargaRunas, '1');
  if (p.tieneGrito) recarga(bx + 98, ry, '📯', j.recargaRuna2, 15 * p.stats.recargaRunas, '2');
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const dioses = [...new Set(p.tomadas.map((t) => bendicionPorId(t.id)?.dios))].filter((d): d is keyof typeof DIOSES => !!d);
  sombra(dioses.map((d) => `${DIOSES[d].icono}${p.tomadas.filter((t) => bendicionPorId(t.id)?.dios === d).length}`).join(' '), bx, ry + 32);

  // Reino y encuentro (arriba en el centro).
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  sombra(`Reino ${p.reino} · ${p.bioma.nombre} · ${p.esJefe ? '👑 Jefe' : `Encuentro ${p.encuentro + 1}/${ENCUENTROS}`}${p.elite ? ' · 💀 Élite' : ''}`, cx, 20);
  ctx.font = '12px system-ui, sans-serif';
  if (p.modificador) sombra(`${MODIFICADORES[p.modificador].nombre}: ${MODIFICADORES[p.modificador].texto}`, cx, 40, '#ffb37a');
  // Barra del jefe.
  const jefe = p.enemigos.find((e) => e.d.jefe && e.estado !== 'muerto');
  if (jefe) {
    const w = Math.min(460, ancho * 0.6);
    ctx.font = 'bold 14px system-ui, sans-serif';
    sombra(`${jefe.d.nombre}${jefe.fase2 ? ' · ¡enfurecido!' : ''}`, cx, 58, '#ffd23f');
    barra(cx - w / 2, 68, w, 12, jefe.vida / jefe.vidaMax, '#c62828');
    barra(cx - w / 2, 81, w, 5, jefe.estado === 'aturdido' ? 1 : jefe.aturd / jefe.d.aturdMax, '#ffd23f');
  }
  // Oro y Honor (arriba a la derecha, junto a la pausa).
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px system-ui, sans-serif';
  sombra(`💰 ${Math.floor(p.oro)}   🏅 ${Math.round(p.honor)}   ☠ ${p.bajas}`, tactil ? ancho - 112 : ancho - 66, 26);

  // Mensajes del centro.
  ctx.textAlign = 'center';
  if (p.mensajeT > 0) {
    ctx.font = 'bold 24px system-ui, sans-serif';
    sombra(p.mensaje, cx, alto * 0.3, '#ffd23f');
  }
  if (p.ejecutable() && !tactil) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    sombra('[R] o ataque: rematar', cx, alto * 0.7, '#fff');
  }
  if (p.arma === 'hacha' && h2.estado !== 'mano' && p.tiempo % 1 < 0.6) {
    ctx.font = '12px system-ui, sans-serif';
    sombra(`Sin hacha: peleas a puñetazos (aturden mucho). ${tactil ? '○' : 'E'} la llama.`, cx, alto - (tactil ? 18 : 24), '#ddd');
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

/* ---------- Bucle ---------- */

let fps = 60;
let ultimo = performance.now();
iniciarBucle(
  (dt) => rend.medir('logica', () => {
    entrada.actualizar();
    psp.actualizar();
    const p = partida;
    if (!p) return;
    if (p.fase !== 'combate') {
      // Entre combates se muestran las pantallas de la expedición.
      const clave = `${p.fase}${p.version}${p.ofertas.length}`;
      if (clave !== faseMostrada) {
        faseMostrada = clave;
        pantallaFase(p);
      }
      giroX = giroY = 0;
      return;
    }
    if (faseMostrada) {
      faseMostrada = '';
      mostrarPanel(null);
      jugando(true);
    }
    if (p.pausada) {
      giroX = giroY = 0;
      return;
    }
    if (psp.pulsado('start') || entrada.pulsado('pausa')) return pausar();
    const c = controlesVacios();
    c.x = entrada.x || psp.x;
    c.z = entrada.y || psp.y;
    c.giroX = giroX;
    c.giroY = giroY;
    giroX = giroY = 0;
    // PSP: con R mantenido, □ △ ○ son la magia (runa, grito y furia); sin R, los ataques normales.
    const r = psp.activo('R');
    const rematar = psp.pulsado('circulo') && !r && !!p.ejecutable();
    c.ligero = ligeroPendiente || entrada.pulsado('ligero') || (!r && psp.pulsado('cuadrado'));
    c.fuerte = fuertePendiente || entrada.pulsado('fuerte') || (!r && psp.pulsado('triangulo'));
    ligeroPendiente = fuertePendiente = false;
    c.esquivar = entrada.pulsado('esquivar') || psp.pulsado('cruz');
    c.bloquear = entrada.activo('bloquear') || psp.activo('L');
    c.especial = entrada.pulsado('especial') || (!r && !rematar && psp.pulsado('circulo'));
    c.runa1 = entrada.pulsado('runa1') || (r && psp.pulsado('cuadrado'));
    c.runa2 = entrada.pulsado('runa2') || (r && psp.pulsado('triangulo'));
    c.furia = entrada.pulsado('furia') || (r && psp.pulsado('circulo'));
    c.ejecutar = entrada.pulsado('ejecutar') || rematar;
    c.fijar = entrada.pulsado('fijar') || psp.pulsado('select');
    p.autoFijar = app.g.config.objetivoAuto;
    p.ayudaEsquiva = app.g.config.ayudaEsquiva;
    p.actualizar(dt, c);
  }),
  () => {
    const ahora = performance.now();
    if (!rend.debeDibujar(ahora, !partida || partida.pausada || partida.fase !== 'combate')) return;
    const dt = Math.min(0.1, (ahora - ultimo) / 1000);
    fps = fps * 0.9 + (1 / Math.max(0.001, dt)) * 0.1;
    ultimo = ahora;
    if (partida && render) {
      render.sombras(tamanoSombras(app.g.config.calidad));
      rend.medir('render', () => render!.dibujar(partida!, app.g.look, !app.g.config.animacionesReducidas, dt));
      dibujarHud(partida, dt);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, ancho, alto);
    }
    if (app.g.config.mostrarFps) {
      ctx.fillStyle = '#9f9';
      ctx.font = '11px monospace';
      ctx.fillText(`${Math.round(fps)} FPS`, 8, alto - 8);
    }
    rend.actualizarMonitor(render?.renderer ?? null);
  },
);

if (import.meta.env.DEV && location.search.includes('demo')) void empezar();
else if (app.g.nombre) menu();
else bienvenida();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
addEventListener('load', () => setTimeout(() => void cargar3d(), 800));
