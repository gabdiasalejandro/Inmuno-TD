# Tower defense de inmunología (nombre provisional: Inmuno TD)

Documento de proyecto y plan de trabajo. Está escrito para que Claude Code lo lea al inicio de cada sesión.

## 1. Qué es

Un tower defense en rejilla, inspirado en Plants vs. Zombies (base), PvZ Fusion (fusiones) y Rush Royale (merge y azar), que enseña inmunología.

- **Meta de aprendizaje:** alguien que no sabe nada de inmunología termina el juego y puede aprobar un examen universitario introductorio sencillo.
- **Meta final:** que universidades y profesores lo adopten en sus cursos.
- **Público:** estudiantes, pero debe ser divertido para alguien que no es médico ni biólogo.
- **Plataforma:** navegador de escritorio y navegador móvil, con posible migración a nativo.
- **Primera entrega:** el mundo 1 (inmunidad innata) completo y pulido: 8 niveles, jefe, arte final, sonido, almanaque y preguntas.
- **Equipo:** una persona programando con Claude Code. Arte simple en SVG generado por modelo y revisado a mano.

## 2. Reglas de trabajo para Claude Code

Estas reglas mandan sobre cualquier otra cosa del documento.

### 2.1 Inmunología: implementar y dejar lista la revisión médica

Un médico revisará toda la inmunología cuando la demo esté lista (decidido el 2026-11-14). Hasta entonces no se bloquea el trabajo por verificación bibliográfica.

- Implementar con conocimiento estándar de inmunología, sin búsqueda de fuentes concepto por concepto.
- `docs/fuentes.md` es la lista de revisión para el médico: una línea por cada cosa que el juego afirma y dónde se usa (unidad, regla, pregunta). Añadir fuente solo si ya se tiene a mano.
- Si hay duda real sobre si algo es cierto, marcarlo como `dudoso` en esa lista en vez de investigarlo a fondo. No inventar datos concretos (cifras, nombres de moléculas) de los que no se esté seguro.
- Cuando el juego simplifica la biología por jugabilidad, registrar la simplificación en `docs/simplificaciones.md` con lo que ocurre en realidad. El almanaque debe poder aclararla.
- Una mecánica no debe enseñar algo que se sabe falso. Si jugabilidad y exactitud chocan de forma clara, consultar.

### 2.2 Consultar las mecánicas

Cualquier mecánica nueva, o cambio a una existente, se consulta con el usuario antes de implementarla. Presentar opciones concretas con sus consecuencias y esperar respuesta. Esto incluye: unidades y enemigos nuevos, fusiones, reglas de estados, economía, condiciones de victoria y derrota, y la forma de las preguntas.

Sí se puede decidir sin consultar: detalles de implementación, refactors, nombres internos, tests y correcciones de errores.

### 2.3 Diseño de nivel

El diseño de nivel se pule por iteraciones, pero la primera versión de cada nivel debe intentar estar bien hecha: con objetivo de aprendizaje claro, curva de dificultad razonada y balance probado con tests de simulación. No entregar niveles de relleno esperando arreglarlos después.

Al entregar un nivel, explicar brevemente qué enseña, cómo se gana, cómo se pierde y qué dudas de balance quedan.

### 2.4 Estilo visual y personajes

El estilo de la sección 6 es una dirección general, no una regla fija. Cada personaje se afina aparte con el usuario. Proponer, mostrar y ajustar.

### 2.5 Nombres reales

Unidades, enemigos, estados y fusiones usan siempre el nombre real (neutrófilo, opsonización, MHC I). Sin apodos. El humor va en el almanaque, separado del dato.

### 2.6 Orquestación de modelos

La sesión principal actúa como jefe: planifica con el usuario, reparte trabajo a subagentes, revisa lo que devuelven y es la única que consulta al usuario. Los subagentes no deciden mecánicas (2.2).

| Modelo | Papel                | Para qué                                                                                                    |
| ------ | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Haiku  | Auxiliar             | Tareas mecánicas y baratas: búsquedas, comprobaciones puntuales de un dato, mantener listas al día.         |
| Sonnet | Ejecutor             | Tareas de implementación acotadas y ya decididas: código, tests, datos JSON, sprites SVG según la guía.     |
| Opus   | Especialista         | Lo que exige más razonamiento: diseño del sistema de estados y reglas, balance, depuración difícil.         |
| Jefe   | Dirección y revisión | Plan, reparto, revisión de diffs, ejecución de tests, consultas al usuario. Hace él mismo lo que es pequeño. |

