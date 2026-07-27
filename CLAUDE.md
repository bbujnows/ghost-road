# Ghost Road

An Appalachian folk-horror tower defense. Seven nights defending a homestead at the end of an
abandoned logging road. **Kara — a gold Labrador/pit mix with white paws, belly, and chest — is
the centerpiece of the design, not a bonus unit.**

## Status: skeleton, design doc complete

The code is still a skeleton — it mounts Pixi inside React, establishes the render layering, and
demonstrates the lightmap. **There is no gameplay in it yet.**

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
  Game.ts       Pixi mount, render layering, ticker, input plumbing. No gameplay.
  lighting.ts   the lightmap (RenderTexture + multiply overlay) and lightAt() queries
  kara.ts       Kara's appearance and walking. None of her abilities.
  world.ts      throwaway placeholder scene so the lightmap has a surface
src/ui/         placeholder React HUD overlay, pointer-events: none
```

**Rendering layers, in order:** `scene` → `lighting.overlay` (multiply) → `foreground`.
Anything that must stay visible in the dark goes in `foreground` — that is where Kara's white
markings live, and why she reads as four pale paws moving through the black. This is the one
architectural decision already made, and it is the reason the skeleton is worth keeping.

`LightingSystem.lightAt(x, y)` is a cheap analytic approximation of the rendered lightmap.
Gameplay queries it; the shader is never read back. If you change the gradient falloff in
`radialGradient()`, change `lightAt()` to match or they will disagree.

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
