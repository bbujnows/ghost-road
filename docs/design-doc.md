# Ghost Road — Design Document

**Version 2.0 · 2026-07-27** — incorporates the accepted rulings from the external design review
([redesign-consult.md](redesign-consult.md)). Where that document proposes systems not yet specced
here (the light/damage ward split, Kara's active kit, the content plan), its build order is the
adopted roadmap and its numbers are the starting spec.

An Appalachian folk-horror tower defense. Seven nights defending a homestead at the end of an
abandoned logging road. Kara — a gold Labrador/pit mix with white paws, belly, and chest — is the
only unit the player directly commands.

> All numbers in this document are first-pass and meant to be tuned. They are stated precisely so
> that tuning has somewhere to start and so that disagreements are about values rather than about
> what the system even is.

---

## 1. The premise in one paragraph

Light gates damage. Wards cannot hurt what is standing in the dark, so the game is a lighting
puzzle wearing a tower defense's clothes. Kara is the single exception — she works in the dark,
which is why she is worth commanding and why the player's attention is permanently split between
the lit board and the dark dog. She is silent for the entire game. If she barks, the player has
already lost something.

---

## 2. Light and shadow

### 2.1 The three bands

Illumination at a point is a scalar `L ∈ [0,1]`. Everything in the game keys off which band `L`
falls into.

| Band | Range | What it means |
| --- | --- | --- |
| **Dark** | `L < 0.15` | Enemies are invisible and untargetable. Only Kara, salt lines, and the bell operate here. |
| **Dim** | `0.15 ≤ L < 0.35` | Enemies are *visible* but still not damageable. This band exists so that reveal and damage are separate rewards. |
| **Lit** | `L ≥ 0.35` | Enemies are damageable. Wards deal listed damage. |

> **The Bright band is cut** (ruling 2026-07-27). +25% inside a 21px ring was decorative — it only
> ever rewarded overlap, which was already dominant. Overlap now buys coverage insurance; damage
> bonuses live in the Fiddler aura and ward upgrade tiers, where they are legible. If playtest
> misses it, the fallback is Bright at threshold 0.65 as a 2 dps burn, never a multiplier.

Ambient moonlight is `L = 0.08` everywhere — permanently below the Dark threshold. The moon is
atmosphere, never a solution.

### 2.2 Accumulation and falloff

Per light source `i` at distance `d`, **flat-core falloff** (ruling 2026-07-27, replacing the
original `^1.6` exponent):

```
core_i    = 0.6 × radius_i
falloff_i = d ≤ core_i ? 1 : 1 − smoothstep((d − core_i) / (radius_i − core_i))
L         = min(1, Σ intensity_i × falloff_i) × (1 − 0.5 × fogDensity)
```

Full intensity out to 60% of radius, then a smooth fall to zero at the edge. The old exponent
made every authored number a lie — radius 150 delivered a 77px kill zone and enemies went
invisible at 118px. Under flat-core, **authored radius ≈ delivered radius**, and dwell time in
the damage zone roughly doubles, which is what un-brittles the kill margins. Fog remains a
straight multiplier on the total — a global difficulty lever that reads instantly.

### 2.3 Rendering

- Lightmap rendered to a `RenderTexture` at **half resolution**, upscaled bilinearly. Light is
  low-frequency; nobody sees the difference and it roughly quarters the fill cost.
- Composited over the scene with **multiply**, then a second **additive** pass for bloom on the
  emitters themselves.
- **Soft shadows** via 2D shadow volumes from occluder segments (cabin walls, boulders, the mill).
  Cap at **8 shadow-casting lights**; every light beyond that is unshadowed. Lanterns cast,
  bubbles and the belly flash do not.
- **Fog** is two scrolling noise textures at different rates modulating the lightmap, plus a
  parallax fog-volume sprite layer in front of the scene.
- `lightAt(x, y)` is an analytic CPU evaluation of the same formula. Gameplay queries it; the GPU
  lightmap is never read back. **If the falloff exponent changes in the shader, it must change in
  `lightAt()` or the two silently disagree.**

### 2.4 Kara's coat, as a lighting rule

Kara renders in two layers. Her gold body sits **under** the lightmap and goes dark with
everything else. Her white paws, belly, and chest render **above** it at:

```
markingsAlpha = 0.25 + 0.75 × L(kara.x, kara.y)
markingsTint  = color of the nearest light source, weighted by contribution
```

In an unlit stretch she is four pale points and a chest blaze moving through black. Near a lantern
she warms to amber; in open moonlight she goes cold blue. This is not decoration — it is the
player's only means of tracking her, and two later mechanics (the Fetch, and Show Belly) depend on
the player having learned to read it.

### 2.5 The three light interactions that matter

**Show Belly.** Spawns a light at Kara: `intensity 0.9, radius 260`, held 1.4s, eased to zero over
the final 0.4s, then 0.8s on the ground getting up — 2.2s of total helplessness. It does **not**
cast shadows: it is a reflection off her belly, which reads softer and keeps it off the 8-light
shadow budget.

**Measured reach: it makes ground Lit out to 222px and visible out to 242px** — larger than a
lantern's entire pool, and it lands anywhere on the map she can reach. This is the game's manual
burst window and the main reason her position matters. The light dies *before* she is back on her
feet, deliberately: the reward ends while the risk is still running.

**Hose mist.** The spring line is a weak light on its own (`intensity 0.20, radius 110` — Dim, never
Lit). Its real function is **scattering**: any lantern whose radius overlaps the mist volume gets
`radius × 1.35` and `+0.15 intensity` *within the mist*. A lantern beside a hose lights far more
road than a lantern anywhere else. This is the game's central ward combo, and it is why the hose is
priced like a lantern despite dealing no damage.

**Bubble glow.** Each bubble is a moving light: `intensity 0.22, radius 55, lifetime 5s`. Alone it
peaks at `L = 0.30` — squarely Dim, so **it reveals and never kills.** Keeping it under the 0.35
threshold is what stops Bubbles from replacing the Lantern Post.

**But light accumulates**, and that produces an emergent combo worth keeping (measured, built
2026-07-27): at a lantern's fringe the two stack.

| Distance from a lantern | Lantern alone | With a bubble |
| --- | --- | --- |
| 105px | 0.28 · Dim | **0.50 · Lit** |
| 110px | 0.18 · Dim | **0.40 · Lit** |
| 115px | 0.11 · Dark | 0.33 · Dim |

So a bubble parked on a lantern's edge temporarily **extends its kill zone by ~10px**, and a
bubble trail through overlapping pools briefly widens the whole corridor. It was not designed in;
it falls out of additive light, it costs a charge and lasts five seconds, and it rewards a player
who has understood the band system. Keep it. The same rule will produce the stronger version once
the Spring Line's mist scattering exists.

### 2.6 The homestead's own light

The house is lit for free, by four sources it owns: a broad porch light, a hung lantern by the
door, and the two windows. Together they put the cabin, porch, and yard in the **Bright** band, and
they reach **the last 190px of road — 17.4% of it**.

Two reasons this is not a giveaway:

- **The thing being defended must always be legible.** A player who cannot see the homestead cannot
  read how the night is going. Its window glow is drawn into an emissive layer *above* the darkness
  overlay, for the same reason Kara's white markings are.
- **17.4% is the free tier, not a defence.** It buys about six seconds of visibility at the very
  end of the walk, with no ward attached. Everything above the yard costs oil.

The visual darkness of unlit ground (`AMBIENT_COLOR`) is deliberately separate from the gameplay
value (`AMBIENT_LIGHT = 0.08`). Enemy visibility is gated on the band, never on the render colour,
so the scene can be made legible without weakening the mechanic. **Tune the two independently.**

---

## 3. Kara

### 3.1 Vitals

| Stat | Value |
| --- | --- |
| HP | 100 |
| Walk speed | 95 px/s |
| Chase speed (bubbles) | 180 px/s |
| Ear-Perk radius | 280 px (350 at Bond T1+) |
| Ear-Perk lead time | 2.0s before the threat is visible |

She is never permanently lost. At 0 HP she goes **Down**: limps to the porch and is unavailable for
**25s** (12s at Bond T4+). The player is blind for that stretch. That is the entire cost, and it is
enough — do not add a permadeath mode.

**Built 2026-07-28**, alongside the Bone Dog. Two implementation notes that are design, not detail:

- She keeps **limping toward the porch on screen** while the clock runs. The player watches her go
  rather than seeing her switch off, and a hurt dog walking away is a considerably worse thing to
  look at than a grey icon.
- Nothing may bite a downed dog. She is out of the fight, not a body left on the field. The cost is
  her absence and it should never read as cruelty.

**She heals 25 HP per wave cleared** — *not from the original design*, added in the counterplay pass
and flagged for playtest (§12.2). The spring line is the only healing the doc specifies and it is
not built, so without this a bad wave 1 turns the rest of the night into an unrecoverable bleed —
the same death-spiral shape the consultation cut out of the oil economy. Partial rather than full so
damage still carries between waves.

### 3.2 Command set

| Command | Input | Cooldown | Cost / catch |
| --- | --- | --- | --- |
| **Send** | Right click | — | Free. She walks; she does not teleport. |
| **Bubbles** | `B` + click | **2 charges, +1 per 8s** (consult ruling) | Her blink. She chases at 180px/s. Costs a charge, not a cooldown, so both can be spent at once when it matters. |
| **Show Belly** | `X` | 14s (11s at T3+) | 1.4s flash + 0.8s getting up. Takes **2× damage** and accepts no commands for the full 2.2s. |
| **Blanket** | `Z` | — | Minimum 3.0s under, then `3.0 − 0.4 × bondTier` seconds (floor 1.0s) of coaxing. Untargetable underneath, and blind. |
| **Hold** | `H` | 20s | Requires the Rope toy equipped that night (§4). Plants her; enemies within 90px are slowed 35% and cannot pass. Max 8s. She takes damage the whole time. |
| **Throw ball** | `T` when she drops one | — | +3 bond, but she is out of position ~4s fetching. |
| **Lead** | `L` | Once per night | Unlocked at Bond T5, usable Night 7 only. Fog → 0 within 300px of her for 12s. |

**The Bark is not a command.** It fires automatically, at most once per night, when something
physically reaches the homestead. See §10.

**The Blanket shipped with the Bone Dog** (2026-07-28), which is what it was waiting for. It was
held back through step 4 on the grounds that a panic button whose entire value is becoming
untargetable buys nothing while nothing targets her; once something did, it became the answer to it
in the same pass.

As built: `Z` puts her under, `Z` (or a Send) takes her out, and she will not begin coming out
before the 3.0s minimum. Underneath she is untargetable — and **blind**. No ears, no light, no
position, no orders carried out. That blackout is the honest price of invulnerability in a game
whose entire information system is the dog, and it is what stops the Blanket being a free answer to
every bad moment. One white paw is left sticking out from under the quilt: in an unlit yard it is
the only thing on screen that says where she is, which is §2.4 doing its work in the one situation
where the rest of her has stopped.

**Ear-Perk is not a command either.** It is a readout. She lifts her ears and orients toward the
nearest threat within radius, 2.0s before it becomes visible. From **Night 5**, one perk in six is
a false positive with nothing behind it — she is reacting to something the player will never see.
This is a horror beat and a deliberate erosion of the player's most reliable instrument.

**Implementation note, and it matters.** She perks at what is *about to be seen*, not at whatever
happens to be nearby. Each threat's position is projected 2.0s along the road and tested against
the lightmap; she reacts only to threats that are currently invisible and will be visible by then.
Tying it to raw proximity instead would leave her ears up for nine seconds at a stretch — at 280px
and 30px/s that is most of the approach — and the tell would mean nothing. **The signal is only
worth watching because it is rare.**

The perk snaps up fast and comes down slowly, breathing shallows, and the tail stops wagging. None
of it is surfaced in the HUD, deliberately: the player is meant to learn to watch her.

### 3.3 The water (softened from the original hard lock — ruling 2026-07-27)

While Kara is within `0.5 × barrier radius` of an active spring line she enters **Play**:

- Barrier radius × 1.3
- She heals **8 HP/s** and any curse effect is cleansed
- Bond +0.5/s (capped at +6 per night)
- When idle with no command, she **drifts toward nearby water on her own** — leave her
  unattended near a spring line and you will find her in it.

**A plain Send pulls her out.** No bubble tax. The original design had her refuse to leave
without a bubble, and the review called it correctly: that charged the player to undo something
the game did to them. What survives instead is the *reluctance* — on being called out of the
water she obeys, but the animation shows it: a last snap at the spray, a full-body shake, and a
look back. The personality is in the leaving, not in a fee.

### 3.4 Bond

Bond runs 0–100 across the campaign.

| Tier | Bond | Unlock |
| --- | --- | --- |
| T1 | 15–34 | Ear-Perk radius 280 → 350 |
| T2 | 35–59 | Show Belly cooldown 14s → 11s; blanket coaxing −0.4s/tier |
| T3 | 60–84 | Down recovery 25s → 12s |
| T4 | 85–100 | **Lead** |

**Hold is no longer bond-gated** (ruling 2026-07-27) — it lives on the Rope toy (§4), making it a
per-night build choice instead of a permanent unlock. The bond track simplifies to four tiers,
each one felt: better ears, faster belly, faster recovery, and Lead.

**Gains:** throw a dropped ball +3 (≈4 opportunities/night) · rest her between nights +5 · feed her
+4 · playing in the hose +0.5/s to a +6/night cap · finish a night with her uninjured +8.

**Losses:** ignore a dropped ball −2 each · she goes Down −5.

Maximum realistic accrual is ~14–16/night. **Reaching T5 by Night 7 requires near-perfect play
across the whole campaign**, which is the intent — Lead is a reward for having actually looked
after her, not a scheduled unlock.

### 3.5 The dropped ball

At semi-random moments — weighted to be *inconvenient*, i.e. 2–4s after a wave begins — Kara drops
a ball at the player's feet and stares. Throwing it costs roughly 4 seconds of her being out of
position. Ignoring it costs bond and she picks it back up, disappointed, after 6s.

The tradeoff must be legible in the moment and slightly painful every time. Do not make the timing
fair.

---

## 4. Toy loadout

One toy per night, chosen before the night starts. Toys are unlocked with stash (§9) and persist —
choosing is a per-night build decision, not a purchase.

| Toy | Effect | Stash cost |
| --- | --- | --- |
| **Ragged Fox** (her favorite) | Bond gain ×1.5 for the night | Starting |
| **Tennis Ball** | Ball drops +50% more often; +2 stash per retrieve | Starting |
| **The Squeaker** | Bark alarm may fire **twice** this night; Ear-Perk lead time 2.0s → 2.2s | 8 |
| **The Rope** | **Grants Hold** for the night (§3.2) | 12 |
| **Stuffed Duck** | Hose amplification +25%; she takes **no damage** while in water | 14 |
| **Weighted Bear** | Kara HP 100 → 150; move speed −15% | 16 |
| **Sock Monkey** | Bubbles: +2 max charges; regen 8s → 5s | 18 |
| **Old Blanket Scrap** | Blanket coaxing → 1.0s flat; emerging grants 3s of +50% move speed | 20 |

The Blanket Scrap is the ambush enabler and is priced to be a late-campaign pickup. The Weighted
Bear is deliberately double-edged — more body, less reach.

---

## 5. The wards

Wards, not guns. Nothing in this game shoots.

| Ward | Oil | Function |
| --- | --- | --- |
| **Lantern Post** | 15 | **Pure light, zero damage** (roster split, built 2026-07-27). `intensity 0.85, radius 120`, delivering lit to ~102px under flat-core. It makes ground fightable; something else does the fighting. |
| **Cold Iron** | 25 | A 90×26px board of nails laid **along the road bed** (auto-snaps to the nearest segment). **8 damage per 0.4s** to everything standing on it *in light* — ~56 per pass at walker speed. Legal to lay in the dark as an investment awaiting a lantern. Folklore: iron burns spirits. |
| | | Under the flat-core falloff (§2.2), authored radius ≈ delivered radius; the old `^1.6` curve delivered a 77px kill zone from a stated 150 and is the reason it was cut. The placement preview always draws the *delivered* Lit and Dim radii, never the raw number. |
| **Salt Line** | 20 | Not a light. A drawn segment up to 140px. Crossing costs 25 damage and 50% slow for 2s. **Depletes after 6 crossings.** Works in full dark. |
| **Church Bell** | 65 | One per map. Activated, 45s cooldown. Staggers every enemy on screen 2.5s and forces them to Dim band for 6s. |
| **Fiddler** | 55 | Porch-bound. **One aura**: ward damage +20% in 260px (ruling 2026-07-27 — tune-switching cut; nobody opens a menu mid-wave in a five-minute game). Upgrade branches choose bigger radius or Kara move speed. Flees if an enemy comes within 120px. |
| **Spring Line** | 45 | Running water. 110px barrier enemies path around. Scatters lantern light (§2.5). Heals and traps Kara. |

**Lantern upgrades** (branches, per the consult structure — not yet built): *Storm* (wind-proof,
matters from Night 4) / *Mirror* (oval pool stretched along the road).

His one tune is *Cold Frost Morning*. The cut tunes survive as his upgrade branches: *Wayfaring
Stranger* (radius branch) and *Shady Grove* (Kara-speed branch).

**The roster split is built** (2026-07-27): Lantern Post is pure light, Cold Iron is the damage
layer. Still to come from [redesign-consult.md](redesign-consult.md) §4: the **Bottle Tree**
(45 oil, traps three enemies — the Hant Cat's counter), iron's 50% spirit resist (step 5,
counterplay pass), and the upgrade branches (step 6).

### 5.1 Synergies and anti-synergies

| Combination | Result |
| --- | --- |
| **Lantern + Spring Line** | The core combo. Mist scatters the lantern: +35% radius, +0.15 intensity inside the mist. A glowing curtain that lights far more road than either piece alone. |
| **Bubbles + Spring Line** | Bubbles crossing mist are boosted 0.22 → 0.40, crossing into Lit. A moving damage corridor. |
| **Show Belly + clustered lanterns** | Belly flash pushes an already-Dim cluster to Lit while every nearby lantern is in range. The intended burst. |
| **Fiddler (*Wayfaring Stranger*) + everything** | +30% light radius is a board-wide multiplier on the core mechanic. Priced accordingly. |
| **Hold + Salt Line** | She pins them standing on the salt, forcing repeat crossings. Best non-light kill in the game. |
| **Salt Line + dark lanes** | Salt and Kara are the *only* things that function below 0.15. Salt is the answer to a lane you cannot afford to light. |
| **Church Bell − Kara** | **Anti-synergy, deliberate.** The bell folds her ears back: Ear-Perk disabled for 5s. The board-wide reveal costs you your early-warning system. Never remove this. |
| **Blanket + Bone Dogs** | They lose their target — and go for the homestead instead. Hiding her is not free. |

---

## 6. The seven nights

Each night is **3 waves**, 55–70s per wave, 12s between. Night length **3:45–4:30**. Pausable at
any instant with Space; auto-pauses on tab blur; state saves to `localStorage` after every wave.

### Enemy roster

| Enemy | Behavior |
| --- | --- |
| **Road Walker** | Baseline. Walks the road toward the homestead. |
| **Snake-Doctor Swarm** | Fast, fragile, arrives in numbers. Punishes single-lantern coverage. |
| **The Unseen** | Alpha `0.06 + 0.94 × L`. Genuinely invisible in the dark. Countered by Kara's ears, the bell, or bubbles. |
| **Tallow Man** | Snuffs a lantern on contact — disabled 8s. Attacks your lighting, not your HP. |
| **Bone Dog** | Fast, and it targets **Kara** rather than the homestead. |
| **Drownd Girl** | Immune to salt. Cannot cross running water at all — the spring line is a hard wall. |
| **Hant Cat** | Leaps salt lines entirely. |
| **The Fetch** | A copy of Kara. Same silhouette, same gait — **but no white markings.** You identify the real dog by her four pale paws. |

### Enemy stats

| Enemy | HP | Speed | Porch damage | Resists | Built |
| --- | --- | --- | --- | --- | --- |
| **Road Walker** | 45 | 30 px/s | 8 | — | ✅ |
| **Crawler** | 22 | 62 px/s | 5 | — | ✅ |
| **Tallow Man** | 90 | 22 px/s | 12 | light 50% *(inert)* | ✅ |
| **Bone Dog** | 24 | 55 / 78 px/s | 6 | — | ✅ |
| The Unseen · Drownd Girl · Hant Cat · Hollow Kin · The Fetch | — | — | — | — | ❌ |

### The counterplay pass (2026-07-28)

Consult §9 step 5. Every enemy here punishes one specific habit and is answered one specific way,
and no two share an answer.

| Enemy | Punishes | Answered by | Measured |
| --- | --- | --- | --- |
| **Crawler** | A gap in your coverage, crossed before you can patch it. 1070px in 17s against the walker's 36s. | One lit iron strip, always. | 1.45s dwell → 3–4 ticks = 24–32 vs 22 HP. |
| **Tallow Man** | Lanterns set tight against the road bed. He pinches them out for 8s. | **Spatially** — a post further than 58px from his walk is out of reach — or **Kara**, who squares up and runs him off it. | 4.09s dwell → 80 damage vs 90 HP: one strip deliberately does not finish him. A Kara stagger roots him 2.0s on the iron for 40 more, which does. |
| **Bone Dog** | Leaving her parked in the open. It ignores the house entirely. | The Blanket, a recall, or **using her as bait** — it follows her wherever she goes, including across your iron. | 7.5s of one dog to Down her, 3.8s of two, half that while she is on her back. |

**Damage types.** `iron` and `light` (consult §4). Iron is the only live source — Cold Iron is the
only ward that deals damage at all after the roster split. The Tallow Man's 50% light resist is
carried as **declared and inert**: it becomes live the moment a light-burn ward ships in step 6, and
substituting some other counterplay now only to unpick it then would cost far more than three lines
of data. His two live counters are spatial and canine, and neither of them needs the type.

**The Tallow Man forgets a lamp Kara chased him off.** Without that, he re-reaches for the same
lantern the instant the 2.0s stagger ends, and a dog parked beside one post locks the boss out of
the night permanently — she would beat him by standing still, which is the opposite of what she is
for. She saves *that* lamp; he goes and finds another. Following him down the line and spoiling each
one is real, expensive micro and exactly the kind wanted.

> ### ⚠ Night 1 is currently a proving ground
>
> The night structure below gives Night 1 Road Walkers plus the Tallow Man as its boss, with the
> Crawler arriving on Night 2 and Bone Dogs on Night 3. Nights 2–7 are build-order step 7 and do not
> exist, so **every enemy written in the counterplay pass is folded into Night 1** to be playable at
> all. Wave 1 is still walkers only and still teaches the baseline; waves 2 and 3 are a test
> harness. Restore the shipping composition when step 7 lands.
>
> Measured pacing: 55.7s / 58.2s / 82.6s uncontested, **3:40 for the night** including breaks.

> **45 HP is tuned against the split roster** (consult §1-S5 target): Cold Iron deals ~56 per
> pass (7 ticks × 8 over a 3.0s dwell on the 90px strip), so one lantern + one iron kills with
> ~25% margin, and the kill lands at the sixth tick. Lanterns alone kill **nothing** — a lit road
> with no iron is a road you watch them walk down. The derivations below reflect earlier tunings
> and stand as history.

The Road Walker's numbers are derived rather than picked. A lantern does `14 / 0.55 ≈ 25.5` dps,
and a walker crossing a lantern's 154px Lit chord at 30 px/s is exposed for **5.1 seconds**, taking
**130 damage**. At 120 HP that is **one pass, one kill, with almost no margin.**

> **This was 60, and it broke the game.** At 60 a single lantern overkilled by 2×, so two
> overlapping lanterns killed a walker in **1.15 seconds** — fast enough that it read as the enemy
> vanishing on contact. Worse, the Bright band's +25% never mattered, because nothing lived long
> enough to benefit from it. Overlapping was strictly better than spreading and the central
> decision of the game — coverage versus damage — did not exist. Tune HP against that 130, never
> in isolation.

Measured kill times at 120 HP, walking straight through lantern coverage:

| Placement | Time to kill | What it buys |
| --- | --- | --- |
| One lantern | 3.98s (4.3s dwell) | Only just enough. Off-centre placement will fail to kill. |
| Two overlapping, 90px apart | 2.27s | Fast kills over a short stretch |
| Two spread, 220px apart | 3.98s | Same kill speed, twice the road covered |

That gap is the game: **overlap to kill faster, spread to cover more road**, and neither is free.

**Lanterns re-arm on acquisition.** A lantern's cooldown is clamped at zero and reset to
`initialDelay = 0.3s` the moment it acquires a target. Without this, an idle lantern banks
readiness and fires the instant anything crosses into its light — two overlapping lanterns landed
35 damage on the same frame, 29% of a walker's health, before the player saw anything happen.

**Nothing may blink out of existence.** A killed walker hands its display container to a corpse
and falls from the pose it died in over `0.85s` — buckle, topple, fade. A kill the player cannot
watch happen reads as a bug.

**Night 1 pacing**, at the road's measured 1070px (35.7s traverse):

| Wave | Walkers | Gap | Duration |
| --- | --- | --- | --- |
| 1 | 6 | 4.0s | 55.7s |
| 2 | 8 | 3.5s | 60.2s |
| 3 | 10 | 3.0s | 62.7s |

Night total **3:27** including the 12s breaks — inside the 5-minute budget with room for the later
nights to grow.

### Night structure

| # | Night | Introduces | Boss |
| --- | --- | --- | --- |
| 1 | **First Night** | Road Walkers. Lanterns and the light bands. | **The Tallow Man** — snuffs lanterns one by one. Teaches that lighting is a resource under attack. |
| 2 | **Second Night** | The Unseen. Ear-Perk becomes load-bearing. | **The Snallygaster** — aerial, ignores salt and water entirely, vulnerable only in Lit band. A pure lighting fight. |
| 3 | **Third Night** | Bone Dogs — the first threat aimed at Kara. | **The Bell Witch** — silences the church bell for the night, mimics voices, and spawns **false ear-perks**. Attacks both your instruments. |
| 4 | **Fourth Night** | Rain. Wind snuffs un-upgraded lanterns; the creek overflows into a free extra barrier. | **The Drownd Girl** — salt-immune, water-bound. Must be killed with light alone. |
| 5 | **Fifth Night** | Fog at `density 0.6` — every light loses 30%. Genuine false ear-perks begin. | **The Greenbrier Ghost** — does not attack. She *walks*, and everything she passes rises behind her. Kill the walker, not the risen. |
| 6 | **Sixth Night** | Oil scarcity. Starting oil cut 40%. | **The Fetch** — three copies of Kara on the board. Commands go to whichever you clicked. Find the white paws. |
| 7 | **Seventh Night** | The road itself opens. Fog `density 0.9`. | **The Drover** — leads the whole hollow's dead down the road at once. Without **Lead**, the path through the fog is not findable in time. |

Night 6 is the payoff for §2.4. A player who has spent five nights tracking her by her paws will
find the real Kara in about a second and a half, and will feel clever rather than tested.

---

## 7. Difficulty and failure

The homestead has **100 HP**. Enemies that reach the porch damage it and are removed.

| Enemy | Porch damage |
| --- | --- |
| Snake-Doctor Swarm | 3 |
| Tallow Man, Bone Dog | 6 |
| Road Walker, Hant Cat | 8 |
| The Unseen | 10 |
| Drownd Girl | 12 |
| Boss | 25 |

Two modes, chosen at campaign start and locked for the run.

### 7.1 Normal — *Hold the Night*

- Homestead HP **resets to 100 at the start of every night.**
- At 0 HP the night ends in failure and is **replayed from wave 1**.
- **Stash earned during the failed night is kept. Bond gains are not** (ruling 2026-07-27 —
  keeping both made deliberate failure a bond farm).
- No cap on retries.

The intent is that a bad night costs four minutes and teaches you the lane you misjudged. This is
the mode for playing at a desk with interruptions.

### 7.2 Hard — *The Hollow Remembers*

- Homestead HP **persists across all seven nights.** It does not reset.
- Between nights it recovers **+20 HP** free, and stash can buy repairs at **10 stash → +15 HP**.
- **The homestead never "falls" and the run never restarts.** At 0 HP it takes a **scar**: a
  permanent, named injury. HP then refills to a new, lower maximum and the night continues.

| Scar | Max HP after | Permanent effect |
| --- | --- | --- |
| 1. **Burnt wing** | 85 | −1 ward slot for the rest of the run |
| 2. **Broken porch** | 70 | Kara's Down recovery 25s → 40s |
| 3. **Cracked bell frame** | 55 | Church bell cooldown 45s → 70s |
| 4. **Split spring box** | 40 | Hose amplification halved (+35% radius → +17%) |
| 5. **Roof gone** | 25 | Rain and fog nights lose an additional 15% light |
| 6. **—** | — | The hollow takes the homestead. Run over. |

Scars cannot be repaired at any price. Every one of them makes the remaining nights harder in a
way the player can name, and by Night 7 a scarred run is a genuinely different game — fewer wards,
a slower dog, a weaker bell. Losing compounds rather than resetting, which is the whole point of
the mode.

Bond, toys, and permanent unlocks carry across both modes identically. Difficulty changes what
failure costs, never what Kara is capable of.

---

## 8. The long nights — endless mode

Unlocked by completing Night 7 on either difficulty. Nights 8 onward, procedurally escalating,
played for a high-water mark. This is the mode that turns 35 minutes of authored content into
something worth opening every day.

Carried in: **bond, toys, and all permanent unlocks.** Stash keeps accruing and keeps being
spendable between nights.

**Escalation, where `n` is the night number:**

| Knob | Formula | Notes |
| --- | --- | --- |
| Fog density | `min(0.95, 0.50 + 0.05 × (n − 7))` | Hits maximum around Night 16 and stays there. |
| Enemy HP | `× (1 + 0.12 × (n − 7))` | Uncapped. This is the primary wall. |
| Enemy speed | `× min(1.5, 1 + 0.03 × (n − 7))` | Capped, so the game never becomes reaction-time-only. |
| Waves per night | 3, → 4 at Night 12, → 5 at Night 20 | Nights get longer, but 5 waves still lands near 6 minutes. |
| Starting oil | `120 + 10 × floor((n − 7) / 5)` | Grows, but far slower than enemy HP. |

**Bosses** return every third night (10, 13, 16, …), drawn from the seven with a stacking
modifier — a Tallow Man that also leaps salt, a Drownd Girl in absolute fog. Boss selection is
seeded from the run, not random per night, so a run has a recognizable shape.

**Homestead rules follow the difficulty the campaign was cleared on** — Normal replays the night,
Hard accumulates scars until the sixth ends the run. A Hard endless run therefore has a definite
ending, which is what makes the score mean something.

**Score** is nights survived, with total bond as the tiebreak. Stored locally. Kara's condition at
the end of the run is shown alongside the number.

---

## 9. The ball stash economy

Two currencies, deliberately separated so that in-night tactics and between-night progression never
compete for the same pool.

**Lamp oil** — in-night only, does not carry over.
- **Income floor: 25 oil per wave, guaranteed** (ruling 2026-07-27). The original kill-gated
  economy was a death spiral by construction — kills funded lanterns which enabled kills, so a
  bad opening was unrecoverable. Kills now accelerate; they never gate.
- Plus **+4 per enemy killed in the Lit band, +2 per salt kill.** The differential is intentional:
  salt is the cheap answer to a dark lane, and it keeps you poor.
- Starting oil: Night 1 = 75, rising through Night 5, then cut on Night 6. With the split-roster
  prices this buys a working defense — two lanterns and one damage ward — before the first spawn,
  without covering everything.

**Stash** — between-night only, carries over. Kara fetches it.
- She retrieves one item per **3 kills**. Each retrieval is a **6-second round trip during which she
  is out of position.**
- The player can toggle fetching **off**. Doing so costs progression and buys presence — the single
  most consequential toggle in the game.
- Expected income with fetching on: **10–14 stash/night**, so **70–90 across the campaign**.

**Spending:**

| Purchase | Cost |
| --- | --- |
| Toys | 8–20 (see §4) |
| Permanent lantern upgrade | 15 |
| Permanent salt capacity 6 → 9 crossings | 18 |
| +25 starting oil, permanent | 10 |
| Heal Kara to full | 5 |
| Rest her (bond +5) | Free |

Buying everything would cost roughly **180**. The player can afford about half. That gap is the
build.

---

## 10. Audio

The audio design exists to serve one event. Everything else is subordinate to it.

**The ambient bed.** Mixed at **−18 LUFS** and kept there. Wind in the ridge pines, crickets that
thin out as the nights get worse, the creek, the fiddler when he is playing. No musical stingers.
No cues on spawns.

**The enemies are quiet.** No screeches, no roars. Footsteps, cloth, and wet sounds only. A player
straining to hear is a player who will be destroyed by a loud noise.

**Kara is audible.** Breathing, paws on gravel, and — critically — **her collar tags jingling**,
panned in stereo to her position and attenuated with distance. In a dark corner of the map, her
tags are how you hear where she is. This is the audio counterpart of her white paws, and it is the
reason she can be off-screen without being lost.

**The Bark.**

1. **400ms of total silence.** Every channel ducked to −60 dB. Nothing about the visuals changes.
2. The bark, peaking at **−3 dBFS** — roughly **15 dB above anything else in the game.**
3. 2 seconds of a ringing high-pass tail, as if the player's ears are recovering.
4. Ambient returns **6 dB quieter than before** and stays there until the wave ends.

Once per night, maximum. Twice with the Squeaker. It fires only when something has physically
reached the homestead, which means it is never a warning — it is a verdict. The 400ms of silence
before it is the entire trick: the player's nervous system registers the absence before the sound
arrives.

She does not bark at anything else. Not at bosses, not at the Fetch, not at the Drover. Seven
nights of a silent dog is what buys those four hundred milliseconds.

---

## 11. Session and technical constraints

- **≤5 minutes per night.** 3 waves × 55–70s + 12s gaps = 3:45–4:30, leaving headroom. The one
  exception is deep endless: 5-wave nights from Night 20 land near 6 minutes. Acceptable there,
  because by then the player has opted in — but it means **no night may ever require more than one
  uninterrupted sitting**, and the pause-and-resume path has to be exercised at that length.
- **Pause is instant and total** (Space). Auto-pause on tab blur. Save to `localStorage` after every
  wave; resume exactly where it left off.
- **Silent by default** — audio must be explicitly enabled. It is a game played at a desk.
- **60fps in a Chrome tab, no install.**
- React + TypeScript + Vite + PixiJS. Custom shader for the lightmap composite and the mist
  scattering term. Half-resolution lightmap, ≤8 shadow-casting lights, ≤400 simultaneous particles.

---

## 12. Decisions and open questions

### 12.1 Resolved

**Failure and difficulty.** Two modes, §7. Normal replays the failed night and keeps everything
earned; Hard persists homestead damage and accumulates permanent scars. Settled 2026-07-27.

**Life after Night 7.** Endless mode, §8, carrying bond and toys forward. Settled 2026-07-27.

**The Fetch's audio tell.** The copies **do** jingle — but a few milliseconds out of sync with the
real Kara, and very slightly wrong in pitch. Audio is a second and harder confirmation of what her
white paws already told the player, and "Kara is always audible" survives intact. Implementation
note: the offset must be small enough that it reads as *unease* rather than as an obvious tell —
start at 40ms and −15 cents and tune down, not up. Settled 2026-07-27.

**The church bell.** Ships as originally ruled: 65 oil, full 5-second Ear-Perk blackout, revisit
after playtest. The design review proposed softening to 3s; that proposal is noted and waits on
the same playtest — the earlier ruling stands until play says otherwise.

**The 2026-07-27 consultation rulings** (full reasoning in
[redesign-consult.md](redesign-consult.md)):

1. **Spring Line hard lock softened, not cut.** She drifts to water when idle and amplifies it,
   but a plain Send pulls her out — reluctantly, visibly. No bubble tax. (§3.3)
2. **Bright band cut.** Damage bonuses move to the Fiddler and upgrade tiers. (§2.1)
3. **Fiddler simplified to one aura**, the cut tunes becoming his upgrade branches. (§5)
4. **Hold moved from Bond T2 to the Rope toy**; bond simplifies to four tiers. (§3.4, §4)
5. **Income floor**: 25 oil/wave guaranteed, kills accelerate rather than gate. (§9)
6. **Flat-core falloff** replaces the `^1.6` exponent; authored radius ≈ delivered. (§2.2)
7. **Retry keeps stash, not bond** — closes the deliberate-failure bond farm. (§7.1)

Also adopted as roadmap: the consult doc's **build order** (feel week first — fast-forward, wave
preview, hit feedback, falloff — then economy, then the roster split, then Kara's actives) and
its **positioning**: the hook is the dog, the light is the terrain, the horror is the amplifier.

### 12.2 Still open

1. **Should Kara's fetching default to on or off?** On teaches the tradeoff by making the player
   feel her absence; off risks them never finding the toggle. Leaning on, with the toggle
   surfaced explicitly the first time she leaves position mid-wave.
2. **Does Hard mode need a scar preview?** Showing the player which scar is next may create useful
   dread, or may just make the mode feel scripted. Cheap to try both.
3. **Endless boss modifiers need a blocklist.** Some stacks are likely unwinnable rather than
   hard — a salt-leaping, lantern-snuffing boss in 0.95 fog has no counterplay left. Enumerate
   after the first playable endless run.
4. **Is 25s Down too long for a five-minute night?** It is the doc's own number, but on a ~60s wave
   it removes her for nearly half of it, and two Bone Dogs put her there in 3.8s. Watch whether
   going Down reads as a mistake the player made or as the night being taken away from them.
5. **Is `KARA.healPerWave = 25` right, or should she heal fully between waves?** Invented in the
   counterplay pass because nothing else can heal her yet (§3.1). Full healing removes the
   consequence; none at all reintroduces a death spiral. 25 is a guess that needs a session.
6. **Night 5's boss.** The Greenbrier Ghost is real West Virginia folklore (Zona Heaster Shue,
   1897) and is settler history rather than sacred tradition, which is why it is used here.
   Several obvious alternatives for this slot — the Raven Mocker and the Wampus Cat among them —
   are Cherokee, drawn from living religious tradition rather than ghost stories. If the game
   reaches for those, it should be with Cherokee consultation rather than a folklore wiki. Flagged
   here so the decision is made deliberately rather than by whoever writes Night 5.

---

## 13. What to build first

In order, because each step is only testable once the prior one works:

1. **The lightmap and the three bands.** Nothing else can be evaluated until light is real. *(The
   skeleton already has this.)*
2. **Lantern + Road Walker.** The minimum loop that proves light-gated damage is fun rather than
   merely clever.
3. **Kara's Send, Ear-Perk, and Show Belly.** The core of her; enough to know whether commanding a
   dog is satisfying.
4. **The spring line and its scattering.** The first real combo, and the first thing that will need
   heavy tuning.
5. **One full night, end to end,** with the bark. Ship nothing else until the bark lands.
6. **The seven nights and the two difficulty modes.** Normal first — Hard's scar system only makes
   sense once the nights it degrades actually exist.
7. **Endless.** Last, deliberately. Its escalation curve can only be tuned against a campaign that
   has already been balanced, and building it earlier would mean tuning it twice.
8. Everything else.