Reglas de reparto:

- **Encargo cerrado.** Cada tarea delegada lleva objetivo, archivos que puede tocar, criterios de aceptación y comandos de verificación. El subagente devuelve qué hizo y el resultado observado de esos comandos.
- **Nada se da por hecho sin revisión.** El jefe revisa el diff y vuelve a ejecutar `pnpm typecheck` y `pnpm test` antes de aceptar un trabajo.
- **Fuentes, solo si se piden.** Si se consulta bibliografía, citar literalmente y no de memoria. El texto completo de artículos abiertos se obtiene por Europe PMC: `https://www.ebi.ac.uk/europepmc/webservices/rest/<PMCID>/fullTextXML` (NCBI Bookshelf y PMC web bloquean a las herramientas).
- **No delegar por delegar.** Un cambio pequeño y entendido lo hace el jefe directamente. Se delega cuando hay trabajo independiente que puede ir en paralelo o que llenaría el contexto del jefe.
- **Dudas hacia arriba.** Si un subagente encuentra una decisión de mecánica, un choque entre jugabilidad y exactitud o una fuente que contradice el diseño, se detiene y lo devuelve al jefe, que consulta al usuario.

## 3. Principio de diseño

Cada mecánica es el concepto, no un disfraz. Si el jugador gana, es porque entendió la inmunología. Los niveles entregan el conocimiento uno por uno y la dificultad sube porque hay que combinar más conceptos, no por números inflados.

## 4. Mecánicas

Punto de partida acordado. Los detalles se consultan (regla 2.2).

- **Rejilla por carriles** tipo PvZ, con colocación deliberada. Cada carril representa tejido (epitelio, tejido, ganglio).
- **Recurso:** la médula ósea produce la energía para desplegar células. Es fija: no se planta ni ocupa casillas. Da energía a ritmo basal constante y las citocinas aceleran esa producción, a cambio de subir la inflamación desde el nivel 1-4 (decidido el 2026-11-14). Se descartó el girasol plantable porque enseñaría que la médula se multiplica en el tejido. La producción basal está implementada; el acelerón por citocinas llega con el nivel 1-3.
- **Inmunidad innata:** barata e inmediata. Epitelio y moco (muro), neutrófilo (barato, vive poco), macrófago (tanque que fagocita), NK (mata células propias infectadas), complemento (trampas).
- **Inmunidad adaptativa:** lenta pero decisiva. Los enemigos muertos sueltan antígeno, una célula dendrítica lo lleva al ganglio y, tras un retraso, se desbloquean linfocitos específicos para ese patógeno.
- **Fusiones** como cooperación celular real: Th + B da célula plasmática, Th1 + macrófago da macrófago activado, anticuerpo + enemigo lo deja opsonizado.
- **Merge y azar:** los linfocitos salen con receptor aleatorio (recombinación V(D)J) y solo sirven los que encajan con el antígeno de la oleada. Fusionar iguales es expansión clonal y maduración de afinidad.
- **Memoria:** un patógeno vencido deja células de memoria y el reencuentro arranca más rápido. Las vacunas se compran antes del nivel.
- **Segunda forma de perder:** barra de inflamación. Desplegar de más daña el tejido propio (tormenta de citocinas, autoinmunidad).
- **PAMP y PRR:** cada patógeno lleva un emblema visible (PAMP) que las células innatas reconocen.

## 5. Ruta del juego

### 5.1 Mundos y jefes

| Mundo | Tema                                                             | Jefe                                                         |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| 1     | Inmunidad innata (barreras, fagocitos, inflamación, complemento) | _Staphylococcus aureus_                                      |
| 2     | Presentación de antígeno y MHC                                   | Herpesvirus que oculta el MHC I                              |
| 3     | Linfocitos T                                                     | _Mycobacterium tuberculosis_ (se gana formando el granuloma) |
| 4     | Linfocitos B y anticuerpos                                       | Neumococo encapsulado                                        |
| 5     | Memoria y vacunas                                                | Sarampión (borra células de memoria)                         |
| 6     | Evasión inmune                                                   | VIH (elimina los Th y rompe las fusiones)                    |
| 7     | Autoinmunidad e hipersensibilidad                                | Lupus (el enemigo son unidades propias)                      |
| 8     | Final                                                            | Célula tumoral (PD-1, inhibidor de checkpoint)               |

Los jefes y sus mecánicas son propuestas. Verificar cada una con fuentes (regla 2.1) y consultar (regla 2.2).

