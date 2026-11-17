# Manual cytokines and tutorial system

Objective: player-controlled cytokine release (1-3), scalable PvZ-style mini tutorials hosted by the dendritic cell, pointer cursor on desktop. Branch: main (uncommitted until the user asks). Delivery: ask-on-risk. Runner: `pnpm typecheck && pnpm test` (Vitest).

## Specs

- S1. Pointer cursor: "en pc falta el cambio de cursor a pointer en la selección de mundos y niveles, no sé si adentro de los niveles tmb".
- S2. Manual cytokines: "las citocinas dando clic en las células, tmb en las paredes dañadas cuando se abren los carriles". Cells that detect a PAMP (macrophage) and damaged walls (wounds) accumulate a cytokine charge; the player clicks the source to release a pulse. The pulse speeds up the marrow and makes neutrophils cheaper/faster for a few seconds (proposal accepted by the user).
- S2b (supersedes the click-per-source part of S2, per L3/L4). One hold-to-release button: while held, pooled charge from all capable sources drains into the cytokine meter; it can never release more than the pooled charge ("ese botón tenga el límite de ls cargas de las células"); more capable cells = more charge. Both the stored charge and the meter decay slowly when nothing generates ("las dos bajaran lento con el tiempo si no generan más"). Sources: macrophage detecting PAMP, epithelium when damaged ("Que el epitelio al ser dañado tmb pueda liberar"), wounds with little charge ("que las de las heridas liberen poco para que el jugador tenga que plantar más" — gameplay over realism, record in simplificaciones). From 1-4 holding longer also raises inflammation; 1-3 still none (S3). Tutorial must teach the button.
- S3. "el 1-3 sin inflamación, esta se presenta en el 1-4". No inflammation meter or penalty in 1-3.
- S4. Tutorial: "falta un mini tutorial antes de cómo se usa como en pvz, y me preocupa que tal vez necesitemos varios de esos y hay que hacerlo escalable". Data-driven tutorial steps, reusable by any level.
- S4a. Tutorial style (user choice, 2026-11-17): guided PvZ style — the game pauses or slows, the dendritic cell says one short line, an arrow points at the card or cell, the step advances only when the player performs that action; skippable if the level was already played.
- S5. Tutor character: the bone marrow presents the tutorials (user change, L8; was the dendritic cell, whose sprite is kept for 1-7). Sprite is a proposal pending user review.
- S6 (later, needs level design). Inflammation bar in 1-4 with tiers: 0–40 % no effect, 40–80 % collateral damage to own units in inflamed lanes, 100 % defeat.

- S7 (later, design accepted 2026-11-17). NET: when a neutrophil dies it leaves a NET on its cell for a few seconds that slows bacteria and does slight damage; "que no esté tan op, porque si no a lo mejor habría que subirle el costo". From 1-4 NETs also raise inflammation. Keep level order (1-2 resident macrophage, 1-3 recruited neutrophil); cards/almanac stress "residente".

- S8. Left HUD (PvZ 2): marrow + vertical deck in a left column; "e igual las barritas y botones arriba, pero estaría bien ver un mockup antes de aplicarlo". Mockup approved by the user 2026-11-17 (docs/mockup-hud-izquierda.png).
- S9. "el botón de menú adentro del nivel debería decir pausa, no llevarte directo al menú": pause button that pauses and opens Continuar / Reiniciar / Menú.

- S10. Tutorial pacing (L8): "es medio lento, hay que poner el macrófago más adelante para que el jugador no espere demasiado a que salgan bacterias y que las bacterias salgan un poco más rápido". Macrophage step moved to col 7 (done). Bacteria sooner: tutorial-only, without changing 1-3 balance.
- S11. No gram-negative for now; the user wants a special named bacterium with a specific behaviour (to design).

- S12 (L9). Tutorial UI: macrophage step at col 6; "sin botón de saltar, solo de \"siguiente\""; card and target cell highlighted at once; remove "Toca para seguir" (it overlaps).
- S13 (L9). Streptococcus pyogenes is the special enemy of 1-4 (spreads through tissue via hyaluronidase: changes lane at barriers). Level design pending.

- S14 (L10). Level 1-4 design approved as proposed: objectives "¿Qué ventajas y qué daños tiene la inflamación?" and "¿Qué son las NET y por qué también dañan el tejido?"; inflammation rises with released cytokines and each NET, decays slowly, tiers 0–40 none / 40–80 own units lose HP slowly / 100 defeat; NET ~3 s on the neutrophil's cell on death, strong slow + slight damage; S. pyogenes has PAMP, same HP as gram+, on reaching an epithelium switches to a neighbour lane instead of attacking, mucus slows it as usual; deck epitelio, moco, macrofago, neutrofilo; early gram+ only, S. pyogenes mid-level, dense mixed final wave; win = clear, lose = breach or inflammation 100; 3–4 min; marrow tutorial steps for the inflammation bar and for the first lane switch.

