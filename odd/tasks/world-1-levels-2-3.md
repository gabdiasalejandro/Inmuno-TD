# World 1, levels 1-2 and 1-3, plus level intros

Objective: make levels 1-2 (resident macrophage) and 1-3 (neutrophil) playable, and give every level a concept card and a start banner.
Branch: main (no commits yet; the user has not asked for commits). Delivery: none planned. Test runner: `pnpm test` (Vitest), `pnpm typecheck`, `pnpm build`.

## Specs

- S1. A big banner at level start. User: "Falta que salga un !Resiste! en grande al empezar el nivel".
- S2. A simple concept card before each level starts, including 1-1. User: "en el nuevo nivel hay que presentar de forma sencilla los conceptos con una flashcard antes de empezar, o de la forma en que mejor lo consideres, igual en el primero, algo como !Las barreras naturales detienen a las bacterias!, tú decides el texto exacto".
- S3. Build 1-2 and 1-3 with the design the user approved. User: "Vas con el 1-2 y el 1-3".
  - 1-2 Macrófago residente: new unit `macrofago`, expensive and tough; phagocytosis swallows one bacterium whole and then digests for a few seconds; only attacks enemies with a PAMP emblem and the detection is visible; won by clearing every wave; last waves nearly overwhelm it.
  - 1-3 Neutrófilo: new unit `neutrofilo`, cheap, eats fast, short-lived; a macrophage that detects enemies raises a cytokine meter; while it is high the marrow produces faster and neutrophils redeploy sooner; won by clearing waves macrophages alone cannot hold.
- S4. More lanes open in the new levels. User: "y que se abran más carriles". Revised 2026-11-14: three lanes in 1-2 and all five in 1-3. User: "en el nivel 2 se abran 3 carriles y en el 3 ya los 5".
- S5 (assumption, from CLAUDE.md 2.3): each level ships with simulation balance tests.
- S6. Neutrophil cost 50. User: "que el neutrófilo cueste 50".

## Tasks

- [x] T1 (S3) inline: sim rules `requires`, cytokine signal, boosted marrow, `alarmed` units. Tests first.
- [x] T2 (S3, S4, S5) inline: data for units, levels 1-2 and 1-3, intro texts, balance bots.
- [x] T3 (S3) delegated, Opus (parallel, disjoint surface `assets/sprites/{macrofago,neutrofilo}`): sprites.
- [x] T4 (S1, S2, S3) delegated, Sonnet (several files, starts after T1-T2 because it renders their API): intro card, start banner, cytokine meter, detection and phagocytosis visuals.
- [x] T5 inline: seam check (typecheck, tests, build) and browser review.
- [x] T6 (S4, S6) inline: neutrophil cost 50; 1-2 opens three lanes; 1-3 opens all five. Balance bots re-tuned so macrophages or neutrophils alone still lose 1-3, while a combined strategy wins with energy reserved for replacing macrophages.

## Log

