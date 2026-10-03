# Game Description

## The pitch

**THE OTHER HALF: two bits · one qubit.** Keep Alice and Bob talking through a channel that fits one qubit at a time. Share pair halves while it's quiet, then shape the link between you, and every qubit you send carries two bits.

## The fantasy

You're the operator who beats the bandwidth limit with *preparation*, not speed. A classical operator needs two channel uses per two-bit message. You quietly stock entangled pairs in the lulls, and when the rush hits, each window carries a whole message.

## What you see

- **Alice (you)** on the left in coral. **Bob** on the right in cyan.
- **The channel lane** along the bottom. It carries one qubit at a time, then recharges.
- **The ladder.** Every pair you've banked is a rung spanning the gap between Alice and Bob. The bottom rung is the next to be used.
- **The link** on each rung has two strands.
  - Parallel strands mean the halves agree on ▲▼. **Crossed** strands mean they disagree. FLIP does this.
  - Rungs in step mean they agree on ◀ ▶. **Zigzag (offbeat)** means they disagree. PHASE does this.
  - These four shapes are the four Bell states. The game calls them TWIN, CROSS, OFFBEAT and ANTI, and shows Φ⁺, Ψ⁺, Φ⁻ and Ψ⁻ in CIRCUIT view.
- **Message cards** show two bits and the link shape that carries them, with a fuse.
- **Bob's analyzer** docks the arriving half with his own and reads two lamps: UNTANGLE (CNOT), TURN (H), READ.

## The loop

1. **SHARE** in the quiet. One qubit crosses, carrying nothing.
2. A **message arrives**. Its content is decided only now.
3. **Shape** the link with FLIP / PHASE on your half until it matches the card.
4. **SEND.** Exactly one qubit crosses.
5. Bob's **analyzer** reads two bits, giving a ✓, or a ✗ with a diagnosis.
6. **Decide:** bank more pairs or spend one? Wait out a noise zone or cancel its twist? Risk the spy's open eye?

## Structure

- **Levels 1–5 (hands-on, about 6 minutes)** build the model one rule at a time:
  - correlation (PAIR)
  - two agreements (THE LINK)
  - local moves (FOUR MOVES)
  - the Bell analyzer (THE DECODER)
  - the signature payoff (ONE QUBIT)
- **Levels 6–10 (missions, about 1 minute each)** put it under pressure: fluency, rushes, noise zones, an eavesdropper, and a finale.
- **Arcade:** endless, escalating, with a daily seed. **Classical mode** removes entanglement so you can feel the difference.
- **Quantum Lab** (optional): amplitudes, kets, Bell decomposition, reduced states, the decoding circuit step by step.

## The signature moment (Level 5)

> Message for Bob: **11**. Bob has nothing from you. Send it in ONE qubit.

1. You FLIP and PHASE a lone qubit and send it. PHASE did nothing visible: a lone ▲ has no phase to show.
2. Bob reads **`?1`**. One qubit, one bit.
3. *Rewind to this morning.* You SHARE a pair, with no message on it. The message 11 arrives. You FLIP + PHASE your half: the link turns ANTI. You SEND.
4. Bob's analyzer untangles, turns and reads **11**:

> **ONLY ONE QUBIT CROSSED THE CHANNEL**
> *Bob read 11: two bits. His half crossed before the message existed.*

The ledger beside it keeps the accounting honest:
- halves shared ahead (no message on them): 1
- qubits sent with a message: 1
- bits decoded: 2

The spy readout shows that the qubit alone would have read 50/50 for any message.

## Platforms

Any modern browser on desktop, laptop, tablet or phone. Keyboard, mouse or touch. No install, no account, no backend.
