import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ColorAtaque } from '../core/enemigos';
import { liberar } from '../rendimiento';
import { animateWalk, createAvatar, DEFAULT_LOOK, type Look } from './characters';
import { Partida, type Efecto, type Enemigo } from './logica';

const cacheMat = new Map<string, THREE.Material>();
function mat(color: number, basico = false, opacidad = 1): THREE.Material {
  const clave = `${color}|${basico}|${opacidad}`;
  let m = cacheMat.get(clave);
  if (!m) {
    const o = { color, transparent: opacidad < 1, opacity: opacidad, depthWrite: opacidad >= 1 };
    m = basico ? new THREE.MeshBasicMaterial(o) : new THREE.MeshLambertMaterial(o);
    cacheMat.set(clave, m);
  }
  return m;
}

function malla(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, sombra = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = sombra;
  m.receiveShadow = true;
  return m;
}

const COLOR_AVISO: Record<ColorAtaque, number> = { amarillo: 0xffd23f, rojo: 0xff3030, azul: 0x3cb4ff };

/** Hacha (o puño de cadenas) en la mano o volando. */
function modeloHacha(): THREE.Group {
  const g = new THREE.Group();
  g.add(malla(new THREE.CylinderGeometry(0.03, 0.035, 0.75, 6), mat(0x5d4037), 0, -0.1, 0));
  const hoja = new THREE.Shape();
  hoja.moveTo(0, 0);
  hoja.quadraticCurveTo(0.28, 0.05, 0.3, 0.26);
  hoja.quadraticCurveTo(0.16, 0.18, 0, 0.16);
  hoja.closePath();
  const geo = new THREE.ExtrudeGeometry(hoja, { depth: 0.03, bevelEnabled: false });
  const m = malla(geo, mat(0xcfe8f5), 0.02, 0.12, -0.015);
  g.add(m, malla(new THREE.BoxGeometry(0.08, 0.2, 0.06), mat(0x9fb4c0), 0, 0.2, 0));
  return g;
}

function modeloCuchilla(): THREE.Group {
  const g = new THREE.Group();
  g.add(malla(new THREE.BoxGeometry(0.05, 0.5, 0.025), mat(0xff7a2a, true), 0, 0.15, 0));
  g.add(malla(new THREE.BoxGeometry(0.12, 0.05, 0.05), mat(0x3e2723), 0, -0.12, 0));
  return g;
}

function modeloEscudo(): THREE.Group {
  const g = new THREE.Group();
  g.add(malla(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 14).rotateZ(Math.PI / 2), mat(0x8d6e4a), 0, 0, 0));
  g.add(malla(new THREE.CylinderGeometry(0.39, 0.39, 0.03, 14, 1, true).rotateZ(Math.PI / 2), mat(0x9e9e9e), 0, 0, 0));
  g.add(malla(new THREE.SphereGeometry(0.08, 8, 6), mat(0xbdbdbd), 0.04, 0, 0));
  return g;
}

function ojos(g: THREE.Object3D, x: number, y: number, z: number, sep: number, color: number, r = 0.05) {
  for (const s of [-1, 1]) g.add(malla(new THREE.SphereGeometry(r, 8, 6), mat(color, true), x + s * sep, y, z, false));
}

/** Lobo low-poly (también el Gran lobo, con otra escala y color). */
function modeloLobo(color: number): { grupo: THREE.Group; patas: THREE.Object3D[] } {
  const g = new THREE.Group();
  const pelo = mat(color);
  g.add(malla(new THREE.BoxGeometry(0.5, 0.5, 1.2), pelo, 0, 0.75, 0));
  g.add(malla(new THREE.BoxGeometry(0.42, 0.42, 0.42), pelo, 0, 0.95, -0.72));
  g.add(malla(new THREE.BoxGeometry(0.22, 0.2, 0.3), mat(0x9e9e9e), 0, 0.86, -1.0));
  g.add(malla(new THREE.SphereGeometry(0.05, 6, 4), mat(0x111111), 0, 0.92, -1.16));
  for (const s of [-1, 1]) g.add(malla(new THREE.ConeGeometry(0.08, 0.2, 4), pelo, s * 0.13, 1.25, -0.68));
  ojos(g, 0, 1.02, -0.93, 0.11, 0xffd23f, 0.045);
  const cola = malla(new THREE.CylinderGeometry(0.05, 0.1, 0.6, 5), pelo, 0, 0.95, 0.75);
  cola.rotation.x = -0.9;
  g.add(cola);
  const patas: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.18, -0.45], [0.18, -0.45], [-0.18, 0.45], [0.18, 0.45]]) {
    const pivote = new THREE.Group();
    pivote.position.set(x, 0.6, z);
    pivote.add(malla(new THREE.BoxGeometry(0.13, 0.6, 0.13), pelo, 0, -0.3, 0));
    g.add(pivote);
    patas.push(pivote);
  }
  return { grupo: g, patas };
}