- L1 (2026-11-14, user, verbatim): "Falta que salga un !Resiste! en grande al empezar el nivel, y en el nuevo nivel hay que presentar de forma sencilla los conceptos con una flashcard antes de empezar, o de la forma en que mejor lo consideres, igual en el primero, algo como !Las barreras naturales detienen a las bacterias!, tú decides el texto exacto. Vas con el 1-2 y el 1-3, y que se abran más carriles"
- L2: Approved design for S3 was presented by the boss in the previous turn and accepted with "Vas con el 1-2 y el 1-3".
- L3: T1 done. RED then GREEN in `tests/sim/signals.test.ts` (requires, signals, boosted marrow, recruitment, per-level signal gating). Marrow now uses an integer charge (`state.marrowCharge`, `sim.marrowFraction()`).
- L4: T2 done. Bots in `tests/sim/balance-1-2-3.test.ts`: 1-2 barriers only never wins, ignoring the second lane loses, a macrophage per lane wins (also acting every 3 s). 1-3 macrophages alone lose, neutrophils alone lose, both win (also acting every 2 s). Neutrophil tuned to rate 0.5 and lifespan 10 after the first run let macrophages alone win 1-3. 1-2 opens lanes 1 and 3; 1-3 opens lanes 2, 0 and 4.
- L5: T3 (Opus) and T4 (Sonnet) launched. A separate almanac sketch (user request "manda a otro modelo a bocetar el almanaque") runs in parallel on its own surfaces and is not part of this document.
- L6: T3 done. Sprites `macrofago` and `neutrofilo` delivered and seen rendered by the boss next to the existing ones; PRR nubs at (160,48), (177,56), (203,88), (211,124) in `macrofago/cuerpo.svg` `<g id="prr">`, relayed to the T4 worker. Pending owner review.
- L7: T4 done (S1, S2, S3 presentation). Worker verified in a real browser: intro cards for 1-1, 1-2, 1-3; banner; alarmed macrophage with PRR glow; engulf; winning 1-2 and "Siguiente nivel" into 1-3; cytokine meter and particles; retry skips the card. Not seen: a full win of 1-3 in the browser (only the simulation bots prove it).
- L8: T5 done. `pnpm typecheck` clean, `pnpm test` 214 passed, `pnpm build` ok. Boss saw the 1-2 card, the "¡Resiste!" banner and the 1-3 HUD in screenshots. Set `"signals": []` in 1-1 so cytokines are inert there. Follow-up launched (Sonnet): name/figure/badge overlaps on the four narrow cards of 1-3, plus the almanac list as a scroll (user: "la idea del alamanaque es un scroll").
- S1-S5 verdict: S1 met, S2 met, S3 met (1-3 browser win unverified), S4 met (2 lanes in 1-2, 3 in 1-3), S5 met.
- L9 (2026-11-14, user, verbatim): "No se entiende muy bien que hace la barra de citocinas ni sus consecuencias para el juego, hay que explicarlo de alguna forma, y siento que está muy op, supongo que el nerfeo viene en el nivel de inflamación, a lo mejor falta introducir enemigos acorde con la introducción del neutrófilo, pero yo creo que ya lo checamos después."
- L10: Decision: explain the meter now (effect chips with live multipliers on the meter, a one-time callout when it first rises, a visual link to the marrow and the neutrophil card), added to the running Sonnet follow-up. The balance concern is deferred by the user to level 1-4: cytokines/neutrophils feel overpowered; candidate fixes are the inflammation cost and a new enemy type that answers the neutrophil. No numbers changed.
- L11 (2026-11-14, user, verbatim): "puedes checar en diseño de nivel que el neutrófilo cueste 50 y en el nivel 2 se abran 3 carriles y en el 3 ya los 5?" Followed by "sí, porfa" after the boss proposed applying and rebalancing.
- L12: Decision: cost 50, three lanes in 1-2 (1, 3, then 2) and five in 1-3 (2, 0, 4, 1, 3). 1-2 gains waves in the third lane; 1-3 gains light waves in lanes 1 and 3 while keeping the late bursts that defeat macrophages alone. The neutrophil bot now keeps a macrophage's worth of energy in reserve, so at cost 50 it no longer starves replacement macrophages.
- T6 verdict (S4, S6 met): `pnpm typecheck` clean, `pnpm test` 298 passed, `pnpm build` ok. Bots: 1-2 loses with barriers or with only one/two lanes defended and wins with a macrophage per lane (also every 3 s); 1-3 loses with macrophages alone and with neutrophils alone, and wins with both (also every 2 s).
- L11: Follow-up done (Sonnet) and seen by the boss in screenshots: almanac list scrolls (drag, wheel, clipped, tested for 6, 7 and 30 entries); card overlaps fixed for 1 to 4 cards; cytokine meter shows live multiplier chips (marrow and neutrophil), a one-time "¡Alarma!" callout, and a teal link to the marrow panel and the neutrophil card. `pnpm typecheck` clean, `pnpm test` 269 passed, `pnpm build` ok. Weak: the chips are small and sit tight against the "Citocinas" label with four cards.
- L13 (2026-11-14, user, verbatim): "LO sigo sintiendo muy fácil, que el lvl dos se gane con solo 1 macrófago por línea no me acaba de convencer, tampoco que el 3 se pueda ganar tan fácil sin epitelios ni moco. . ." Followed by: "Así también vemos en los tests si hay buen balance, si es necesario bajarle la vida al macrófago o subirle 25 el costo lo hacemos, pero solo si lo ves conveniente".
- L14: 1-2 hardened and validated. Macrophage HP 400 -> 250 (global, authorized), 1-2 marrow 30/5 and late bursts of 5 at 64-68 and 82-86. Tests now show: macrophages alone lose, walls alone lose, ignoring a lane loses, and macrophage + wall + mucus wins (also every 3 s). 1-3 remains winnable with macrophages + neutrophils and no barriers; lowering HP or raising cost to 125 did not change that, and every barrier strategy the balance bots tried lost once pressure was high enough to beat the no-barrier combo. Buffing mucus slow or wall HP in simulation did not close the gap either. Decision needed on a bigger lever before touching 1-3 further.
