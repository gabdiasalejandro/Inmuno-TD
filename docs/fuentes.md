# Fuentes

Lista de revisión para el médico (regla 2.1 de `CLAUDE.md`): todo lo que el juego afirma sobre inmunología y dónde lo usa.
Las entradas largas de abajo son de una verificación inicial con fuentes; las nuevas pueden ser de una línea.

Estados posibles: `por revisar` (implementado, sin fuente), `verificado` (con fuente), `dudoso` (no estamos seguros; revisar primero).

## Plantilla

```
### <id-del-concepto>

- **Qué afirma el juego:** ...
- **Fuente:** autor, título, edición, capítulo o sección (o DOI / URL institucional).
- **Qué dice la fuente:** paráfrasis breve y fiel.
- **Dónde se usa:** unidad, regla, nivel o pregunta.
- **Estado:** verificado | pendiente | rechazado
- **Verificado por / fecha:** ...
```

## Entradas

### medula-produccion-basal

- **Qué afirma el juego:** la médula ósea produce neutrófilos de forma continua aunque no haya infección (energía basal).
- **Fuente:** Wirths S, Bugl S, Kopp HG. "Steady-state neutrophil homeostasis is a demand-driven process". _Cell Cycle_ 2013;12(5). PMC3610712.
- **Qué dice la fuente:** "The human bone marrow produces an estimated number of 10^11 neutrophils per day, and granulopoiesis physiologically takes up two-thirds of the hematopoietic marrow space."
- **Matiz:** la producción en estado estable está regulada por la demanda, no es un flujo fijo. Ver `simplificaciones.md#medula-ritmo-constante`.
- **Dónde se usa:** regla de energía (`marrow` en el nivel, `src/sim/sim.ts`).
- **Estado:** verificado
- **Verificado por / fecha:** verificador Haiku; cita comprobada por el jefe contra el texto completo, 2026-11-14.

### granulopoyesis-de-emergencia

- **Qué afirma el juego:** durante la infección aumentan citocinas (G-CSF, GM-CSF, IL-6) que hacen que la médula produzca más neutrófilos.
- **Fuente:** (a) Paudel S, Ghimire L, Jin L, Jeansonne D, Jeyaseelan S. "Regulation of emergency granulopoiesis during infection". _Frontiers in Immunology_ 2022. PMC9485265. (b) Carnevale S, Ghasemi S, Rigatelli A, Jaillon S. "The complexity of neutrophils in health and disease: Focus on cancer". _Seminars in Immunology_ 2020;48. PMC7500440.
- **Qué dice la fuente:** (a) "release massive amounts of granulopoietic cytokines (such as G-CSF, GM-CSF, IL-6) during local or systemic infection." (b) "In inflammatory conditions, expression levels of granulopoietic cytokines, such as G-CSF, GM-CSF and IL-6 are increased".
- **Matiz:** las citocinas son redundantes entre sí: Wirths 2013 indica que la granulopoyesis de emergencia se induce incluso en ratones sin G-CSF ni GM-CSF. No afirmar que una sola citocina es imprescindible. Parte de la evidencia es murina. No está verificado que aumente la _liberación_ de neutrófilos maduros a sangre; el juego solo puede afirmar aumento de producción.
- **Dónde se usa:** aceleración de la médula por citocinas (`marrowBoost`, nivel 1-3).
- **Estado:** verificado
- **Verificado por / fecha:** verificador Haiku; cita (a) comprobada por el jefe, cita (b) sin comprobar por el jefe, 2026-11-14.

### macrofago-citocinas-granulopoyeticas

- **Qué afirma el juego:** el macrófago residente detecta patógenos con sus PRR y libera citocinas que aceleran la médula.
- **Fuente:** Paudel S et al. 2022 (ver arriba), sección "Hematopoietic and non-hematopoietic cells".
- **Qué dice la fuente:** "Tissue resident macrophages and circulating monocytes are equipped with PRRs, sense pathogens at the site of entry, and release massive amounts of granulopoietic cytokines (such as G-CSF, GM-CSF, IL-6) during local or systemic infection." Y a continuación: "we speculate that monocytes and macrophages are not the sole players. Although there is lack of careful in vivo experimentation proving direct roles of these cells in emergency granulopoiesis, the abundance of data suggests their role is largely mediated b[y]..."
- **Matiz:** está respaldado que el macrófago detecta con PRR y libera G-CSF, GM-CSF e IL-6. Que eso sea lo que dispara la granulopoyesis de emergencia es, según la propia revisión, una hipótesis antigua sin demostración directa in vivo, y los macrófagos no son la única fuente. La fuente no menciona TNF y no respalda IL-1 de macrófago para esta mecánica: no usar esos nombres aquí.
- **Dónde se usa:** nivel 1-3 (el jugador libera las citocinas con un clic en el macrófago).
- **Estado:** pendiente. Se puede implementar "el macrófago libera G-CSF, GM-CSF e IL-6" pero falta decidir con el usuario cómo presentar el vínculo causal y registrar la simplificación.
- **Verificado por / fecha:** verificador Haiku; citas comprobadas por el jefe, que corrigió una cita que el verificador había parafraseado entre comillas, 2026-11-14.

