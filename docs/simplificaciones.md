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

### virus-camina-por-el-carril

- **En el juego:** el virus avanza por el carril como una bacteria, infecta la primera célula que toca (cualquier célula propia, el moco no) y desaparece al entrar en ella.
- **En la realidad:** los viriones no se desplazan por sí mismos: los arrastran los fluidos o pasan de una célula a otra, y una célula suele recibir muchos.
- **Por qué se simplifica:** encaja en la rejilla por carriles y deja ver qué célula se infecta.
- **Fuente:** entradas del nivel 1-5 en `fuentes.md`.
- **Dónde lo aclara el almanaque:** ficha del virus.

### virus-estalla-en-segundos

- **En el juego:** la célula infectada estalla 6 segundos después, muere y suelta 2 o 3 virus: uno en su casilla y los demás en la misma columna de los carriles vecinos.
- **En la realidad:** el ciclo hasta que salen nuevas copias dura de horas a días, salen cientos o miles de viriones y muchos virus salen por gemación sin matar enseguida a la célula.
- **Por qué se simplifica:** un temporizador corto y visible da tiempo a reaccionar con la NK sin alargar la partida.
- **Fuente:** entradas del nivel 1-5 en `fuentes.md`.
- **Dónde lo aclara el almanaque:** ficha del virus.

### interferon-radio-y-duracion

- **En el juego:** al infectarse, la célula protege a sus 8 casillas vecinas durante 5 segundos; un virus que toca una célula protegida se pierde sin infectarla. La protección termina antes de que estalle la célula, así que los virus que suelta pueden infectar a las vecinas.
- **En la realidad:** el interferón de tipo I difunde por el tejido y actúa durante horas; el estado antiviral no impide la entrada del virus, sino que frena su multiplicación dentro de la célula.
- **Por qué se simplifica:** un escudo corto y local enseña la idea (avisar a las vecinas) y deja sitio a la NK.
- **Fuente:** entradas del nivel 1-5 en `fuentes.md`.
- **Dónde lo aclara el almanaque:** ficha del virus.

### nk-sin-mhc-de-clase-i

- **En el juego:** la célula NK ataca a cualquier célula propia infectada a dos casillas o menos (en cualquier dirección) y la mata de un golpe; nunca ataca virus sueltos ni bacterias.
- **En la realidad:** la NK integra señales activadoras (por ejemplo ligandos de estrés reconocidos por NKG2D) e inhibidoras (sobre todo MHC de clase I); muchas infecciones bajan el MHC de clase I y eso también la activa.
- **Por qué se simplifica:** el mundo 1 solo enseña el reconocimiento del estrés; el MHC de clase I llega con el mundo 2.
- **Fuente:** entradas del nivel 1-5 en `fuentes.md`.
- **Dónde lo aclara el almanaque:** ficha de la célula NK.

### complemento-poder-recargable

- **En el juego:** el complemento es un poder fuera del mazo que actúa sobre un área de 3 por 3 casillas, se recarga en 30 segundos, no cuesta energía y cada uso sube la inflamación.
- **En la realidad:** el complemento no se activa a voluntad; se dispara solo sobre la superficie de microbios o con anticuerpos, y actúa donde ocurre, de forma continua.
- **Por qué se simplifica:** el jugador decide cuándo lanzar la cascada, y el coste (inflamación) hace que no pueda repetirla sin pensar. La recarga y el coste sustituyen a una activación continua.
- **Fuente:** `fuentes.md` (sección Nivel 1-6).
- **Dónde lo aclara el almanaque:** ficha del complemento (`note_real`).

### opsonizacion-como-pamp

- **En el juego:** el estado `opsonizado` hace que el enemigo cuente como si tuviera PAMP, así que los macrófagos y neutrófilos lo detectan y atacan.
- **En la realidad:** la opsonización la reconocen receptores propios de los fagocitos (CR1, receptores Fc), no los receptores PRR que reconocen PAMP.
- **Por qué se simplifica:** un único requisito de detección (`PAMP`) hace que el juego sea legible; separar dos receptores añadiría una regla más que el nivel 1-6 no necesita.
- **Fuente:** `fuentes.md` (sección Nivel 1-6).
- **Dónde lo aclara el almanaque:** ficha del complemento (`note_real`, pendiente de ampliar) y de la bacteria encapsulada.

