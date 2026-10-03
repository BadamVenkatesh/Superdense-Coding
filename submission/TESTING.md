# Testing

All results below were produced in this repository on 3 Oct 2026 (Node 24.21, Google Chrome 154 headless, Firefox 156 via WebDriver BiDi).

## 1. Unit + integration tests (`npm test`)

**113 tests across 6 files, all passing.**

| File | Covers |
|---|---|
| `tests/quantum/engine.test.ts` | Qubit ordering (q0 = MSB); kets; X, Z, H, Y; self-inverse gates; XZ = −ZX; Y = iXZ; CNOT; time-ordered ops; normalisation under gates; Born-rule probabilities; collapse (asking twice repeats the answer); sampled frequencies vs Born (20 000 shots); `measureAll` never returns zero-probability outcomes; Pauli expectations; I/2 reduced states |
| `tests/quantum/superdense.test.ts` | **Bell initialisation** (\|00⟩, \|11⟩ = 1/√2, others 0); Φ⁺ identity; normalisation; ⟨ZZ⟩ = ⟨XX⟩ = +1; Bell states orthonormal; agreement signs match the visual language; **I → Φ⁺, X → Ψ⁺, Z → Φ⁻, X-then-Z → Ψ⁻ exactly, Z-then-X → −Ψ⁻** (same decode); moves self-cancel; FLIP toggles only ZZ, PHASE only XX; X on either half is equivalent; **all four messages decode with certainty**; CNOT+H ≡ Bell projection; after CNOT, Bob holds the FLIP bit and Alice the PHASE bit; 400 full protocol runs; **ρ_A = I/2 for every message**; **no signalling** (ρ_B unchanged); reading the halves destroys ⟨XX⟩; spy statistics (learns nothing, garbles one bit ≈50%); X/Z channel errors flip bit 2/bit 1; **Holevo ceiling** (≤ 2 distinguishable outcomes from a lone qubit) |
| `tests/game/mission.test.ts` | Wave schedules; SHARE banks a Φ⁺; one qubit at a time; recharge; rack capacity; shaped messages always decode; unshaped garbles with an "encode" diagnosis and costs a heart; toggles are real gates; BIT BY BIT uses 2 qubits / 2 windows; expiry; loss at 0 hearts; message content independent of player actions; FLIP zone flips exactly bit 2; PHASE zone can't touch a lone bit; spy learns 0 bits from pairs and some from lone bits; classical mode disables pairs; pre-shared counting; input buffering; late deliveries expire; stars; scoring; **level balance**: perfect *and* practised bots clear every mission with 3★, a late-reacting player clears 6–9, **classical play loses RUSH HOUR, STATIC and LAST LIGHT**, no-banking loses RUSH HOUR and LAST LIGHT; the arcade escalates and ends |
| `tests/game/bench.test.ts` | Φ⁺ start; agreement on the same question (50 pairs); each half 50/50 (2000 samples); asking breaks the link; toggles are gates; no signalling after any move; Level 1/2/3 progress rules; **Level 4: reading the halves ≈ 50% correct over 400 rounds; the analyzer is 100%**; the analyzer refuses an asked pair; **Level 5: the lone qubit never carries the PHASE bit; all four paired messages arrive, the spy sees 50/50; a wrong pattern decodes wrong and a pair shared after the message isn't counted as pre-shared** |
| `tests/game/store.test.ts` | Unlock order; persistence across reloads; never lowers stars or best score; unlock-all; reset keeps settings; corrupt/hostile JSON sanitised; null storage; throwing storage; arcade bests and daily score |
| `tests/integration/pipeline.test.ts` | **For each of 00/01/10/11 through the real mission engine:** SHARE before the message exists → message arrives → local moves on q0 only (the half alone is I/2) → exactly one qubit sent → Bell measurement → same two bits; the pair is counted as pre-shared; BIT BY BIT costs two channel uses |

## 2. End-to-end (`npm run e2e`)

The production build in real Chrome, **played with the keyboard only**. Every section starts from a fresh page load. **Result: 36/36 checks passing.**

