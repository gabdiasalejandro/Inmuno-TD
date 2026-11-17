# Simplificaciones

Cada vez que el juego simplifica la biología por jugabilidad se registra aquí (regla 2.1 de `CLAUDE.md`).
El almanaque debe poder aclarar cada una. Una simplificación nunca puede enseñar algo falso.

## Plantilla

```
### <id-de-la-simplificación>

- **En el juego:** ...
- **En la realidad:** ...
- **Por qué se simplifica:** ...
- **Fuente:** entrada correspondiente en `fuentes.md`.
- **Dónde lo aclara el almanaque:** ...
```

## Entradas

### medula-ritmo-constante

- **En el juego:** sin infección, la médula da energía a un ritmo fijo.
- **En la realidad:** la producción de neutrófilos en estado estable se ajusta a la demanda; no es un caudal constante.
- **Por qué se simplifica:** un ritmo fijo y predecible es necesario para que el jugador pueda planificar en los primeros niveles.
- **Fuente:** `fuentes.md#medula-produccion-basal`.
- **Dónde lo aclara el almanaque:** ficha de la médula ósea (pendiente de escribir).

### moco-con-caducidad

- **En el juego:** el moco colocado desaparece a los 20 segundos.
- **En la realidad:** el moco se produce y se renueva de forma continua, y el movimiento ciliar lo arrastra junto con lo que atrapó.
- **Por qué se simplifica:** como los enemigos no lo atacan, sin caducidad sería una ralentización permanente.
- **Dónde lo aclara el almanaque:** ficha del moco (pendiente de escribir).

### epitelio-desplegable

- **En el juego:** el jugador coloca células epiteliales donde quiere, pagando energía de la médula.
- **En la realidad:** el epitelio no viene de la médula ósea ni se despliega; se regenera a partir de células del propio tejido.
- **Por qué se simplifica:** el nivel 1-1 necesita una unidad de muro con el recurso único del juego.
- **Dónde lo aclara el almanaque:** ficha del epitelio (pendiente de escribir).

### medula-roja-en-hueso-largo

- **En el juego:** la médula se dibuja como un hueso largo con el canal central lleno de médula roja.
- **En la realidad:** en adultos ese canal contiene sobre todo médula amarilla (grasa); la médula roja activa está en hueso esponjoso (vértebras, pelvis, esternón, extremos de huesos largos).
- **Por qué se simplifica:** la silueta de hueso largo se reconoce al instante.
- **Dónde lo aclara el almanaque:** ficha de la médula ósea (pendiente de escribir).

### citocinas-una-sola-barra

- **En el juego:** hay un único medidor llamado "citocinas" que acelera la médula y hace llegar antes a los neutrófilos.
- **En la realidad:** son moléculas distintas con papeles distintos: factores como G-CSF, GM-CSF e IL-6 aumentan la producción en la médula, y las quimiocinas guían a los neutrófilos hasta el tejido.
- **Por qué se simplifica:** el nivel 1-3 enseña una sola idea, "el macrófago da la alarma".
- **Dónde lo aclara el almanaque:** fichas del macrófago y del neutrófilo (pendiente).
- **Fuentes que suman a la misma barra:** desde el nivel 1-3 la llenan el macrófago que detecta bacterias, el epitelio colocado cuando recibe daño y las heridas abiertas (señales de alarma del tejido dañado). En la realidad son mediadores distintos (citocinas del macrófago; alarminas como IL-33 o ATP y citocinas del epitelio dañado) que el juego agrupa en un solo medidor.

### citocinas-las-libera-el-jugador

- **En el juego:** el macrófago que detecta bacterias, el epitelio dañado y las heridas acumulan una carga de citocinas; solo pasa a la barra mientras el jugador mantiene pulsado el botón "Liberar citocinas", y nunca más de lo acumulado. La carga guardada y la barra bajan despacio si nada las genera.
- **En la realidad:** la liberación es continua y automática: empieza en cuanto los PRR detectan al microbio (o en cuanto el tejido se daña), sin que nadie la "decida", y la cantidad crece con el estímulo. Las células no guardan una reserva que se vacíe a voluntad.
- **Por qué se simplifica:** convertir la alarma en un gesto del jugador hace que note el concepto "el macrófago da la alarma" en vez de que ocurra sin que lo vea.
- **Dónde lo aclara el almanaque:** ficha del macrófago (pendiente).

### heridas-alarma-debil

- **En el juego:** una herida abierta acumula muy poca carga de citocinas (como mucho 4 puntos, a 0,5 por segundo), mucho menos que un macrófago (30 puntos, 7 por segundo). Así el jugador tiene que colocar células para dar una alarma útil.
- **En la realidad:** el tejido dañado es una fuente importante de señales de alarma (alarminas, DAMP y citocinas del epitelio); no hay motivo para pensar que su aporte sea tan pequeño frente al del macrófago.
- **Por qué se simplifica:** decisión de jugabilidad del usuario (2026-11-17): "que las de las heridas liberen poco para que el jugador tenga que plantar más". Resta realismo a cambio de que la alarma dependa de las células que despliega el jugador.
- **Dónde lo aclara el almanaque:** ficha del epitelio (pendiente).

