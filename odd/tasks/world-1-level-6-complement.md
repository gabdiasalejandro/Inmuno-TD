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

- [x] T1 (S1, S2, S3, S4, S5) inline: sim rules (opsonized status, capsulated enemy, complement power with area and cascade, gram-negative MAC). Commit c68d44b. Tests written after the code, not RED first (exception: the sim was built before the test file; the tests pin the rules and were fixed where they checked the wrong thing).
- [x] T2 (S1) inline: placement refuses powers as units; the power is played with `playPower`, one use per level. Commit c68d44b.
- [x] T3 (S4, S5, S6) inline: card wiring, cascade labels in order, opsonin ring on marked enemies, digestion bubbles and violet tint on every phagocytosis. Commit d151df4. Not verified in a browser.
- [x] T4 (S8) inline: level 1-6 data, intro, objectives, i18n, almanac entries, balance tests (`tests/sim/balance-1-6.test.ts`). Commits c68d44b and befe2fb.
- [x] T5 (S8, S10) inline: `docs/fuentes.md` and `docs/simplificaciones.md` sections for level 1-6. Commit befe2fb.
- [x] T6 inline: seam check run after each unit: `pnpm typecheck`, `pnpm test` (526 passing), `pnpm build`.

- [x] T7 (S11, S12) inline: the complement becomes a reusable power outside the deck, cooldown 30 s, no energy cost, each use raises inflammation. Commit (see log).
- [x] T8 (S13) inline: sprites for the gram-negative and capsulated bacteria, following `docs/guia-estilo.md`, checked by rendering to PNG.
- [x] T9 (S14) inline: the power section under the deck, the four cascade components as chips that light in order, and a caption with each step's role.
- [x] T10 inline: seam check (typecheck, tests, build) and a headless screenshot of level 1-6.

## Log

- L1 (2026-11-21, user, verbatim): "Ya probé el nivel, me gusta en términos generales... ahora, los niveles qué siguen, qué decisiones hay que tomar antes de hacerlas?" then "complemento ataque en área, carta de un solo uso por nivel (habrá niveles donde no esté), la idea es que se entienda la cascada, que sea como un combo, fase 1 C3b marca bacterias y los leucocitos las procesan más rápido, C3a aumenta inflamación, C5a te regala un neutrófilo, y C5b mata trés bacterias aleatorias del mapa. Y añadimos un enemigo que sea muy difícil de fagocitar y el complemento ayude, o que los macrófagos solo detecten hasta que ya les está pegando y con el complemento lo detecten más rápido. Algo así. No es definitivo... hay que agregar animaciones más evidentes para los fagocitos de cuando están digiriendo".
- L2 (2026-11-21, user, verbatim): "me gusta que sea solo a gramnegativos, te dejo libertad para implementarlo con el balance aprendizaje jugabilidad, y de una vez ve haciendo el nivel que sigue, dame opción múltiple para las dudas que vayan saliendo. Y sí, la secuencia es importante. Qiero que se note el nuevo método de detección, sí, y no sé que tan fiel sea lo de que los macrófagos fagocitan más rápido así, así que te toca decidir cómo haces divertida la secuencia."
- L3 (2026-11-21, decision, mine): opsonization is a status `opsonizado` on enemies, declared in `statuses.json`. It grants the `PAMP` tag for detection and attack (simplification: real opsonins are recognised by their own receptors, not by PAMP; to register). Opsonized enemies take 1.5x phagocytosis damage (the user doubts this is faithful; registered as a gameplay simplification).
- L4 (2026-11-21, decision, mine): the capsulated enemy has no `PAMP` tag, so phagocytes ignore it until complement opsonizes it. Its waves in 1-6 come after the first use is explained.
- L5 (2026-11-21, decision, mine): the complement power has radius 1 (a 3x3 area) around the clicked cell, costs no energy, and is usable once per level. Its cascade: C3b at 0 s, C3a at 0.8 s, C5a at 1.6 s, C5b at 2.4 s.
- L6 (2026-11-21, decision, mine): the C5b membrane attack takes up to three gram-negative enemies in the area, nearest the base first; the sim sorts by position.
- L7 (2026-11-21, observation): with the bots in `balance-1-6.test.ts`, the level is won in about 115 s with the complement card, and lost by breach without it. The winning run ends with about 350 energy unspent, so the economy of the level is probably too generous. Open for the user.
- L8 (2026-11-21, observation, mine): the capsulated and gram-negative enemies and the complement card have no sprites yet; they render with the default figure. Art is pending the user's review (CLAUDE.md 2.4).
- L9 (2026-11-21, not done): no tutorial file for 1-6, and no browser check of the cascade or the digestion animation. Those need a manual play by the user.
- L10 (2026-11-21, decision, mine): the infected-cell enemy that spawns viruses (S9) is out of this task; the user asked to leave it for a later adjustment.
- L11 (2026-11-21, user, verbatim): "faltan sprites, me gustaría que la cascada fuera más explícita con los componentes que tiene para que se aprenda, y que no sea una carta más, que sea un poder en otra sección. y lo de que sea uno solo por partida ns, piénsalo. si quieres le añades costo o no, decide qué es mejor para la jugabilidad"
- S11. The complement is a power in its own section, not a deck card. User: "que no sea una carta más, que sea un poder en otra sección".
- S12. Reusable, with a cooldown. Decision (mine): 30 s cooldown, no energy cost, each use raises inflammation by 4. Why: energy is already the currency of units, and the neutrophil the C5a gives back would refund a cost anyway; a one-use power is a trick, while the real complement acts continuously, so recharge plus an inflammation price stand in for it.
- S13. Sprites for the two new bacteria. User: "faltan sprites". The power itself has no character and gets a chip panel, not a sprite.
- S14. The cascade explains itself. User: "que la cascada fuera más explícita con los componentes que tiene para que se aprenda". Four chips in order (C3b, C3a, C5a, C5b), each lights when its step fires, and a caption says the role of the current step.
- L12 (decision, mine): the intro of 1-6 shows the two bacteria instead of the power, because a power has no figure.
- L13 (observation): with the reusable power, the 1-6 has a second capsulated wave (80 s, lane 0). The balance bots still win with the power and lose without it.