| Area | Checks |
|---|---|
| Title → Level 1 | Space starts L1; both halves agree; L1 clears; Enter goes to L2 |
| Level 2 | The grid fills and the level clears |
| Level 3 | FLIP → CROSS; PHASE → OFFBEAT; both → ANTI; Bob's lone check is 50/50; clears |
| Level 4 | ◀ ▶ after ▲▼ is flagged as meaningless; clears via the analyzer |
| Level 5 | A lone qubit delivers `?1`; the first paired message is 11; **the signature banner appears**; clears |
| CIRCUIT view | Formal names (Ψ…) appear |
| Levels 6–10 | Each mission is won by a keyboard bot that reads only on-screen state; L7 pairs were shared before their messages existed; **the same L7 rush is lost in classical mode** (18 lone qubits sent) |
| Robustness | 120 mashed keys mid-mission never break it; Esc pauses; stars survive a reload; the game runs with **localStorage blocked**; no console errors |
| Lab / Arcade | Lab preset 11 shows Ψ⁻ = 0.707\|01⟩ − 0.707\|10⟩; the arcade runs |
| Mobile (390×844, touch) | No horizontal scroll; tapping SHARE banks pairs |
| Input integrity | FLIP/PHASE presses always reshape the link as intended |

It produces the 33 screenshots in `submission/screenshots/`.

## 3. Cross-browser

- **Chrome (desktop + mobile emulation):** the full e2e above.
- **Firefox** (`npm run smoke:firefox`): title, Level 1 agreement, a mission delivering one message, the Lab, no console errors. **PASS.**
- **Safari:** not available in this environment. The game uses only standard APIs (Canvas 2D, Web Audio with a `webkitAudioContext` fallback, ResizeObserver with a resize fallback, a `roundRect` fallback).

## 4. Sound (`npm run audio`)

Real Chrome, reading an analyser on the master output:

| Check | Result |
|---|---|
| The audio context runs after a user gesture | ✓ |
| Title music is audible | RMS ≈ 0.015 |
| Asking a question makes sound (answer + link snap) | RMS ≈ 0.034, so effects sit above the music |
| With music off, an idle stage is silent | RMS 0.0000 |
| Starting a mission plays the go cue | ✓ |
| `M` mutes everything | RMS 0.0000 |

Level 4 deliberately plays only a neutral arrival ping, so Bob can't *hear* which message Alice sent.

## 5. Performance (`npm run perf`)

| Metric | Result |
|---|---|
| Load event (local preview) | ~150 ms |
| JS / CSS | 123 KB / 30 KB (≈44 KB / 6.5 KB gzipped) |
| Frame rate, Level 10 with a full rack | **60 fps** |
| JS heap during a mission | ~1.5–2.5 MB (varies with GC timing) |

## 6. Accessibility checks

- Every action is reachable from the keyboard (the e2e plays all 10 levels without a mouse). Focus rings are visible.
- Bell states are distinguishable without colour: crossed vs parallel strands, rungs vs zigzag, plus SAME/OPPOSITE words in every readout.
- `prefers-reduced-motion` freezes link animation (patterns remain readable) and disables CSS transitions. There's also a manual override.
- The ARIA live region announces asks, link changes, decodes and new messages. Sound captions are optional.
- Touch targets are ≥ 44 px, with responsive layouts at 390 px and 1440 px.

## 7. Manual playtest log (beginner perspective) and fixes

| Observation | Fix |
|---|---|
| L1: "what are ▲▼ and ◀ ▶?" | The first line now says "up or down?" / "left or right?" |
| L2 felt slow between pairs | Shortened the turnaround (1.0 s + 0.7 s share) |
| L2 said "ALWAYS SAME" after two samples | Now "SAME EVERY TIME" (an observation) |
| L3: FLIP's crossing was hard to see because the strand colours swapped end to end | Strands keep one colour; crossing = colours change sides |
| L3: "Bob checks" after a move made twice proved nothing | It now requires a changed link |
| L4: the desk sat in a corner of an empty stage | Centred and enlarged |
| L5: the prompt was stale while the analyzer ran; the banner collided with the stage | Stage-aware prompts; a banner backdrop |
| Missions: reaction time decided the outcome more than understanding did | Press-early buffering |
| Missions: classical play could survive RUSH HOUR | Fuses count until delivery; tests now enforce that classical play loses |
| Which button is which bit? | PHASE/FLIP buttons accent-matched to the card digits they control (yellow/pink), with labels kept |
| Mobile: the channel and READY labels overlapped | Narrow-screen labels |

**Not done:** testing with real first-time players (the biggest remaining risk: difficulty was tuned by bots, not newcomers), and judging the audio's *taste* by ear. Its presence, levels and muting are verified by the meter test above.
