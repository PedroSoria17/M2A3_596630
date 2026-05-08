# EL PASILLO — Un homenaje a P.T.

Mini juego de terror en primera persona inspirado en el *playable teaser* de
*Silent Hills*. La escena ahora es una **calle en L** entre edificios
elevados y postes de luz, recorrida por una entidad demoníaca (Azazel) que
gana presencia con cada bucle.

## Cómo jugarlo

Los módulos ES requieren un servidor — **no** funciona abriendo el HTML con
doble clic.

```
cd pt-horror
python3 -m http.server 8000
# o npx serve .  o  Live Server (VS Code)
```

Abre `http://localhost:8000/` en Chrome/Firefox/Edge. Pulsa **Empezar** y usa
auriculares.

## Controles

| Tecla     | Acción                  |
| --------- | ----------------------- |
| `W A S D` | Moverse                 |
| Ratón     | Mirar                   |
| `E`       | Interactuar             |
| `ESC`     | Pausa / liberar cursor  |

## Mecánica

Estás en una calle que se repite. Llega a la puerta del fondo. Cada bucle
corrompe la realidad un poco más:

- **Bucle 1** — la radio capta un boletín de noticias.
- **Bucle 2** — los postes empiezan a fallar.
- **Bucle 3** — susurros, sangre en las paredes.
- **Bucle 4** — un bebé llora, el teléfono suena.
- **Bucle 5** — *Azazel* aparece al fondo.
- **Bucle 6** — *Azazel* te persigue. Si te alcanza, retrocedes un bucle.
- **Bucle 7** — la puerta se abre.

Hay **5 pósters de "DESAPARECIDA"** repartidos: `[E]` para recoger un fragmento.

## Entidad: Azazel

Mezcla de **Pazuzu** (demonio mesopotámico del viento, popularizado por *El
Exorcista*) y **Azazel** (uno de los Vigilantes caídos en el Libro de Enoc).
Cuernos curvados, ojos rojos, piel cenicienta, pezuñas digitígradas, garras
largas, sigilo en el pecho. Su voz es un rugido grave con distorsión y un
chillido demoníaco al final cuando salta sobre ti.

Todo el audio (drone subgrave, gruñido, susurros invertidos, scream) está
**sintetizado en tiempo real con Web Audio API** (osciladores + WaveShaper +
ring modulation). Sin assets externos.

## Configuración

Hay un menú de **Configuración** accesible desde el menú principal y desde la
pausa (`ESC` en juego). Permite ajustar:

- **Audio**: volumen general, efectos, ambiente
- **Video**: brillo, FOV, niebla
- **Control**: sensibilidad del ratón, sacudida de cámara, linterna

## Características técnicas

- **Three.js 0.160** vía CDN (importmap), sin build step.
- **Texturas procedurales** dibujadas en `<canvas>` (edificios, asfalto,
  acera, puerta metálica, póster, luna, demonio, cara para jumpscare).
- **Audio procedural** con Web Audio API (osciladores, filtros, distortion,
  ring mod, reverb mediante delay).
- **Camera shake** dinámica con decay.
- **Iluminación**: ambiente azul lunar, directional light de luna, postes con
  point lights, linterna spot del jugador, plus glow rojo de Azazel.
- **Colisión AABB** con deslizamiento por paredes y head bobbing al andar.

## Estructura

```
pt-horror/
├── index.html   — entrada, UI (menú, settings, pausa, jumpscare)
├── style.css    — estética, viñeta, animación de jumpscare
└── game.js      — motor, IA del demonio, audio procedural, settings
```

## Aviso

Contiene parpadeos de luz, llantos, susurros invertidos y un *jumpscare*
demoníaco con scream sintetizado. Reduce el volumen si lo necesitas.
