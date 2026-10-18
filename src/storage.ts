import type { IdArma } from './core/armas';
import { MEJORAS, type IdMejora, type Mejoras } from './core/progreso';
import { DEFAULT_LOOK, LOOK_OPTIONS, type Look } from './game/look';
import { configPorDefecto, normalizarConfig, type Configuracion } from './settings';

export interface Record_ {
  nombre: string;
  /** Reino alcanzado y encuentro dentro de él. */
  reino: number;
  encuentro: number;
  bajas: number;
  honor: number;
  fecha: string;
}

export interface Estadisticas {
  expediciones: number;
  reinoMax: number;
  bajas: number;
  bajasMax: number;
  honorTotal: number;
  jefes: number;
}

const estadisticasNuevas = (): Estadisticas => ({ expediciones: 0, reinoMax: 0, bajas: 0, bajasMax: 0, honorTotal: 0, jefes: 0 });

export interface Guardado {
  v: 1;
  nombre: string | null;
  /** Honor para gastar en el Salón. */
  honor: number;
  mejoras: Mejoras;
  arma: IdArma;
  records: Record_[];
  estadisticas: Estadisticas;
  /** Apariencia del guerrero (mismo sistema de personajes que el Arcade). */
  look: Look;
  config: Configuracion;
}

export const CLAVE_GUARDADO = 'mcl-valhalla:v1';
const MAX_RECORDS = 10;

export const guardadoNuevo = (): Guardado => ({
  v: 1, nombre: null, honor: 0, mejoras: {}, arma: 'hacha', records: [], estadisticas: estadisticasNuevas(),
  look: { ...DEFAULT_LOOK, shirt: 0x8e24aa, hair: 'mohawk', hairColor: 0xd84315, facialHair: 'beard', body: 'strong', hat: 'helmet', hatColor: 0x9e9e9e, bottomColor: 0x6d4c41 } as Look,
  config: configPorDefecto(),
});

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const entero = (v: unknown, min: number, max: number, porDefecto: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : porDefecto;

function normalizarRecord(v: unknown): Record_ | null {
  if (!esObjeto(v) || typeof v.nombre !== 'string' || typeof v.fecha !== 'string') return null;
  return {
    nombre: v.nombre.slice(0, 20), reino: entero(v.reino, 1, 1e6, 1), encuentro: entero(v.encuentro, 0, 5, 0),
    bajas: entero(v.bajas, 0, 1e7, 0), honor: entero(v.honor, 0, 1e9, 0), fecha: v.fecha,
  };
}

/** Orden de la tabla: más lejos (reino y encuentro) y, a igualdad, más bajas. */
const comparar = (a: Record_, b: Record_) => b.reino - a.reino || b.encuentro - a.encuentro || b.bajas - a.bajas;

function normalizarEstadisticas(v: unknown): Estadisticas {
  const e = estadisticasNuevas();
  if (!esObjeto(v)) return e;
  for (const k of Object.keys(e) as Array<keyof Estadisticas>) e[k] = entero(v[k], 0, 1e9, 0);
  return e;
}

function normalizarMejoras(v: unknown): Mejoras {
  const m: Mejoras = {};
  if (!esObjeto(v)) return m;
  for (const def of MEJORAS) {
    const n = entero(v[def.id], 0, def.max, 0);
    if (n > 0) m[def.id as IdMejora] = n;
  }
  return m;
}

/** Cada rasgo debe ser una de las opciones conocidas; si no, se usa el de por defecto. */
export function normalizarLook(entrada: unknown, porDefecto: Look): Look {
  if (!esObjeto(entrada)) return { ...porDefecto };
  const look = { ...porDefecto } as Record<string, unknown>;
  for (const [clave, opciones] of Object.entries(LOOK_OPTIONS)) {
    const valor = entrada[clave];
    const validos = (opciones as readonly unknown[]).map((o) => (typeof o === 'object' && o ? (o as { id: string }).id : o));
    if (validos.includes(valor)) look[clave] = valor;
  }
  return look as unknown as Look;
}

/** Valida datos guardados: cualquier campo dañado vuelve a su valor por defecto. */
export function normalizarGuardado(entrada: unknown): Guardado {
  const base = guardadoNuevo();
  if (!esObjeto(entrada)) return base;
  const records = Array.isArray(entrada.records)
    ? entrada.records.map(normalizarRecord).filter((r): r is Record_ => r !== null).sort(comparar).slice(0, MAX_RECORDS)
    : [];
  const mejoras = normalizarMejoras(entrada.mejoras);
  const arma: IdArma = entrada.arma === 'cuchillas' && mejoras.cuchillas ? 'cuchillas' : 'hacha';
  return {
    v: 1,
    nombre: typeof entrada.nombre === 'string' ? limpiarNombre(entrada.nombre) : null,
    honor: entero(entrada.honor, 0, 1e9, 0),
    mejoras,
    arma,
    records,
    estadisticas: normalizarEstadisticas(entrada.estadisticas),
    look: normalizarLook(entrada.look, base.look),
    config: normalizarConfig(entrada.config),
  };
}

export function agregarRecord(g: Guardado, r: Record_): boolean {
  g.records.push(r);
  g.records.sort(comparar);
  g.records = g.records.slice(0, MAX_RECORDS);
  return g.records.includes(r);
}

/** Anota el final de una expedición: el Honor se guarda siempre (también al caer). */
export function anotarExpedicion(g: Guardado, r: { reino: number; encuentro: number; bajas: number; honor: number; jefes: number }, nombre: string): boolean {
  const e = g.estadisticas;
  e.expediciones++;
  e.bajas += r.bajas;
  e.bajasMax = Math.max(e.bajasMax, r.bajas);
  e.reinoMax = Math.max(e.reinoMax, r.reino);
  e.honorTotal += r.honor;
  e.jefes += r.jefes;
  g.honor += r.honor;
  return agregarRecord(g, { nombre, reino: r.reino, encuentro: r.encuentro, bajas: r.bajas, honor: r.honor, fecha: new Date().toISOString().slice(0, 10) });
}

/** Nombre del jugador: 1 a 20 caracteres; letras, espacios, punto, apóstrofo y guion. */
export function limpiarNombre(texto: string): string | null {
  const limpio = texto.replace(/\s+/g, ' ').trim().slice(0, 20);
  return /^[\p{L}\p{M}\d .'-]{1,20}$/u.test(limpio) ? limpio : null;
}

function almacenSeguro(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function cargar(almacen: Pick<Storage, 'getItem'> | null = almacenSeguro()): Guardado {
  try {
    const texto = almacen?.getItem(CLAVE_GUARDADO);
    return texto ? normalizarGuardado(JSON.parse(texto)) : guardadoNuevo();
  } catch {
    return guardadoNuevo();
  }
}

export function guardar(g: Guardado, almacen: Pick<Storage, 'setItem'> | null = almacenSeguro()): void {
  try {
    almacen?.setItem(CLAVE_GUARDADO, JSON.stringify(g));
  } catch {
    // Sin almacenamiento (ventana privada o bloqueado): el juego sigue en memoria.
  }
}