### opsonizacion-multiplica-la-fagocitosis

- **En el juego:** un enemigo opsonizado recibe 1,5 veces el daño de los fagocitos, y la marca dura hasta que muere.
- **En la realidad:** la opsonización aumenta la eficacia de la fagocitosis, pero el factor exacto depende del tipo de célula y del microbio; no es un multiplicador fijo. El C3b queda unido de forma covalente a la superficie y se degrada a iC3b, que sigue siendo opsonina, así que una marca que no caduca es razonable a la escala de una partida.
- **Por qué se simplifica:** un número visible permite al jugador ver el efecto.
- **Dónde lo aclara el almanaque:** ficha del complemento (pendiente de ampliar).

### mac-solo-gramnegativas-y-tres

- **En el juego:** el complejo de ataque perfora hasta tres enemigos gramnegativos del área, los más cercanos a la base primero.
- **En la realidad:** el MAC actúa sobre las gramnegativas con mucha frecuencia, pero el número de poros y las bacterias afectadas dependen de la cantidad de complemento depositado.
- **Por qué se simplifica:** el límite de tres hace la carta legible y deja que la gramnegativa encapsulada sea el reto del nivel.
- **Dónde lo aclara el almanaque:** fichas de la bacteria gramnegativa y del complemento.

### capsula-escudo-total

- **En el juego:** la bacteria encapsulada no tiene PAMP, así que los fagocitos no la atacan en absoluto hasta que el complemento la marca.
- **En la realidad:** la cápsula dificulta la opsonización pero no la impide del todo; los anticuerpos y otros factores también la superan.
- **Por qué se simplifica:** una regla binaria (visible o invisible) enseña la idea del nivel con claridad.
- **Fuente:** `fuentes.md` (sección Nivel 1-6). **Estado:** dudoso.
- **Dónde lo aclara el almanaque:** ficha de la bacteria encapsulada (`note_real`).

### neutrofilo-regalo-c5a

- **En el juego:** el paso C5a coloca un neutrófilo gratis en la casilla jugada, o en la más cercana de su carril.
- **En la realidad:** C5a atrae neutrófilos hacia el sitio de la infección y los activa; no los crea de la nada, aunque la médula produce y libera neutrófilos.
- **Por qué se simplifica:** el jugador ve el efecto del complemento de forma directa en el tablero.
- **Dónde lo aclara el almanaque:** ficha del complemento (`note_real`).

### dendritica-recoge-de-muertas

- **En el juego:** la célula dendrítica no ataca; recoge un antígeno por cada bacteria que muere en las casillas de alrededor.
- **En la realidad:** captura el antígeno ella misma, por fagocitosis o macropinocitosis, de microbios vivos y de restos de células muertas.
- **Por qué se simplifica:** el jugador tiene que combinar la dendrítica con quien mata, que es la idea del nivel: la innata mata, la dendrítica informa.
- **Dónde lo aclara el almanaque:** ficha de la célula dendrítica (`note_real`).

### dendritica-carga-fija-y-carril

- **En el juego:** con tres antígenos sale de su casilla y camina por su carril hasta el borde izquierdo, que hace de ganglio.
- **En la realidad:** su salida la decide la maduración tras señales de peligro, no una cantidad de antígeno, y viaja por los vasos linfáticos, no por el tejido hacia la «base».
- **Por qué se simplifica:** el viaje se ve y se puede seguir con la vista; el contador del ganglio da al jugador un objetivo claro.
- **Dónde lo aclara el almanaque:** ficha de la célula dendrítica (`note_real`).

### innata-sin-memoria

