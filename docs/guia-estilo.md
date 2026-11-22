# Guía de estilo de sprites

Guía fija para pegar en cada petición de sprite. Desarrolla la sección 6 de `CLAUDE.md`. Los valores son la propuesta inicial (epitelio, moco, bacteria grampositiva) y quedan sujetos a revisión del responsable del proyecto.

## 1. Formato técnico

- **Lienzo:** `viewBox="0 0 256 256"`, con `width="256" height="256"`. Las piezas de un personaje comparten el mismo sistema de coordenadas.
- **Piezas por personaje**, en `assets/sprites/<id>/`:
  - `brazos.svg`: brazos, pseudópodos, goteos, flagelos.
  - `cuerpo.svg`: silueta, sombra, brillo, contorno y detalle interno (núcleo, gránulos, pared, emblema PAMP).
  - `ojos.svg`: ojos, párpados, cejas, boca y rubor.
  - `completo.svg`: las tres piezas apiladas, solo para vistas previas.
- **Orden de capas (de abajo arriba):** `brazos` → `cuerpo` → `ojos`. El cuerpo tapa el arranque de los brazos; su contorno oculta la unión.
- **Cada pieza es autónoma:** un único `<g id="brazos|cuerpo|ojos">` con sus propios atributos. Si una pieza necesita desplazarse, el `transform` va en ese `<g>` y en ningún otro sitio. `completo.svg` es la concatenación literal de los tres grupos en el orden de capas.
- **Elementos permitidos:** `<path>`, `<circle>`, `<ellipse>`, `<rect>`, `<polygon>`, `<g>`. Atributos de presentación (`fill`, `stroke`, `stroke-width`, `stroke-linejoin="round"`, `stroke-linecap="round"`).
- **Prohibido:** `<image>`, datos raster, referencias externas, `<text>`, fuentes, scripts, `<style>`, filtros, degradados, máscaras, `clipPath`, `<use>`, `opacity` para simular transparencias.
- **Márgenes:** nada (trazo incluido) a menos de 8 px del borde del lienzo. Así las animaciones de escala y rebote no recortan el contorno.
- **Línea de suelo:** la base visible del personaje (pies, charco, flagelos) se apoya en y ≈ 220–229. Todas las unidades y enemigos comparten esta línea para que se alineen en la casilla.

## 2. Trazo

| Uso | Color | `stroke-width` |
| --- | --- | --- |
| Contorno exterior de la silueta | `#3A2A2A` | 8 |
| Brazos de doble trazo (contorno / relleno) | `#3A2A2A` / tono de sombra | 34 / 18 (deja 8 visible por lado) |
| Detalle interior: núcleo, párpados, boca | `#3A2A2A` | 5 |
| Cejas | `#3A2A2A` | 5 (relajadas) o 6 (firmes, traviesas) |
| Flagelos y apéndices finos | `#3A2A2A` | 7 |
| Pared bacteriana interior | sombra oscura del cuerpo | 4 |
| Acentos pequeños: colmillo, burbujas | `#3A2A2A` o tono de sombra | 3 |

Siempre `stroke-linejoin="round"` y `stroke-linecap="round"`. A 96 px el contorno de 8 queda en unos 3 px, que es el mínimo legible.

**Construcción del cuerpo** (siempre en este orden dentro de `cuerpo.svg`): relleno base sin trazo → sombra sin trazo, cuyo borde exterior coincide con la silueta → brillo → contorno (`fill="none"`, trazo 8) → detalle interno con su propio trazo de 5.

## 3. Paleta

Sin blanco puro (`#FFFFFF`) ni negro puro (`#000000`). Sin degradados: cada zona es un color plano.

### Comunes

| Hex | Papel |
| --- | --- |
| `#3A2A2A` | Contorno, pupilas, cejas, bocas. Sustituye al negro. |
| `#FBF7F2` | Brillos de los ojos, dientes. Cuerpo de leucocitos. Sustituye al blanco. |
| `#E1D9E8` | Sombra de leucocito, pseudópodos y brazos de leucocito, interior de vacuolas. |
| `#D3B6CE` | Gránulos finos del neutrófilo (rosa lila apagado, como en la tinción). |
| `#B791BE` / `#936AA0` | _Propuesta:_ NK, cuerpo y sombra (malva violáceo apagado, distinto del blanco hueso de macrófago y neutrófilo y de los patógenos saturados); también brazos, púa y flequillo. |
| `#B8324A` / `#8E2338` / `#E57A86` | _Propuesta:_ NK, gránulos citotóxicos rubí: base, trazo y brillo. |
| `#DDBDB8` | Fondo de juego. Todo personaje debe leerse sobre él. |
| `#8C3A44` | Interior de boca abierta. |
| `#D9737A` | Lengua. |

