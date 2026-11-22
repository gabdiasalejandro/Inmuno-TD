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

- [ ] T1 (S1, S2, A1) sim: enemies that span several lanes (targeting, blocking, power area, traps). Route: inline.
- [ ] T2 (S1, S2, A2-A5) sim: `sheds`, `aura` from a health threshold, `shield` from a health threshold, `boss` win. Route: inline.
- [ ] T3 (S4) sprites: colony and shed S. aureus, proposals. Route: delegated (Sonnet), parallel to T1-T2, disjoint surface `assets/sprites/staphylococcus_aureus*/`.
- [ ] T4 (S1, S2) level 1-8 data, enemies, balance bots. Route: inline.
- [ ] T5 (S1) render and HUD: big colony, toxin aura, fibrin wall with its bar, boss health bar. Route: inline.
- [ ] T6 (S4) tutorial, intro, objectives, almanac, physician notes; browser check. Route: inline.

Route evidence: T3 is an independent unit (art) with a disjoint surface and several minutes of work, launched while T1-T2 run inline.

## Log

- L1 (2026-11-21, user, verbatim): "y cómo harías el lvl del jefe?" then, to the three-phase proposal: "sí, me gustaría que el jefe se quedara más o menos quieto y fueran llegando bacterias mientras esté vivo"