- **En el juego:** cada vez que vuelve el patógeno, la defensa innata es exactamente igual que la primera vez.
- **En la realidad:** la innata no tiene memoria específica, pero sí una «inmunidad entrenada» inespecífica que puede reforzarla durante un tiempo.
- **Por qué se simplifica:** el nivel enseña la diferencia principal entre innata y adaptativa; el matiz puede ir en el almanaque.
- **Fuente:** `fuentes.md` (sección Nivel 1-7). **Estado:** dudoso.
- **Dónde lo aclara el almanaque:** pendiente (ficha de la célula dendrítica o una ficha de sistema futura).

### inflamacion-cronica-por-vuelta

- **En el juego:** cada vuelta del patógeno sube 20 puntos un suelo bajo la inflamación, que ya no baja de ahí; desde el 60 % la inflamación daña a las células propias y la defensa acaba cediendo.
- **En la realidad:** las infecciones repetidas o persistentes mantienen la inflamación y dañan el tejido, pero no con un escalón fijo por episodio.
- **Por qué se simplifica:** convierte «la innata sola no basta» en una derrota que el jugador entiende.
- **Dónde lo aclara el almanaque:** pendiente.

### colonia-como-jefe

- **En el juego:** una «colonia» de _S. aureus_ se planta en una columna, ocupa tres carriles, alcanza a las células a dos casillas y, mientras vive, suelta un _S. aureus_ cada 4 segundos desde su frente.
- **En la realidad:** no hay una colonia que dirija la infección; las bacterias se multiplican en el foco y se diseminan desde ahí.
- **Por qué se simplifica:** da al mundo 1 un jefe visible que concentra las armas reales de _S. aureus_.
- **Dónde lo aclara el almanaque:** ficha de la colonia de _S. aureus_ (`note_real`).

### leucocidinas-solo-neutrofilos

- **En el juego:** las leucocidinas solo dañan a los neutrófilos cercanos, y solo desde que la colonia baja al 70 % de vida.
- **En la realidad:** también dañan a monocitos y macrófagos, y la bacteria las produce según su regulación, no según cuánto daño recibe.
- **Por qué se simplifica:** enseña que el neutrófilo no siempre es la respuesta y deja al macrófago como protagonista del asedio.
- **Dónde lo aclara el almanaque:** ficha de la colonia de _S. aureus_.

### absceso-escudo-total

- **En el juego:** desde el 40 % de vida, la colonia levanta un muro de fibrina que absorbe todo el daño hasta romperse.
- **En la realidad:** el absceso aísla a las bacterias y estorba a los fagocitos, pero no las blinda; los neutrófilos se acumulan dentro y forman pus, y a menudo hay que drenarlo.
- **Por qué se simplifica:** un muro con su propia barra es fácil de leer y obliga a combinar macrófagos con complemento.
- **Dónde lo aclara el almanaque:** ficha de la colonia de _S. aureus_ (`note_real`).

### macrofago-golpea-y-traga

- **En el juego:** contra la colonia, el macrófago da golpes rápidos y algo más débiles que su fagocitosis; cuando la colonia baja al 10 % de vida, un macrófago se la traga entera.
- **En la realidad:** los fagocitos no golpean; atacan un foco grande rodeándolo, fagocitando bacterias una a una y liberando sustancias microbicidas. Nadie se traga una colonia entera.
- **Por qué se simplifica:** el golpe deja ver que el macrófago está atacando a un enemigo demasiado grande para tragarlo, y el final por fagocitosis cierra el mundo con el concepto del nivel 1-2.
- **Dónde lo aclara el almanaque:** ficha de la colonia de _S. aureus_ (`note_game`).

### otros-patogenos-en-el-jefe

- **En el juego:** mientras vive la colonia, cada 25 segundos entra por las heridas un virus o una bacteria encapsulada.
- **En la realidad:** son infecciones distintas que no dependen de _S. aureus_; el nivel mezcla patógenos de niveles anteriores para repasarlos.
- **Por qué se simplifica:** repaso de NK, interferón y complemento dentro del jefe.
- **Dónde lo aclara el almanaque:** pendiente.
