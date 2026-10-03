# THE OTHER HALF: two bits · one qubit

**quriosity 2026 · Option 05: Superdense Coding**

> *Send two bits by posting a single qubit. The secret ingredient is a friend you entangled with earlier.*

A browser game about superdense coding. You keep Alice and Bob talking through a channel that fits **one qubit at a time**. While it's quiet, you share halves of entangled pairs with Bob. When messages arrive, you shape the link between your half and his, and send **one** qubit. Bob's analyzer reads **two** bits.

**Play:** open the hosted link, or run it locally (below). No install, no account, no backend.

---

## What we learned in the first three hours, and how it became the game

We kept a "wait, what?" log while working through the physics. Every mechanic in the game came from one of those entries.

**1. "Two bits in one qubit? Isn't that exactly what Holevo's theorem forbids?"**
It is, for a lone qubit. Read on its own, one qubit yields at most one classical bit. We checked the edge case by hand: put a lone qubit in ▲ and apply a PHASE (Z), and *nothing measurable changes*. Z|0⟩ = |0⟩. One of the two moves simply vanishes.
→ **Level 5 opens with this wall.** You try to send `11` on a lone qubit. Bob receives `?1`. Only then does the game hand you the pair.

**2. "So where do the two bits live?"**
Not in either qubit. We computed the reduced state of the travelling qubit for all four messages, and it is I/2 every time: pure noise. The information is in the *relationship*. A Bell pair is a joint eigenstate of two commuting questions, Z⊗Z ("do the halves agree on ▲▼?") and X⊗X ("do they agree on ◀ ▶?"). Two ±1 answers make two bits, and neither half holds them.
→ **The link between the halves is the game's main object.** Its two strands are either parallel or **crossed** (Z⊗Z) and either in step or **offbeat** (X⊗X). TWIN, CROSS, OFFBEAT and ANTI are the four Bell states, readable by shape alone.

**3. "Alice touches only her qubit. How does that change something shared?"**
X on her half flips exactly one agreement, and Z flips the other. Bob's half, on its own, stays exactly 50/50, so nothing is signalled until her qubit physically arrives.
→ **Level 3:** FLIP crosses the link, PHASE makes it zigzag. Then you let Bob check his half alone. It's still a coin flip: *"He can't see your move."*

**4. "Why can't Bob just measure both qubits?"**
We tried it on paper. Measuring each qubit in ▲▼ gives the ▲▼ agreement, and leaves ⟨X⊗X⟩ = 0. The second bit is destroyed. You have to ask the *pair* (CNOT, then H, then measure).
→ **Level 4 is a designed failure.** As Bob, you try reading the halves and get one bit plus a coin flip. Then the analyzer arrives and reads both, every time.

**5. "If two qubits travel in total anyway, what's the point?"**
This was our biggest confusion, and the answer became the game. The second qubit, Bob's half, can travel **before the message exists**, when the channel would otherwise be idle. Pre-shared *classical* randomness can't do that. Pre-shared *entanglement* can.
→ **Missions are a channel economy.** Bank pairs in the quiet, and every qubit in the rush carries two bits. **Classical mode** removes entanglement from the very same rush, and you lose it.

**6. "What does noise do to this?"**
A stray Pauli is just a move nobody chose. A FLIP error garbles exactly the second bit; a PHASE error, the first. A *known* twist can be cancelled in advance (X·X = I). A random one can't.
→ **Level 8's zones, Level 10's static.** Level 9's spy shows the flip side: it learns 0 bits from a paired qubit, but its look breaks the pair.

The one sentence we wanted every player to be able to say afterwards:
*"I didn't put two bits in one qubit. Bob already had the other half. One qubit plus the half he got earlier carried two bits."*

---

## How to play

| | |
|---|---|
| **Goal** | Get each two-bit message to Bob, correctly, before its fuse burns out. |
| **SHARE** `S` | Send Bob his half of a fresh pair. Carries no message. Do it while it's quiet. |
| **FLIP** `F` / **PHASE** `P` | Act on *your* half only. FLIP crosses the link (2nd bit). PHASE makes it zigzag (1st bit). |
| **SEND** `Space` | When the link matches the message card, send your half: one qubit crosses. |
| **BIT BY BIT** `B` | No pair? Send two lone qubits, one bit each. Slow. |
| Bench levels | `Q`/`W` ask ▲▼ / ◀ ▶ · `O`/`L` Bob asks · `A` analyzer · `N` new pair |
| Anywhere | `V` GAME ↔ CIRCUIT names · `M` sound · `Esc` back/pause |