### 5.2 Mundo 1, la demo

Cada nivel añade una sola pieza y obliga a usar las anteriores.

1. **Barreras:** solo epitelio y moco. Una herida abre un carril.
2. **Macrófago residente:** solo ataca enemigos con PAMP, que detecta con su PRR. Fagocitosis.
3. **Neutrófilo:** el macrófago emite citocinas al detectar enemigos, y eso abarata y acelera los neutrófilos. Viven poco.
4. **Inflamación:** aparece la barra. Más inflamación trae refuerzos más rápido, pero daña el tejido.
5. **Virus:** infecta células propias. El interferón protege a las vecinas y la NK mata a las que esconden su MHC I.
6. **Complemento:** trampas que opsonizan o perforan (MAC).
7. **Nivel trampa:** el mismo patógeno vuelve tres veces y la respuesta innata es igual de lenta cada vez. Aparece la célula dendrítica como gancho al mundo 2.
8. **Jefe, _S. aureus_:** se amuralla en un absceso (coagulasa) y sus toxinas matan neutrófilos.

### 5.3 Reglas de diseño de nivel

- Un concepto nuevo por nivel, sin muros de texto.
- Cada mundo incluye un nivel donde la estrategia anterior fracasa a propósito.
- Partidas de 3 a 5 minutos.
- Modo infinito para repasar (después de la demo).

### 5.4 Para que alcance para un examen

- Cada nivel tiene 2 o 3 objetivos de aprendizaje redactados como preguntas de examen.
- Al terminar un nivel cae una pregunta rápida de niveles anteriores (repaso espaciado). Da estrellas, no bloquea.
- Tras cada jefe hay un caso clínico: ordenar pasos y elegir la célula responsable. Eso abre el siguiente mundo.
- Almanaque como glosario: dato real arriba, frase con humor del personaje abajo.

## 6. Estilo visual (dirección general)

- **Criaturas-célula, no humanos.** El cuerpo es la célula y la cara va encima. La silueta refleja la morfología real: neutrófilo con núcleo multilobulado, macrófago grande con pseudópodos, dendrítica con prolongaciones.
- **Chibi con rasgos anime**, proporción de 1,5 a 2 cabezas. Carisma sin ser empalagoso.
- **Personalidad al estilo de las plantas de PvZ:** sale de la silueta, el gesto base y las animaciones de reposo y ataque, no de diálogos.
- **Leucocitos claros** (blanco hueso), diferenciados por el color del núcleo y los gránulos, como en una tinción. **Patógenos con cuerpo de color saturado.**
- **Las células inmunes son un poco más cute que los antagonistas.**
- **Trazo y color:** contorno grueso marrón oscuro, cel shading de dos tonos, sin degradados. Sin blanco ni negro puros.
- **Fondo:** rosa apagado de tono medio, con poca variación entre casillas. La saturación se reserva para enemigos, PAMP y efectos, para no cansar la vista.
- **No depender solo del color:** siluetas distintas siempre.

Referencias ya probadas (hex): cuerpo de leucocito `#FBF7F2`, sombra `#E1D9E8`, núcleo `#7B4FA3`, contorno `#3A2A2A`, fondo `#DDBDB8`, _S. aureus_ `#F2C230` con sombra `#D9A21B`, PAMP `#8E2C6B`.

Notas de personaje hasta ahora:

- **Neutrófilo:** blanco, novato impulsivo, ceño decidido, rubor leve.
- **Macrófago:** veterano grandote y glotón.
- **NK:** aire de femme fatale. Calma total, pide "identificación" (MHC I) antes de matar.
- **Dendrítica:** mensajera con muchos brazos.
- **_S. aureus_:** racimo dorado y arrogante. El diseño de prueba gustó.
- **Epitelio, moco y bacteria grampositiva:** aprobados por el usuario el 2026-11-14 e integrados en el juego (`assets/sprites/`, guía en `docs/guia-estilo.md`).
- **Médula ósea:** hueso con cara y canal de médula roja, en el panel de energía, con placa "Médula ósea". Aprobada por el usuario el 2026-11-14.
- **Macrófago y neutrófilo:** primera propuesta integrada en el juego. Pendientes de revisión del usuario.
- **Mundos:** emblemas provisionales en `assets/sprites/mundos/`. Pendientes de revisión del usuario.

### Flujo de arte

