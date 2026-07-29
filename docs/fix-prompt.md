# Prompt — Ghost Road, corrective design pass

*Written 2026-07-29, after the consult's build order (steps 1–8) was completed and after the first
recorded play session. Paste this whole file as the instruction.*

---

## Your role

You are three people at once, and the tension between them is the point:

- **A game theorist.** You reason about dominant strategies, degenerate equilibria, information
  asymmetry, and whether a decision is actually a decision. When a choice has a strictly better
  option you say so and prove it. You care whether the player's information is sufficient to make
  the choice the designer thinks they are making, and whether a period of play contains any
  decision at all.
- **A tower defense designer** who has shipped several. You know why Kingdom Rush's waves feel
  authored and BTD6's feel generated; why Defense Grid's mazing is load-bearing and PvZ's lanes are;
  why Orcs Must Die's active verbs raise the floor of a bad build. You benchmark against real games,
  by name, with specifics.
- **A graphics designer working only with what this repo and Claude can actually reach.** No image
  generation, no raster asset pipeline, no paid tools, no external CDN (a strict CSP blocks it). What
  you *do* have: procedural vector drawing in PixiJS 8, SVG, CSS, canvas, the existing bloom and
  lightmap passes, colour and value theory, and the Canva connector for mockups and references. Every
  visual recommendation must be buildable by an agent editing TypeScript in this repo.

Write as one voice. Do not label which hat a paragraph is wearing.

---

## The product, and what may not change

Ghost Road is an Appalachian folk-horror tower defense played in short breaks during a workday. The
player defends a homestead at the end of an abandoned logging road across seven nights.

**Non-negotiable. Anything that violates one of these is not a proposal, it is a different game:**

1. **Kara is the centrepiece, not a bonus unit.** She is the player's real dog. Agreed positioning:
   *the tower defense where you watch the dog, not the road.*
2. **Every ability Kara has must trace to something the real dog actually does.** Labrador retriever
   / pit bull mix, gold with white from all four paws up her belly and chest to her throat. Floppy
   ears. Silent except territorial at home. Loves bubbles, balls, stuffed toys, being under blankets.
   Attacks water from a hose. Rolls constantly on her back when playing. **If a mechanic does not
   trace to a real trait, it does not belong to her.**
3. **She can be hurt and never permanently lost.** Her *absence* is the cost. No permadeath, ever.
4. **Her damage is zero.** The moment she becomes a gun she becomes a tower and the positioning dies.
5. **Sessions five minutes or less**, pausable instantly, resumable.
6. **Light gates damage.** Dark (<0.15) invisible and untouchable, Dim (0.15–0.35) visible and
   unkillable, Lit (≥0.35) damageable. Kara is the sole exception — she works in the dark.
7. **60fps in a browser tab, no install.**

---

## What is built

Read `CLAUDE.md`, `docs/design-doc.md`, and `docs/redesign-consult.md` first. `src/game/balance.ts`
holds every tuned number with a citation to the section that decided it.

Three bands with flat-core falloff · a split roster (Lantern Post gives light and deals nothing,
Cold Iron deals damage and only inside light) · ward upgrades, two branches × two tiers,
branch-exclusive · Kara's Send, Ear-Perk, Show Belly, Bubbles, Blanket, Hold, HP and a Down state ·
enemies Road Walker, Crawler, Tallow Man, Bone Dog, The Unseen · bosses Bell Witch, Greenbrier
Ghost, The Drover · seven nights with per-night fog and wind · a four-toy loadout · the Nightly Road
· the Long Road · `localStorage` progress.

Deferred and named as such in the docs: the bark, bond, the ball stash, Hard-mode scars, the
remaining five wards, three blocked bosses, **all audio**.

---

## Evidence: the first recorded session

A 10:22 screen recording of the current build was sampled at 20-second intervals across the whole
session, plus 3-second intervals around two events. The player got through Night 2 into Night 6 and
also played a Nightly Road.

**Important limitation, and you should weigh it.** These are still frames. They cannot show
animation quality, game feel, reaction windows, or decisions-per-minute. Nothing below about *pacing
or feel* is established — only what a frame can prove. Where you need motion, say so and say what
you would look for.

### What the frames establish

**V1 — Wind is a total blackout, not a decision.** Night 5 (fog 50%, gust every 22s): the HUD reads
`6 lanterns out · 4s` and **the entire map is dark except the cabin.** Seven enemies are on the road
and none is visible or damageable. There is no action available during it. A gust hits every
non-Storm lantern *simultaneously*, so it is a global metronome rather than a problem to solve, and
the intended answer — Storm Glass — costs 15 oil per lantern across six-plus lanterns and only
*halves* the duration at tier 1. This is the single most damaging thing in the recording.

**V2 — Enemies render on top of the homestead.** On Night 6, hooded Road Walkers stand at roof
height and in front of the cabin wall, drawing above it. Enemies are added to `scene` after the
world is built, so z-order puts them over the building they are attacking. It reads as broken.

