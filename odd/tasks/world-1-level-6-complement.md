# World 1, level 1-6: complement

Objective: add the complement cascade as a one-use level card (area attack) and build level 1-6 around it, with a capsulated enemy only complement can reveal to phagocytes.
Branch: feat/world-1-level-6. Delivery: commits on this branch; push and PR are the user's decision. Test runner: `pnpm test` (Vitest), `pnpm typecheck`, `pnpm build`.

## Specs

- S1. Complement is a one-use card per level, and it attacks in an area. User: "complemento ataque en área, carta de un solo uso por nivel (habrá niveles donde no esté)".
- S2. The cascade runs in order, as a visible combo. User: "fase 1 C3b marca bacterias y los leucocitos las procesan más rápido, C3a aumenta inflamación, C5a te regala un neutrófilo, y C5b mata tres bacterias aleatorias del mapa". User later: "la secuencia es importante".
- S3. C5b only hits gram-negative enemies. User: "me gusta que sea solo a gramnegativos".
- S4. Opsonization changes detection: phagocytes detect an opsonized enemy at once, so the new detection method must be visible. User: "que los macrófagos solo detecten hasta que ya les está pegando y con el complemento lo detecten más rápido" and "Qiero que se note el nuevo método de detección".
- S5. An enemy that is hard to phagocytose and that complement helps. User: "añadimos un enemigo que sea muy difícil de fagocitar y el complemento ayude".
- S6. Phagocytes show digestion clearly. User: "hay que agregar animaciones más evidentes para los fagocitos de cuando están digiriendo".
- S7 (assumption, the user delegated the design): the implementer decides the numbers, the area and how the sequence looks. User: "te dejo libertad para implementarlo con el balance aprendizaje jugabilidad" and "te toca decidir cómo haces divertida la secuencia".
- S8 (assumption, CLAUDE.md 2.3): level 1-6 ships with simulation balance tests and its concept card, objectives and questions are noted for review.
- S9 (out of scope): the infected-cell enemy that spawns viruses. User: "lo dejamos para ajuste".
- S10 (rule, CLAUDE.md 2.1 and 2.2): every simplification goes to `docs/simplificaciones.md` and every claim to `docs/fuentes.md`. Mechanics already agreed by the user are implemented; new ones are asked as multiple choice.

## Tasks

- [ ] T1 (S1, S2, S3, S4, S5) inline: sim. Opsonized enemies, capsulated enemy, complement power with area and cascade, gram-negative MAC. Tests first.
- [ ] T2 (S1, S2) inline: placement and card wiring in the sim boundary (power command, one use).
- [ ] T3 (S4, S5, S6) inline: visuals. Cascade banners in order, detection marker on opsonized enemies, digestion animation for phagocytes.
- [ ] T4 (S8) inline: data for level 1-6, intro, almanac and i18n texts, balance tests.
- [ ] T5 (S8) inline: docs `fuentes.md` and `simplificaciones.md`.
- [ ] T6 inline: seam check (typecheck, tests, build).

## Log

- L1 (2026-11-21, user, verbatim): "Ya probé el nivel, me gusta en términos generales... ahora, los niveles qué siguen, qué decisiones hay que tomar antes de hacerlas?" then "complemento ataque en área, carta de un solo uso por nivel (habrá niveles donde no esté), la idea es que se entienda la cascada, que sea como un combo, fase 1 C3b marca bacterias y los leucocitos las procesan más rápido, C3a aumenta inflamación, C5a te regala un neutrófilo, y C5b mata trés bacterias aleatorias del mapa. Y añadimos un enemigo que sea muy difícil de fagocitar y el complemento ayude, o que los macrófagos solo detecten hasta que ya les está pegando y con el complemento lo detecten más rápido. Algo así. No es definitivo... hay que agregar animaciones más evidentes para los fagocitos de cuando están digiriendo".
- L2 (2026-11-21, user, verbatim): "me gusta que sea solo a gramnegativos, te dejo libertad para implementarlo con el balance aprendizaje jugabilidad, y de una vez ve haciendo el nivel que sigue, dame opción múltiple para las dudas que vayan saliendo. Y sí, la secuencia es importante. Qiero que se note el nuevo método de detección, sí, y no sé que tan fiel sea lo de que los macrófagos fagocitan más rápido así, así que te toca decidir cómo haces divertida la secuencia."
- L3 (2026-11-21, decision, mine): opsonization is a status `opsonizado` on enemies, declared in `statuses.json`. It grants the `PAMP` tag for detection and attack (simplification: real opsonins are recognised by their own receptors, not by PAMP; to register). Opsonized enemies take 1.5x phagocytosis damage (the user doubts this is faithful; registered as a gameplay simplification).
- L4 (2026-11-21, decision, mine): the capsulated enemy has no `PAMP` tag, so phagocytes ignore it until complement opsonizes it. Its waves in 1-6 come after the first use is explained.
- L5 (2026-11-21, decision, mine): the complement power has radius 1 (a 3x3 area) around the clicked cell, costs no energy, and is usable once per level. Its cascade: C3b at 0 s, C3a at 0.8 s, C5a at 1.6 s, C5b at 2.4 s.
