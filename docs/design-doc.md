# Ghost Road — Design Document

**Version 1.0 · 2026-07-27**

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
| **Lit** | `0.35 ≤ L < 0.75` | Enemies are damageable. Wards deal listed damage. |
| **Bright** | `L ≥ 0.75` | Damageable, and wards deal **+25% damage**. Rewards deliberately overlapping two lanterns rather than spreading them evenly. |

Ambient moonlight is `L = 0.08` everywhere — permanently below the Dark threshold. The moon is
atmosphere, never a solution.

### 2.2 Accumulation and falloff

Per light source `i` at distance `d`:

```
contribution_i = intensity_i × (1 − clamp(d / radius_i, 0, 1))^1.6
L = min(1, Σ contribution_i) × (1 − 0.5 × fogDensity)
```

The `^1.6` exponent gives a hot core and a long soft tail, so a lantern reads as a pool rather
than a spotlight. Fog is a straight multiplier on the total — on Night 5 at `fogDensity = 0.6`,
every light in the game loses 30% of its value, which is a global difficulty lever that costs
nothing to implement and reads instantly to the player.

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
the final 0.4s. It does **not** cast shadows — it is a reflection off her belly, and making it
shadowless both reads as softer and keeps it off the 8-light shadow budget. A cluster of Dim-band
enemies is pushed into Lit for the duration. This is the game's manual burst window.

**Hose mist.** The spring line is a weak light on its own (`intensity 0.20, radius 110` — Dim, never
Lit). Its real function is **scattering**: any lantern whose radius overlaps the mist volume gets
`radius × 1.35` and `+0.15 intensity` *within the mist*. A lantern beside a hose lights far more
road than a lantern anywhere else. This is the game's central ward combo, and it is why the hose is
priced like a lantern despite dealing no damage.

**Bubble glow.** Each bubble is a moving light: `intensity 0.22, radius 55, lifetime 5s`. Alone it
is Dim — it reveals, it does not damage. **But a bubble drifting through hose mist is boosted to
`0.40`**, which crosses the Lit threshold. A bubble trail laid through a mist curtain is a moving
damage-enabling corridor. This was not designed in; it fell out of the scattering rule, and it is
worth keeping.

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

### 3.2 Command set

| Command | Input | Cooldown | Cost / catch |
| --- | --- | --- | --- |
| **Send** | Right click | — | Free. She walks; she does not teleport. |
| **Bubbles** | `B` + click | 6s, 3 charges, +1 charge per 8s | The only reliable way to break the hose lock. |
| **Show Belly** | `X` | 14s (11s at T3+) | 1.4s flash + 0.8s getting up. Takes **2× damage** and accepts no commands for the full 2.2s. |
| **Blanket** | `Z` | — | Minimum 3.0s under. Calling her out then takes `3.0 − 0.4 × bondTier` seconds (floor 1.0s) of coaxing. |
| **Hold** | `H` | 20s | Unlocked at Bond T2. Plants her; enemies within 90px are slowed 35% and cannot pass. Max 8s. She takes damage the whole time. |
| **Throw ball** | `T` when she drops one | — | +3 bond, but she is out of position ~4s fetching. |
| **Lead** | `L` | Once per night | Unlocked at Bond T5, usable Night 7 only. Fog → 0 within 300px of her for 12s. |

**The Bark is not a command.** It fires automatically, at most once per night, when something
physically reaches the homestead. See §8.

**Ear-Perk is not a command either.** It is a readout. She lifts her ears and orients toward the
nearest threat within radius, 2.0s before it becomes visible. From **Night 5**, one perk in six is
a false positive with nothing behind it — she is reacting to something the player will never see.
This is a horror beat and a deliberate erosion of the player's most reliable instrument.

### 3.3 The hose lock

While Kara is within `0.5 × barrier radius` of an active spring line she enters **Play**:

- Barrier radius × 1.3
- She heals **8 HP/s** and any curse effect is cleansed
- Bond +0.5/s (capped at +6 per night)
- **She will not respond to Send.** Only a bubble pulls her out, or the blanket call.

Her happiest animation is a soft trap. The player will place a hose to win a lane and then spend a
bubble charge every wave getting her out of it.

### 3.4 Bond

Bond runs 0–100 across the campaign.

