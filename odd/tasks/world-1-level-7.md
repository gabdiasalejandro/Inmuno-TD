# World 1, level 1-7 "Reencuentro": dendritic cell and the returning pathogen

Objective: the trap level of world 1. The same pathogen returns and the innate response is just as slow each time; only the dendritic cell carrying antigen to the lymph node ends it. Hook to world 2.
Branch: feat/world-1-level-7. Delivery: ask-on-risk. Runner: `pnpm typecheck && pnpm test` (Vitest).

## Specs

- S1. Dendritic cell is a playable deck card (user choice, 2026-11-21): "Unidad jugable (Recomendado)" — "Carta del mazo. Se coloca, recoge antígeno de las bacterias que mueren cerca y lo lleva al ganglio (borde izquierdo). Entregar N antígenos es la condición de victoria."
- S2. Proposal shown to the user before the S3 question: "_S. pyogenes_ vuelve en tres encuentros iguales. La innata tarda lo mismo cada vez porque no tiene memoria." / "Dendrítica: barata. No ataca ni bloquea. Cuando muere una bacteria en las casillas de alrededor, recoge un antígeno. Con 3 antígenos camina por su carril hasta el borde izquierdo (el ganglio), los entrega y sale del tablero." / "Victoria: entregar N antígenos (unos 6) y limpiar el tablero."
- S3. If the third encounter ends without enough antigen delivered (user choice, 2026-11-21): "Vuelve otra vez (Recomendado)" — "El patógeno repite el encuentro hasta que llegue el antígeno. Jugar solo con la innata no gana nunca: la inflamación se acumula y acaba perdiendo. Es la trampa del nivel y enseña que la innata no recuerda."
- S4. Dendritic sprite: mint, approved 2026-11-21 (done in commit 9e9dfc0).
- S5. Project rules (CLAUDE.md 2.3, 5.4): the level ships with a learning goal, 2-3 objectives phrased as exam questions, a tutorial, almanac entry, balance tested with simulation bots, and entries in `docs/fuentes.md` / `docs/simplificaciones.md`.

## Tasks

- [ ] T1 (S1, S2, S3) sim: `collects` units, couriers that walk to the left edge, `antigen` win condition, `returns` that repeats the last encounter. Route: inline.
- [ ] T2 (S1, S2) render and HUD: dendritic load, walking courier, delivered/needed counter, "return" banner. Route: inline.
- [ ] T3 (S2, S3, S5) level 1-7 data, balance bots. Route: inline.
- [ ] T4 (S5) tutorial, intro card, almanac, objectives, docs for the physician. Route: inline.
- [ ] T5 browser check of the level. Route: inline.

Route evidence: one dependent chain (T2-T4 read T1's state), no parallel units, so no writer delegation.

## Log

- L1 (2026-11-21, user, verbatim): "Eso, y empezamos con el 1-7." then "Me gusta la menta, vas con el lvl"
