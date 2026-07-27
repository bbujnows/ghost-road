# Ghost Road

An Appalachian folk-horror tower defense. Seven nights defending a homestead at the end of an
abandoned logging road, with a dog named Kara.

Enemies are only damageable inside lit areas, so placing lanterns is a lighting puzzle rather
than a DPS problem. Kara is the exception — she works in the dark, which is the entire reason
she matters.

## Run it

```
npm install
npm run dev
```

## Controls

| Input | Action |
| --- | --- |
| `1` / `2` | Select ward (Lantern Post / Spring Line) |
| Left click | Place selected ward |
| Right click | Send Kara |
| `B` | Bubbles — she chases instantly |
| `X` | Show Belly — white belly up, light burst, vulnerable while down |
| `Z` | Blanket — hidden and untargetable |
| `Space` | Pause |

Watch her ears, not the road. She lifts them about two seconds before anything becomes visible.
She is silent all game — if she barks, something has already reached the porch.

## Status

Playable skeleton. The lightmap, light-gated damage, Kara's command set, running water, and wave
spawning are real. Art is flat vector stand-in geometry, and there is no audio yet.

See [CLAUDE.md](CLAUDE.md) for architecture and [docs/design-prompt.md](docs/design-prompt.md)
for the full design brief.
