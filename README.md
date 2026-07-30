# Ghost Road

**[Play it →](https://bbujnows.github.io/ghost-road/)**

An Appalachian folk-horror tower defense. Seven nights defending a homestead at the end of an
abandoned logging road, with a dog named Kara.

Kara is a real dog. Every ability she has traces back to something she actually does.

---

## The one rule everything hangs off

**Light gates damage.** Anything standing in the dark is invisible and cannot be hurt at all —
not by anything, at any price. Light is not scenery here; it is what makes ground fightable.

| Band | | |
| --- | --- | --- |
| **Dark** | under 0.15 | invisible, untouchable |
| **Dim** | 0.15–0.35 | you can see it, you cannot hurt it |
| **Lit** | 0.35 and up | now you can |

Lantern Posts make light and deal no damage. Cold Iron deals damage and only inside light. You
need both, and where they overlap is where the road bites.

**Kara is the exception.** She works in the dark, and she is the only thing that does — which is
why the game is really about watching the dog rather than the road.

## Controls

| Input | |
| --- | --- |
| `1`–`7` | Choose a ward |
| Left click | Place it, or click one you own to upgrade it |
| `Q` / `E` | Buy an upgrade branch |
| Right click | Send Kara |
| `X` | Show Belly — she rolls over and her white belly lights the ground |
| `B` | Blow a bubble; she chases it |
| `Z` | Under the blanket — untargetable, and blind |
| `T` | Throw the ball she dropped |
| `H` | Hold the line (needs the Rope) |
| `C` | Ring the church bell |
| `G` | Fetching on / off |
| `L` | Lead (the Seventh Night, if you have earned it) |
| `F` | Fast-forward · `Space` pause · `?` help |

**Turn the sound on.** It is off by default and there is one moment in the whole game it exists
for.

## Three ways to play

- **The Seven Nights** — the campaign. Each night adds exactly one thing. Bosses on 3, 5 and 7.
  Choose *Hold the Night* or *The Hollow Remembers*, where the homestead never resets and takes a
  permanent, named scar every time it falls.
- **The Nightly Road** — one seeded night per calendar day, the same for everyone, one attempt, a
  streak. The seed is the date, so it is fixed rather than random.
- **The Long Road** — endless from Night 8, on a road generated fresh for every run. Unlocked by
  holding all seven.

## The documents

The design came first and the code is a transcription of it.

- **[docs/design-doc.md](docs/design-doc.md)** — the whole design. Light, Kara, the wards, the
  seven nights, the economy, the audio.
- **[docs/redesign-consult.md](docs/redesign-consult.md)** — an outside review that found the
  first build was "a strong theme and an honest lighting sim sitting on top of a tower defense
  that does not yet exist", and the roadmap that fixed it.
- **[docs/fix-plan.md](docs/fix-plan.md)** — a corrective pass written against a recording of real
  play. It caught two things no amount of arithmetic had.
- **[CLAUDE.md](CLAUDE.md)** — the architecture, and the gotchas worth knowing before changing
  anything.

`src/game/balance.ts` holds every tuned number with a citation to the section that decided it.

## Run it

```
npm install
npm run dev
```

`npm run build` type-checks and bundles; `npm run lint` runs oxlint. Pushing to `main` deploys.

## Why the layering matters

Kara is a gold Lab/pit mix with white running from all four paws up her belly and chest to her
throat. Her body renders **under** the darkness overlay and goes dark with everything else; her
white markings render **above** it. Walk her off the lit road and she becomes four pale paws
moving through the black.

That is not decoration. It is the rule the whole art direction is built on, and on the night three
copies of her come down the road with no white on any of them, it is the only way to tell which
one is the dog.