### macrofago-una-bacteria-por-bocado

- **En el juego:** el macrófago engulle exactamente una bacteria y tarda 4 segundos en digerirla.
- **En la realidad:** un macrófago puede contener varios microbios a la vez y la digestión lleva de minutos a horas.
- **Por qué se simplifica:** hace visible que un solo fagocito se ve desbordado y que hacen falta refuerzos.
- **Dónde lo aclara el almanaque:** ficha del macrófago (pendiente).

### neutrofilo-vida-en-segundos

- **En el juego:** el neutrófilo desaparece a los 10 segundos de desplegarse.
- **En la realidad:** vive del orden de horas a pocos días.
- **Por qué se simplifica:** la partida dura minutos; lo que se conserva es que vive mucho menos que el macrófago.
- **Dónde lo aclara el almanaque:** ficha del neutrófilo (pendiente).

### inflamacion-medidor-global

- **En el juego:** un solo medidor de inflamación para todo el tejido. Hasta el 60 % no hace daño. Del 60 % al 90 % todas tus células pierden un 1 % de su vida máxima por segundo, en todos los carriles; desde el 90 % el daño se duplica (2 % por segundo); al 100 % se pierde el nivel. Sube con las citocinas liberadas (0,42 puntos por punto) y con cada NET (3 puntos), y baja 1,1 puntos por segundo.
- **En la realidad:** la inflamación es local: cada zona del tejido se inflama según lo que pasa en ella, y el daño colateral depende de muchas moléculas y células, no de un umbral fijo.
- **Por qué se simplifica:** un medidor global se lee de un vistazo y enseña lo esencial: la respuesta inflamatoria ayuda, pero en exceso daña el propio tejido.
- **Fuente:** entradas "Inflamación" y "Tormenta de citocinas" en `fuentes.md`.
- **Dónde lo aclara el almanaque:** pendiente (no hay ficha de inflamación todavía).

### inflamacion-dano-por-tick

- **En el juego:** el daño de la inflamación es una pérdida de vida constante, repartida en cada paso de la simulación.
- **En la realidad:** el daño tisular por inflamación se acumula a lo largo de horas o días por enzimas, especies reactivas de oxígeno y otras moléculas.
- **Por qué se simplifica:** una pérdida lenta y continua se ve en las barras de vida y da tiempo al jugador a reaccionar.
- **Fuente:** entrada "Inflamación" en `fuentes.md`.
- **Dónde lo aclara el almanaque:** pendiente.

### net-duracion-y-lugar

- **En el juego:** todo neutrófilo que muere (por edad o en combate) deja una NET en su casilla durante 3 segundos; frena mucho a las bacterias (al 30 % de su velocidad) y les hace 5 de daño por segundo.
- **En la realidad:** no todos los neutrófilos forman NET; la red se extiende por el tejido de alrededor y puede durar mucho más que unos segundos.
- **Por qué se simplifica:** una red breve y en una casilla se entiende al instante y no hace al neutrófilo demasiado fuerte.
- **Fuente:** entradas "NET" en `fuentes.md`.
- **Dónde lo aclara el almanaque:** ficha del neutrófilo ("En el juego" / "En realidad").

### streptococcus-pyogenes-cambio-de-carril

- **En el juego:** Streptococcus pyogenes, al chocar con un epitelio, se pasa a un carril vecino libre en lugar de atacarlo. Lo hace una sola vez por bacteria: después ataca los muros como cualquier otra. Si los dos vecinos están bloqueados en esa columna, ataca como cualquier bacteria. Llega en grupos de 3 o 4 muy juntos.
- **En la realidad:** la hialuronidasa degrada el ácido hialurónico de la matriz y la bacteria se extiende por el tejido; no esquiva barreras saltando de un sitio a otro.
- **Por qué se simplifica:** el cambio de carril es la forma de "extenderse por el tejido" que permite una rejilla por carriles; el límite de un cambio y los grupos hacen que una fila de muros sirva contra ella.
- **Fuente:** entrada "Streptococcus pyogenes" en `fuentes.md`.
- **Dónde lo aclara el almanaque:** ficha de Streptococcus pyogenes.

### streptococcus-pyogenes-color

- **En el juego:** Streptococcus pyogenes se dibuja rojo.
- **En la realidad:** es grampositiva y con la tinción de Gram se vería violeta, como la bacteria grampositiva del juego.
- **Por qué se simplifica:** hay que distinguirla de un vistazo de la bacteria grampositiva genérica.
- **Fuente:** entrada "Streptococcus pyogenes" en `fuentes.md`.
- **Dónde lo aclara el almanaque:** ficha de Streptococcus pyogenes.
