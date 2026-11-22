# World 1, level 1-8: boss Staphylococcus aureus

Objective: the world 1 boss. A large S. aureus colony that barely moves and sheds bacteria while it lives, in three phases (arrival, leukocidins, coagulase abscess) that punish strategies from earlier levels.
Branch: feat/world-1-level-8 (from feat/world-1-level-7). Delivery: ask-on-risk. Runner: `pnpm typecheck && pnpm test` (Vitest).

## Specs

- S1. Three phases, approved by the user 2026-11-21 ("sí"), from this proposal:
  - "Llegada (unos 30 s): el jefe es un racimo dorado grande y lento, con PAMP. Delante de él llegan estafilococos pequeños."
  - "Leucocidinas (cuando baja al 70 % de vida): las toxinas matan a los neutrófilos en las casillas cercanas al jefe en 1 o 2 s."
  - "Absceso por coagulasa (al 40 %): el jefe se rodea de un muro de fibrina con vida propia. Mientras el muro esté en pie, al jefe no le llega daño, y por detrás sigue soltando estafilococos." / "El muro se rompe a golpes de macrófago." / "El complemento lo marca, y eso multiplica el daño de los fagocitos." / "El MAC no le hace nada, porque es grampositivo."
  - "Presión de fondo: si abusas de las citocinas y del complemento, la inflamación sube hasta hacerte perder. La NK y la dendrítica están en el mazo pero no sirven de nada aquí."
  - "Victoria: matar al jefe."
- S2. User, verbatim: "me gustaría que el jefe se quedara más o menos quieto y fueran llegando bacterias mientras esté vivo"
- S3. Clinical case after the boss (CLAUDE.md 5.4): out of scope for this feature; separate feature.
- S4. Project rules (CLAUDE.md 2.3, 2.4, 2.5, 5.4): objectives as exam questions, tutorial, almanac, balance bots, physician notes; sprites are proposals for user review; real names only.

Assumptions (mine, to confirm with the user when delivering):
- A1. The colony is wide: it covers lanes 1-3 (`span: 1` around lane 2), so units in those three lanes can reach it.
- A2. Shed bacteria (`staphylococcus_aureus`) enter from the right edge, rotating through every lane; they stop when the colony dies.
- A3. Leukocidins hit units tagged `granulocito` (the neutrophil) within 1 cell of the colony.
- A4. The abscess is a shield with its own hit points; opsonization multiplies damage to it too.
- A5. The level is won the moment the colony dies (`win: { type: 'boss' }`), whatever shed bacteria remain.

## Tasks

- [x] T1 (S1, S2, A1) sim: enemies that span several lanes (targeting, blocking, power area, traps). Route: inline.
- [x] T2 (S1, S2, A2-A5) sim: `sheds`, `aura` from a health threshold, `shield` from a health threshold, `boss` win. Route: inline.
- [x] T3 (S4) sprites: colony and shed S. aureus, proposals. Route: delegated (Sonnet), parallel to T1-T2, disjoint surface `assets/sprites/staphylococcus_aureus*/`. Commit 0729d7a.
- [x] T4 (S1, S2) level 1-8 data, enemies, balance bots. Route: inline.
- [x] T5 (S1) render and HUD: big colony, toxin aura, fibrin wall with its bar, boss health bar. Route: inline.
- [x] T6 (S4) tutorial, intro, objectives, almanac, physician notes; browser check. Route: inline.

Route evidence: T3 is an independent unit (art) with a disjoint surface and several minutes of work, launched while T1-T2 run inline.

## Log

- L1 (2026-11-21, user, verbatim): "y cómo harías el lvl del jefe?" then, to the three-phase proposal: "sí, me gustaría que el jefe se quedara más o menos quieto y fueran llegando bacterias mientras esté vivo"
- L2 (decision, mine): the colony first only crawled forward and nobody could reach it. Added `anchor`: it walks in and holds column 6, so the player must lay siege to it (macrophages at column 5). Shed S. aureus every 4 s, rotating lanes. Colony 2000 hp, aura from 70 % (30 dps on `granulocito`, radius 1), fibrin shield 600 hp from 40 %. Bots: siege + complement wins at about 150 s, siege alone about 216 s, a defence that only waits loses.
- L3 (checks): `pnpm typecheck`, `pnpm test` (582) and `pnpm build` pass. Headless browser: intro, HUD "Jefe 100%", colony across lanes 1-3, shed S. aureus. Not seen in the browser: the toxin haze, the fibrin wall, the phase banners and the win screen (my click script kept losing early).
- L4 (open): the defeat card shows the generic gram-negative bacteria, not S. aureus. Clinical case after the boss (S3) is a separate feature. Sprites are proposals pending user review.
- L5 (2026-11-21, user, verbatim): "Está ok, pero me gustaría cambiar algunas cosas, más aleatoriedad en las bacterias, algún virus o encapsulada  por ahí suelta, es ganable, pero me gustaría que los macrófagos tuvieran una animación de golpe, porque ahora no se entiende muy bien que le están pegando a la colonia, un rediseño de la colonia, algo que se sienta menos como círculos perfectos, que el golpe del macrófago tenga cooldown menor al que tendría si fagocitara, pero que haga un poco menos de daño, y que cuando la bacteria esté en vida óptima se la coma y que el lvl termine cuando ya no haya bacterias y haya muerto el jefe"
- L6 (interpretation, mine, to confirm): "vida óptima" = the colony at or under 10 % health: then the macrophage engulfs it whole instead of striking.
- L7 (done): shed pool by weight (S. aureus 6, capsulated 1, virus 1) every 5 s in a random lane (seeded); macrophage `strike` against `colonia` (30 every 1.5 s, bites are 40 every 4 s) with a punch animation; colony `engulfBelow` 0.1 (not through the shield) with an engulf animation; boss win also needs an empty board; shed S. aureus hp 40; colony anchored at column 5 and drawn smaller (SPAN_SCALE 0.85) so it fits; lumpy colony sprite (delegated, Sonnet). Bots on seeds 1-5: full toolkit wins in about 155 s (engulf about 135 s); without complement it loses every seed (capsulated bacteria); passive defence loses. 599 tests pass.
- L8 (not verified): punch and engulf animations, toxin haze, fibrin wall and win screen were not seen in a browser; the headless click script kept losing early.
