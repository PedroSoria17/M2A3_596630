# EL PASILLO — Un homenaje a P.T.

Mini videojuego de terror en primera persona inspirado en el famoso *playable
teaser* (P.T.) de *Silent Hills*. Recreación libre, hecha desde cero con
**Three.js**, audio procedural (Web Audio API) y texturas dibujadas en
`<canvas>`. Sin assets externos, sin build step.

## Cómo jugarlo

1. Abre `index.html` en un navegador moderno (Chrome, Firefox, Edge…).
   - Lo más sencillo: levantar un servidor local en esta carpeta para que
     funcionen los módulos ES:
     ```
     python3 -m http.server 8000
     ```
     y abrir `http://localhost:8000/pt-horror/`.
2. Pulsa **Empezar**. El cursor quedará bloqueado.
3. Usa auriculares para una experiencia más inmersiva.

## Controles

| Tecla       | Acción                  |
| ----------- | ----------------------- |
| `W A S D`   | Moverse                 |
| Ratón       | Mirar                   |
| `E`         | Interactuar             |
| `ESC`       | Liberar el cursor       |

## Mecánica

Estás atrapado en un pasillo en L. Llega a la puerta del fondo. Cuando la
cruzas, el pasillo se reinicia. **Cada bucle corrompe la realidad**:

- **Bucle 1** — la radio captura un boletín de noticias.
- **Bucle 2** — las luces empiezan a fallar.
- **Bucle 3** — susurros, sangre, los cuadros cambian.
- **Bucle 4** — un bebé llora, el teléfono suena.
- **Bucle 5** — *Lisa* aparece al fondo del pasillo.
- **Bucle 6** — Lisa te persigue. **No te dejes alcanzar.**
- **Bucle 7** — la puerta se abre.

Interactúa con la **radio** (cerca del inicio) y el **teléfono** (al final del
segundo tramo) para escuchar fragmentos de la historia. Recoge los **5 cuadros
rotos** repartidos por el pasillo.

## Estructura del proyecto

```
pt-horror/
├── index.html   — entrada y UI (menú, subtítulos, jumpscare)
├── style.css    — estética desaturada con viñeta y estática
└── game.js      — motor 3D, IA del fantasma, bucles y audio procedural
```

## Aviso

Contiene parpadeos de luz, llantos y un *jumpscare*. Si eres sensible, mejor
no jugar de noche.