/** Troll de piedra low-poly. */
function modeloTroll(): { grupo: THREE.Group; brazos: THREE.Object3D[]; patas: THREE.Object3D[] } {
  const g = new THREE.Group();
  const piedra = mat(0x7d858f);
  const musgo = mat(0x5a7a3a);
  g.add(malla(new THREE.DodecahedronGeometry(0.75, 0), piedra, 0, 1.55, 0));
  g.add(malla(new THREE.DodecahedronGeometry(0.42, 0), musgo, 0, 2.15, 0.15));
  g.add(malla(new THREE.DodecahedronGeometry(0.38, 0), piedra, 0, 2.35, -0.35));
  ojos(g, 0, 2.4, -0.68, 0.14, 0xffa23f, 0.06);
  const brazos: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(s * 0.85, 2, 0);
    p.add(malla(new THREE.CylinderGeometry(0.2, 0.26, 1.3, 6), piedra, 0, -0.65, 0), malla(new THREE.DodecahedronGeometry(0.3, 0), piedra, 0, -1.35, 0));
    g.add(p);
    brazos.push(p);
  }
  const patas: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(s * 0.38, 0.95, 0);
    p.add(malla(new THREE.CylinderGeometry(0.22, 0.26, 0.95, 6), piedra, 0, -0.48, 0));
    g.add(p);
    patas.push(p);
  }
  return { grupo: g, brazos, patas };
}

/** Espectro: túnica translúcida que flota. */
function modeloEspectro(): THREE.Group {
  const g = new THREE.Group();
  g.add(malla(new THREE.ConeGeometry(0.45, 1.5, 8, 1, true), new THREE.MeshLambertMaterial({ color: 0x9fc8d8, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }), 0, 1.1, 0, false));
  g.add(malla(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.75 }), 0, 1.95, 0, false));
  ojos(g, 0, 1.98, -0.22, 0.09, 0x6fffe0, 0.05);
  return g;
}

/** Apariencia de los enemigos humanoides (avatares del Arcade). */
function lookEnemigo(tipo: Enemigo['tipo'], id: number): Look {
  const piel = [0x8fa39a, 0x9aa89a, 0x7f948c][id % 3];
  const base: Look = { ...DEFAULT_LOOK, skin: piel, eyes: 'normal', hair: 'long', hairColor: 0xd8d8d8, facialHair: 'beard', shirt: 0x4e5b4f, bottom: 'pants', bottomColor: 0x3e3a33, hat: 'helmet', hatColor: 0x6d6d6d, accessory: 'none', body: 'slim' };
  switch (tipo) {
    case 'arquero': return { ...base, hat: 'none', shirt: 0x5d4b3a, accessory: 'scarf' };
    case 'escudero': return { ...base, shirt: 0x3d4a5a, body: 'strong' };
    case 'berserker': return { ...base, skin: 0xe0c0a0, hat: 'none', hair: 'mohawk', hairColor: 0xd84315, shirt: 0x5d4037, body: 'strong', facialHair: 'beard' };
    case 'nigromante': return { ...base, hat: 'none', hair: 'bald', shirt: 0x4a2a6a, bottomColor: 0x2a1a3a, facialHair: 'goatee' };
    case 'jarl': return { ...base, hat: 'crown', hatColor: 0xffb300, shirt: 0x37474f, body: 'strong', hairColor: 0xeeeeee };
    case 'valquiria': return { ...base, gender: 'girl', skin: 0xf5c9a0, hair: 'ponytail', hairColor: 0xf6d36b, facialHair: 'none', shirt: 0xe0e6ea, bottom: 'skirt', bottomColor: 0x8a9aa6, hat: 'helmet', hatColor: 0xcfd8dc, eyes: 'lashes', body: 'normal' };
    default: return base;
  }
}

interface Modelo {
  grupo: THREE.Group;
  /** Avatar del Arcade (humanoides) o null en bestias. */
  cuerpo: THREE.Group | null;
  brazos: THREE.Object3D[];
  patas: THREE.Object3D[];
  anillo: THREE.Mesh;
  hielo: THREE.Mesh;
  estrellas: THREE.Group;
  arma: THREE.Object3D | null;
}