### Núcleos (tinción)

| Hex | Papel |
| --- | --- |
| `#7B4FA3` | Núcleo, tono base. |
| `#5E3A80` | Sombra del núcleo, nucléolo y cromatina. |
| `#A47CC8` | Brillo del núcleo. |
| `#3B2260` / `#2A1745` / `#6E4C94` | _Propuesta:_ NK, núcleo redondo índigo oscuro: base, sombra y brillo. |
| `#2F7D6B` / `#215A4D` | Dendrítica, núcleo verde azulado a juego con su cuerpo: base y sombra. |

### Tejido propio (no leucocitos)

| Hex | Papel |
| --- | --- |
| `#EDB07F` | Epitelio, cuerpo. |
| `#CF8A5A` | Epitelio, sombra, brazos y microvellosidades. |
| `#F8D2AE` | Epitelio, brillo. |
| `#E58E6E` | Epitelio, rubor. |
| `#CFE39B` | Moco, cuerpo. |
| `#A8C46E` | Moco, sombra. |
| `#E2EEBF` | Moco, zona interior clara y burbujas (efecto translúcido). |
| `#EEF4CF` | Moco, brillo húmedo. |
| `#8FAE58` | Moco, trazo de las burbujas. |
| `#E8A29A` | Moco, rubor. |
| `#EFE2C8` | Médula ósea: hueso compacto, cuerpo (marfil, no blanco). |
| `#D3BE98` | Médula ósea: sombra del hueso y brazos. |
| `#F8EFDC` | Médula ósea: brillo del hueso. |
| `#C8575C` | Médula ósea roja, relleno del canal. |
| `#A9424C` | Médula ósea roja, sombra y trazo de las células madre. |
| `#F0A3A0` | Médula ósea: células madre de la sangre (grumos claros). |

### Patógenos (saturados)

| Hex | Papel |
| --- | --- |
| `#7452E0` | Bacteria grampositiva, cuerpo (violeta por la tinción de Gram). |
| `#5435B8` | Bacteria grampositiva, sombra. |
| `#4A2FA6` | Bacteria grampositiva, línea de pared gruesa. |
| `#9E86F2` | Bacteria grampositiva, brillo. |
| `#F2C230` / `#D9A21B` | _S. aureus_, cuerpo y sombra (referencia). |
| `#8E2C6B` | Emblema PAMP. Reservado: ningún otro elemento usa este color. |
| `#F6E9EF` | Halo y centro del emblema PAMP. |

Regla de saturación: los patógenos y el PAMP son los únicos colores saturados. El tejido propio usa tonos cálidos o suaves de saturación media; los leucocitos, blanco hueso.

## 4. Proporciones

- **Chibi, 1,5 a 2 cabezas.** El cuerpo de la célula es la cabeza: la cara ocupa el tercio superior o medio del cuerpo y no hay cuello.
- **Altura de silueta:** de 160 a 200 px para unidades propias de una casilla. Los enemigos básicos son más bajos (unos 80 px de cuerpo, 125 px con apéndices) para leerse como intrusos pequeños.
- **Silueta reconocible sin color:** cada personaje debe distinguirse en negro plano. Hoy: rectángulo alto con flecos (epitelio), gota cónica con charco (moco), cápsula horizontal con patas onduladas (bacteria).
- **Orientación:** las unidades propias miran al frente (o ligeramente a la derecha). Los enemigos avanzan de derecha a izquierda y miran a la **izquierda**: cara en el extremo izquierdo del cuerpo, cola o apéndices traseros a la derecha.

## 5. Juego de ojos y bocas compartido

Todos los personajes construyen la cara con las mismas piezas. Se cambia la expresión (párpado, ceja, boca), nunca la construcción del ojo.

### Ojo base (centro en `cx, cy`)

1. Globo: `<ellipse rx="10" ry="13" fill="#3A2A2A">` en `(cx, cy)`.
2. Brillo grande: `<circle r="4.5" fill="#FBF7F2">` en `(cx − 3, cy − 4)`.
3. Brillo pequeño: `<circle r="2" fill="#FBF7F2">` en `(cx + 3.5, cy + 5)`.

