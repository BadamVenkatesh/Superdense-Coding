# Quantum Concept: Superdense Coding

## The problem

Holevo's theorem: a single qubit, sent and measured on its own, delivers **at most one** classical bit. Superdense coding (Bennett & Wiesner, 1992) delivers **two** classical bits by sending one qubit. The condition is that sender and receiver already share an entangled pair.

## Convention used in the code, the game and these documents

- States are written `|q0 q1⟩`. **q0 = Alice** (sender; this qubit travels). **q1 = Bob** (receiver; he received it earlier).
- Vector order is `[α00, α01, α10, α11]`, with index = 2·q0 + q1.
- Gate sequences are listed **in time order** (circuit order). "X then Z" is the matrix Z·X.

## Step by step

**1. Make and share the pair.** H on q0, then CNOT(q0→q1):
```
|00⟩ → (|0⟩+|1⟩)|0⟩/√2 → |Φ⁺⟩ = (|00⟩ + |11⟩)/√2        amplitudes [0.7071, 0, 0, 0.7071]
```
Bob receives q1 *before any message exists*.

**2. Encode with a local Pauli on q0.**

| Message | Alice (time order) | Operator | Result | ⟨Z⊗Z⟩ | ⟨X⊗X⟩ | Game name |
|---|---|---|---|---|---|---|
| 00 | — | I | Φ⁺ = (\|00⟩+\|11⟩)/√2 | +1 | +1 | TWIN |
| 01 | X | X | Ψ⁺ = (\|01⟩+\|10⟩)/√2 | −1 | +1 | CROSS |
| 10 | Z | Z | Φ⁻ = (\|00⟩−\|11⟩)/√2 | +1 | −1 | OFFBEAT |
| 11 | X then Z | Z·X = iY | Ψ⁻ = (\|01⟩−\|10⟩)/√2 | −1 | −1 | ANTI |

"Z then X" (the matrix X·Z) gives −Ψ⁻. That is the same physical state, because the global phase is unobservable, and it decodes the same way. The game applies the real gates in whatever order the player taps them.

**3. Send q0.** That is one use of the quantum channel.

**4. Bell measurement.** CNOT(q0→q1), then H(q0), then measure both in the computational basis:

| In | after CNOT | after H(q0) | Read |
|---|---|---|---|
| Φ⁺ | \|+⟩\|0⟩ | \|00⟩ | 00 |
| Ψ⁺ | \|+⟩\|1⟩ | \|01⟩ | 01 |
| Φ⁻ | \|−⟩\|0⟩ | \|10⟩ | 10 |
| Ψ⁻ | \|−⟩\|1⟩ | \|11⟩ | 11 |

The first bit read is the X⊗X agreement (Alice's PHASE). The second is the Z⊗Z agreement (Alice's FLIP).

## Why "two agreements" is not a metaphor

The four Bell states are the joint eigenstates of the **commuting** observables Z⊗Z and X⊗X. A pair can have definite values for both at once, even though neither half has a definite value of its own. The two ±1 eigenvalues are the two bits.

- Alice's X on q0 anticommutes with Z⊗Z and commutes with X⊗X, so it toggles exactly one agreement.
- Z does the reverse.

The game draws exactly these two features: **crossed strands** for Z⊗Z = −1, and **offbeat zigzag rungs** for X⊗X = −1.

## Facts the game relies on (all verified by automated tests)

| Fact | Check | Where the player meets it |
|---|---|---|
| The travelling qubit alone is pure noise for **every** message | ρ_A = I/2 for all four encodings | L5 spy readout; L9 spy notebook |
| No signalling | ρ_B is unchanged by any operation on q0 | L3: "Bob checks his half alone": still 50/50 |
| Measuring the halves one by one loses a bit | after Z on both qubits, ⟨X⊗X⟩ = 0 | L4: the designed decoder failure |
| A lone qubit carries at most one bit | Z\|0⟩ = \|0⟩; on a ▲/▼ start only the FLIP bit is readable | L5 part A: Bob gets `?1` |
| Noise is a Pauli the player didn't choose | X error flips bit 2; Z error flips bit 1 | L8 zones, with a diagnosis per error |
| A known twist can be undone | X·X = Z·Z = I; X on Bob's half ≡ X on Alice's for Φ⁺ | L8: pre-cancel a zone; fix twisted banked pairs |
| A measuring spy learns nothing and disturbs | spy readings are 50/50 for any message; one bit garbles about 50% of the time | L9 |
| Classical: 1 bit per channel use | each lone qubit \|b⟩ is read in Z | BIT BY BIT; Classical mode |

## Honest accounting

**Two qubits travel from Alice to Bob in total.** Superdense coding does not create free bandwidth. It lets one of the two qubits travel **before the message exists**, when the channel would otherwise sit idle. Pre-shared *classical* randomness can't do that: it doesn't raise the classical capacity of the channel. Pre-shared *entanglement* doubles it to two bits per use. Every mission's ledger counts both kinds of crossing.

## What the game never says

- That a qubit "contains" two bits.
- That entanglement sends information by itself, or anything faster than light. Bob learns nothing until Alice's qubit physically arrives.
- That noise is "quantum randomness breaking things". Every error is a named Pauli with a predictable effect.

## Simplifications we chose, and why they're safe

- **"▲▼ / ◀ ▶ questions"** stand for Z- and X-basis measurements.
- **"Agree / opposite"** stand for the ±1 eigenvalues of Z⊗Z and X⊗X.
- **Storage is ideal**: banked halves don't decohere. This keeps the focus on the protocol. The Lab says so.
- **God's-eye link view.** The link shows the pattern Alice *knows* (she knows her moves and the visible zones). Anything unknowable, like random static or a spy's look, is drawn as "?" so the display never leaks information that wouldn't be available.

## References

- C. H. Bennett, S. J. Wiesner, "Communication via one- and two-particle operators on Einstein-Podolsky-Rosen states", *Phys. Rev. Lett.* 69, 2881 (1992).
- A. S. Holevo, "Bounds for the quantity of information transmitted by a quantum communication channel", *Probl. Inf. Transm.* 9, 177 (1973).
- M. A. Nielsen, I. L. Chuang, *Quantum Computation and Quantum Information*, §2.3.
