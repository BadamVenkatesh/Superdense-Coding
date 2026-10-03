# Originality

## What exists

From our survey of about 45 quantum games (itch.io jam archives, Steam titles and published quantum-game papers):

- **Superdense coding in games** appears as one puzzle level in *The Qubit Factory* (route a Bell pair, apply I/X/Z/XZ). Teleportation and card games use I/X/Z/ZX lookup charts.
- Common nearby patterns: "entangled switches" that move together (physically misleading), BB84 "catch the eavesdropper" games, gate-placement circuit puzzles, Bloch-sphere toys.
- The obvious version of this option is "pick I/X/Z/XZ from a table": a lookup, not a mechanic.

## What's new here

We claim nothing is unique. None of the following appeared in the survey.

1. **A channel economy built from the protocol's actual advantage.** The player banks entangled halves *before* the messages exist and spends them in rushes. That is the real reason superdense coding matters: entanglement moves channel use to a quieter time. The Holevo-limited alternative (BIT BY BIT) is always available, and always too slow.
2. **A visual language where each Bell state is two independent shapes.** Crossed vs parallel strands is the Z⊗Z sign. Rungs in step vs offbeat zigzag is the X⊗X sign. FLIP and PHASE each change exactly one shape, so the player reads Bell states by sight and never memorises a table.
3. **A designed decoder failure.** Level 4 lets Bob try to read the halves individually, and labels the second comparison "meaningless: the first question already broke the link". Only then does the Bell analyzer arrive.
4. **The ceiling-then-payoff sequence.** Level 5 makes the player hit the Holevo wall with the same message (11 → `?1`) before delivering it with a pre-shared half. The struggle is what makes "ONLY ONE QUBIT CROSSED THE CHANNEL" land.
5. **An in-game remove-the-quantum switch.** Classical mode replays the same seeded rush without entanglement and loses it. The judges can run the rule-03 test themselves.
6. **Noise as named moves, with counterplay.** A known FLIP/PHASE zone can be cancelled by the player's own move (X·X = I), including twists that hit *Bob's* half on its way to the rack. Random static can only be avoided.
7. **A spy that learns nothing but still matters.** Its notebook shows readings uncorrelated with the messages, while Bob's error rate shows the disturbance.

## Why it isn't a reskin

Remove entanglement and the game's central decision ("bank now, spend later") disappears. Without pairs, every message costs two channel uses at the moment it's needed, and the rush can't be won. The game proves this in classical mode.