Tip: press SEND or SHARE *while the channel is charging*. The press is remembered and fires the moment it opens.

**Levels:**

| # | Level | What it teaches |
|---|---|---|
| 1 | PAIR | Random answers that always agree |
| 2 | THE LINK | Two agreements, no predictable individual answers |
| 3 | FOUR MOVES | Local operations change the joint state; no signalling |
| 4 | THE DECODER | Bell measurement vs reading the halves |
| 5 | **ONE QUBIT** | The signature moment: one qubit, two bits |
| 6 | DEAD DROP | Fluency |
| 7 | RUSH HOUR | Entanglement as a resource banked in advance |
| 8 | STATIC | Channel noise as Pauli errors |
| 9 | WIRETAP | An eavesdropper learns nothing and disturbs the pair |
| 10 | LAST LIGHT | Everything at once |
| ∞ | Arcade | Endless, daily seed, plus a **classical** mode to compare |

**Judging in a hurry?** The title screen links straight to **Level 5** (about 2 minutes), and *Settings → Unlock all levels* opens everything.

## The physics, briefly

- **Convention:** `|q0 q1⟩`, where q0 = Alice (her qubit travels) and q1 = Bob (shared earlier). Gates are listed in time order.
- **Pair:** H(q0), then CNOT(q0→q1), gives Φ⁺ = (|00⟩+|11⟩)/√2.
- **Encode:** 00 → I → Φ⁺ · 01 → X → Ψ⁺ · 10 → Z → Φ⁻ · 11 → X then Z (= Z·X = iY) → Ψ⁻. Z then X gives −Ψ⁻, a global phase with the same decode.
- **Decode:** CNOT(q0→q1), H(q0), measure → b1 b2. b1 = the X⊗X agreement (PHASE bit), b2 = the Z⊗Z agreement (FLIP bit).
- **What the game never claims:**
  - that a qubit stores two bits (it can't: Holevo);
  - that entanglement sends anything by itself (no signalling);
  - that anything travels faster than light (the qubit must physically cross).
- **What it does claim:** shared entanglement + a local operation + one transmitted qubit + a joint measurement = two classical bits.

The **Quantum Lab** (title screen) shows all of this live: amplitudes, kets, Bell decomposition, ⟨Z⊗Z⟩, ⟨X⊗X⟩, both reduced density matrices, the decoding circuit step by step, and the Pauli matrices. It's optional. The game never requires it.

## Technology

- TypeScript + Vite. No UI framework.
- Canvas 2D for the stage, DOM for everything else, Web Audio synthesis for sound.
- About 44 KB of gzipped JavaScript. Self-hosted fonts.
- Our own dependency-free state-vector simulator in `src/quantum/` (complex amplitudes, gates, Born-rule measurement with collapse, partial trace).

```
src/quantum/  the physics (pure, fully unit-tested)
src/game/     game rules on real state vectors: mission engine, bench levels, scoring, saves, bots
src/ui/       router, canvas scene, screens
src/audio/    synthesised sound
tests/        quantum · game · integration
scripts/      e2e (Chrome), smoke-firefox, perf, smoke-routes
submission/   competition write-ups and screenshots
```

## Develop, test, build

Requires Node 20+ (CI uses Node 24).

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 113 unit + integration tests
npm run build        # type-check + production build → dist/
npm run e2e          # keyboard playthrough of all 10 levels in Chrome (+ screenshots)
TMPDIR=~/snap/firefox/common/tmp npm run smoke:firefox   # Firefox smoke test (snap Firefox needs TMPDIR)
npm run preview      # serve dist/ locally
```

## Deploy

`dist/` is a static site that works from any sub-path (`base: './'`).

- **GitHub Pages:** push to `main`. `.github/workflows/deploy.yml` tests, builds and publishes. Enable *Settings → Pages → Source: GitHub Actions*.
- **Netlify / Vercel:** import the repo. `netlify.toml` and `vercel.json` are included.
- **Anywhere else:** upload the contents of `dist/`. You can even open it from a USB stick with any static server.

## Credits & licence

Made for quriosity 2026 (ISAQC, IIIT Hyderabad). MIT licence. Fonts: Space Grotesk, Inter and JetBrains Mono (SIL OFL, via Fontsource).
Superdense coding: C. H. Bennett & S. J. Wiesner, *Phys. Rev. Lett.* 69, 2881 (1992). Holevo bound: A. S. Holevo (1973).
# Superdense-Coding
# Superdense-Coding
