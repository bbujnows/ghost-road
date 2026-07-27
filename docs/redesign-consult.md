# Ghost Road — Redesign Consultation

**External design review · 2026-07-27 · benchmarked against Kingdom Rush, BTD6, PvZ, Defense Grid, Orcs Must Die!, Rogue Tower**

You asked for judgment, so the summary is blunt: this is a strong theme and an honest lighting
sim sitting on top of a tower defense that does not yet exist. The two problems that matter are
structural, not tuning. Everything in your playtest list is a downstream symptom of them.

---

## 1. Diagnosis, ranked

### S1 — Fatal: the player has nothing to do during a wave

Count the verbs available mid-wave right now: place a lantern (rarely — oil is scarce), move Kara
(no effect on combat), watch. That is 1–2 meaningful decisions per minute. Mid-wave Kingdom Rush
runs 8–12 (hero micro, two spell casts, reinforcement drops, upgrade taps). Orcs Must Die is a
continuous-input game. Even BTD6 free-play idles at 4–6 plus menuing.

A five-minute session makes this worse, not better: there is no room for slow-burn setup payoff,
so if the minute-to-minute is empty, the whole session is empty. **No amount of ward variety fixes
this.** Wards fire themselves. The only place decisions-per-minute can come from is Kara — and she
currently has one passive.

This is also the answer to your open question 6: commanding one unit absolutely can hold
attention — Kingdom Rush heroes prove it — but only if the unit has actives on short cooldowns,
not just a radar animation.

### S2 — Fatal: one purchase solves both halves of the core mechanic

The pitch is "light gates damage": revealing and killing are supposed to be separate problems.
But the Lantern Post is simultaneously the light source *and* the damage source, so both problems
collapse into one decision — "place circle on road" — which is the baseline verb of every TD ever
shipped, executed here with less variety than any of your comparators.

This is why overlap-vs-spread was your only strategic axis, and why it broke twice. It is the only
axis that exists.

**The fix is to split the roster: light is cheap infrastructure, damage is scarce and only works
inside light.** Now the four bands do real work — you decide what to reveal and, separately, what
to kill, and dark-capable wards (salt, iron) become a genuine alternative economy instead of a
side-grade. This is Ghost Road's version of BTD6's camo/lead layer: a second consideration
riding on every placement.

**Can light-gates-damage carry seven nights plus endless?** As built — light *is* damage — no.
It is a placement filter on a standard TD, and shallower than Kingdom Rush's terrain. Split as
above — light as terrain, damage in light, dark-capable exceptions — yes, comfortably. But it is
the terrain system, not the headline. The headline is the dog (§2).

### S3 — Structural: the economy is a death spiral by construction

Kills fund oil → oil funds lanterns → lanterns enable kills. A player who opens badly cannot earn
their way back; your playtest note 5 ("a bad opening may be unrecoverable") is this, observed. No
comparator gates *all* income on performance: BTD6 pays per-round, KR pays per-kill but starts you
able to afford a working defense.

Fix: an income floor per wave; kills accelerate rather than gate. Numbers in §6.

### S4 — Tuning that masquerades as structure: the falloff exponent

`(1 − d/r)^1.6` is why every authored number lies: radius 150 delivers a 77px kill zone, the
Bright band is a 21px joke, and a kill has 0.3s of margin only on a centre-line pass. One change —
**flat-core falloff** (full intensity to 60% of radius, smooth fall to zero at the edge) — fixes
all four of your playtest notes 2–4 simultaneously, because dwell time in the damage zone roughly
doubles and authored radius ≈ delivered radius. Do this before retuning any HP.

### S5 — Tuning: enemy HP is being tuned against a broken curve

120 HP was the right correction to the wrong variable. Retarget after S4: baseline enemy dies to
one lantern + one cheap damage ward with ~25% margin; lantern-only kills ~60–70% of its HP. That
makes pairing light with damage the *learned* behavior instead of an optional one.

### S6 — Structural, content: 35 minutes with endless bolted on

The five-minute night is not a liability — it is the product. It matches how this game will
actually be played (desk, interruptions, daily). But it needs a structure built for it (§7)
rather than a campaign shape borrowed from games with 40-hour arcs, and it needs **speed
controls**, which are near-universal in the genre and absent here.

---

## 2. Competitive positioning: commit to the dog

Three candidate hooks. Two of them lose on contact with the market:

- **The light system** — reveal mechanics are commonplace (camo, cloak, stealth waves). Done well
  it is a very good *layer*. Nobody installs a game for a layer.
- **The horror** — a mood, not a loop. It amplifies; it cannot carry.
- **Kara** — no competitor has this. Kingdom Rush heroes are stat sticks with a portrait. OMD's
  avatar is a weapon platform. Nobody ships a commanded unit that is simultaneously the hero, the
  information system (Ear-Perk as radar, the bark as the loss alarm, stillness as dread), and the
  emotional stake — with a no-permadeath rule that makes *her absence*, not her death, the cost.