### inflamacion-excesiva-dana-tejido

- **Qué afirma el juego:** una inflamación excesiva o prolongada daña el tejido propio.
- **Fuente:** Bortolotti P, Faure E, Kipnis E. "Inflammasomes in Tissue Damages and Immune Disorders After Trauma". _Frontiers in Immunology_ 2018;9:1900. PMC6105702.
- **Qué dice la fuente:** "the intensity, duration, and compartmentalization of the inflammatory response needs to be tightly regulated. Excessive, extensive, or prolonged inflammation is responsible for secondary damage, as observed during ARDS or trauma".
- **Matiz:** la inflamación controlada es protectora; solo el exceso daña. El contexto de la fuente es trauma y SDRA, no infección: antes de implementar la barra de inflamación (nivel 1-4) hace falta una segunda fuente en contexto infeccioso.
- **Dónde se usa:** barra de inflamación (pendiente de implementar).
- **Estado:** verificado, con segunda fuente pendiente.
- **Verificado por / fecha:** verificador Haiku; cita comprobada por el jefe, 2026-11-14.

### No verificado todavía

- Que el macrófago atraiga o reclute neutrófilos al tejido (quimiocinas). Es una afirmación distinta de la producción en médula y el nivel 1-3 la necesita.
- Vida corta del neutrófilo. La fuente consultada dice expresamente que no la establece.
- Nada de lo anterior está cotejado con Janeway, Abbas o Kuby: NCBI Bookshelf devolvió una pantalla de verificación y no se pudo abrir.

### Nivel 1-1 (barreras)

- El epitelio intacto es una barrera física que impide la entrada de microbios; una herida la rompe y abre una vía de entrada. Uso: carriles cerrados y herida del nivel 1-1. **Estado:** por revisar.
- El moco atrapa microbios y frena su avance. Uso: unidad `moco` (frena, no bloquea). **Estado:** por revisar.
- Las barreras no eliminan a las bacterias, solo las contienen. Uso: en 1-1 no hay forma de matar enemigos; se gana resistiendo. **Estado:** por revisar.
- Las bacterias dañan el epitelio hasta atravesarlo. Uso: los enemigos destruyen la unidad `epitelio`. **Estado:** dudoso (depende del patógeno; muchas bacterias no rompen epitelio sano).
- El sprite de la bacteria grampositiva tiene flagelos. Uso: `assets/sprites/bacteria_gram_pos`. **Estado:** dudoso (muchas grampositivas, como estafilococos y estreptococos, son cocos inmóviles sin flagelos).

### Médula ósea (personaje y energía)

- La médula ósea roja, en el hueso esponjoso, produce las células de la sangre. Uso: personaje `medula_osea` y producción de energía. **Estado:** por revisar.

### Niveles 1-2 y 1-3 (macrófago, neutrófilo, citocinas)

- El macrófago residente vive en el tejido y reconoce patrones de los microbios (PAMP) con sus receptores (PRR). Uso: `macrofago` solo ataca enemigos con etiqueta `PAMP`. **Estado:** por revisar.
- El macrófago fagocita: engulle al microbio entero y lo digiere. Uso: ataque `fagocitosis`, una bacteria por bocado y 4 s de digestión. **Estado:** por revisar.
- El macrófago que detecta microbios libera citocinas. Uso: señal `citocinas` del nivel 1-3; el macrófago acumula carga mientras detecta un PAMP con su PRR y el jugador la libera manteniendo pulsado el botón "Liberar citocinas" (`emits` en `src/data/units.json`, `src/sim/systems/sources.ts`). **Estado:** verificado en parte (ver `macrofago-citocinas-granulopoyeticas`).
- El epitelio dañado libera señales de alarma (alarminas y citocinas) que avisan al sistema inmune. Uso: las heridas abiertas del nivel 1-3 acumulan algo de carga de `citocinas` (`fromWounds` en `src/data/signals.json`; poca a propósito, ver `heridas-alarma-debil` en `simplificaciones.md`). **Estado:** por revisar.
- Las células epiteliales que reciben daño liberan citocinas y alarminas, más cuanto mayor es el daño. Uso: la unidad `epitelio` acumula carga de `citocinas` en proporción al daño que recibe (`emits.perDamage` en `src/data/units.json`, nivel 1-3). **Estado:** por revisar (la proporcionalidad con el daño es una suposición de jugabilidad).
- Las citocinas hacen que la médula produzca más neutrófilos. Uso: la médula se acelera con la señal. **Estado:** verificado (ver `granulopoyesis-de-emergencia`), con el vínculo causal directo del macrófago marcado como hipótesis.
- Las citocinas reclutan neutrófilos al foco con rapidez. Uso: los neutrófilos se recargan antes con la señal alta. **Estado:** por revisar (el reclutamiento al tejido depende sobre todo de quimiocinas; aquí se agrupa todo como "citocinas").
- El neutrófilo fagocita rápido y vive poco. Uso: `neutrofilo` ataca cada 2 s y caduca a los 10 s. **Estado:** por revisar.
- Los fagocitos de una sola célula no bastan ante muchas bacterias; la respuesta eficaz combina macrófagos y neutrófilos. Uso: balance del nivel 1-3. **Estado:** por revisar.