Separación entre centros de los ojos: 44–46 px en cuerpos anchos, hasta 34 px en cuerpos bajos (bacteria). Los brillos van siempre arriba a la izquierda, para todos los personajes, porque la luz del juego viene de ahí.

### Párpados (dan la expresión)

Un polígono del **color base del cuerpo** tapa la parte superior del globo, y encima una línea de trazo 5 marca el borde del párpado.

| Párpado | Borde inferior | Expresión | Uso actual |
| --- | --- | --- | --- |
| Abierto | sin párpado | despierto, alegre | medula_osea, neutrofilo |
| Plano | horizontal a `cy − 7` | sereno, estoico | epitelio |
| Plano bajo | horizontal a `cy − 3` | satisfecho, de vuelta de todo | macrofago |
| Caído | curva casi horizontal a `cy − 1`, con el extremo exterior caído hasta `cy + 1` | soñoliento | moco |
| Inclinado | recta de `cy − 8` (exterior) a `cy − 2` (interior) | travieso, malicioso | bacteria |

### Cejas

Trazo de 5 o 6, unos 22–26 px de largo, entre 14 y 28 px por encima de `cy` (las cejas asimétricas usan el rango completo).

- Rectas: firmeza.
- Arco suave caído hacia afuera: relajación.
- Asimétricas (una alzada en arco, otra recta bajando hacia el centro): picardía. Solo antagonistas.

### Bocas (trazo 5, `#3A2A2A`)

| Boca | Construcción | Expresión |
| --- | --- | --- |
| Recta | curva cuadrática de 20 px, con 3 px de flecha hacia arriba | seria pero amable |
| Óvalo | `<ellipse rx="7" ry="9" fill="#8C3A44">` con trazo 5 y lengua `<ellipse rx="3.5" ry="3" fill="#D9737A">` en la parte baja | bostezo, sorpresa |
| Sonrisa ladeada | curva cuadrática de 34 px desplazada hacia un lado | burla |
| Colmillo | triángulo `#FBF7F2` con trazo 3 bajo la sonrisa | antagonista |
| Grito | forma de D abierta de 24 px, `fill="#8C3A44"` con trazo 5 y lengua `<ellipse rx="4" ry="2.5" fill="#D9737A">` | ímpetu, grito de carga (neutrofilo) |
| Relamida | sonrisa ladeada con la punta de la lengua (`#D9737A`, trazo 3) asomando en la comisura | glotonería satisfecha (macrofago) |

### Rubor

`<ellipse rx="10" ry="5.5">` en un tono rosado del cuerpo, unos 20 px por debajo y 18 px hacia afuera del centro de cada ojo. Solo en células propias: es una de las formas de hacerlas algo más tiernas que los antagonistas.

## 6. Emblema PAMP

Rombo reutilizable en todos los patógenos:

1. Halo: rombo de 40 × 40 px, `fill="#8E2C6B"`, `stroke="#F6E9EF"`, `stroke-width="14"`.
2. Mismo rombo encima con `stroke="#3A2A2A"`, `stroke-width="5"`.
3. Rombo interior de 16 × 16 px, `fill="#F6E9EF"`, sin trazo.

Va en la mitad trasera del cuerpo, nunca sobre la cara, y siempre visible de perfil. El halo claro lo separa de cuerpos oscuros o saturados. En otros patógenos se cambia solo su posición, no su forma ni su tamaño.

## 7. Fichas de personaje

### epitelio

- **Silueta:** célula columnar alta, como un ladrillo con esquinas redondeadas y algo más ancha en la base. Microvellosidades redondeadas en el borde superior (parecen un flequillo). Núcleo basal ovalado en la parte baja. Brazos cortos y gruesos a los lados.
- **Colores:** `#EDB07F`, `#CF8A5A`, `#F8D2AE`, rubor `#E58E6E`, núcleo `#7B4FA3` / `#5E3A80` / `#A47CC8`.
- **Personalidad:** portero estoico y cumplidor. Párpado plano, cejas rectas, boca recta.
- **Reposo:** casi inmóvil; respiración lenta (escala vertical de 1,00 a 1,02 cada 2 s, anclada en la base). Los brazos se balancean 2–3°.
- **Ataque o bloqueo:** no ataca. Al recibir un golpe se planta: el cuerpo baja 4 px y se ensancha un 4 % durante 120 ms y vuelve; los brazos se abren 10° hacia afuera.
- **Daño y muerte:** daño, sacudida horizontal de ±3 px; muerte, se hunde hacia la base y se aplana.

