# Inmuno TD

Tower defense en rejilla que enseña inmunología. Inspirado en Plants vs. Zombies, PvZ Fusion y Rush Royale: cada mecánica es un concepto real (fagocitosis, citocinas, inflamación, NET, interferón, células NK), no un disfraz.

**Meta:** que alguien que no sabe nada de inmunología termine el juego y pueda aprobar un examen universitario introductorio. Proyecto abierto y sin ánimo de lucro, pensado para que profesores lo usen en clase.

**Demo:** https://gabdiasalejandro.github.io/Inmuno-TD/ (se publica desde `main`).

## Estado

Mundo 1 (inmunidad innata) en desarrollo:

| Nivel | Concepto |
| --- | --- |
| 1-1 | Barreras: epitelio y moco |
| 1-2 | Macrófago residente, PAMP y PRR |
| 1-3 | Neutrófilo y citocinas (botón de liberar) |
| 1-4 | Inflamación, NET y _Streptococcus pyogenes_ |
| 1-5 | Virus, interferón y célula NK (en curso) |

Incluye tutoriales guiados presentados por la médula ósea, almanaque y menú de mundos.

## Tecnologías

- **TypeScript** 7
- **Phaser** 4 (render e input)
- **Vite** 8 (servidor de desarrollo y build)
- **Vitest** 5 (tests de la simulación, balance y layout)
- **pnpm** como gestor de paquetes
- **GitHub Actions + GitHub Pages** para el despliegue
- Sprites en **SVG** por piezas, animados con tweens

## Comandos

```bash
pnpm install      # dependencias
pnpm dev          # servidor local en http://localhost:5173
pnpm build        # typecheck + build de producción en dist/
pnpm preview      # sirve el build
pnpm typecheck    # solo comprobación de tipos
pnpm test         # todos los tests
pnpm test:watch   # tests en modo observación
pnpm tunnel       # expone el servidor local con cloudflared (pruebas en móvil)
```

## Arquitectura

```
src/
  sim/       simulación pura, sin Phaser: estado, sistemas por mecánica, determinista
  game/      escenas Phaser (menú, nivel, almanaque), figuras y tutorial
  ui/        HUD, tarjetas, layouts puros testeables
  data/      unidades, enemigos, señales, niveles y tutoriales en JSON
  i18n/      textos visibles (español)
assets/sprites/<personaje>/   cuerpo.svg, ojos.svg, brazos.svg
docs/        revisión médica y guía de estilo
tests/       Vitest
```

- **Lógica separada del render:** `src/sim/` no importa Phaser, así que se prueba sola.
- **Determinista:** paso de tiempo fijo y azar con semilla; los tests de balance juegan niveles completos con bots.
- **Contenido en datos:** unidades, enemigos, niveles y tutoriales viven en JSON para que un inmunólogo pueda revisarlos sin tocar código. Un nivel nuevo es un archivo en `src/data/levels/`; su tutorial, uno en `src/data/tutorials/`.

## Documentación

- [`docs/fuentes.md`](docs/fuentes.md): cada afirmación de inmunología del juego, para la revisión médica.
- [`docs/simplificaciones.md`](docs/simplificaciones.md): dónde el juego simplifica la biología y qué ocurre en realidad.
- [`docs/guia-estilo.md`](docs/guia-estilo.md): guía de sprites (formato, trazo, paleta).
- [`CLAUDE.md`](CLAUDE.md): documento de diseño y plan de trabajo.

## Licencia

[MIT](LICENSE).
