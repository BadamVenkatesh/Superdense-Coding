# Gameplay Guide

## Controls

| Key | Action |
|---|---|
| `Space` / `Enter` | Main action: start, SEND, next |
| `F` | FLIP your half (X): crosses the link's strands, toggles the 2nd bit |
| `P` | PHASE your half (Z): makes the link zigzag (offbeat), toggles the 1st bit |
| `S` | SHARE: send Bob his half of a new pair (no message on it) |
| `B` | BIT BY BIT: send the message as two lone qubits (one bit each) |
| `Q` / `W` | Ask ▲▼ / ask ◀ ▶ (bench levels) |
| `O` / `L` | Bob asks his half ▲▼ / ◀ ▶ (levels 2–3) |
| `A` | Bob's analyzer (level 4) |
| `0` `1` | Type a two-bit answer (level 4) |
| `N` | New pair (bench levels) |
| `V` | GAME ↔ CIRCUIT names |
| `M` | Sound on/off (Settings has separate Music and Volume controls) |
| `Esc` | Back / pause |

Everything is also clickable and touch-friendly.

## Reading the link

| Card | Link | Means |
|---|---|---|
| **00 TWIN** | parallel, rungs in step | same ▲▼ answers, same ◀ ▶ answers |
| **01 CROSS** | crossed, rungs in step | opposite ▲▼, same ◀ ▶ |
| **10 OFFBEAT** | parallel, zigzag | same ▲▼, opposite ◀ ▶ |
| **11 ANTI** | crossed, zigzag | opposite on both |

To send a message, make the link look like the card, then SEND.

## Levels

1. **PAIR.** Ask both halves ▲▼ (Q) three times, then ◀ ▶ (W) three times. A fresh pair crosses to Bob automatically after each ask.
2. **THE LINK.** Use Q/W for your half and O/L for Bob's. Fill all four grid cells.
3. **FOUR MOVES.**
   - FLIP (F), then ask ▲▼ (Q): opposite.
   - PHASE (P), then ask ◀ ▶ (W): opposite.
   - Both, then ask either.
   - Finally, make a move and let Bob check his half (O).
4. **THE DECODER.** You're Bob.
   - Try asking the halves, then pick a card.
   - After a miss, the analyzer unlocks: press A *before* asking anything, then Enter to pick the card it lit.
   - Three analyzer decodes clear the level.
5. **ONE QUBIT.**
   - Try to send 11 on a lone qubit (Space). Bob gets `?1`.
   - Enter, then SHARE (S). Wait for the message. Shape the link and send.
   - Repeat for all four messages.
6. **DEAD DROP.** Four pairs are already in Bob's rack. Shape and SEND each message. SHARE when the rack runs low. No timer.
7. **RUSH HOUR.**
   - The forecast strip shows when messages arrive.
   - SHARE in every quiet moment until the rack is full.
   - In the rush, shape and SEND. Press early: the press fires when the channel opens.
   - After clearing it, try "this rush with NO entanglement".
8. **STATIC.**
   - A lit FLIP zone flips whatever crosses it, and a PHASE zone phases it.
   - Either wait for the zone to fade, or add the same move before sending to cancel it. The readout warns you and shows ✓ when cancelled.
   - Shares that cross a zone arrive twisted (⚡): the link shows it, so fix it when you use that pair.
9. **WIRETAP.**
   - Don't send while the spy's eye is open. Its notebook shows what it read: noise.
   - BIT BY BIT qubits *can* be read by the spy.
10. **LAST LIGHT.** Everything, plus grey random static that can't be cancelled, only avoided.

**Arcade:** endless and escalating, with a daily seed. Play it again in classical mode to see the gap.

## Scoring

- Correct pair delivery: 100. Correct bit-by-bit delivery: 40.
- Speed bonus: up to +50. Streak multiplier: up to ×2.
- Hearts left at the end: +150 each.
- Wrong or expired messages cost a heart.
- ★★★ = no slips, ★★ = one slip, ★ = cleared.

## Listening

Every important event has a sound, and the music tells you how busy the channel is:
- A new message plays a short chord. When Bob decodes it correctly, the **same chord** comes back.
- The music gets busier when messages are waiting and fuses are running down.
- A double tick means a fuse is about to expire.

Turn on *Settings → Sound captions* to see every cue written on screen.

## Tips

- The quiet is when you win the rush.
- Don't memorise: the card shows the pattern it needs.
- A move made twice cancels itself.
- If a message arrives and Bob's rack is empty, BIT BY BIT is your fallback. It takes two channel uses.
