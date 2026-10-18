# Plan: McL Valhalla (roguelike de acción nórdico)

## Qué es

Inspirado en el modo roguelike de los juegos de acción nórdicos: expediciones por reinos con combate cuerpo a cuerpo, bendiciones de los dioses y progreso permanente. Sin nombres, personajes ni armas de juegos comerciales; la mitología nórdica es de dominio público.

## Expedición

1. El Salón: mejoras con Honor y elección de arma.
2. Reino N: 5 encuentros (2 o 3 oleadas) con puertas de recompensa entre ellos, y un jefe.
3. Tras el jefe: volver al Salón (+25 % de Honor) o seguir al reino N+1.
4. Reinos en ciclo (Midgard, Muspelheim, Niflheim, Helheim, Asgard) y jefes en ciclo; la escala de vida, daño y presupuesto de enemigos crece sin límite.

## Reglas comunes (netlify/CLAUDE.md)

3D con three.js, avatares del Arcade para el guerrero y los humanoides (bestias low-poly con el mismo estilo), 4 dificultades (`MODOS`: vida, daño, ventana del bloqueo perfecto, Honor y atacantes a la vez), configuración común, pantalla completa, modo oscuro AMOLED, PWA y `rendimiento.ts`.

## Ideas siguientes

- Desafíos diarios con semilla compartida.
- Lanza y martillo.
- Compañero que ayuda en combate.
- Modo solo jefes.
