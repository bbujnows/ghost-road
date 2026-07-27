# Ghost Road

An Appalachian folk-horror tower defense. Seven nights defending a homestead at the end of an
abandoned logging road. **Kara — a gold Labrador/pit mix with white paws, belly, and chest — is
the centerpiece of the design, not a bonus unit.**

## The two rules everything hangs off

1. **Light gates damage.** Enemies are only damageable inside lit areas. Ward placement is a
   lighting puzzle, not a DPS problem. Anything that changes what is lit is a major ability.
2. **Kara is the exception.** She operates in the dark. That is the entire reason she matters,
   and no other unit should get that property.

## Kara

Every one of her abilities comes from something the real dog actually does. Keep it that way —
if a new mechanic does not trace back to a real trait, it does not belong to her.

| Real trait | Ability |
| --- | --- |
| Silent except territorial at home | **The Bark** — she makes no sound all game; one bark means something reached the porch. Once per night, maximum. |
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

## Architecture

```
src/game/
  Game.ts       orchestrator — ticker, waves, input, HUD state bridge
  lighting.ts   the lightmap (RenderTexture + multiply overlay) and lightAt() queries
  kara.ts       Kara: state machine, commands, rendering
  enemies.ts    haint kinds, road pathing, light-gated damage
  wards.ts      Lantern, SpringLine, Bubble
  world.ts      background/road/homestead geometry
  nights.ts     wave and night definitions (data only)
src/ui/         React HUD overlay, pointer-events: none
```

**Rendering layers, in order:** `scene` → `lighting.overlay` (multiply) → `foreground`.
Anything that must stay visible in the dark goes in `foreground` — that is where Kara's white
markings live, and why she reads as four pale paws moving through the black.

`LightingSystem.lightAt(x, y)` is a cheap analytic approximation of the rendered lightmap. Gameplay
queries it; the shader never gets read back. If you change the gradient falloff, change both.

## Status

Playable skeleton. Real: the lightmap, light-gated damage, Kara's commands, running water,
wave spawning. **Not yet:** hand-painted art (all geometry is flat vector stand-in), audio,
the toy loadout, the ball-stash economy between nights, bond unlocks (Hold / Lead), nights 4-7,
and the folklore bosses.

The full design brief is in [docs/design-prompt.md](docs/design-prompt.md).

## Commands

```
npm run dev      # vite dev server
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

Node is installed per-user via winget; if `npm` is blocked in PowerShell, run it through
`cmd /c "set PATH=%PATH%;<node-dir>&& npm ..."`.

## Controls

`1`/`2` select ward · left click place · right click send Kara · `B` bubbles · `X` show belly ·
`Z` blanket · `Space` pause
