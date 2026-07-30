# Ghost Road — corrective design pass

**External review · 2026-07-29 · against the first recorded session (10:22, sampled)**

The blunt version: the systems are sound and two of them are actively switching the game off. This
is not a game that needs redesigning again. It needs one fatal mechanic replaced, one number
destacked, one z-order bug fixed, and its protagonist made visible. Everything else on the list is
polish that can wait behind a played session with sound.

**One finding is worse than the others and it is not on the observer's list.** You wrote an explicit
fairness rule for the Nightly Road — *at most two heavy modifiers, because stacked-modifier
difficulty is super-linear while oil compensation is linear* — and then hand-authored Night 6 with
**three**: a 45% oil cut, 60% fog, and gusts every 26 seconds. You had already reasoned your way to
the correct rule and then did not apply it to the content you had written first. Look for that shape
elsewhere; it is the most expensive kind of mistake because the reasoning is already done.

---

## 1. Ranked diagnosis

### FATAL — the game stops working

**D1. Wind is an off-switch, not a mechanic.** *(observer V1, confirmed and escalated)*

A gust snuffs **every** non-Storm lantern **simultaneously** for 5s, every 18–26s, on nights 5–7 and
all of endless. The recording shows the state plainly: `6 lanterns out · 4s`, the entire map dark but
the cabin, seven enemies on the road, none visible, none damageable, nothing to press.

That is not difficulty. Difficulty is a problem with an answer. This is a periodic removal of the
game's information layer, its damage layer, and its decision space at once — and it recurs on a
timer the player cannot influence. Compare: Kingdom Rush never takes your towers away; BTD6's
camo/purple layers *change* what works rather than suspending it. The nearest genre analogue is
PvZ's fog, and PvZ gives you Plantern and Blover — **two purchasable answers, both positional.**

Storm Glass is nominally the answer and it fails as one: 15 oil per lantern across six-plus lanterns,
and tier 1 only *halves* the duration. There is no affordable in-night response, so the correct play
is to stop playing for five seconds.

*Disproof I would accept:* a session where a player does something meaningful during a gust.

**D2. Night 6 is not a spike, it is a stack.** *(observer V7, confirmed)*