### Almanaque (textos en `src/i18n/es.almanac.json`)

Todas **por revisar** salvo las marcadas.

- Epitelio: cubre la piel y reviste intestino y vías respiratorias; sus células muy unidas forman una barrera física; es parte de la inmunidad innata; se regenera a partir de células del propio tejido.
- Moco: secreción pegajosa de superficies húmedas; atrapa microbios y evita que lleguen al epitelio; los cilios lo arrastran hacia fuera; se renueva de forma continua.
- Bacteria grampositiva: se tiñe de violeta con Gram por su pared gruesa de peptidoglucano; unicelular y sin núcleo; lleva PAMP en la superficie que las células innatas reconocen.
- Médula ósea: tejido blando del interior de ciertos huesos; ahí se forman las células de la sangre a partir de células madre; la producción se ajusta a la demanda; en adultos la médula roja está sobre todo en vértebras, pelvis y esternón.
- Médula ósea: "es un órgano linfoide primario: allí maduran los linfocitos B". **Estado:** dudoso (confirmar redacción).
- Macrófago: fagocito grande que vive en los tejidos; engulle microbios y restos de células; da la alarma liberando citocinas. Nota: en el juego solo ataca enemigos con PAMP; "restos de células" va más allá de la regla del juego.
- Neutrófilo: de los primeros en llegar al tejido infectado, donde fagocita bacterias; núcleo con varios lóbulos; vida corta y reposición continua desde la médula.
- Neutrófilo: "es el leucocito más abundante de la sangre". **Estado:** dudoso (cierto en humanos; revisar redacción).
- Inflamación (nivel 1-4, barra de inflamación, almanaque e intro 1-4): la inflamación recluta defensas pero también causa daño colateral al tejido propio. **Estado:** por revisar.
- Inflamación (regla de la barra): las citocinas liberadas aumentan la inflamación. **Estado:** por revisar.
- Tormenta de citocinas (derrota del 1-4 por inflamación al 100 %, texto "La inflamación dañó el tejido"): una respuesta inflamatoria excesiva puede dañar gravemente los tejidos. **Estado:** dudoso (el juego no usa el término; revisar si el desenlace se presenta bien).
- NET (neutrófilo, regla `onDeath`, tutorial e intro 1-4, almanaque del neutrófilo): el neutrófilo puede expulsar su ADN con proteínas de sus gránulos formando una red que atrapa y mata bacterias. **Estado:** por revisar.
- NET: el neutrófilo suele morir al formarla (NETosis). **Estado:** dudoso (existe también NETosis "vital" sin muerte inmediata; revisar la redacción "suele morir").
- NET: las NET también dañan el tejido propio y aumentan la inflamación (regla `raises` del 1-4, objetivo "¿Qué son las NET y por qué también dañan el tejido?"). **Estado:** por revisar.
- Streptococcus pyogenes (enemigo del 1-4, almanaque): bacteria grampositiva, coco en cadenas; causa faringitis, impétigo e infecciones graves de piel y tejidos profundos. **Estado:** por revisar.
- Streptococcus pyogenes: su hialuronidasa degrada el ácido hialurónico del tejido y le ayuda a extenderse (regla `spreads`: cambia de carril ante el epitelio, una sola vez por bacteria). **Estado:** por revisar.

### Nivel 1-5 (virus, interferón, célula NK)

Todas **por revisar** salvo las marcadas.