- S15 (L11). Tutorial arrow must not overlap the bubble (release-button step). Cytokines: "bajar un poquito la carga que pueden tener las células de citocinas y que el botón cargue la barra más rápido" (macrophage 40→30, epithelium 15→10, wound 6→4, release 25→40/s). Added to the 1-4 writer.
- S16 (L11). Commit the finished work; the 1-4 writer is editing the same files, so commit after it returns.

- S17 (L12). Inflammation tiers: 0–60 % none, 60–90 % collateral damage, from 90 % damage doubled, 100 % defeat. Cytokine bar fills faster. 1-4 easier: "necesitamos que la inflamación joda un poco menos y deje usar las citocinas un poco más".

- S18 (L13). Fix overlap in the almanac and the intro concept card (long names collide, body text runs under "¡Vamos!"). The 1-4 tutorial presents S. pyogenes when the first one appears. "para forzar muros podemos hacer que aparezcan en grupos de 3 o 4 muy pegados y que solo puedan cambiar de carril una vez".

- S19 (L14). Level 1-5 virus, approved: the virus (small, fast, low HP) infects ANY own cell instead of attacking (state `infectada`); after some seconds the infected cell bursts, dies and releases 2–3 new virions into neighbouring cells. Infected cells protect their neighbours with interferon automatically for a few seconds (protected cells cannot be infected) — "está bien para que el virus no sea una masacre". Phagocytes can eat free virions but cannot attack infected cells. NK (new unit) attacks only own `infectada` cells in range (stress-ligand recognition), never free virus. NO MHC I mechanic in world 1 ("lo del MHC lo guardamos para el mundo 2"). Viruses come mixed with bacteria. Deck epitelio, moco, macrofago, neutrofilo, NK; cytokines and inflammation stay active. The bone marrow explains it (tutorial). NK sprite: femme fatale, pretty, a colour different from macrophage and neutrophil (proposal for review).

- S20 (L15, later, after world 1). Big epithelium buff so it is used more and the virus and S. pyogenes mechanics make more sense: "habrá que darle un gran bufo al epitelio cuando acabemos el mundo 1". NK sprite redo: "esta sí se tiene que ver algo más mala y cool, incluso ligeramente edgy".

## Tasks

- T1 S1 — delegated (user asked for agents) — done, typecheck + 308 tests pass, uncommitted.
- T2 S2, S3 — delegated (user asked for agents) — done, typecheck + 320 tests pass, uncommitted. Numbers: macrophage 6 s / 40, wound 12 s / 15. 1-3: wins only when releasing.
- T3 S4, S4a, S5 — delegated — done for 1-3, typecheck + 352 tests + build pass, uncommitted, not seen in browser. Dendritic sprite pending user review; no almanac entry yet.
- T5 S2b, S4 — delegated — done, typecheck + 372 tests + build pass, uncommitted. Meter decay 3/s, release 25/s; macrophage cap 40 @7/s; epithelium cap 15, 0.3/hp; wound cap 6 @0.5/s.
- T6 S9 + T7 S8 — delegated — done, typecheck + 391 tests + build pass, uncommitted, not seen in browser.
- T8 S5 (marrow tutor), S10 — delegated — done, 396 tests + build pass; tutorial hold step shows at 14.8 s instead of 29.6 s (waitTime fast, 2×). Effect line rewritten in first person (marrow speaking).
- T9 S12 — delegated — done, typecheck + 398 tests + build pass, uncommitted.
- T10 S12 fix — inline — done: bubble 680×170, text 24 px, "Siguiente" on its own row; first-release green "¡Alarma!" hint removed (trigger, levelView fn and its test). 397 tests pass.
- T13 S19 — level 1-5 — delegated — done, 500 tests + build pass. NK sprite (edgy, mauve) and virus sprite pending user review.
- T12 S18 — delegated — done, 467 tests pass. Intro/almanac text fit, S. pyogenes groups of 3–4 with one lane switch, tutorial shows it on first appearance.
- T11 S17 — delegated — done, 438 tests pass. Release 60/s; inflammation +0.42/pt, decay 1.1/s, harm 1 %/s from 60 %, 2 %/s from 90 %; gauge throbs from the last tier. Uncommitted.
- T4 S6, S7, S13, S14, S15 — level 1-4 + overlap fix + cytokine tuning — delegated — done, typecheck + 436 tests + build pass. Pending playtest and S. pyogenes sprite review.

## Log