| Tier | Bond | Unlock |
| --- | --- | --- |
| T0 | 0–14 | — |
| T1 | 15–29 | Ear-Perk radius 280 → 350 |
| T2 | 30–49 | **Hold** |
| T3 | 50–69 | Show Belly cooldown 14s → 11s; blanket coaxing −0.4s/tier |
| T4 | 70–89 | Down recovery 25s → 12s |
| T5 | 90–100 | **Lead** |

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

One toy per night, chosen before the night starts. Toys are unlocked with stash (§7) and persist —
choosing is a per-night build decision, not a purchase.

| Toy | Effect | Stash cost |
| --- | --- | --- |
| **Ragged Fox** (her favorite) | Bond gain ×1.5 for the night | Starting |
| **Tennis Ball** | Ball drops +50% more often; +2 stash per retrieve | Starting |
| **The Squeaker** | Bark alarm may fire **twice** this night; Ear-Perk lead time 2.0s → 2.2s | 8 |
| **The Rope** | Hold duration 8s → 13s; Hold slow 35% → 50% | 12 |
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
| **Lantern Post** | 30 | `intensity 0.85, radius 150`. Deals **14 damage / 0.55s** to one Lit target in radius. The only damage source that scales. |
| **Salt Line** | 20 | Not a light. A drawn segment up to 140px. Crossing costs 25 damage and 50% slow for 2s. **Depletes after 6 crossings.** Works in full dark. |
| **Church Bell** | 65 | One per map. Activated, 45s cooldown. Staggers every enemy on screen 2.5s and forces them to Dim band for 6s. |
| **Fiddler** | 55 | Porch-bound. 260px aura, three switchable tunes (8s to change). Flees if an enemy comes within 120px. |
| **Spring Line** | 45 | Running water. 110px barrier enemies path around. Scatters lantern light (§2.5). Heals and traps Kara. |

**Lantern upgrades:** Oil Lamp (+25 oil) → `radius 190, damage 18`. Storm Lantern (+35 oil) → same,
plus immunity to wind-snuff, which matters from Night 4 onward.

**Fiddler tunes:** *Cold Frost Morning* (+25% ward damage) · *Wayfaring Stranger* (+30% light
radius) · *Shady Grove* (Kara +40% move speed, +2 bond/min).

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

## 7. The ball stash economy

Two currencies, deliberately separated so that in-night tactics and between-night progression never
compete for the same pool.

**Lamp oil** — in-night only, does not carry over.
- Starting oil: Night 1 = 90, rising to 150 by Night 5, then **cut to 90 on Night 6**.
- +6 per enemy killed in the Lit band. +2 per enemy killed by salt.
- The differential is intentional: salt is the cheap answer to a dark lane, and it keeps you poor.

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

## 8. Audio

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

## 9. Session and technical constraints

- **≤5 minutes per night.** 3 waves × 55–70s + 12s gaps = 3:45–4:30, leaving headroom.
- **Pause is instant and total** (Space). Auto-pause on tab blur. Save to `localStorage` after every
  wave; resume exactly where it left off.
- **Silent by default** — audio must be explicitly enabled. It is a game played at a desk.
- **60fps in a Chrome tab, no install.**
- React + TypeScript + Vite + PixiJS. Custom shader for the lightmap composite and the mist
  scattering term. Half-resolution lightmap, ≤8 shadow-casting lights, ≤400 simultaneous particles.

---

## 10. Open questions

1. **Does the Fetch need an audio tell?** Her collar tags would give the copies away instantly, and
   silent copies contradict "Kara is always audible." Current lean: the copies jingle too, but
   fractionally out of sync. Needs playtesting more than argument.
2. **Is the bell's 5s ear-deafening too punishing at 65 oil?** It may make the bell a trap purchase
   rather than a tradeoff. Watch whether players buy it twice across a campaign.
3. **Should fetching default to on or off?** On teaches the tradeoff by making the player feel her
   absence. Off risks them never discovering the toggle.
4. **Night 5's boss.** The Greenbrier Ghost is real West Virginia folklore (Zona Heaster Shue, 1897)
   and is settler history rather than sacred tradition, which is why it is used here. Several
   obvious alternatives for this slot — the Raven Mocker and the Wampus Cat among them — are
   Cherokee, drawn from living religious tradition rather than ghost stories. If the game reaches
   for those, it should be with Cherokee consultation rather than a folklore wiki. Flagged here so
   the decision is made deliberately rather than by whoever writes Night 5.

---

## 11. What to build first

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
6. Everything else.
