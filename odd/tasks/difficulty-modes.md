# Difficulty modes (Normal and Sepsis), level 1-1 tutorial, faster loading

Objective: two difficulties. Sepsis is the current level data; Normal is a per-level override layer, easier on levels 1-2 to 1-5 and maybe the boss. Plus the 1-1 tutorial and lighter browser loading.
Branch: feat/difficulty-modes. Delivery: ask-on-risk. Runner: `pnpm typecheck && pnpm test` (Vitest).

## Specs

- S1. Tutorial in level 1: "poner tutorial en el lvl 1".
- S2. Two difficulties: "añadir dos dificultades, una normal y otra sépsis, para la normal vamos a bajar la dificultad del dos, 3 4 y 5, y los de la sépsis son los niveles que ya tenemos, tal vez les aumentemos un poquis la diff, pero ya veremos, igual al jefe hay que bajarle en normal."
- S3. Testing per difficulty: "Para la dif normal se usan tests y bots normales como siempre, para la sépsis el único \"test\" va a ser que yo lo pueda pasar jajajaja". Balance tests and bots run on Normal; Sepsis has no balance tests.
- S4. Selection (user, 2026-11-22): "sí, selector normal, no, sépsis disponible desde el inicico" — global selector in the menu, Normal by default, Sepsis available from the start. Progress shared between difficulties (confirmed: "sí, perfecto").
- S5. Faster loading: "checar una forma de lazy load o algo para que tarde menos en cargar en navegador". Plan: preload only the sprites the current level uses; Phaser in its own chunk.
- S6. Architecture: "checar la arquitectura, pq ya hay archivos muy largos". Deferred: split GameScene.ts and Hud.ts after this feature, as separate work.
- S7. World map scenes (2026-11-22): "rediseñe el fono de los mundos a excenas y no solo el logo brillante". Proposal only; integration after user approval (CLAUDE.md 2.4).

## Tasks

- [x] T1 (S1) 1-1 tutorial: 4 steps (marrow, epitelio 2/3, moco 2/5, first bacterium). Route: inline. Commit 4723228.
- [x] T2 (S2, S3, S4) difficulty core: `Difficulty` type, `normal/` override files merged over base levels by `resolveLevel`, stored preference, menu selector, GameScene and balance bots use the resolved level. Route: inline (one dependent unit). Selector bottom right, checked in headless Chromium (map, world view, tap to Sepsis).
- [ ] T3 (S2, S3) Normal balance of 1-2, 1-3, 1-4, 1-5, 1-8: one override file and balance test per level. Route: delegated, parallel writers (independent levels, disjoint files, long bot iteration). Numbers shown to the user before acceptance (CLAUDE.md 2.2).
- [x] T4 (S5) loading: Phaser in its own chunk (357 KB gz, cached across deploys), game sprites loaded in the background from the menu instead of per level (no risk of a missing sprite), "Cargando…" placeholder until Phaser boots. Measured at 1.5 Mbps + 4x CPU: JS 2.4 s, level sprites +1 s. Route: inline.
- [ ] T5 (S7) world scene proposals. Route: delegated (Sonnet), SVG + preview only.

## Log

- L1 (2026-11-22, user): "hay que hacer varias cosas. 1- poner tutorial en el lvl 1. checar una forma de lazy load o algo para que tarde menos en cargar en navegador, checar la arquitectura, pq ya hay archivos muy largos y me preocupa cuando vayamos metiendo más mec+anicas, como los linfocitos, etc. Y la más trabajosa e importante, añadir dos dificultades, una normal y otra sépsis, para la normal vamos a bajar la dificultad del dos, 3 4 y 5, y los de la sépsis son los niveles que ya tenemos, tal vez les aumentemos un poquis la diff, pero ya veremos, igual al jefe hay que bajarle en normal. Para la dif normal se usan tests y bots normales como siempre, para la sépsis el único \"test\" va a ser que yo lo pueda pasar jajajaja"
- L2: baseline `pnpm test` already fails 8-9 tests in `tests/sim/balance-1-8.test.ts` (commit 556c770 allowed failures for a Pages deploy). Normal 1-8 must make them pass.
- L3 (2026-11-22, user): "sí, selector normal, no, sépsis disponible desde el inicico." / "sí, perfecto, de momento así. y puedes mandar a otro agente chiquito a que rediseñe el fono de los mundos a excenas y no solo el logo brillante?"