**V3 — The road is the brightest terrain on screen and reads as a wooden boardwalk.** In a game
whose premise is that darkness hides things, the terrain glows — a pale tan ribbon visible end to
end at every fog level, more prominent than anything except the cabin. It also does not read as an
abandoned dirt logging road.

**V4 — Kara is roughly 30px and the hardest actor on screen to find.** The positioning is *watch the
dog, not the road*, and the dog is the least visible thing in the frame. In several samples she
cannot be located without knowing where to look.

**V5 — Kara and the Bone Dog are confusable at a glance.** Same size, same four-legged silhouette,
seen adjacent on Night 4. The design intends this as foreshadowing for the Fetch, but at 30px in a
dark scene it may simply be unreadable rather than tense.

**V6 — The placement preview over-promises.** A hard bright ring at the dim radius is far more
visually prominent than the soft gradient pool a placed lantern actually delivers, so every purchase
looks smaller than the preview promised.

**V7 — Night 6 compounds into a spiral.** Starting oil cut to 60, fog 60%, gusts every 26s. Observed
state: **5 oil, one lantern on the entire map, 13 enemies incoming, homestead falling from 82 to 27
within the sampled window.** The income floor exists but does not keep pace with what the night
removes. Whether this is difficulty or a broken night is your call, but it is not obviously the
former.

**V8 — The board is mostly empty dark space.** With 7–13 enemies "on the road", frames routinely
show none of them. This is the light rule working as designed; it is also long stretches with
nothing to look at, and it interacts badly with V1 and V4.

**V9 — The HUD is large, static, and permanently occupies both bottom corners.** A nine-row control
legend is pinned on screen for the whole session.

### What the frames cannot settle, and I suspect anyway

- **The game is completely silent and the bark is unbuilt.** The design's emotional payload is one
  bark, at most once per night, when something reaches the porch — the entire audio mix exists to
  make that sound land. There is no audio at all. This may be the most valuable unbuilt thing.
- **Two wards is not a roster.** The split fixed *what* a purchase does; there is still exactly one
  light ward and one damage ward.
- **Ear-Perk may be unlearnable.** It is the primary tell and deliberately unsurfaced. Night 3's Bell
  Witch attacks it by making it lie — which does nothing to a player who never learned to read it.
- **Decisions-per-minute is unverified.** Target 7–9 mid-wave; the arithmetic only clears it if every
  ability is spent off cooldown.

Treat all of this — the V-list included — as a hypothesis list to be confirmed, corrected, or
overturned. **If you think the ranking is wrong, say so first.**

---

## What I want from you

A document at `docs/fix-plan.md`. Structure it however serves the argument, but it must contain:

1. **A ranked diagnosis**, most damaging first, separating *fatal* (the game does not work) from
   *structural* (it works and is shallow) from *tuning* (a number is wrong). For each, the evidence
   you would accept as disproof. Say which of V1–V9 you are rejecting and why.
2. **A concrete fix for each**, specified tightly enough to implement without a second conversation:
   real numbers, real file names, real formulas. For V1 specifically, I want the design that turns
   wind from a global debuff into a decision.
3. **A visual direction pass** — palette, value structure, silhouette rules, motion language, and the
   feedback events that currently have no visual at all. Constrained to procedural PixiJS/SVG/CSS.
   Address V3, V4 and V5 directly. Include at least one change that is cheap and transforms
   perceived quality.
4. **A cut list.** Name what should be removed or left unbuilt, with reasons. A pass that only adds
   is not a design pass.
5. **A build order**, cheapest-and-highest-leverage first, marking which items are blocked on a
   playtest with sound and motion rather than frames.
6. **The five questions only a played session can answer**, each with the specific observation that
   settles it.

---

## How to work

- **Measure before asserting.** This repo's tuning has been derived by simulation, and simulation has
  caught four errors that reasoning missed — flat-core falloff quietly hollowed out three separate
  threshold-based levers, and a five-wave endless night ran 6:41 against a five-minute budget. It
  also *failed* to catch V1 and V2, which needed a recording. Know which tool answers which question.
  Write and run a script when a number is in doubt, and say what you measured.
- **To run repo TypeScript under Node**, bundle first:
  `npx esbuild src/game/x.ts --bundle --format=esm --platform=node --outfile=<tmp>.mjs`. Do not
  scrape source with regex to reach tuning tables; that has silently produced wrong numbers twice.
- **Do not invent content the design doc already decides.** Build to the doc's numbers. If something
  is in neither doc nor code, it has not been decided — flag it rather than filling it.
- **Cite sections.** `balance.ts` is a transcription of the design doc and they must not drift.
- **Be blunt.** The last consult opened with *"this is a strong theme and an honest lighting sim
  sitting on top of a tower defense that does not yet exist,"* and that sentence was worth the whole
  document. If something is bad, lead with it.
- **Respect the constraints above absolutely.** A recommendation that gives Kara damage, adds
  permadeath, or pushes a night past five minutes is to be rejected — do not spend a paragraph on it.
