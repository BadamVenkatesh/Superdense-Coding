# Submission: THE OTHER HALF

| Form field | Value |
|---|---|
| Option | **05 · Superdense Coding** |
| Playable game | *Hosted link: add after deploying* (static site; see `../README.md` → Deploy) |
| Public repository | *Repo link: add after pushing* |
| Gameplay video | *Record from `DEMO_SCRIPT.md`* |
| README write-up | `../README.md` (the section "What we learned in the first three hours…") |
| Anything else for the judges | See `SUBMISSION_CHECKLIST.md` for a suggested note |

## In one paragraph

THE OTHER HALF is a browser game in which you keep Alice and Bob talking through a channel that fits one qubit at a time. In quiet moments you share halves of entangled pairs with Bob. When a message arrives, FLIP and PHASE on your half reshape the link between the two halves, and you send **one** qubit. Bob's Bell analyzer reads **two** bits. The game makes you hit the Holevo wall first (a lone qubit delivers `?1`, not `11`). Then it pays it off: **"ONLY ONE QUBIT CROSSED THE CHANNEL."** It also shows the honest cost: the other half crossed earlier, before the message existed.

## Files

| File | What it covers |
|---|---|
| `GAME_DESCRIPTION.md` | What the game is, its loop, its levels |
| `QUANTUM_CONCEPT.md` | The physics, the convention, verification |
| `EDUCATIONAL_VALUE.md` | What a player learns, where, and how we check it |
| `ORIGINALITY.md` | What's new compared with existing quantum games |
| `GAMEPLAY_GUIDE.md` | Controls, every level, tips |
| `TECHNICAL_OVERVIEW.md` | Architecture, simulator, performance |
| `TESTING.md` | Automated and manual testing, with results |
| `DEMO_SCRIPT.md` | A 90-second and a 3-minute demo, plus a video shot list |
| `JUDGING_CRITERIA_MAPPING.md` | Each official criterion → feature → evidence |
| `SUBMISSION_CHECKLIST.md` | What's done and what humans still need to do |
| `screenshots/` | 33 screenshots captured by the automated playthrough |

## Run it

```bash
npm install && npm run build && npm run preview   # or open the hosted link
```
