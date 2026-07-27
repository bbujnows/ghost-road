# Ghost Road

An Appalachian folk-horror tower defense. Seven nights defending a homestead at the end of an
abandoned logging road. **Kara — a gold Labrador/pit mix with white paws, belly, and chest — is
the centerpiece of the design, not a bonus unit.**

## Status: §13 steps 1–2 built

Playable: the light bands, one Lantern Post, Road Walkers, Night 1's three waves, lamp oil,
homestead HP, and Normal-mode retry. Kara is on the board and walks, but **has none of her
abilities yet** — those are step 3.

Not built: every other ward, every other enemy, fog, bond, stash, toys, nights 2–7, Hard mode,
endless, audio. Do not add them ahead of the build order in §13 of the design doc.

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

The build order is in §13 of the design doc. Next step is a lantern and a Road Walker.

## The two rules everything will hang off

1. **Light gates damage.** Enemies are only damageable inside lit areas. Ward placement is a
   lighting puzzle, not a DPS problem. Anything that changes what is lit is a major ability.
2. **Kara is the exception.** She operates in the dark. That is the entire reason she matters,
   and no other unit should get that property.

## Kara

Every ability she gets must come from something the real dog actually does. If a proposed
mechanic does not trace back to a real trait, it does not belong to her.

| Real trait | Ability (specified, not yet built) |
| --- | --- |
| Silent except territorial at home | **The Bark** — silent all game; one bark means something reached the porch. Once per night, maximum. |
| Floppy ears | **Ear-Perk** — hearing-cone detection, tells ~2s before a threat is visible |
| Rolls on her back when playing | **Show Belly** — white belly up, reflected light burst; vulnerable while down |
| Attacks water from a hose | **The Spring Line** — running-water ward (real folklore: spirits can't cross it); she amplifies it and is healed by it, but won't leave on her own |
| Loves bubbles | **Bubbles** — instant lure, drags a faint light trail; the only reliable way to pull her off the water |
| Loves balls | **The Ball Stash** — retrieval hoard under the porch, between-night currency |
| Loves stuffed toys | **Toy Loadout** — one toy per night, each a different passive |
| Loves being under blankets | **Blanket** — hidden and untargetable; stays under longer than you want |

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
  lighting.ts   the lightmap, the four bands, lightAt() and radiusForThreshold()
  enemies.ts    RoadWalker only
  wards.ts      Lantern only
  kara.ts       Kara's appearance and walking. None of her abilities.
  world.ts      placeholder scene geometry, plus the road polyline (load-bearing)
src/ui/         React HUD overlay, pointer-events: none
```

**Rendering layers, in order:** `scene` → `lighting.overlay` (multiply) → `foreground`.
Anything that must stay visible in the dark goes in `foreground` — that is where Kara's white
markings live, and why she reads as four pale paws moving through the black. This is the one
architectural decision already made, and it is the reason the skeleton is worth keeping.

`LightingSystem.lightAt(x, y)` is an analytic CPU evaluation of the same falloff the gradient
texture encodes. Gameplay queries it; the GPU lightmap is never read back. They are kept honest by
generating the gradient's colour stops from `FALLOFF_EXPONENT` — change the exponent and both move.

**A light's `radius` is not its pool size.** At the doc's falloff a lantern (`radius 150,
intensity 0.85`) is Lit only to 77px and invisible past 118px. Use `radiusForThreshold()` for
anything player-facing; never draw the raw radius.

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

## Gotchas

- `erasableSyntaxOnly` is on in the TS config, so **constructor parameter properties do not
  compile**. Declare fields explicitly and assign in the constructor.
