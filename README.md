# McL Valhalla

Roguelike de acción en 3D para el navegador, con mitología nórdica. Cruzas los reinos uno tras otro: cada reino tiene 5 encuentros y un jefe, y la expedición no tiene final (los reinos se repiten en ciclo y cada vuelta es más difícil).

- **Combate cuerpo a cuerpo** en tercera persona: combo ligero de 4 golpes, ataque fuerte, golpe tras esquivar, esquiva con invulnerabilidad, escudo y **bloqueo perfecto** (aturde y devuelve los proyectiles).
- **Avisos de color**: amarillo se puede bloquear, rojo hay que esquivarlo, azul se castiga con un bloqueo perfecto.
- **Aturdimiento y remates**: llena la barra del enemigo y remátalo para curarte.
- **Armas**: Hacha de escarcha (se lanza, se clava y vuelve a la mano; sin ella se pelea a puñetazos) y Cuchillas ígneas (se desbloquean en el Salón).
- **Runas, furia y bendiciones** de Thor, Freya, Odín, Tyr, Skadi y Loki, con bendiciones dobles al combinar dioses.
- **Puertas** con recompensa: bendición, forja, fuente, Honor, prueba de élite o mercader. Modificadores de arena a partir del reino 3.
- **El Salón**: mejoras permanentes con el Honor que ganas en cada expedición, aunque caigas.
- Enemigos: draugr, escuderos, arqueros, lobos, berserkers, espectros, nigromantes y trolls. Jefes: Troll de piedra, Valquiria, Jarl draugr y Gran lobo.
- Teclado y ratón, mando y controles táctiles. Funciona sin conexión (PWA) y el progreso queda en el navegador.

Publicado en https://mcl-valhalla.netlify.app

## Desarrollo

```sh
npm install
npm run dev      # ?demo empieza una expedición directamente
npm test
npm run build
```

`src/core/*` es la lógica pura (combate, armas, enemigos, bendiciones, expedición, arena, progreso, física y navegación A*), `src/game/logica.ts` la expedición, `src/game/ia.ts` los enemigos y `src/game/render3d.ts` el dibujo con three.js.