- L1 (2026-11-17, user): "No, el 1-3 sin  inflamación, esta se presenta en el 1-4, házlo local, pero falta un mini tutorial antes de cómo se usa como en pvz, y me preocupa que tal vez necesitemos varios de esos y hay que hacerlo escalable, que lo de alguna célula que se dedica justo a entrenar células inmunes estaría cool. Otro detalle es que en pc falta el cambio de ccursor a pointer en la selección de mundos y niveles, no sé si adentro de los niveles tmb, bueno, manda a agentes a ejecutarlo y lo que tengas duda antes de mandarlos me preguntas. Sí, las citocinas dando clic en las células, tmb en las paredes dañadas cuando se abren los carriles."
- L2: tutor = dendritic cell (user answer). Still to discuss: NETs, neutrophil arriving before macrophage, virus, ranged unit, deck on the left (PvZ 2).
- L3 (2026-11-17, user): "Mejor de momento lo dejamos solo cuerpo a cuerpo. Y ya los linfocitos T en el mundo 3 harían su trabajo. Lo de las citocinas a nivel jugable no me encanta, yo creo que sí, la carga debería bajar con el tiempo, pero más lento que ahora, y mejor un botón para liberar, y que puedas liberar más mientras más células haya con capacidad de hacerlo, en lugar de dar clic una por una. Que el epitelio al ser dañado tmb pueda liberar, y que las de las heridas liberen poco para que el jugador tenga que plantar más (le quita realismo, pero sacrificio por jugabilidad), sí, lo del balance está ok. (Tenemos que cambiar el tutorial con esto, ya qué)."
- L4 (2026-11-17, user): "me gustaría que las dos bajaran lento con el tiempo si no generan más, y que el botón no liberara de golpe, que fuera más como un "mantén pulsado", y mientras más lo hagas más subes la barra y más se inflama y que ese botón tenga el límite de ls cargas de las células, no sé si me explico"
- L5: no ranged unit for now (melee only; ranged comes with lymphocytes in world 3). S2 rewritten to S2b; T5 opened.
- L6 (2026-11-17, user): "Si, e igual las barritas y botones arriba, pero estaría bien ver un mockup antes de aplicarlo y otra cosa importante el botón de menú adentro del nivel debería decir pausa, no llevarte directo al menú"
- L7 (2026-11-17, user): "Sí, me gusta el mockup"
- L8 (2026-11-17, user): "Mejor no metemos grampnegativa de momento, pero tengo ganas de algún enemigo especial, alguna bacteria con nombre que haga algo específico. Lo de las citocinas está bien" / "es medio lento, hay que poner el macrófago más adelante para que el jugador no espere demasiado a que salgan bacterias y que las bacterias salgan un poco más rápido. nd más. Y mejor pon a la médula ósea a presentarlo"
- L9 (2026-11-17, user): "EL hud me gusta más, el macrófago a la 6 mejor, sin botón de saltar, solo de \"siguiente\" y que se marque tanto el macrófago como la casilla inmediatamente, el toca para seguir se solapa btw, solo lo quitamos y yap. Me gusta el enemigo especial para el 1-4 el pyogens"
- L10 (2026-11-17, user): "me gusta lo del 1-4 [...] el tutorial tiene fallas de overlap y la imágen en verde que sale la primera vez que liberas citocinas no es necesaria."
- L11 (2026-11-17, user): "mini error de overlap aquí. lo demás ok, sí, justo te iba a decir eso, hay que hacer commit, y hay que bajar un poquito la crga que puden tener las células de citocinas y que el botón cargue la barra más rápido."
- L12 (2026-11-17, user): "mejor sube la franja a 60 y 60-90 daño de inflamación lo del daño, y haz que la barra de citocina cargue más rápido, ahora mismo el nivel está muy difícil, pasable, pero puede frustrar, necesitamos que la inflamación joda un poco menos y deje usar las citocinas un poco más, y que del 90% el daño se duplique me parece ok"
- L13 (2026-11-17, user): "PUes vamos a ver lo del virus, mientras tanto hay overlap en el almanaque [Image #3] y en esta card, sí lo del pyogens está ok. para forzar muros podemos hacer que aparezcan en grupos de 3 o 4 muy pegados y que solo puedan cambiar de carril una vez"
- L14 (2026-11-17, user): "dale la 2, seguramente después de acabar el mundo 1 haya cosas de diseño, lo del MHC lo guardamos para el mundo 2, la NK está ok. y que los virus vengan con las bacterias sí. Lo de la NK sí, y tenemos que hacerla estilo femme fatale, bonita, y de otro color diferente a los macro y neutro , lo del interferón sí, está bien para que el virus no sea una masacre. y que lo explique la médula"
- L15 (2026-11-17, user): "Y habrá que darle un gran bufo al epitelio cuando acabemos el mundo 1 para que se use más y las mecánicas de los virus y los pyogens tengan más sentido, pero lo dejamos para después. Y de la NK, no me encanta, esta sí se tiene que ver algo más mala y cool, incluso ligeramente edgy"