**Position: the tower defense where you watch the dog, not the road.** Every redesign decision
below serves that: her actives are the decisions-per-minute (S1), her tells are the UI, the
horror exists to make her one bark land, and the light system is the terrain she alone can cross.

---

## 3. The redesigned core loop

**Target: 7–9 decisions per minute mid-wave** (KR: 8–12; BTD6 free-play: 4–6).

**Between waves (12–15s):** wave preview shows composition and entry lane → spend the income
floor → adjust Kara's position for the coming lane. 3–4 decisions.

**During a wave (45–60s):**

| Verb | Cadence | Source |
| --- | --- | --- |
| Send Kara | every 6–10s | lane control, Bone Dogs, escort |
| Show Belly | 14s cooldown | burst-reveal a clump for the wards |
| Bubble | 2 charges, 8s regen | instant reposition / save |
| Blanket | 20s cooldown | panic button |
| Ball drop | ~once per 2 waves | attention tax: throw (4s absence, +bond) or ignore (−bond) |
| Mid-wave ward placement | ~once | the income floor makes this possible |

**Fast-forward at 2× always available.** With a banked defense and nothing on the road, watching
walkers amble at 30px/s is dead air. Every comparator solved this a decade ago.

---

## 4. Wards and enemies, rebuilt

### The split roster

**Light (no damage) —**

| Ward | Oil | Function |
| --- | --- | --- |
| **Lantern Post** | 15 | Flat pool, radius 120 (kill-capable to ~95). Branches: *Storm* (wind-proof) / *Mirror* (oval pool stretched along the road) |

**Damage (only works in light) —**

| Ward | Oil | Function |
| --- | --- | --- |
| **Cold Iron** (nail strip) | 25 | 90px floor strip; 8 dmg per 0.4s to anything standing on it *in light*. Folklore: iron burns spirits. The OMD floor-trap verb. |
| **Bottle Tree** | 45 | Traps the next 3 enemies within 70px into bottles, 4s each, 20 dmg on release; 8s recharge per bottle. Folklore: blue bottles catch haints. |

**Dark-capable (the exceptions that prove the light rule) —**

| Ward | Oil | Function |
| --- | --- | --- |
| **Salt Line** | 20 | As current, 8 crossings. |
| **Church Bell** | 65 | Reveal everything 6s (forces Dim minimum). Folds Kara's ears **3s** (down from 5 — keep the tradeoff, soften the punishment). |

**Special —**

| Ward | Oil | Function |
| --- | --- | --- |
| **Spring Line** | 40 | Wall + light-scatter multiplier, as designed. Kara amplifies it while within 60px and self-heals — **the hard lock is cut** (§8). |
| **Fiddler** | 55 | **One** aura: ward damage +20% in 260px. Branches: radius / adds Kara move speed. Tune-switching is cut (§8). |

**Upgrades:** every ward gets 2 branches × 2 tiers. Oil buys tiers in-night; stash unlocks
branches between nights. 5 wards × 4 nodes = 20 nodes — enough for build identity in a
five-minute night without BTD6's sprawl, which your session length cannot host anyway.

### Counterplay matrix

Two damage types: **light-burn** and **iron**. Every enemy has one cheap counter and one
comfortable counter; nothing has a universal answer.

| Enemy | Gimmick | Resists | Countered by |
| --- | --- | --- | --- |
| Road Walker | baseline | — | anything |
| Crawler | fast; outruns one pool | — | salt, iron strips |
| The Unseen | invisible outside light | — | bell, Kara's ears, Show Belly |
| Tallow Man | snuffs lanterns 8s | 50% light | **iron**; Kara stagger interrupts the snuff |
| Bone Dog | hunts Kara | — | anything — but forces Blanket/recall micro |
| Drownd Girl | salt-immune | 75% iron | **light only**; cannot cross Spring Line |
| Hant Cat | leaps salt and iron | — | Bottle Tree, light |
| Hollow Kin | 4× HP wall | — | stacked damage, Fiddler aura |

This is your "enemies teach you to build differently" audit item, answered: Tallow Man teaches
iron, Drownd Girl teaches light, Hant Cat teaches traps, Bone Dog teaches Kara micro.

---

## 5. Kara, rebuilt

Eight abilities was the right instinct with two redundancies. The kit that survives:

**Passives:** Ear-Perk (the radar — built, correct). The Bark (sacred, untouched).
**Move:** Send. **Dash:** Bubbles, 2 charges — absorbs its old "only way to break the lock" job
since the lock is gone; it is now her blink, which is a real, distinct verb.
**Burst:** Show Belly. **Panic:** Blanket. **Slot:** Toy loadout, expanded to 8 toys — this is
her build-defining choice and the natural home for effects like Hold (the Rope toy) rather than
bond-gating them. **Tax:** the ball drop, guaranteed once per night at a genuinely bad moment.