- Sprites en SVG por piezas (cuerpo, ojos, brazos en archivos o grupos separados). Una carpeta nueva en `assets/sprites/<id>/` con `brazos.svg`, `cuerpo.svg` y `ojos.svg` se carga sola (`src/game/sprites.ts`).
- Los SVG se importan con `?url&no-inline`: Vite incrusta los menores de 4 KB como `data:` y el cargador de Phaser falla con ellos.
- Animación moviendo piezas con tweens desde el motor: reposo, ataque, daño, muerte. Sin fotogramas dibujados.
- Guía de estilo fija en cada petición de sprite: grosor de línea, paleta, proporciones, juego de ojos y bocas compartido.
- Cada sprite pasa revisión del usuario antes de darse por bueno.

## 7. Stack

- **TypeScript + Phaser 4 + Vite.** Al iniciar, comprobar la versión estable actual de Phaser y su documentación, no asumirla.
- **Versiones comprobadas el 2026-11-14:** Phaser 4.2.1 (etiqueta `latest` en npm), Vite 8.3.8, Vitest 5.1.0, TypeScript 7.0.2. Gestor de paquetes: pnpm.
- **Comandos:** `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test`.
- **Tests:** Vitest sobre la simulación.
- **Móvil:** primero web y PWA. Empaquetado nativo con Capacitor más adelante.
- **Sin servidor al principio:** progreso en almacenamiento local del navegador. El panel para profesores vendrá después y necesitará backend.

Descartados: Godot (su exportación web en móvil tiene salvedades y rinde menos que la nativa) y Rust con Bevy o macroquad (iteración más lenta y binarios pesados para este alcance).

## 8. Arquitectura

```
src/
  sim/     lógica pura, sin Phaser
  game/    escenas Phaser: render e input
  ui/      HUD, almanaque, preguntas
  data/    units.json, enemies.json, questions.json, levels/1-1.json
  i18n/    es.json
assets/sprites/<personaje>/   cuerpo.svg, ojos.svg, brazos.svg
docs/      fuentes.md, simplificaciones.md
tests/
```

- **Lógica separada del render.** `sim/` no importa Phaser. Se prueba sola y sobrevive a un cambio de motor.
- **Simulación por sistemas.** `sim/world.ts` guarda el estado y las consultas compartidas; cada mecánica es un módulo en `sim/systems/` (aparición, señales, médula, combate, resultado, colocación) y `sim/sim.ts` solo fija el orden en que corren. Una mecánica nueva es un sistema nuevo, no más código en un archivo central. Falta el sistema de estados de la sección 8.1 (`opsonizado`, `infectada`...), que se añade al diseñar el 1-4 o el 1-5.
- **Niveles autodescubiertos.** Cada JSON en `src/data/levels/` es un nivel y su nombre de archivo es su id; no hay lista manual (`tests/data/levels.test.ts` lo vigila).
- **Contenido en datos.** Unidades, enemigos, niveles, oleadas, reglas y preguntas viven en JSON, para que un inmunólogo pueda revisarlos sin tocar código.
- **Simulación determinista:** paso de tiempo fijo y azar con semilla. Permite tests de balance del tipo "el nivel 1-3 se gana con esta estrategia y se pierde sin neutrófilos".
- **Textos traducibles desde el inicio.** Claves en inglés en los datos, textos visibles por identificador en `i18n/`. Español primero.

### 8.1 Estados y reglas

La inmunología se modela como un sistema de estados y reglas en datos, no unidad por unidad.

- **Estados:** `opsonizado`, `infectada`, `sin_MHC1`, `activado`.
- **Señales globales:** citocinas e inflamación, como medidores que las unidades suben y leen.
- **Reglas:** por ejemplo, "fagocitosis contra `opsonizado` hace más daño" o "la NK solo ataca objetivos `sin_MHC1`".
- **Fusiones:** una tabla con dos ids de entrada y uno de salida.

Añadir complemento o anticuerpos en mundos posteriores debe ser añadir reglas, no reescribir unidades.

### 8.2 Formato de unidad (borrador)

```json
{
  "id": "neutrofilo",
  "lineage": "mieloide",
  "cost": 50,
  "cooldown": 5,
  "hp": 60,
  "lifespan": 30,
  "attack": { "type": "fagocitosis", "damage": 20, "rate": 1.0, "range": 1 },
  "requires": ["PAMP"],
  "tags": ["innata", "fagocito"]
}
```

Los enemigos siguen el mismo patrón: vida, velocidad, qué PAMP llevan y rasgos como `capsula` o `infecta_celulas`.

