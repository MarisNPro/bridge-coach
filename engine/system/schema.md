# System-as-data — schema and design notes

This is the keystone of the engine: one bidding system encoded as data, read by
three consumers without any of them re-implementing bridge logic. `natural-v1.yaml`
is the first instance; this document defines its shape.

## Why data, not code

The bot, the conformance check, and the comprehension questions must agree on what
every call means. If that knowledge lives in code, it drifts and gets duplicated.
Encoding it once as data means a single source of truth, a coach can retune it via
`toggles`, and a second system (Precision) drops into the same shape later.

## Top level

```
id            stable identifier (e.g. natural-v1)
name          display name
hcp_scale     point values (A=4 K=3 Q=2 J=1)
toggles       coach-amendable knobs the rules read
situations[]  bidding situations, each a priority-ordered rule list
```

## A situation

```
id            identifier (opening, resp-1nt, ...)
description    human note
when          context this situation applies to: { seat, auction }
              auction is the partnership's calls so far; opponents pass
              (uncontested MVP), so the context is fully determined by it.
rules[]       tried IN ORDER; FIRST MATCH WINS
```

Order is load-bearing. It encodes priority (check 2C before 1NT) and tie-breaks
(list 1S before 1H so 5-5 majors opens the higher). Reordering rules changes the
system, so treat the order as part of the data.

### Contested auctions

Opponents' calls in `when.auction` are written in **(parentheses)**:
`["1C", "(1S)"]` is "we opened 1C, RHO overcalled 1S". `X` is a double, `XX` a
redouble. The bot still evaluates against the hand to bid; the parentheses just
record whose call each was, so the right situation is selected. Competitive
situations bake the opponents' actual suit into ordinary `length` / `stopper_in`
conditions (one situation per opponent opening), which keeps the evaluator free
of any "their suit" machinery.

## A rule

```
id            identifier
conditions    THE EXECUTABLE PART — predicates the bot evaluates
call          the bid this rule produces
meaning       plain-language description (questions narrate this)
promised      what partner may INFER from the call (see below)
```

### conditions — the only executable block

| predicate          | form                                   | meaning |
|--------------------|----------------------------------------|---------|
| `hcp`              | `{min, max}` (either optional)         | high-card-point range |
| `balanced`         | `true` / `false`                       | shape in {4333, 4432, 5332} |
| `length`           | `{ suit: {min, max} }`                 | absolute suit lengths |
| `compare`          | `[ {left, op: ge\|gt, right} ]`        | pairwise length comparison between two suits |
| `four_card_major`  | `true` / `false`                       | has (or lacks) a 4-card major: spades ≥ 4 or hearts ≥ 4 |
| `top3_honors`      | `{suit, min}`                          | count of {A,K,Q} held in a suit ≥ min (suit quality) |
| `stopper_in`       | `<suit>`                               | a stopper in the suit: A, or Kx, or Qxx, or Jxxx |

All listed predicates are ANDed. An absent predicate means "don't care". This small
set covers natural openings and the response samples; add predicates here (and in the
evaluator) only when a real rule needs them, never speculatively.

### conditions vs promised — the important distinction

