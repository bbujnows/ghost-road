# Ghost Road

An Appalachian folk-horror tower defense. Seven nights defending a homestead at the end of an
abandoned logging road. **Kara — a gold Labrador/pit mix with white paws, belly, and chest — is
the centerpiece of the design, not a bonus unit.**

## Status: build order steps 1–5 built

The roadmap in use is **§9 of [docs/redesign-consult.md](docs/redesign-consult.md)**, adopted
2026-07-27, which supersedes §13 of the design doc.

Playable: the three light bands · the split roster (Lantern Posts give light and deal nothing, Cold
Iron deals damage and only inside light) · the income floor · fast-forward · Kara's Send, Ear-Perk,
Show Belly, Bubbles and Blanket, her HP and her Down state · the counterplay roster (Road Walker,
Crawler, Tallow Man, Bone Dog) · Night 1's three waves, lamp oil, homestead HP, Normal-mode retry.

Next: **step 6** — upgrade branches (2 branches × 2 tiers per ward) and the toy roster, with Hold
living on the Rope toy.

Not built: the other wards (salt, bell, spring line, bottle tree, fiddler), the other enemies, fog,
bond, stash, toys, nights 2–7, Hard mode, endless, audio. Do not add them ahead of the build order.

⚠ **Night 1 is currently a proving ground, not the shipping Night 1.** Every enemy from the
counterplay pass is folded into it so they can be played at all; the real Night 1 is walkers plus
the Tallow Man as boss. See the callout in design doc §6.

**`src/game/balance.ts` holds every number the doc specifies**, each citing its section. Change a
value there and change it in the doc too — the doc is the source of truth, that file is its
transcription. If a number is in neither, it has not been decided; ask rather than invent.

**[docs/design-doc.md](docs/design-doc.md) is the source of truth for everything else** — the
light bands, Kara's commands and cooldowns, the toy list, the wards, the seven nights and their
bosses, the two difficulty modes, endless mode, the stash economy, and the audio design. It has
numbers. Build against them and change them by editing that document, not by inventing
alternatives in code.

> An earlier pass at this repo made up an enemy roster, ward costs, damage numbers, and a night
> structure *before* the design existed, and all of it was thrown away. If something is not in
> the design doc, it has not been decided — ask rather than invent.

## The two rules everything hangs off

1. **Light gates damage.** Enemies are only damageable inside lit areas. Ward placement is a
   lighting puzzle, not a DPS problem. Anything that changes what is lit is a major ability.
2. **Kara is the exception.** She operates in the dark. That is the entire reason she matters,
   and no other unit should get that property.

## Kara

Every ability she gets must come from something the real dog actually does. If a proposed
mechanic does not trace back to a real trait, it does not belong to her.

| Real trait | Ability | Built |
| --- | --- | --- |
| Floppy ears | **Ear-Perk** — she lifts them ~2s before a threat becomes visible, and turns to face it | ✅ |
| Rolls on her back when playing | **Show Belly** — white belly up, reflected light burst; 2× damage taken and no orders for 2.2s | ✅ |
| Loves bubbles | **Bubbles** — she chases at 180px/s; her blink. The bubble is a drifting light that reveals and never kills | ✅ |
| Loves being under blankets | **Blanket** — untargetable and blind; she will not come out for 3s and takes 3 more to coax | ✅ |
| Territorial at home | **Squaring up** — she runs the Tallow Man off a lantern without a sound | ✅ |
| Silent except territorial at home | **The Bark** — silent all game; one bark means something reached the porch. Once per night, maximum. | ❌ |
| Attacks water from a hose | **The Spring Line** — running-water ward (real folklore: spirits can't cross it); she amplifies it and is healed by it | ❌ |
| Loves balls | **The Ball Stash** — retrieval hoard under the porch, between-night currency | ❌ |
| Loves stuffed toys | **Toy Loadout** — one toy per night, each a different passive | ❌ |

**Her damage stays zero.** The moment she becomes a gun she becomes a tower, and the position — *the
tower defense where you watch the dog, not the road* — dies with it. She changes what is killable,
where things go, and what the player knows. Nothing else.

**She is never permanently lost.** Injury sends her to the porch to recover, leaving the player
blind for a stretch. The tension is losing her presence for a wave, not losing her. Do not add a
permadeath mode.

## Design constraints

- Sessions **5 minutes or less**, pausable at any moment (Space), state resumable.
- Silent by default. The audio mix exists to make her one bark land.
- 60fps in a Chrome tab, no install.

## What is actually in the repo

```
src/game/
  balance.ts    every doc-specified number, each citing its section
  Game.ts       orchestrator — waves, oil, homestead HP, input, HUD state bridge
  lighting.ts   the lightmap, the three bands, lightAt() and radiusForThreshold()
  enemies.ts    Enemy base class + RoadWalker, Crawler, TallowMan, BoneDog, Corpse
  wards.ts      Lantern (pure light, snuffable) and ColdIron (damage, only in light)
  kara.ts       her dual rig, her state machine, and every ability she has
  bubbles.ts    the drifting lights she chases
  atmosphere.ts bloom, motes, hit embers, oil wisps, vignette
  world.ts      the cabin and the road polyline (load-bearing)
src/ui/         React HUD overlay, pointer-events: none
```

**Rendering layers, in order:** `scene` → `lighting.overlay` (multiply) → `bloom.output` →
`foreground` → `vignette`. Anything that must stay visible in the dark goes above the overlay —
that is where Kara's white markings live, and why she reads as four pale paws moving through the
black.

**Kara's rig is built twice.** `createRig()` runs once for the coat (under the darkness overlay,
goes dark with everything else) and once for the white markings (above it, never taken by the dark),
and `poseRig()` applies identical transforms to both every frame. Both rigs must be posed or she
comes apart. Rig-local `y = 0` is the ground and her paws rest on it; the white belly band must be
drawn *inside* the torso's lower edge or it reads as a detached bar hanging under her.

