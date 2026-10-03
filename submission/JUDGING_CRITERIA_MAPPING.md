# Judging Criteria Mapping

The official site lists five things the guidelines reward, plus seven ground rules and one requirement ("a meaningful link between its gameplay and its chosen option"). Each row is: **criterion → game feature → why it satisfies the criterion → evidence you can check.**

## The five rewarded qualities

### 1. "The physics is accurate and easy to follow"

| Feature | Why | Evidence |
|---|---|---|
| A real state-vector simulator (`src/quantum/`) runs every pair, move, measurement, zone and spy | Results are computed, never scripted | `src/game/mission.ts` calls `encode`, `applyGate`, `measureQubit` and `bellMeasure`; 113 automated tests |
| A consistent convention: `\|q0 q1⟩`, q0 = Alice, gates in time order | Experts can audit every mapping | `QUANTUM_CONCEPT.md`; the Lab's reference table |
| The four Bell states drawn as two independent shapes (crossed = Z⊗Z = −1, offbeat = X⊗X = −1) | Each visual feature is exactly one stabiliser sign, so reading the link is reading the state | `tests/quantum/superdense.test.ts` "carry the agreement signs the game shows" |
| Honest accounting: the ledger counts the pre-shared half | The game never claims free bandwidth or that a qubit stores two bits | L5 ledger; mission end card |
| No signalling shown, not just stated | Bob's half stays 50/50 after any move, and the player checks it | L3 "Bob checks his half"; test "no signalling" |
| Formal names revealed only after the discovery | Easy to follow first, precise second | Clear cards ("In physics: …"); CIRCUIT view (`V`) |

### 2. "The core mechanic comes straight from the quantum idea"

| Feature | Why | Evidence |
|---|---|---|
| The central decision is *bank a pair now (no message) vs spend one (two bits)* | That is literally superdense coding's advantage: entanglement distributed before the message exists | L7 RUSH HOUR |
| Encoding = shaping the link with X/Z on your half only | The local-Pauli step *is* the input | Levels 3, 5–10 |
| Decoding = a joint (Bell) measurement that beats reading the halves | Teaches why the joint measurement is needed | L4's designed failure |
| **Remove the quantum and the game breaks** | Classical mode (no pairs) loses the same seeded rush | Clear-card button on L7; arcade classical; test "RUSH HOUR cannot be survived without entanglement" |

### 3. "A beginner can pick it up and understand it"

| Feature | Why | Evidence |
|---|---|---|
| No tutorial screens; one new rule per level; Levels 1–3 can't be failed | Learn by doing, low stress | Level table in `GAME_DESCRIPTION.md` and `GAMEPLAY_GUIDE.md` |
| Plain names first (TWIN/CROSS/OFFBEAT/ANTI, FLIP/PHASE, "▲▼ = up or down?") | No Dirac notation needed to play | Level 1 first line |
| Message cards show the pattern they need | No codebook to memorise | Every mission |
| Failure explains itself ("Link was CROSS, message needed ANTI: add PHASE") | Teaching through failure | Mission diagnoses |
| "What you know" panel | The player's own summary, one rule per level | Levels map |
| Keyboard, touch, captions, reduced motion, colour-independent shapes | Accessible to more beginners | `TESTING.md` accessibility section |

### 4. "The idea is genuinely your own"

| Feature | Why | Evidence |
|---|---|---|
| Stockpile-before-the-message channel economy | Not found in the ~45-game survey | `ORIGINALITY.md` |
| Two-strand link language for Bell states | Not a lookup table, not a Bloch sphere | Screenshots 06, 07, 21 |
| Ceiling-then-payoff (`?1` then 11 from one qubit) | Struggle → build, per rule 05 | Screenshots 11, 14 |
| In-game classical switch | The remove-the-quantum test, playable | Screenshot 22 |

### 5. "It is easy to get running, hosted or as a direct executable"

| Feature | Why | Evidence |
|---|---|---|
| A static web build: open a URL and play | No install, account, backend, API key or quantum hardware | `dist/`; deploy configs for Pages, Netlify and Vercel |
| Runs on desktop and mobile; Chrome and Firefox tested | Judges can use any device | e2e mobile checks; Firefox smoke test |
| Robust to blocked storage or blocked audio | Works in locked-down browsers | e2e "game runs with storage blocked" |

## The seven ground rules

| Rule | How we meet it |
|---|---|
| 01 Learn by playing | Every rule is discovered by an action (ask, move, check, decode, bank) before any text names it |
| 02 Topic first | 2D canvas, no 3D, no shaders; every visual encodes a physical quantity |
| 03 Build around the idea | Classical mode proves the game fails without entanglement |
| 04 Welcome beginners | High-school level; formal maths only in the optional Lab and CIRCUIT view |
| 05 Learn → Struggle → Build | L4 (read the halves → fail → analyzer) and L5 (lone qubit → `?1` → pair → 11) are designed struggles |
| 06 Original only | See `ORIGINALITY.md` |
| 07 Easy to run | Static site; one URL |

## "A meaningful link between gameplay and the chosen option"

Every verb maps onto the protocol:

- SHARE = entanglement distribution
- FLIP / PHASE = local Paulis
- SEND = one quantum channel use
- ANALYZER = Bell measurement
- BIT BY BIT = the Holevo-limited classical alternative

The official mechanism text ("share a Bell pair · apply I, X, Z, XZ · send · decode 00, 01, 10, 11") is the game's core loop, step for step.