### moco

- **Silueta:** gota cónica con la punta ladeada y un charco ancho en la base. Dos goteos que cuelgan a los lados como brazos derretidos.
- **Colores:** `#CFE39B`, `#A8C46E`, `#E2EEBF`, `#EEF4CF`, burbujas con trazo `#8FAE58`, rubor `#E8A29A`. La translucidez se sugiere con una zona interior clara, burbujas atrapadas y un brillo húmedo largo, todo plano.
- **Personalidad:** soñoliento, pegajoso, indiferente. Párpado caído, cejas relajadas, boca en bostezo.
- **Reposo:** bamboleo de gelatina: escala alterna 1,03 × 0,97 y 0,97 × 1,03 cada 1,5 s, anclada en la base. Los goteos bajan 4 px y suben con retraso.
- **Ataque (atrapar y ralentizar):** se aplasta (1,10 × 0,90) y los goteos se estiran 8 px hacia abajo durante 200 ms; vuelve despacio, en 500 ms.
- **Daño y muerte:** daño, temblor de escala; muerte, se aplasta en charco (escala vertical a 0,2).

### bacteria_gram_pos

- **Silueta:** bacilo, cápsula horizontal baja. Cuatro flagelos ondulados bajo el cuerpo que hacen de patas y uno trasero que hace de cola. Mira a la izquierda. Se diferencia del racimo esférico de _S. aureus_.
- **Colores:** `#7452E0`, `#5435B8`, `#4A2FA6` (pared gruesa de peptidoglucano), `#9E86F2`, emblema PAMP `#8E2C6B` con `#F6E9EF`.
- **Personalidad:** intruso pequeño y travieso. Párpados inclinados, cejas asimétricas, sonrisa ladeada con colmillo. Sin rubor.
- **Reposo y marcha:** saltitos de 3 px cada 0,4 s mientras avanza; la cola oscila ±8° a contratiempo.
- **Ataque:** se echa hacia atrás 6 px y embiste 10 px hacia la izquierda en 150 ms, con una leve rotación de −5°.
- **Daño y muerte:** daño, retroceso de 4 px a la derecha; muerte, gira 90° y se encoge hasta desaparecer.

### medula_osea

No es una unidad: es la estructura fija que produce la energía. No se coloca en la rejilla; vive en el panel de energía, arriba a la izquierda.

- **Silueta:** hueso largo de dibujo animado, en pie: cabeza ancha con dos cóndilos, diáfisis corta y base con dos cóndilos que hacen de pies. Un corte longitudinal en la diáfisis deja ver un canal de médula roja con trabéculas y células madre. Brazos cortos y gruesos a los lados.
- **Colores:** hueso `#EFE2C8` / `#D3BE98` / `#F8EFDC`; médula `#C8575C` / `#A9424C`; células `#F0A3A0` y `#FBF7F2`; rubor `#E8A29A`.
- **Personalidad:** trabajadora incansable y orgullosa de su producción. Ojos abiertos (el único personaje que los usa por ahora), cejas en arco suave alzadas, boca recta con una sonrisa contenida, rubor.
- **Reposo:** respira algo más rápido que el epitelio (escala vertical 1,00 a 1,03 cada 1,8 s) y mueve los brazos como quien trabaja (±3° cada 0,9 s).
- **Producción:** mientras carga, un orbe de energía crece en el canal de médula y el personaje se hincha un poco; un anillo a su alrededor se llena en el ritmo basal. Al producir se aprieta (1,12 × 0,88 durante 110 ms) y el orbe sale volando en arco hasta el contador de energía.
- **Daño y muerte:** no aplica en el mundo 1.

### macrofago