### 8.3 Formato de nivel (borrador)

```json
{
  "id": "1-3",
  "grid": { "rows": 5, "cols": 9 },
  "startEnergy": 100,
  "marrow": { "amount": 25, "interval": 5 },
  "deck": ["epitelio", "macrofago", "neutrofilo"],
  "newUnit": "neutrofilo",
  "objectives": ["obj.reclutamiento"],
  "waves": [
    { "at": 10, "enemy": "bacteria_gram_pos", "lane": 2, "count": 3, "gap": 2 }
  ],
  "questions": ["q.pamp_prr", "q.fagocitosis"]
}
```

Los números de ambos formatos son de ejemplo. El balance se decide con tests y jugando.

## 9. Plan de construcción

1. **Núcleo de `sim` con tests:** rejilla, energía, colocar unidades, enemigos que avanzan, combate, victoria y derrota. _Hecho el 2026-11-14 (`src/sim/`, `tests/sim/`)._
2. **Escena Phaser con figuras provisionales** y el nivel 1-1 jugable en navegador y en móvil. _Hecho el 2026-11-14 en escritorio (`src/game/`, `src/ui/`, `src/data/levels/1-1.json`); pulido con sprites, médula visible y menú de mundos y niveles (`src/game/MenuScene.ts`); el 1-1 dura 60 s. Falta probarlo en un móvil real._
3. **Niveles 1-2 y 1-3:** PAMP/PRR, fagocitosis y citocinas. _Hechos el 2026-11-14, con tarjeta de concepto y cartel de inicio en todos los niveles; pendiente de que el usuario los juegue y diga si divierten. Seguimiento en `odd/tasks/world-1-levels-2-3.md`._ Aquí se valida si la mecánica divierte. Si no divierte, parar y replantear con el usuario.
4. **Flujo de arte:** sprites por piezas, animaciones, guía de estilo cerrada con los primeros personajes.
5. **Niveles 1-4 a 1-7:** inflamación, virus y NK, complemento, nivel trampa. _1-4 hecho el 2026-11-17 (barra de inflamación, NET, Streptococcus pyogenes; sprite en propuesta); pendiente de que el usuario lo juegue._
6. **Jefe _S. aureus_** y caso clínico.
7. **Almanaque, preguntas y repaso espaciado.** _Almanaque bocetado el 2026-11-14 (`src/game/AlmanacScene.ts`, textos en `src/i18n/es.almanac.json`); faltan preguntas y repaso._
8. **Pulido:** sonido, tutoriales sin texto, rendimiento en móvil, PWA.

En cada paso: anotar la inmunología para la revisión médica (2.1), consultar las mecánicas (2.2) y entregar algo jugable.

## 10. Fuera del alcance de la demo

- Mundos 2 a 8.
- Backend, cuentas y panel para profesores.
- Empaquetado nativo.
- Idiomas además del español (la estructura sí queda lista).
- Modo infinito.

## 11. Decisiones abiertas

- Balance de citocinas y neutrófilos: el usuario los sintió demasiado fuertes en el 1-3 (2026-11-14); el neutrófilo pasó a costar 50 y el 1-3 abre los 5 carriles (2026-11-14). El macrófago bajó a 200 de vida y el 1-2 conserva las oleadas duras 5/5; el usuario lo jugó y lo ganó con macrófagos retrasados, moco delante y algún muro, y el test reproduce esa estrategia (2026-11-14). Desde el 2026-11-17 las citocinas las libera el jugador con un clic en el macrófago que detecta PAMP o en la herida abierta (`src/sim/systems/sources.ts`); ya no escalan solas con las bacterias. Números provisionales: macrófago 6 s de carga y 40 puntos, herida 12 s y 15 puntos; el 1-3 usa médula 30/5. El 1-3 sigue sin exigir barreras en los tests y necesita una decisión de diseño. La inflamación como coste y un enemigo nuevo que responda al neutrófilo se siguen revisando al diseñar el 1-4.
- Nombre del juego.
- Orientación en móvil (horizontal como PvZ o vertical).
- Números de la economía: ritmo basal de la médula, cuánto acelera cada citocina y cuánto cuesta cada unidad (el modelo ya está decidido en la sección 4).
- Forma exacta de las preguntas y del caso clínico.
- Diseño final de cada personaje.
- ~~Licencia~~: MIT, proyecto abierto y sin ánimo de lucro (decidido el 2026-11-14; ver `LICENSE`).
