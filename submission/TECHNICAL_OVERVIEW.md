# Technical Overview

## Stack

- **TypeScript + Vite.** Static output, `base: './'`, so it runs from any path or host.
- **No UI framework.** A ~100-line DOM helper, a hash router, a Canvas 2D stage, and Web Audio synthesis.
- **Dependencies at runtime:** self-hosted fonts only (Fontsource).
- **Dev tools:** vitest (unit and integration tests), puppeteer-core with the system Chrome/Firefox (end-to-end tests).
- **Size:** about 123 KB of JS (≈44 KB gzipped) and 30 KB of CSS (≈6.5 KB gzipped).

## Layers

```
src/quantum/      the physics. Pure functions, no DOM.
  complex.ts        complex arithmetic
  state.ts          n-qubit state vectors; q0 = most significant bit; kets; global phase
  gates.ts          I X Y Z H, CNOT; applyOps in time order
  measurement.ts    Born rule + collapse (Z and X bases), Pauli expectations, partial trace
  bellStates.ts     the four Bell states, their agreements, identification, game names
  superdenseCoding.ts  createPair, movesFor, encode, decodeSteps (CNOT, H), bellMeasure, lone qubits
  rng.ts            seeded mulberry32 (reproducible missions, tests, daily seed)

src/game/         game rules on real state vectors. Pure, deterministic with a seed.
  mission.ts        real-time engine: channel window, flights, rack, zones, spy, fuses, hearts, input buffering
  bench.ts          one-pair bench for levels 1–5 + pure progress functions
  levels.ts         10 level definitions + arcade generator
  scoring.ts        score only from correct decodes
  store.ts          safe persistence (corrupt/blocked storage tolerated)
  bot.ts            mission bots (balance tests and the reference strategy)

src/ui/           presentation only. Never does quantum maths itself.
  app.ts            router, settings, toasts, captions, ARIA live region, global keys
  scene.ts          canvas renderer: orbs, two-strand links, ladder, channel, zones, spy, analyzer
  components.ts     message cards, pattern badges, circuit SVG, overlays
  screens/          title, levels map, levels 1–5, mission (6–10 + arcade), lab, how-to, settings
src/audio/audio.ts  synthesised cues + captions
```

## The simulator

- **Representation:** a `State` is `{ n, amps: Complex[] }`, with qubit 0 as the most significant bit. For two qubits that is `[α00, α01, α10, α11]` = `|q0 q1⟩`. Alice is q0 and Bob is q1.
- **Gates:** single-qubit gates act on the pairs of indices that differ in the target bit. CNOT swaps the amplitudes where the control is 1.
- **Measurement:**
  - X-basis questions rotate with H, measure in Z, collapse, and rotate back.
  - `measureAll` samples one basis state.
  - Probabilities are exact |α|².
- **Bell decoding:** CNOT(q0→q1), then H(q0), then `measureAll`. The tests check it against direct projection onto the Bell basis.
- **Noise and spy:**
  - Zones apply the real Pauli to the qubit actually on the channel: q1 during a SHARE, q0 during a SEND, the lone qubit during BIT BY BIT.
  - The spy performs a real projective measurement in a random basis.
- **Randomness:** separate seeded streams for message content, noise and measurement. Message content therefore never depends on what the player does, and the daily seed is fair.

## The mission engine in one paragraph

- `tick(dt)` advances time. Messages spawn from a wave plan, with content drawn at arrival. Fuses burn until the message *reaches Bob*.
- The single flight moves along the channel, and zones and the spy act on it.
- Arrivals bank a pair (SHARE), decode a message by Bell measurement (SEND), or read a lone bit (BIT BY BIT).
- `press(action)` either acts immediately or arms the action to fire the moment the channel opens.
- Every outcome produces events that the UI turns into sound, captions, log entries and diagnoses.

## Robustness

- **Storage:** every access is wrapped. The game runs with storage blocked (tested), and corrupt saves are sanitised (tested).
- **Audio:** created on the first gesture. If blocked or unsupported, it's silent and everything still works.
- **Errors:**
  - A screen that throws is replaced by a recovery panel with a way back.
  - A rendering error in one canvas frame is caught and logged, and the next frame draws.
- **Input:**
  - Repeated keys are ignored in missions.
  - Every action validates state and shakes, with a reason, when refused.
  - Locked levels redirect to the furthest unlocked one.
- **Pausing:** missions pause when the tab is hidden. Esc pauses. Restart is always available.
- **Old browsers:** a canvas `roundRect` fallback covers older Safari and Firefox.

## Performance (measured, production build, headless Chrome)

| Metric | Value |
|---|---|
| Load event (local) | ~150 ms |
| Transferred on first load | ~120 KB uncompressed (fonts load on demand) |
| Frame rate in the busiest mission (6 banked pairs, zones, spy, flight) | 60 fps |
| JS heap during a mission | ~1.5–2.5 MB (varies with GC timing) |

The DOM updates only when values change (queue, readout, prompt, forecast at 10 Hz). The canvas redraws every frame.

## Deploy

```bash
npm install
npm run build    # tsc --noEmit && vite build → dist/
```

Upload `dist/` anywhere static. The GitHub Pages workflow (`.github/workflows/deploy.yml`), `netlify.toml` and `vercel.json` are included.