export class Render3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly camara = new THREE.PerspectiveCamera(62, 1, 0.1, 200);
  private escena = new THREE.Scene();
  private estatico = new THREE.Group();
  private version = -1;
  private jugador: Modelo | null = null;
  private lookJugador = '';
  private armaJugador = '';
  private enemigos = new Map<Enemigo, Modelo>();
  private areas: THREE.Mesh[] = [];
  private proyectiles: THREE.Object3D[] = [];
  private tiposProyectil: string[] = [];
  private hachaVuela = modeloHacha();
  private efectos = new Map<Efecto, THREE.Object3D>();
  private marcaFijado: THREE.Mesh;
  private sol: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private tamSombras = -1;
  private vp = new THREE.Vector3();
  private miraX = 0;
  private miraZ = 0;

  constructor(lienzo: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.hemi = new THREE.HemisphereLight(0xeaf4ff, 0x445566, 1.4);
    this.sol = new THREE.DirectionalLight(0xfff1d6, 1.7);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sol.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
    this.sol.position.set(14, 40, 10);
    this.escena.add(this.hemi, this.sol, this.estatico, this.camara);
    this.hachaVuela.scale.setScalar(1.6);
    this.hachaVuela.visible = false;
    this.escena.add(this.hachaVuela);
    this.marcaFijado = malla(new THREE.TorusGeometry(0.7, 0.04, 4, 24).rotateX(Math.PI / 2), mat(0xffffff, true, 0.8), 0, 0.05, 0, false);
    this.escena.add(this.marcaFijado);
  }

  sombras(tam: number) {
    if (tam === this.tamSombras) return;
    this.tamSombras = tam;
    this.renderer.shadowMap.enabled = tam > 0;
    if (tam > 0) {
      this.sol.shadow.mapSize.set(tam, tam);
      this.sol.shadow.map?.dispose();
      this.sol.shadow.map = null;
    }
    this.escena.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
  }

  ajustar(ancho: number, alto: number, dpr: number) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(ancho, alto, false);
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
  }

  /** Arena nueva: suelo, borde, pilares, ruinas, charcos y decoración del reino. */
  private construirArena(p: Partida) {
    liberar(this.estatico);
    this.estatico.clear();
    for (const m of this.enemigos.values()) {
      this.escena.remove(m.grupo);
      liberar(m.grupo);
    }
    this.enemigos.clear();
    const b = p.bioma;
    const a = p.arena;
    const niebla = p.modificador === 'niebla';
    this.escena.background = new THREE.Color(b.cielo);
    this.escena.fog = new THREE.Fog(b.niebla, niebla ? 6 : 26, niebla ? 26 : 75);
    this.hemi.color.setHex(b.luz);

    const porMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const fijo = (...ms: THREE.Mesh[]) => {
      for (const m of ms) {
        m.updateMatrix();
        m.geometry.applyMatrix4(m.matrix);
        const material = m.material as THREE.Material;
        if (!porMaterial.has(material)) porMaterial.set(material, []);
        porMaterial.get(material)!.push(m.geometry);
      }
    };
    const suelo = malla(new THREE.CircleGeometry(a.radio + 14, 48).rotateX(-Math.PI / 2), mat(b.suelo), 0, 0, 0);
    suelo.castShadow = false;
    this.estatico.add(suelo);
    // Losas del centro y anillo de piedras del borde.
    fijo(malla(new THREE.RingGeometry(a.radio - 0.4, a.radio + 0.5, 48).rotateX(-Math.PI / 2), mat(b.piedra), 0, 0.02, 0));
    fijo(malla(new THREE.RingGeometry(2.6, 3.1, 32).rotateX(-Math.PI / 2), mat(b.piedra), 0, 0.02, 0));
    for (let i = 0; i < 40; i++) {
      const ang = (i / 40) * Math.PI * 2;
      const piedra = malla(new THREE.DodecahedronGeometry(0.55, 0), mat(b.piedra), Math.cos(ang) * (a.radio + 0.9), 0.3, Math.sin(ang) * (a.radio + 0.9));
      piedra.scale.set(1, 0.7 + (i % 3) * 0.25, 1);
      fijo(piedra);
    }
    for (const bl of a.bloques) {
      const alto = bl.y1 - bl.y0;
      if (bl.tipo === 'torre') {
        // Pilar con runas que brillan.
        fijo(malla(new THREE.CylinderGeometry(0.6, 0.72, alto, 8), mat(b.piedra), bl.x, alto / 2, bl.z), malla(new THREE.BoxGeometry(1.5, 0.3, 1.5), mat(b.piedra), bl.x, alto, bl.z));
        fijo(malla(new THREE.BoxGeometry(0.1, 0.5, 0.05), mat(0x6fd8ff, true), bl.x, alto * 0.55, bl.z - 0.66));
      } else if (bl.tipo === 'pared') fijo(malla(new THREE.BoxGeometry(bl.w, alto, bl.d), mat(b.piedra), bl.x, alto / 2, bl.z));
      else {
        const r = malla(new THREE.DodecahedronGeometry(0.5, 0), mat(b.piedra), bl.x, alto * 0.45, bl.z);
        r.scale.set(bl.w * 1.1, alto * 1.1, bl.d * 1.1);
        fijo(r);
      }
    }
    for (const ch of a.charcos) fijo(malla(new THREE.CircleGeometry(ch.r, 20).rotateX(-Math.PI / 2), mat(0xff6a1a, true), ch.x, 0.04, ch.z, false));
    // Decoración del reino fuera de la arena.
    for (const d of a.adornos) {
      const e = d.escala;
      switch (b.decor) {
        case 'pino':
          fijo(malla(new THREE.CylinderGeometry(0.2, 0.28, 1.6 * e, 6), mat(0x5d4037), d.x, 0.8 * e, d.z));
          for (let k = 0; k < 3; k++) fijo(malla(new THREE.ConeGeometry((1.7 - k * 0.45) * e, 1.8 * e, 7), mat(0x2e5d3a), d.x, (2 + k) * e, d.z), malla(new THREE.ConeGeometry((1 - k * 0.25) * e, 0.6 * e, 7), mat(0xf7fbff), d.x, (2.6 + k) * e, d.z));
          break;
        case 'lava':
          fijo(malla(new THREE.ConeGeometry(1.4 * e, 3 * e, 6), mat(0x2e211d), d.x, 1.5 * e, d.z), malla(new THREE.CircleGeometry(0.9 * e, 10).rotateX(-Math.PI / 2), mat(0xff6a1a, true), d.x + 1.5, 0.05, d.z, false));
          break;
        case 'cristal': {
          const c = malla(new THREE.OctahedronGeometry(0.9 * e, 0), mat(0x9fe8ff), d.x, 1.4 * e, d.z);
          c.scale.y = 2;
          fijo(c);
          break;
        }
        case 'lapida':
          fijo(malla(new THREE.BoxGeometry(0.8 * e, 1.3 * e, 0.25), mat(0x4a505a), d.x, 0.65 * e, d.z), malla(new THREE.SphereGeometry(0.15, 6, 4), mat(0x8fa0ff, true), d.x, 1.4 * e, d.z, false));
          break;
        case 'columna':
          fijo(malla(new THREE.CylinderGeometry(0.45 * e, 0.5 * e, 5 * e, 10), mat(0xf2e3b0), d.x, 2.5 * e, d.z), malla(new THREE.BoxGeometry(1.2 * e, 0.3, 1.2 * e), mat(0xc9a85a), d.x, 5 * e, d.z));
          break;
      }
    }
    for (const [material, geos] of porMaterial) {
      const conIndice = geos.filter((g) => g.index);
      const sinIndice = geos.filter((g) => !g.index);
      for (const lista of [conIndice, sinIndice]) if (lista.length) this.estatico.add(malla(mergeGeometries(lista), material));
      for (const g of geos) g.dispose();
    }
  }

  private extras(m: Omit<Modelo, 'anillo' | 'hielo' | 'estrellas'>, radio: number, alto: number): Modelo {
    const anillo = malla(new THREE.RingGeometry(radio + 0.15, radio + 0.4, 28).rotateX(-Math.PI / 2), mat(0xffd23f, true, 0.9), 0, 0.06, 0, false);
    anillo.visible = false;
    const hielo = malla(new THREE.BoxGeometry(radio * 2.4, alto * 1.05, radio * 2.4), mat(0x9fe8ff, false, 0.45), 0, alto / 2, 0, false);
    hielo.visible = false;
    const estrellas = new THREE.Group();
    for (let i = 0; i < 3; i++) estrellas.add(malla(new THREE.OctahedronGeometry(0.09, 0), mat(0xffe27a, true), Math.cos((i / 3) * Math.PI * 2) * 0.35, 0, Math.sin((i / 3) * Math.PI * 2) * 0.35, false));
    estrellas.position.y = alto + 0.25;
    estrellas.visible = false;
    m.grupo.add(anillo, hielo, estrellas);
    return { ...m, anillo, hielo, estrellas };
  }

  private modeloEnemigo(e: Enemigo): Modelo {
    let m = this.enemigos.get(e);
    if (m) return m;
    const esc = e.d.escala * (e.elite ? 1.12 : 1);
    let base: Omit<Modelo, 'anillo' | 'hielo' | 'estrellas'>;
    if (e.tipo === 'lobo' || e.tipo === 'granLobo') {
      const l = modeloLobo(e.tipo === 'granLobo' ? 0x3a3a44 : [0x8d8d8d, 0x6d6158, 0xbdbdbd][e.id % 3]);
      base = { grupo: l.grupo, cuerpo: null, brazos: [], patas: l.patas, arma: null };
    } else if (e.tipo === 'troll' || e.tipo === 'trollPequeno') {
      const t = modeloTroll();
      base = { grupo: t.grupo, cuerpo: null, brazos: t.brazos, patas: t.patas, arma: null };
      if (e.tipo === 'troll') base.grupo.scale.setScalar(1 / 1.6);
    } else if (e.tipo === 'espectro') {
      base = { grupo: modeloEspectro(), cuerpo: null, brazos: [], patas: [], arma: null };
    } else {
      const a = createAvatar(lookEnemigo(e.tipo, e.id));
      const brazos = a.body.userData.arms as THREE.Object3D[];
      let arma: THREE.Object3D | null = null;
      if (e.tipo === 'arquero') {
        arma = malla(new THREE.TorusGeometry(0.4, 0.025, 4, 12, Math.PI), mat(0x6d4c41), 0, -0.45, 0.1);
        arma.rotation.y = Math.PI / 2;
      } else if (e.tipo === 'nigromante') {
        arma = new THREE.Group();
        arma.add(malla(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 5), mat(0x3e2723), 0, -0.3, 0), malla(new THREE.SphereGeometry(0.1, 8, 6), mat(0xb36bff, true), 0, 0.38, 0));
      } else if (e.tipo === 'valquiria') {
        arma = malla(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 5), mat(0xcfd8dc), 0, -0.4, 0.2);
        arma.rotation.x = Math.PI / 2;
        // Alas.
        for (const s of [-1, 1]) {
          const ala = malla(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshLambertMaterial({ color: 0xf5f5f5, side: THREE.DoubleSide }), s * 0.55, 1.3, 0.25);
          ala.rotation.set(0, s * 0.5, s * 0.4);
          a.body.add(ala);
        }
      } else {
        arma = new THREE.Group();
        arma.add(malla(new THREE.BoxGeometry(0.06, 0.75, 0.03), mat(0x9e9e9e), 0, 0.15, 0), malla(new THREE.BoxGeometry(0.2, 0.05, 0.05), mat(0x5d4037), 0, -0.22, 0));
        arma.position.set(0, -0.45, 0.15);
        arma.rotation.x = Math.PI / 2;
      }
      brazos[1].add(arma);
      if (e.tipo === 'escudero' || e.tipo === 'jarl') {
        const escudo = modeloEscudo();
        escudo.position.set(-0.12, -0.35, 0.1);
        brazos[0].add(escudo);
      }
      base = { grupo: a.group, cuerpo: a.body, brazos, patas: [], arma };
    }
    const contenedor = new THREE.Group();
    base.grupo.scale.multiplyScalar(esc);
    contenedor.add(base.grupo);
    m = this.extras({ ...base, grupo: contenedor }, e.d.radio, 1.9 * e.d.escala);
    // El modelo interior es el que se anima; el contenedor lleva posición, anillo y estados.
    m.cuerpo = base.cuerpo;
    (m as Modelo & { interior: THREE.Group }).interior = base.grupo;
    this.enemigos.set(e, m);
    this.escena.add(contenedor);
    return m;
  }

  private modeloJugador(p: Partida, look: Look): Modelo {
    const clave = JSON.stringify(look) + p.arma;
    if (this.jugador && clave === this.lookJugador) return this.jugador;
    if (this.jugador) {
      this.escena.remove(this.jugador.grupo);
      liberar(this.jugador.grupo);
    }
    this.lookJugador = clave;
    const a = createAvatar(look);
    const brazos = a.body.userData.arms as THREE.Object3D[];
    const escudo = modeloEscudo();
    escudo.position.set(-0.12, -0.35, 0.1);
    brazos[0].add(escudo);
    const m = this.extras({ grupo: a.group, cuerpo: a.body, brazos, patas: [], arma: null }, 0.4, 1.9);
    this.jugador = m;
    this.armaJugador = '';
    this.escena.add(a.group);
    return m;
  }

  private ponerArma(p: Partida, m: Modelo) {
    const enMano = p.arma === 'cuchillas' || p.jugador.hacha.estado === 'mano';
    const clave = `${p.arma}${enMano}`;
    if (clave === this.armaJugador) return;
    this.armaJugador = clave;
    if (m.arma) {
      // Las dos cuchillas se quitan juntas.
      for (const o of [m.arma, m.arma.userData.gemela as THREE.Object3D | undefined]) {
        if (!o) continue;
        o.parent?.remove(o);
        liberar(o);
      }
      m.arma = null;
    }
    if (!enMano) return;
    const arma = p.arma === 'hacha' ? modeloHacha() : modeloCuchilla();
    arma.position.set(0, -0.48, 0.12);
    arma.rotation.x = Math.PI / 2;
    m.brazos[1].add(arma);
    if (p.arma === 'cuchillas') {
      const otra = modeloCuchilla();
      otra.position.set(0.15, -0.3, 0);
      m.brazos[0].add(otra);
      arma.userData.gemela = otra;
    }
    m.arma = arma;
  }

  dibujar(p: Partida, look: Look, efectos: boolean, dt: number) {
    if (p.version !== this.version) {
      this.version = p.version;
      this.construirArena(p);
    }
    const j = p.jugador;
    const mj = this.modeloJugador(p, look);
    this.ponerArma(p, mj);
    this.animarJugador(p, mj);

    // Cámara detrás del guerrero; con un objetivo fijado mira entre los dos.
    const dist = 7.2;
    const cp = Math.cos(p.camPitch);
    let mx = j.cuerpo.x;
    let mz = j.cuerpo.z;
    if (p.fijado) {
      mx = (j.cuerpo.x * 2 + p.fijado.cuerpo.x) / 3;
      mz = (j.cuerpo.z * 2 + p.fijado.cuerpo.z) / 3;
    }
    const k = Math.min(1, dt * 6);
    this.miraX += (mx - this.miraX) * k;
    this.miraZ += (mz - this.miraZ) * k;
    if (Math.hypot(this.miraX - mx, this.miraZ - mz) > 8) {
      this.miraX = mx;
      this.miraZ = mz;
    }
    this.camara.position.set(j.cuerpo.x + Math.sin(p.camYaw) * dist * cp, 1.4 + dist * Math.sin(p.camPitch), j.cuerpo.z + Math.cos(p.camYaw) * dist * cp);
    this.camara.lookAt(this.miraX, 1.3, this.miraZ);
    this.sol.position.set(j.cuerpo.x + 14, 40, j.cuerpo.z + 10);
    this.sol.target.position.set(j.cuerpo.x, 0, j.cuerpo.z);
    this.sol.target.updateMatrixWorld();

    const vivos = new Set(p.enemigos);
    for (const [e, m] of this.enemigos) {
      if (!vivos.has(e)) {
        this.escena.remove(m.grupo);
        liberar(m.grupo);
        this.enemigos.delete(e);
      }
    }
    for (const e of p.enemigos) this.animarEnemigo(p, e, this.modeloEnemigo(e));

    // Objetivo fijado.
    this.marcaFijado.visible = !!p.fijado;
    if (p.fijado) {
      this.marcaFijado.position.set(p.fijado.cuerpo.x, 0.05, p.fijado.cuerpo.z);
      this.marcaFijado.scale.setScalar(p.fijado.d.radio + 0.5);
      this.marcaFijado.rotation.y = p.tiempo * 2;
    }

    this.dibujarAreas(p);
    this.dibujarProyectiles(p);
    this.dibujarEfectos(p, efectos);
    const h = j.hacha;
    this.hachaVuela.visible = p.arma === 'hacha' && h.estado !== 'mano';
    if (this.hachaVuela.visible) {
      this.hachaVuela.position.set(h.x, h.y, h.z);
      if (h.estado === 'clavada') this.hachaVuela.rotation.set(0.6, 0, 0.4);
      else this.hachaVuela.rotation.set(0, 0, -p.tiempo * 25);
    }
    this.renderer.render(this.escena, this.camara);
  }

  private animarJugador(p: Partida, m: Modelo) {
    const j = p.jugador;
    m.grupo.position.set(j.cuerpo.x, j.cuerpo.y, j.cuerpo.z);
    m.grupo.rotation.set(0, j.yaw + Math.PI, 0);
    const [izq, der] = m.brazos;
    if (m.cuerpo) animateWalk(m.cuerpo, p.tiempo * 1.4, j.moviendose && j.estado === 'libre');
    m.cuerpo!.rotation.x = 0;
    m.grupo.visible = j.estado !== 'muerto';
    // Escudo arriba al bloquear; ataque: brazo derecho de atrás hacia delante.
    izq.rotation.set(j.bloqueando ? -1.5 : -0.3, 0, j.bloqueando ? 0.6 : 0.15);
    if (j.estado === 'atacando' && j.golpe) {
      const fr = Math.min(1, j.t / j.golpe.duracion);
      const ataque = fr < j.golpe.impacto ? -2.6 * (fr / j.golpe.impacto) : -2.6 + (fr - j.golpe.impacto) * 3.6;
      der.rotation.set(ataque, 0, j.combo % 2 ? -0.6 : 0.4);
      if (j.golpe.arco >= Math.PI * 2 - 0.01) m.grupo.rotation.y += fr * Math.PI * 2;
    } else if (j.estado === 'ejecutando') {
      der.rotation.set(-2.8 + (1 - j.t / 0.75) * 2.4, 0, 0);
    } else {
      der.rotation.set(-0.5, 0, -0.1);
    }
    // Rodada al esquivar.
    if (j.estado === 'esquivando' && m.cuerpo) {
      m.cuerpo.rotation.x = -(j.t / 0.36) * Math.PI * 2;
      m.cuerpo.position.y = 0.3;
    } else if (m.cuerpo) m.cuerpo.position.y = 0;
    m.anillo.visible = j.furiaT > 0;
    if (j.furiaT > 0) (m.anillo.material as THREE.MeshBasicMaterial).color.setHex(0xff5a2a);
    m.estrellas.visible = j.estado === 'tambaleo';
    m.estrellas.rotation.y = p.tiempo * 6;
  }

  private animarEnemigo(p: Partida, e: Enemigo, m: Modelo) {
    const interior = (m as Modelo & { interior: THREE.Group }).interior;
    m.grupo.position.set(e.cuerpo.x, e.cuerpo.y + (e.d.vuela ? 0.4 + Math.sin(p.tiempo * 2 + e.id) * 0.15 : 0), e.cuerpo.z);
    m.grupo.rotation.set(0, e.yaw + Math.PI, 0);
    const congelado = e.congelado > 0;
    m.hielo.visible = congelado;
    m.estrellas.visible = e.estado === 'aturdido';
    m.estrellas.rotation.y = p.tiempo * 5;
    // Aviso del ataque con su color.
    const avisando = e.estado === 'aviso' && !!e.ataque;
    m.anillo.visible = avisando;
    if (avisando) {
      (m.anillo.material as THREE.MeshBasicMaterial).color.setHex(COLOR_AVISO[e.ataque!.color]);
      m.anillo.scale.setScalar(1 + Math.sin(p.tiempo * 20) * 0.08);
    }
    if (e.estado === 'aparecer') {
      interior.position.y = -1.8 * e.d.escala * Math.min(1, e.t / 0.9);
    } else interior.position.y = 0;
    if (e.estado === 'muerto') {
      const k = Math.min(1, e.muerteT * 2.5);
      interior.rotation.x = (-Math.PI / 2) * k;
      interior.position.y = -Math.max(0, e.muerteT - 0.8) * 1.2;
      return;
    }
    interior.rotation.x = e.estado === 'tambaleo' ? 0.25 : 0;
    const anda = !congelado && (e.estado === 'mover' || e.estado === 'embestida');
    const t = congelado ? 0 : p.tiempo * (e.estado === 'embestida' ? 3 : 1.4) + e.id;
    if (m.cuerpo) {
      animateWalk(m.cuerpo, t, anda);
      const [izq, der] = m.brazos;
      if (e.estado === 'aviso' && e.ataque) {
        const fr = e.t / p.avisoDe(e, e.ataque);
        der.rotation.set(-0.6 - fr * 2.2, 0, 0.3);
        izq.rotation.set(e.d.guardia ? -1.4 : -0.4 - fr, 0, 0.3);
      } else if (e.estado === 'recuperar') {
        der.rotation.set(-0.3, 0, 0.2);
      } else {
        der.rotation.set(-0.9, 0, 0.1);
        izq.rotation.set(e.d.guardia ? -1.4 : -0.4, 0, e.d.guardia ? 0.6 : 0.1);
      }
    } else {
      for (let i = 0; i < m.patas.length; i++) m.patas[i].rotation.x = anda ? Math.sin(t * 5 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 : 0;
      if (m.brazos.length) {
        const sube = e.estado === 'aviso' && e.ataque ? -(e.t / p.avisoDe(e, e.ataque)) * 2.4 : anda ? Math.sin(t * 4) * 0.4 : 0;
        m.brazos[0].rotation.x = sube;
        m.brazos[1].rotation.x = e.estado === 'aviso' ? sube : -sube;
      }
      // Lobos: se agachan antes de saltar.
      if (e.estado === 'aviso' && (e.tipo === 'lobo' || e.tipo === 'granLobo')) interior.rotation.x = -0.25;
    }
  }

  private dibujarAreas(p: Partida) {
    while (this.areas.length < p.areas.length) {
      const g = malla(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.35, depthWrite: false }), 0, 0.07, 0, false);
      const borde = malla(new THREE.RingGeometry(0.93, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.9, depthWrite: false }), 0, 0.01, 0, false);
      g.add(borde);
      this.areas.push(g);
      this.escena.add(g);
    }
    this.areas.forEach((m, i) => {
      const a = p.areas[i];
      m.visible = !!a;
      if (!a) return;
      const color = COLOR_AVISO[a.color];
      (m.material as THREE.MeshBasicMaterial).color.setHex(color);
      ((m.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(color);
      // El relleno crece hasta el borde justo cuando estalla.
      const k = 1 - Math.max(0, a.t) / a.total;
      m.position.set(a.x, 0.07, a.z);
      m.scale.setScalar(a.r * Math.max(0.05, k));
      (m.children[0] as THREE.Mesh).scale.setScalar(1 / Math.max(0.05, k));
    });
  }

  private dibujarProyectiles(p: Partida) {
    // Se recrean solo si cambia el tipo en esa posición del grupo.
    p.proyectiles.forEach((pr, i) => {
      if (this.tiposProyectil[i] !== pr.tipo) {
        const viejo = this.proyectiles[i];
        if (viejo) {
          this.escena.remove(viejo);
          liberar(viejo);
        }
        let m: THREE.Object3D;
        if (pr.tipo === 'flecha') m = malla(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4).rotateX(Math.PI / 2), mat(0x6d4c41));
        else if (pr.tipo === 'roca') m = malla(new THREE.DodecahedronGeometry(0.55, 0), mat(0x7d858f));
        else if (pr.tipo === 'pluma') m = malla(new THREE.ConeGeometry(0.08, 0.6, 4).rotateX(-Math.PI / 2), mat(0xf5f5f5, true));
        else if (pr.tipo === 'cuervo') {
          const g = new THREE.Group();
          g.add(malla(new THREE.SphereGeometry(0.16, 8, 6), mat(0x1a1a22)), malla(new THREE.PlaneGeometry(0.7, 0.2), new THREE.MeshBasicMaterial({ color: 0x2a2a35, side: THREE.DoubleSide }), 0, 0.05, 0));
          (g.children[1] as THREE.Mesh).rotation.x = -Math.PI / 2;
          m = g;
        } else m = malla(new THREE.SphereGeometry(0.22, 10, 8), mat(0x6fffe0, true));
        this.proyectiles[i] = m;
        this.tiposProyectil[i] = pr.tipo;
        this.escena.add(m);
      }
      const m = this.proyectiles[i];
      m.visible = true;
      m.position.set(pr.x, pr.y, pr.z);
      m.rotation.y = Math.atan2(pr.vx, pr.vz);
      if (pr.tipo === 'roca') m.rotation.x = p.tiempo * 6;
      // Un proyectil devuelto por un bloqueo perfecto se ve dorado.
      if (pr.delJugador && pr.tipo !== 'cuervo' && (m as THREE.Mesh).material) (m as THREE.Mesh).material = mat(0xffd23f, true);
    });
    for (let i = p.proyectiles.length; i < this.proyectiles.length; i++) this.proyectiles[i].visible = false;
  }

  private dibujarEfectos(p: Partida, completos: boolean) {
    const activos = new Set(p.efectos);
    for (const [ef, o] of this.efectos) {
      if (!activos.has(ef)) {
        this.escena.remove(o);
        liberar(o);
        this.efectos.delete(ef);
      }
    }
    for (const ef of p.efectos) {
      let o = this.efectos.get(ef);
      const k = 1 - ef.t / ef.total;
      if (!o) {
        o = this.crearEfecto(ef, completos);
        this.efectos.set(ef, o);
        this.escena.add(o);
      }
      if (ef.tipo === 'onda' || (ef.tipo === 'fuego' && ef.x2 > 0)) {
        // Anillos que se abren (ondas y la erupción de fuego).
        o.scale.setScalar(Math.max(0.1, ef.x2 * (0.3 + k * 0.7)));
        ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
      } else if (ef.tipo !== 'rayo') {
        // Partículas que salen hacia fuera y caen.
        o.children.forEach((c) => {
          const v = c.userData.v as THREE.Vector3 | undefined;
          if (!v) return;
          c.position.set(v.x * k, v.y * k - 4 * k * k, v.z * k);
          c.scale.setScalar(Math.max(0.05, 1 - k));
        });
        if (ef.tipo === 'parry' || ef.tipo === 'ejecucion') o.scale.setScalar(1 + k * 1.5);
      }
    }
  }

  private crearEfecto(ef: Efecto, completos: boolean): THREE.Object3D {
    if (ef.tipo === 'rayo') {
      // Rayo en zigzag entre dos puntos.
      const pts: THREE.Vector3[] = [];
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const sx = i && i < n ? (Math.random() - 0.5) * 0.6 : 0;
        pts.push(new THREE.Vector3(ef.x + (ef.x2 - ef.x) * t + sx, ef.y + 0.5 + (i && i < n ? (Math.random() - 0.5) * 0.6 : 0) + (ef.x2 === ef.x ? (1 - t) * 3 : 0), ef.z + (ef.z2 - ef.z) * t + sx));
      }
      return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9fd8ff }));
    }
    if (ef.tipo === 'onda' || (ef.tipo === 'fuego' && ef.x2 > 0)) {
      const m = malla(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: ef.tipo === 'fuego' ? 0xff6a1a : 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), ef.x, ef.y, ef.z, false);
      return m;
    }
    const color = { chispa: 0xffe27a, sangre: 0xb71c1c, hielo: 0x9fe8ff, fuego: 0xff7a2a, parry: 0x6fd8ff, ejecucion: 0xff3030, veneno: 0x9ad13c, rayo: 0x9fd8ff, onda: 0xffffff }[ef.tipo];
    const g = new THREE.Group();
    g.position.set(ef.x, ef.y, ef.z);
    const n = completos ? (ef.tipo === 'ejecucion' || ef.tipo === 'parry' ? 14 : 7) : 3;
    for (let i = 0; i < n; i++) {
      const c = malla(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat(color, true), 0, 0, 0, false);
      c.userData.v = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3);
      g.add(c);
    }
    if (ef.tipo === 'parry') g.add(malla(new THREE.SphereGeometry(0.35, 10, 8), mat(0xbfefff, true, 0.6), 0, 0, 0, false));
    return g;
  }

  /** Proyecta un punto del mundo a la pantalla (barras, números y avisos). */
  proyectar(x: number, y: number, z: number, ancho: number, alto: number): { x: number; y: number; visible: boolean; detras: boolean } {
    const v = this.vp.set(x, y, z).project(this.camara);
    const detras = v.z > 1;
    return { x: ((v.x + 1) / 2) * ancho, y: ((1 - v.y) / 2) * alto, visible: !detras && Math.abs(v.x) < 1 && Math.abs(v.y) < 1, detras };
  }
}

export { Partida };
