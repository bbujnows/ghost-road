# Ghost Road — Design Prompt

An Appalachian folk-horror tower defense game starring Kara.

Paste the prompt below into Claude to generate the full design doc.

---

Design a folk-horror tower defense game called **Ghost Road**, set in an Appalachian hollow. The player defends a homestead across seven nights as things come up an abandoned logging road.

**Kara the dog is the centerpiece.** She is not a stationary tower — she is the only unit the player directly commands.

**Appearance:** a Labrador retriever / pit bull mix with floppy ears. Warm gold coat, with white running from all four paws up her belly and chest to her throat. This is mechanically meaningful: her gold body absorbs into darkness and fog, but the white catches lantern light and moonlight. At a distance in the dark the player tracks Kara by four pale points of her feet and the blaze of her chest. Her white markings should be the brightest thing in an unlit area and should tint to the nearest light source — warm amber near lanterns, cold blue in moonlight.

**Kara's abilities, all derived from her real personality:**

- **Silence.** Kara does not bark. Not at enemies, not at bosses, not once — the game is quiet where a player expects noise. She is territorial only about home, so **her bark is a one-time-per-night alarm that fires only when something has physically reached the homestead.** It should be the loudest sound in the game and it should scare the player. Design the entire audio mix around making that moment land.
- **Ear-Perk.** Her floppy ears are the detection system. She lifts them and orients toward a threat roughly two seconds before it becomes visible — the game's primary tell. The player learns to watch her ears instead of the road. Late nights, she perks at things that never appear.
- **Show Belly.** Kara flops onto her back and rolls the way she does when she's playing. Her all-white belly turns up and reflects a burst of light across the area, briefly illuminating enemies so the light-dependent wards can hit them. She is vulnerable while she's down. Joyful animation, tactical cost — that contrast is the point.
- **The Hose.** A running-water ward, grounded in the real Appalachian folk belief that spirits cannot cross running water. Activating a hose or spring line lays down a barrier enemies must path around. Two interactions make it Kara's ability and not just a tower: **(1)** the spray throws mist that refracts nearby lantern light into a glowing curtain, extending the lit zone where enemies are damageable; **(2)** Kara cannot resist attacking the spray — she lunges and bites at the water, and while she's playing in it the barrier's output is amplified and she is healed and cleansed of any curse effects. The catch is she won't leave. Commanding her out of the water costs the player something. Her happiest animation in the game is also a soft trap.
- **Bubbles.** The homestead can blow bubbles to lure Kara instantly to a location; she chases them without hesitation. Each bubble refracts lantern light into a small drifting glow, so a bubble trail is also a faint temporary light path. Fastest repositioning tool in the game — and the only reliable way to pull her off the hose.
- **The Ball Stash.** Kara retrieves and drags things back to a hoard under the porch — balls above all, plus dropped enemy items and fallen ward components. The stash is the between-night currency. She will also, at genuinely inconvenient moments, drop a ball at the player's feet and stare, waiting for a throw. Throwing it costs a beat of the player's attention and grants bond. Ignoring it costs bond. Make the player feel that tradeoff.
- **Toy Loadout.** Before each night the player gives Kara one stuffed toy, which grants a passive for that night (e.g. a squeaky one that shortens her alarm cooldown, a heavy one that lets her hold ground longer, a ragged favorite that boosts bond gain). One toy per night — a real build choice.
- **Blanket.** Kara burrows under a blanket and goes completely hidden and invulnerable. Nothing can target or find her. Use it to survive a wave she can't win, or to set an ambush by having her emerge behind something. She'll stay under longer than the player wants her to.
- **Bond meter.** Kara grows across the seven nights. Feeding her, resting her, playing with her, throwing the ball, and keeping her safe raises bond, unlocking Hold (she plants and refuses to yield ground) and on Night 7, Lead (she knows the way through the fog when nothing else does).
- **She can be hurt** but never permanently lost. Injury sends her to the porch to recover, leaving the player blind for a stretch. The tension is losing her presence, not losing her.

The other towers are wards, not guns: lantern posts, salt lines, a church bell, and a fiddler whose tunes stack buffs. Light is the core mechanic — enemies are only damageable inside lit areas, so tower placement is a lighting puzzle. Kara is the exception: she operates in the dark, which is exactly why she matters.

**Art direction:** hand-painted parallax layers, fog volumes, real-time 2D lighting with soft shadows, ember and rain particles, muted blue-green night palette with warm lantern pools. Kara gets the most animation attention in the game — idle breathing, ear flicks, a full-body shake-off after water, the play-bow, the back-roll with all four paws in the air, biting and snapping at hose spray, burrowing under a blanket until only her nose shows, and sleeping curled on the porch between nights. The lab shows in the tail, the water obsession, and the retrieving; the pit shows in the chest and the stubbornness. She should read as a real dog with weight and personality, not a sprite that slides around.

**Tech:** React + TypeScript + Vite + PixiJS with a custom 2D lighting shader.

**Deliver a design doc covering:** the light/shadow system and how Show Belly, the hose mist, and the bubble-glow all interact with it; Kara's full command set, cooldowns, and bond progression; the toy loadout list with numbers; 7 nights with escalating folklore-based bosses; tower synergies including which wards combo with Kara and how the hose interacts with the lanterns; the between-nights ball-stash economy; and the audio design that makes her one bark land. Sessions must be 5 minutes or less and pausable at any moment.

---

## Quirk → mechanic map

| Kara's real trait | In-game ability |
|---|---|
| Silent except territorial at home | **The Bark** — silent all game; one bark means something reached the homestead |
| Floppy ears | **Ear-Perk** — hearing cone detection, ~2s tell before a threat appears |
| Rolls on her back when playing | **Show Belly** — white belly reflects a burst of light; vulnerable while down |
| Attacks water from a hose | **The Hose** — running-water ward; she amplifies it but won't leave it |
| Loves bubbles | **Bubbles** — instant lure/reposition, leaves a faint light trail |
| Loves balls | **The Ball Stash** — retrieval hoard under the porch, between-night currency |
| Loves stuffed toys | **Toy Loadout** — one toy per night, each a different passive |
| Loves being under blankets | **Blanket** — fully hidden and invulnerable; stays under too long |
| Lab/pit mix, gold with white paws, belly, chest | Tracked in the dark by four pale paws and a white blaze |

## Other concepts considered

1. **Reef Guard** — coral reef TD, flow-field currents, caustic underwater lighting
2. **Q4 Defense** — satirical FP&A TD, rogue capex marching down an org chart
3. **Ghost Road** — this one
4. **Abyssal Station** — deep-sea roguelite, 360° defense, bioluminescence as the only light
5. **Blight Season** — agronomy TD, tile-based disease spread, live weather modifiers
