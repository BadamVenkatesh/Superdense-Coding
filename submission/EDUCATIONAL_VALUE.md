# Educational Value

## The one realisation the game is built to create

> "I thought I needed to send two pieces of information. But because Bob and I shared an entangled pair beforehand, I only had to send one qubit, and he recovered both bits."

The player isn't *told* this. They first fail to fit two bits into a lone qubit (Level 5, part A). Then they do it with a pre-shared half (part B). Then they live it under pressure (Levels 6–10), where banking pairs in the quiet is the only way to survive a rush.

## Learn → struggle → build, level by level

| Level | The player does | The struggle (what confuses beginners) | What they build |
|---|---|---|---|
| 1 PAIR | Asks both halves ▲▼, then ◀ ▶ | "Random, but always equal?" | Entanglement = perfect agreement without predictable answers |
| 2 THE LINK | Asks each half its own question; fills a grid | "Different questions give no pattern at all" | The pair holds two agreements; neither half alone is predictable |
| 3 FOUR MOVES | FLIP/PHASE on their half; tests; lets Bob look | **"How can changing only one qubit affect the pair?"** | A local move flips one agreement; Bob's half alone is unchanged |
| 4 THE DECODER | As Bob, reads the halves → wrong; uses the analyzer → right | "Why can't I just measure both?" | Bell measurement reads the joint state; reading the halves destroys one bit |
| 5 ONE QUBIT | Sends 11 on a lone qubit → `?1`; then pre-shares and sends one qubit → 11 | **"How can one qubit carry two bits?"** It can't, alone | The shared pair is the resource; the sent qubit alone holds nothing readable |
| 6 DEAD DROP | Shapes and sends 6 messages from a stocked rack | Mapping fluency | Every banked pair = two bits per channel use |
| 7 RUSH HOUR | Banks in calm, spends in rush (or tries classical mode) | "Why bother pre-sharing?" | Entanglement is distributed before the message exists; that's the advantage |
| 8 STATIC | Waits for, or pre-cancels, FLIP/PHASE zones | "Noise breaks quantum things somehow?" | Noise is a specific Pauli; X garbles bit 2, Z garbles bit 1; known twists can be undone |
| 9 WIRETAP | Times sends around a spy | "Does the spy steal the message?" | The spy learns 0 bits from paired qubits, but measurement breaks the pair |
| 10 LAST LIGHT | Everything | — | The whole protocol, owned |

## The seven questions a beginner should answer after playing

| # | Question | Expected answer | Where it's earned |
|---|---|---|---|
| 1 | What is entanglement? | Two qubits whose answers are each random but always agree (on more than one question) | L1, L2 |
| 2 | What did your operation change? | Not my qubit's own odds, but how the pair agrees (one of two agreements) | L3 (Bob's check stays 50/50) |
| 3 | What are the four Bell states? | The four ways a pair can agree or disagree on ▲▼ and ◀ ▶: TWIN, CROSS, OFFBEAT, ANTI | L3 clear card, every message card |
| 4 | Why did you send only one qubit? | Bob already had the other half; I shared it before the message existed | L5 ledger and banner |
| 5 | How did the receiver decode it? | By asking the pair (CNOT + H + measure), not the halves | L4 |
| 6 | Why was the shared pair necessary? | A lone qubit gives at most one bit (`?1`); classical mode loses the rush | L5 part A, L7 classical |
| 7 | Did the qubit itself contain two bits? | **No.** On its own it reads 50/50 for every message. The protocol uses shared entanglement plus one transmitted qubit to communicate two bits | L5 spy readout, L9 spy notebook |

The map screen's **What you know** panel collects one plain-English rule per cleared level. That's the player's own answer sheet, written by playing.

## Misconceptions the game actively defeats

| Misconception | How the game breaks it |
|---|---|
| "Entanglement = instant messaging" | Bob's half never changes when Alice moves. L3 makes the player check. Every delivery needs a qubit to cross. |
| "The qubit holds the message" | The spy (and the readout) see 50/50 noise for every message. |
| "You can just measure both qubits" | L4's designed failure: one bit plus a coin flip. |
| "Superdense coding gives free bandwidth" | The ledger counts the pre-shared half. Classical vs quantum differ in *when* the channel is used. |
| "Quantum noise is magic randomness" | Each error is a named Pauli with a predictable effect, shown in the diagnosis. |

## Depth for those who want it

- **CIRCUIT view** (press V) renames everything formally: X/Z, Φ⁺/Ψ⁺/Φ⁻/Ψ⁻, CNOT/H/measure, plus a live circuit diagram of the player's own moves.
- **Quantum Lab** shows amplitudes, kets, Bell decomposition, ⟨Z⊗Z⟩, ⟨X⊗X⟩, reduced density matrices and a step-by-step decoder.

## How we checked it

- Automated: bots play every mission to show the intended strategy wins and the wrong one loses. Tests check every physics claim the game makes (`TESTING.md`).
- Manual: a beginner-perspective playthrough with fixes applied (`TESTING.md` → Playtest log).