`conditions` is what makes *this hand* choose *this call* (often narrower than the
call's general meaning). `promised` is what *partner* can infer when they hear the
call — usually broader, because partner doesn't see your exact shape.

Example: a hand opens `1C` only when it has no 5-card major and clubs are the longer
(or 3-3) minor — that's `conditions`. But all partner learns is "12-21, 3+ clubs, no
5-card major" — that's `promised`. The comprehension questions and the counting ladder
grade against `promised`, never against the hidden exact hand. (This is the
"grade against what the bidding promised" rule from the question design.)

`promised` fields (`hcp`, `shape`, `length`, `denies`, `asks`, `artificial`) are
descriptive only — the bot ignores them.

## How each consumer reads the file

- **Bot** — given a hand and the current situation, evaluate rules in order, return the
  first match's `call`. (`evaluate_spike.py` is exactly this.)
- **Conformance** — find the situation, take the student's actual call, check whether the
  hand satisfies the `conditions` of the rule that produces that call. Match = conformant;
  mismatch = flag which rule actually applied.
- **Questions** — to ask "what did partner's 1NT show?", look up the rule whose `call`
  is `1NT` and read `meaning` + `promised`. No bridge reasoning needed at question time.

## Evaluation semantics (precise)

1. Compute hand features once: hcp, per-suit lengths, balanced.
2. Select the situation by `when` (seat + auction).
3. Walk `rules` top to bottom; return the first whose `conditions` all hold.
4. The final rule is a catch-all (e.g. `Pass`) so evaluation always terminates.

## Scope of natural-v1

Covers the **entire handbook** — uncontested sections 2-7 and competitive
sections 8-10. Sections 1 (hand evaluation) and 11 (quick-reference tables) are
reference material, not biddable rules; their content lives in `hcp_scale`, the
`balanced` definition, and the `promised` ranges throughout. 50 situations,
~380 rules.

**Uncontested (sections 2-7)** — openings (2C, 2NT, 1NT, suit openings, 3-level
pre-empts, weak twos, Pass); responses to 1C/1D/1H/1S and the full 1NT structure
(Stayman, transfers, quantitative 4NT, 6NT); responses to 2C and to a weak two;
opener's Stayman answers and transfer acceptances; a minimal Blackwood ace-ask.

**Competitive (sections 8-10):**

- *Exhaustive* — direct action over each 1-level suit opening (`direct-over-1c/
  1d/1h/1s`): simple overcalls, weak jump overcalls, 1NT overcall, Michaels,
  Unusual 2NT, takeout double, Pass. Responses to partner's takeout double over
  each opening (`respond-takeout-over-1x`). DONT defence to their 1NT. Action
  after they double our 1NT. Takeout/3NT over a pre-empt (2H, 3S shown).

- *Responder after a 1-level suit overcall* — the negative-double matrix is now
  complete for every 1-level suit overcall of a minor or major opening:
  `resp-1c-over-1d/1h/1s`, `resp-1d-over-1h/1s`, `resp-1h-over-1s`. The negative
  double shows the unbid major(s); its meaning adapts to the auction (both majors
  over `(1D)`, exactly 4 spades over `(1H)`, 4+ hearts over `(1S)`), alongside cue
  (game-forcing), 1NT/2NT with a stopper, raise, and Pass. Plus one opener rebid
  after interference (`opener-after-1c-1s`) and one advance of partner's overcall.
- *Still to fill (competitive)* — responder after a **2-level** suit overcall
  (e.g. `1H-(2C/2D)`, `1S-(2C/2D/2H)`), and opener's/advancer's later calls across
  the rest of the contested tree.

### Deviations from the handbook (each flagged inline with `[DEV]`)

- Major **limit raise widened to 10-12** (handbook 10-11) so 12-counts with
  support have a home below a game-forcing Jacoby 2NT.
- **2C is HCP ≥ 22 only**; the "9+ playing tricks" alternative isn't modelled.
- **Weak twos require 2 of the top 3 honours** in the suit (handbook "ideally").
- **1-level new-suit responses go strictly up the line.**

### Other simplifications

- A 5-card major is opened even with a longer minor; the strict "longest suit"
  variant is the `major_over_longer_minor` toggle.
- Opening strength is a flat `hcp ≥ 12`; rule-of-20 is a future toggle.
- Blackwood/RKCB, responsive/penalty/support doubles, and SOS redoubles from
  section 9 are represented at the entry level (the ask / the action); their full
  reply ladders are descriptive metadata, not yet separate answering situations.
- Opener's rebid is encoded after a **1-over-1 response** (all six
  `opener-rebid-1c-1d/1c-1h/1c-1s/1d-1h/1d-1s/1h-1s`: raises, 1-level new suits,
  reverses, jump rebids, 1NT/2NT rebids, minimum-rebid catch-all), after a
  **1NT response** (`opener-rebid-1{c,d,h,s}-1nt`: pass/rebid/reverse/jump/2NT),
  the **game-try decision** after a simple major raise
  (`opener-rebid-1h-2h` / `1s-2s`: pass 12-15, invite 16-18, game 19+), and the
  **2/1 (game-forcing) responses** (`opener-rebid-1{h,s}-2{c,d}`, `1s-2h`,
  `1d-2c`: describe shape without jumping — second suit, raise, 6-card rebid,
  2NT). The opener-rebid tree is complete; what remains competitive is the
  responder-after-interference matrix below.