Starting oil 60 (a 48% cut from Night 5's 115), fog 0.60, gusts every 26s, 58 bodies including
Tallow Men and Bone Dogs — and **every night starts with zero wards placed.** 60 oil buys two
lanterns and one iron strip. At fog 0.60 a lantern's lit pool falls from 102px to **67px**, so that
opening covers roughly 134px of a 1070px road.

Observed: 5 oil, one lantern on the entire map, 13 incoming, homestead 82 → 27 inside one sampled
window. The income floor pays 25/wave against a night that removes far more than that.

This is the fairness rule you already wrote, broken.

### STRUCTURAL — it works and it is not delivering the pitch

**D3. You cannot see the protagonist.** *(observer V4 + V5, merged — they are one problem)*

The positioning is *the tower defense where you watch the dog, not the road.* Kara renders at roughly
30px, unlit, in the darkest region of a dark frame, and in several sampled frames she cannot be
located without knowing where to look. The Bone Dog is the same size and the same four-legged
silhouette. **The single sentence the whole design is built on is not true of the thing on screen.**

This is a graphics problem with a design consequence, and it is the highest-value non-fatal item.

**D4. The road out-competes everything for attention.** *(observer V3, confirmed)*

The road bed is drawn at `#45412f` with `#2f2d26` shoulders — the lightest large shape in the frame
after the cabin, visible end to end at every fog density. In a game whose premise is that darkness
hides things, the terrain is the brightest thing in the dark. It also reads as boardwalk, not as a
dirt logging road.

**D5. One light ward and one damage ward is not a roster.** *(observer's own note, agreed)*

The split fixed *what* a purchase does. It did not create variety. Every night is the same two buys
plus a branch choice, and the branch choice is per-ward rather than per-build. This is the correct
next content investment, and it is not urgent this pass.

**D6. Silence.** Agreed with the observer that the bark is the most valuable unbuilt thing. Not this
pass — it needs the audio design, and the audio design needs a played session to tune against.

### TUNING AND BUGS

**D7. Enemies draw over the homestead.** *(V2)* Hooded figures at roof height. Two-line class of bug,
disproportionate damage to perceived quality.

**D8. The placement preview over-promises.** *(V6)* A hard bright ring at the **dim** radius reads as
the pool; the soft gradient a placed lantern delivers looks much smaller. Every purchase disappoints
against its own preview.

**D9. HUD legend is permanent.** *(V9)* Nine rows pinned all session. Minor.

### REJECTED

**V8 — "the board is mostly empty dark space."** Rejected as a defect. That emptiness *is* the
horror, and it is the light rule working. It only reads as a problem because D1 makes it total and
D3 removes the one thing that should be worth watching in it. Fix those and this stops being an
observation about emptiness.

---

## 2. The fixes

### F1 — Wind becomes a front that crosses the hollow *(fixes D1)*

Replace the global snuff with a **moving squall line**:

- A gust has a **band**: a horizontal strip of the map, `halfHeight 150px`, centred on a chosen `y`.
- The front sweeps left-to-right across the map over ~1.4s at ~1000 px/s.
- A lantern is snuffed **as the front reaches its x**, and only if it is inside the band.
- Per-lantern duration drops **5s → 3.5s**, because outages are now staggered rather than shared.
- **Hard guarantee: a single gust may never take more than half your lanterns.** If the band would
  exceed that, the ones furthest from the band centre are spared. A rule that stops a mechanic
  degenerating is worth more than the extra severity it costs.
- The 1.8s warning now shows **the band**, not just a banner — you can see which stretch of road is
  about to go dark.

What this buys, in order of importance:

1. **The map is never fully dark.** There is always somewhere lit, so there is always something to
   watch and somewhere to act.
2. **Placement becomes the answer.** Lanterns spread across the vertical are hit a few at a time;
   lanterns clustered in one band all go out together. That is a real, free, positional counter — the
   PvZ lesson — and it makes the existing tension between covering road and covering *bands* legible.
3. **Storm Glass becomes a choice rather than a tax.** You armour the two lanterns in your worst band
   instead of needing to armour all six.
4. **The warning is actionable.** 1.8s is enough to move Kara toward the stretch that is about to go
   dark. That is a decision inside a gust, which is the thing that did not exist.

`balance.ts`: `GUST = { duration: 3.5, warning: 1.8, sweepSpeed: 1000, halfHeight: 150, maxShare: 0.5 }`

### F2 — Destack Night 6 *(fixes D2)*

Apply your own Nightly Road rule to the campaign: **at most two heavy modifiers per night.** Night 6's
identity is *scarcity*, so scarcity stays and the weather gives way.

| | before | after |
| --- | --- | --- |
| starting oil | 60 | **75** |
| fog | 0.60 | **0.35** |
| wind | 26s | **0** |

75 is a 35% cut from Night 5 — still the sharpest drop in the campaign, still the night you cannot
afford your usual opening, and now a night whose difficulty comes from the thing it is about. Night
7 keeps all three because Night 7 is *supposed* to be the wall, and it starts you at 130.

Also audit Night 5 (fog 0.50 + wind 22s + boss) — two heavies plus a boss. With F1 softening wind
this is acceptable; recheck after a session.

### F3 — Make Kara the most legible thing on the board *(fixes D3)*

Four changes, cheapest first. All procedural, all in `kara.ts`.

1. **Scale 0.58 → 0.72.** She is a dog beside a one-storey cabin; at 0.72 she is still correctly
   proportioned and roughly 36px at the shoulder. Costs nothing.
2. **A ground halo under her.** A soft radial, ~46px, `#f6f1e6` at alpha 0.05–0.09, breathing gently,
   drawn *above* the darkness overlay in the markings layer. It reads as her being the one warm thing
   in the hollow rather than as a UI marker, and it makes her findable in one glance at any fog level.
   This is the cheap change that transforms the frame.
3. **Raise her white floor.** `markings.alpha` currently bottoms at 0.28. Take it to **0.42** — she is
   the stated exception to the dark and should look like it.
4. **Separate her from the Bone Dog by rhythm, not by shape.** Keep the silhouette confusion; it is
   good and it is the Fetch's foreshadowing. Remove the *ambiguity* instead: the Bone Dog's gait rate
   is already 7.4 against her 9, but at 30px neither reads. With F3.1 and F3.2 she has a halo and it
   does not — that is now the whole tell, and it is the right one, because it is *warmth*.

### F4 — Put the road back in the dark *(fixes D4)*

Drop the road's value below the ground plane so light has something to reveal rather than competing
with it.

| element | before | after |
| --- | --- | --- |
| shoulder | `0x2f2d26` | `0x241f1a` |
| bed | `0x45412f` | `0x2c281f` |
| ruts | `0x393524` @ 0.85 | `0x1f1c15` @ 0.7 |

Then add what a dirt road actually has and a boardwalk does not: **scatter, not stripes.** Replace the
two continuous rut lines with short broken segments and a light stipple of gravel — perhaps 120 small
marks along the polyline, deterministic from the existing seeded `rng`. Ruts that stop and start read
as wear; two unbroken parallel lines read as planking.

Net effect: in an unlit stretch the road is a slightly darker absence in the ground, and a lantern
*discovers* it. That is the premise of the game, drawn.

### F5 — Fix the z-order *(fixes D7)*

`buildScene` currently adds the homestead body into the scene background. Return it instead, and have
`Game` place actors in a **y-sorted layer**:

- `actors = new Container(); actors.sortableChildren = true`
- Members: the homestead body (`zIndex = HOMESTEAD.y`), Kara's body, every enemy, every ward.
- Each sets `zIndex = y` per frame.

Painter's algorithm: anything further down the screen draws in front. An enemy on the final approach
at y≈580 goes behind the cabin; Kara in the yard at y≈688 stays in front of it. Correct in every case
rather than patched for the observed one.

### F6 — Make the preview honest *(fixes D8)*

Invert the emphasis. The **lit** ring is the promise the player cares about — it is where the ward can
kill — so it gets the solid 1.5px stroke and the fill. The **dim** ring drops to a 1px dashed hint at
alpha 0.18. A preview should promise the smaller true thing, not the larger nominal one.

---

## 3. Cut list

1. **Cut the permanent control legend** (D9). Collapse it behind `?`, which already opens help. Nine
   rows pinned for a five-minute session is a tutorial that never ends.
2. **Cut the light-band probe from the shipping HUD.** `under cursor 0.54 — lit · your lanterns can
   kill it` is a superb *build* tool and a tell that does the player's reading for them. Keep it
   behind a debug flag. The bands should be learned from the board.
3. **Cut `GUST.duration` as a global.** Superseded by F1's per-lantern staggering.
4. **Do not build the draft, Hard scars, or the remaining wards this pass.** All three are correctly
   deferred and none is on the critical path.
5. **Do not build audio this pass** — but move the bark to the front of the *next* one. It is the
   design's emotional payload and the whole mix exists for it.

---

## 4. Build order

**All nine shipped.** Status as of 2026-07-30:

| # | Work | Landed in |
| --- | --- | --- |
| 1 | **F2** destack Night 6 | ✅ `ce39408` |
| 2 | **F5** z-order | ✅ `ce39408` |
| 3 | **F1** wind as a front | ✅ `ce39408` |
| 4 | **F4** road values | ✅ `ce39408` |
| 5 | **F3** Kara legibility | ✅ `ce39408` |
| 6 | **F6** preview honesty | ✅ `ce39408` |
| 7 | Cut list 1–2 | ✅ `ce39408` |
| 8 | The bark, and the audio mix around it | ✅ `bfbe8ae` |
| 9 | A third and fourth ward (D5) | ✅ `6b65d32` — three, not two: salt, the Bottle Tree and the Church Bell |

> **The plan is executed. What is left of it is §5 — and four of those five questions are still
> open, because only one session has been played since this document was written.** Item 8 was
> explicitly gated on playing the result of 1–7 with sound on, and it was built before that happened.
> That was the right call for momentum and it is a debt: the audio mix has never been heard against
> real play, and neither has anything after it.

---

## 5. The five questions only a played session answers

1. ~~**Does a gust now produce an action?**~~ **ANSWERED 2026-07-29 — yes, and better than
   specified.** The player moved Kara into the band during the warning *and* used Show Belly there.
   That is the correct answer and it was not designed: Show Belly makes ground Lit out to 222px,
   which is larger than a lantern's entire pool, so it is a genuine substitute for the lanterns the
   gust is about to take. **Wind stays.** Record the combo — Show Belly as the answer to a gust is
   now a real line of play and should survive any future tuning of either.
2. **Is Kara watched?** Track how often the cursor or camera attention returns to her when nothing is
   attacking her. If the answer is "only when something is", the positioning is still aspirational.
3. **Is Ear-Perk learned without being told?** Ask the player afterwards what her ears mean. If they
   cannot say, Night 3's Bell Witch is attacking an instrument they never acquired.
4. **Do decisions per minute reach 7–9 mid-wave?** Count them. The arithmetic clears the target only
   if every ability is spent off cooldown, which is not how anyone plays.
5. **Is 25 seconds Down a mistake or a punishment?** Watch the player's face when it happens. If it
   reads as the game taking her away rather than as something they did, cut it to 15.
