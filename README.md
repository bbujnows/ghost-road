# Ghost Road

An Appalachian folk-horror tower defense. Seven nights defending a homestead at the end of an
abandoned logging road, with a dog named Kara.

## Status

**Skeleton. There is no game here yet.**

What exists is the stack wired up and running: Pixi mounted inside React, the render layering
established, and a working lightmap you can walk Kara around in. Click to move her, Space to
pause.

The design brief lives in [docs/design-prompt.md](docs/design-prompt.md) and has not been run
yet. Enemies, wards, waves, the economy, the bosses, and all balance come out of that document —
not out of the code. See [CLAUDE.md](CLAUDE.md) before adding anything.

## Run it

```
npm install
npm run dev
```

## Why the layering matters

Kara is a gold Lab/pit mix with white paws, belly, and chest. Her body renders under the
darkness overlay and goes dark with everything else; her white markings render above it. Walk
her off the lit road and she becomes four pale paws and a chest moving through the black.

That effect is the reason the render layering is `scene → lightmap (multiply) → foreground`, and
it is the one design-driven decision already baked into the skeleton.