`LightingSystem.lightAt(x, y)` is an analytic CPU evaluation of the same falloff the gradient
texture encodes. Gameplay queries it; the GPU lightmap is never read back. They are kept honest by
generating the gradient's colour stops from `falloffAt()` — change the curve and both move together.

**A light's `radius` is not its pool size.** Use `radiusForThreshold()` for anything player-facing;
never draw the raw radius. Under flat-core falloff the two are close, which is the point of the
change — but the preview still draws the delivered radii so the promise stays honest if tuning moves.

## Enemies

`Enemy` is an abstract base holding the road-walking, the damage gate, the hit flash and the facing.
Subclasses override `behave()` to move differently and `animate()` to pose. Two structural
interfaces — `Snuffable` and `Quarry` — let the Tallow Man reach lanterns and the Bone Dog reach
Kara without `enemies.ts` importing either module.

- **Damage is typed** (`iron` | `light`) and resists apply *on top of* the band gate, never instead
  of it. Iron is the only live source; the Tallow Man's light resist is declared and inert until a
  light-burn ward ships in step 6.
- **Silhouette carries the read.** In half-light the outline is all the player gets, so the walker is
  tall and narrow, the crawler low and wide, the Tallow Man squat and lumpen, the Bone Dog Kara's
  shape with nothing warm in it and no white anywhere.
- **Nothing may blink out of existence.** A killed enemy hands its container to a `Corpse` and falls
  from the pose it died in. A kill the player cannot watch happen reads as a bug — it did, once.

## Commands

```
npm run dev      # vite dev server
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

Node is installed per-user via winget; if `npm` is blocked in PowerShell, run it through
`cmd /c "set PATH=%PATH%;<node-dir>&& npm ..."`.

If a fresh `npm install` produces `lightningcss ... is not a valid Win32 application`, the
native binary downloaded corrupt. Fix with `npm install lightningcss-win32-x64-msvc --no-save`.

## UI rules

- **Every overlay that stops play must carry a visible button out.** The tab auto-pauses on blur,
  so the player can land on an overlay without having pressed anything — "press Space" is a
  shortcut for people who already know it, never the exit. Use the `Curtain` component in
  `src/ui/Hud.tsx`, which enforces title + action button + optional keyboard hint.
- **Escape always means "get me out of this overlay."**
- **While the board is frozen, clicks must not reach it.** `Game.inputLocked` gates pointer input;
  without it you can spend oil on a paused game.

## Gotchas

- `erasableSyntaxOnly` is on in the TS config, so **constructor parameter properties do not
  compile**. Declare fields explicitly and assign in the constructor.
- **`as const` infers literal types.** `private charges = BUBBLES.maxCharges` is typed `2`, not
  `number`, and any assignment fails. Annotate `: number` on fields initialised from a balance
  constant.
- **Watch for abilities that let one unit lock a whole enemy out.** Kara staggering the Tallow Man
  had to be made once-per-lantern, or parking her beside a post beat the boss by standing still. Any
  interrupt on a repeating behaviour needs the same check.
- **React StrictMode double-mounts effects**, so `Game.destroy()` can fire while `app.init()` is
  still awaiting. Destroying a half-initialized Pixi Application throws `_cancelResize is not a
  function` and takes the whole React tree down with it — the symptom is a blank page, not a
  visible error. `Game` guards this with `ready`/`disposed` flags; any new async setup in `mount()`
  has to stay behind the same guard.