- Los virus solo se multiplican dentro de una célula: entran, usan su maquinaria para hacer copias y estas salen a infectar otras células. Uso: enemigo `virus` (regla `infects`, estado `infectada` con `burst`), tutorial e intro 1-5, almanaque del virus.
- La salida de las copias puede matar a la célula infectada (lisis). Uso: la célula infectada muere al estallar. **Estado:** dudoso como regla general (muchos virus con envoltura salen por gemación sin lisis inmediata; revisar la redacción).
- Las células infectadas liberan interferón de tipo I, que induce un estado antiviral en las células vecinas. Uso: estado `protegida` repartido a las 8 vecinas (`shares`), tutorial, intro y objetivo "¿Para qué sirve el interferón de tipo I?".
- El estado antiviral impide que el virus se multiplique en la célula protegida. Uso: el virus que toca una célula protegida se pierde sin infectarla (`resisted: "lost"`).
- La célula NK es un linfocito de la inmunidad innata que mata células propias infectadas sin aprendizaje previo. Uso: unidad `nk` (ataque `targets: "own"` con `status: ["infectada"]`), almanaque, objetivo "¿Cómo reconoce y elimina una célula NK a una célula infectada?".
- La NK reconoce señales de estrés de la célula infectada mediante receptores activadores como NKG2D. Uso: tutorial 1-5 y almanaque de la NK.
- La NK mata con perforina y granzimas. Uso: almanaque de la NK.
- La NK también reconoce la pérdida de MHC de clase I ("falta de lo propio"). Uso: solo se menciona en el almanaque como adelanto del mundo 2; no hay mecánica.
- Los fagocitos (macrófagos, neutrófilos) pueden captar viriones libres. Uso: el `virus` lleva PAMP y lo atacan los fagocitos. **Estado:** dudoso (sobre todo el papel del neutrófilo; revisar que el PAMP como "emblema" de un virus no induzca a error, ya que muchos PAMP virales se detectan dentro de la célula).
- Los macrófagos que detectan virus liberan citocinas. Uso: el macrófago acumula citocinas al ver el `virus` (lleva PAMP).
- Los virus pueden infectar distintos tipos celulares, también macrófagos y neutrófilos. Uso: el virus infecta cualquier unidad con la etiqueta `celula` (epitelio, macrófago, neutrófilo, NK). **Estado:** dudoso (depende del virus; infectar a la propia NK es especialmente discutible).

### Nivel 1-6 (complemento, cápsula, gramnegativas)

Todas **por revisar** salvo las marcadas.

- El complemento es un sistema de unas 30 proteínas plasmáticas que se activan en cascada. Uso: poder `complemento` y almanaque. **Estado:** por revisar (cifra aproximada; confirmar).
- C3b marca (opsoniza) al microbio para que los fagocitos lo fagociten con más eficacia. Uso: paso 1 de la cascada, estado `opsonizado` (sin caducidad). **Estado:** por revisar.
- El C3b se une de forma covalente a la superficie del microbio y, al degradarse a iC3b, sigue actuando como opsonina. Uso: la marca `opsonizado` no caduca. **Estado:** por revisar.
- C3a y C5a son anafilotoxinas que aumentan la inflamación y atraen neutrófilos. Uso: paso 2 (C3a sube la inflamación) y paso 3 (C5a aporta un neutrófilo). **Estado:** por revisar (en el juego, C5a es un regalo, no una atracción gradual).
- C5b, con C6 a C9, forma el complejo de ataque a membrana (MAC), un poro que perfora la membrana. Uso: paso 4, sobre hasta tres bacterias gramnegativas del área. **Estado:** por revisar.
- El MAC perfora sobre todo bacterias gramnegativas; las grampositivas, con su pared gruesa de peptidoglucano, resisten en gran medida. Uso: `attack.requires: ["gramnegativa"]`, y la pregunta "¿Por qué el complejo de ataque a membrana no mata a las bacterias grampositivas?". **Estado:** por revisar.
- Las bacterias gramnegativas tienen membrana externa y se tiñen de rosa con la tinción de Gram. Uso: etiqueta `gramnegativa` y almanaque. **Estado:** por revisar.
- Algunas bacterias gramnegativas tienen cápsula de polisacáridos que dificulta la deposición del complemento y la fagocitosis. Uso: enemigo `bacteria_capsulada` (sin etiqueta `PAMP` hasta que se opsoniza). **Estado:** dudoso (la cápsula dificulta, no impide del todo, la opsonización; los anticuerpos también la superan).
- Klebsiella pneumoniae es una bacteria gramnegativa con cápsula. Uso: texto del almanaque de la bacteria encapsulada. **Estado:** por revisar.
- Las bacterias gramnegativas tienen flagelos en un extremo, a menudo alrededor de la célula. Uso: sprite de la bacteria gramnegativa (flagelos traseros). **Estado:** por revisar.
- La opsonización no es un PAMP: la reconocen receptores propios de los fagocitos (CR1, receptores Fc). Uso: el estado `opsonizado` concede la etiqueta `PAMP` a efectos de detección. Es una simplificación; ver `simplificaciones.md`. **Estado:** por revisar.