**Simplified bond curve:** T1 ears 280→350 · T2 Show Belly 14s→11s · T3 down-time 25s→12s ·
T4 **Lead** (Night 7). Hold moves to the Rope toy. Fewer tiers, each one felt.

Her damage stays ~zero. The moment she becomes a gun she becomes a tower, and the position (§2)
dies.

---

## 6. Economy

- **Income:** 25 oil per wave, guaranteed, **plus** 4 per lit kill. Worst-case player can still
  build every wave; good play accelerates.
- **Night 1 start: 75 oil** — two lanterns + one iron strip with the new prices, a working
  defense before the first spawn without covering everything.
- **Stash** unchanged at 10–14/night. Spend pool ≈ 200 (branch unlocks 10–16, toys 8–20,
  permanent +15 starting oil, heal/rest). Affordable per campaign ≈ 100 — two full runs to see
  most of it, which is the replay engine working for you.
- **Close the exploit now:** retrying a failed night keeps stash but must *not* keep bond gains,
  or deliberate failure becomes a bond farm.
- Hard mode's scars are the best idea in the difficulty design. Keep all five. Add the scar
  preview — dread is the correct emotion and it is free.

---

## 7. Content: from 35 minutes to a daily habit

1. **Campaign** — 7 nights × 5 minutes, each introducing exactly one enemy and one ward; bosses
   on 3, 5, 7. This is the tutorial the roguelite deserves, and it is already mostly designed.
2. **The Nightly Road** — one seeded night per calendar day, fixed offered loadout, one attempt,
   local streak counter. This is the desk-break ritual and the retention engine. None of your
   comparators do this; Wordle taught every player the shape.
3. **The Long Road** — endless, and here is the Rogue Tower lesson: **generate the road itself**
   each run. A new path through the dark hollow every run, plus a draft (one toy or ward branch
   every three nights), plus Hard-rule scars so every run *ends*. New map + build draft + certain
   death = the "one more run" hook, answered concretely.

**Feedback pass (missing, and near-fatal for feel):** hit-flash on walkers, ember tick per
lantern hit, oil arcing to the counter on kills, a 0.2s slow-mo on Show Belly, screen-wide
desaturate pulse on the bell. Skip damage *numbers* — the horror tone argues for analog feedback,
not arithmetic. This is a week of work worth more to perceived quality than any system in this
document.

---

## 8. The cut list

1. **The Spring Line hard lock.** Charming on paper, anti-player in the hand: it charges the
   player a bubble to undo a thing the game did to them. Becomes a *chosen* bonus (she amplifies
   while near water) — the personality survives, the tax dies.
2. **Fiddler tune-switching.** Three switchable auras in a five-minute game is a menu nobody
   opens twice. One aura, two branches.
3. **The Bright band.** +25% in a 21px ring is decorative. Cut the band; overlap now buys
   coverage insurance, and damage bonuses live in the Fiddler and upgrade tiers where they are
   legible. (If playtest misses it, re-add at threshold 0.65 as burn-over-time, not a multiplier.)
4. **Kill-gated income** as the primary economy (§6).
5. **The 1.6 exponent** (§1-S4).
6. **Bond-gated Hold** — moves to the Rope toy.
7. **Bond retention on night retry** — exploit, close it.

Nothing on this list touches the constraints: every surviving Kara ability still traces to the
real dog, she still cannot die, sessions stay under five minutes, the hollow stays.

---

## 9. Build order

| # | Work | Why this order |
| --- | --- | --- |
| 1 | **Feel week**: fast-forward, wave preview, hit/kill feedback, flat-core falloff | Cheap, zero design risk, transforms perceived quality; falloff must precede all retuning |
| 2 | Income floor + reprice | One file (`balance.ts`) |
| 3 | Split the roster: lantern→pure light, add Cold Iron, retune walker HP | S2 and S5 together |
| 4 | **Kara actives**: Show Belly, Bubbles, Blanket, ball tax | The game becomes itself here; playtest DPM immediately |
| 5 | Counterplay pass: resists, Crawler, Tallow Man | Enemies start teaching |
| 6 | Upgrade branches + toy roster | Build identity |
| 7 | Nights 2–7, bosses | Content on proven systems |
| 8 | Nightly Road, then procedural Long Road | Retention last, on top of a game that earns it |

**Defer:** full audio design (until the bark can land against real play), the Fetch boss, Hard
mode UI. **Do not defer:** the feel week. It is first for a reason.

## 10. What playtest must settle

- Does Send + Belly + Bubbles hit 7 DPM, or does Kara need a fourth active?
- Does cutting Bright flatten the overlap incentive too far?
- Is a 25-oil floor too forgiving on Normal? (Watch whether anyone fails Night 3.)
- Ball-drop frequency: once a night is a moment; once a wave is a nag. Find the line.

Each is a ten-minute answer once step 4 exists. None is worth arguing about before then.