- **Silueta:** la masa más grande y pesada de la casilla: un bulto ancho y bajo con el contorno abollado, apoyado en todo el suelo. Tres pseudópodos en `brazos.svg` (uno alto que se estira hacia adelante con dedos romos, uno bajo que se arrastra por el suelo hacia adelante y uno trasero). Núcleo grande arriñonado en la mitad trasera. Vacuolas y un fagosoma con una bacteria a medio digerir. Mira a la derecha.
- **Receptores PRR:** cuatro botones lila en el borde superior y delantero del cuerpo, en `cuerpo.svg` dentro de `<g id="prr">` (círculos de radio 7 en (160, 48), (177, 56), (203, 88) y (211, 124)). El motor los hace brillar cuando el macrófago detecta un PAMP; es el único elemento con ese papel.
- **Colores:** cuerpo `#FBF7F2`, sombra y pseudópodos `#E1D9E8`, núcleo `#7B4FA3` / `#5E3A80` / `#A47CC8`, PRR `#A47CC8`, bacteria fagocitada `#9E86F2` con trazo `#5435B8`, rubor `#E8A29A`. Sin brillo: el cuerpo ya usa el tono más claro permitido.
- **Personalidad:** veterano grandote, glotón y algo pagado de sí mismo. Párpado plano bajo, cejas en arco relajadas, sonrisa ladeada relamiéndose, rubor.
- **Reposo:** respiración pesada y lenta (escala 1,02 × 0,98 y vuelta cada 2,4 s, anclada en la base). Los pseudópodos ondulan ±4° con desfase entre ellos, como si tantearan.
- **Ataque (fagocitosis):** los pseudópodos delanteros se estiran 12 px hacia adelante y se cierran (rotación de 15° hacia el objetivo) en 200 ms; el cuerpo embiste 10 px hacia la derecha y se ensancha (1,08 × 0,94) al engullir; vuelve en 300 ms y queda un bamboleo satisfecho de digestión (tres oscilaciones de escala 1,03 × 0,97 que se amortiguan en 900 ms) con el fagosoma desplazándose 4 px.
- **Daño y muerte:** daño, temblor de escala corto; muerte, se desinfla hacia la base y se aplana.

### neutrofilo

- **Silueta:** esfera algo ovalada e inclinada hacia adelante (unos 14°), más pequeña que el macrófago. Urópodo (colita trasera de la célula que migra) abajo a la izquierda. Puño delantero hacia adelante y brazo trasero echado hacia atrás, como al arrancar a correr. Núcleo con cuatro lóbulos de distinto tamaño unidos por puentes finos, en zigzag por la mitad baja, y gránulos finos repartidos. Mira a la derecha.
- **Colores:** cuerpo `#FBF7F2`, sombra y brazos `#E1D9E8`, gránulos `#D3B6CE`, núcleo `#7B4FA3` / `#5E3A80` / `#A47CC8`, rubor `#E8A29A`. Sin brillo, como el macrófago.
- **Personalidad:** novato impulsivo con prisa por entrar en combate. Ojos abiertos, cejas rectas firmes bajando hacia el centro (ceño decidido), boca en grito de carga, rubor leve.
- **Reposo:** impaciente: saltitos de 2 px cada 0,5 s y balanceo hacia adelante de ±3°; el puño delantero tiembla 2 px.
- **Ataque (carrera y engullida):** se agacha 4 px (1,06 × 0,94) en 80 ms, sale disparado 14 px hacia la derecha en 120 ms con rotación de 6° hacia adelante, se hincha al tragar (1,10 × 0,92) y vuelve a su sitio en 250 ms.
- **Daño y muerte:** daño, retroceso de 4 px a la izquierda; muerte (vive poco), se encoge rápido y se desvanece en escala.

### dendritica

- **Excepción de color (aprobada el 2026-11-21):** cuerpo menta `#D3EEDF` con sombra `#A9D6BE`, en vez del blanco hueso de los leucocitos. La distingue del macrófago y del neutrófilo a primera vista.
- **Silueta:** cuerpo redondo con nueve dendritas largas de doble trazo, algunas ramificadas.
- **Gesto:** levanta con el brazo derecho una bandeja (adelanto del MHC II) con un fragmento dorado de bacteria (`#F2C230`): presenta el antígeno.
- **Personalidad:** mensajera chismosa que siempre trae noticias. Guiña el ojo derecho, ceja izquierda alzada, boca abierta en sonrisa. Solo parpadea el ojo abierto.

## 8. Cómo comprobar un sprite

1. Validar el XML: `python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parse(sys.argv[1])" <archivo>`.
2. Rasterizar con `rsvg-convert -w 256 -h 256 -b '#DDBDB8'` y también a 96 px.
3. Apilar las tres piezas en el orden de capas y confirmar que coinciden con `completo.svg`.
4. Comprobar el margen de 8 px y que la base cae en y ≈ 220–229.
5. Abrir `assets/sprites/preview.html` en el navegador para comparar los personajes juntos.
