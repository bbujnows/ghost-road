/**
 * The toy loadout (design doc §4). One toy per night, chosen on the briefing screen.
 *
 * **Four of the doc's eight are here. The other four are blocked, not cut**, and every
 * one of them is blocked on a system that does not exist:
 *
 *  - *Ragged Fox* (bond ×1.5) — bond is not built.
 *  - *Tennis Ball* (ball drops, stash) — neither is built.
 *  - *The Squeaker* (bark twice, ear lead +0.2s) — the bark is not built, and the ear
 *    half alone is a 10% change to one number. Nobody would ever pick it.
 *  - *Stuffed Duck* (hose amplification, immunity in water) — the spring line is not built.
 *
 * Shipping a toy whose effect is inert is worse than shipping three toys: it teaches the
 * player that the loadout screen does not matter. The four below all do something you can
 * feel on the first night you take them.
 *
 * The doc gates unlocks behind stash, which is also not built, so all four are available
 * from the start. The per-night choice is the part that matters and it works today.
 */

import { BLANKET, BUBBLES, EAR_PERK_RADIUS, KARA, KARA_WALK_SPEED, SHOW_BELLY } from './balance'

export type ToyId = 'rope' | 'bear' | 'monkey' | 'scrap'

export interface Toy {
  id: ToyId
  name: string
  /** What it does, in the player's terms. Shown on the picker. */
  effect: string
  /** Why the real dog would care. Shown smaller. */
  flavor: string
  /** The trade, said plainly. Every toy that is only upside is a toy that is mandatory. */
  cost: string | null
}

export const TOYS: Toy[] = [
  {
    id: 'rope',
    name: 'The Rope',
    effect: 'Grants Hold (H). She plants herself: nothing within 90px gets past her, and everything in it is slowed by a third. Up to 8 seconds.',
    flavor: 'She has never lost a game of tug and does not intend to start.',
    cost: 'It costs her 6 HP a second while anything is actually pushing.',
  },
  {
    id: 'bear',
    name: 'The Weighted Bear',
    effect: 'Kara has 150 HP instead of 100.',
    flavor: 'The heavy one. She drags it from room to room and sleeps on it.',
    cost: 'She moves 15% slower carrying it.',
  },
  {
    id: 'monkey',
    name: 'The Sock Monkey',
    effect: 'Bubbles: 4 charges instead of 2, and one back every 5 seconds instead of 8.',
    flavor: 'Squeaks like the bubble wand. She cannot tell them apart and does not want to.',
    cost: null,
  },
  {
    id: 'scrap',
    name: 'The Old Blanket Scrap',
    effect: 'Coaxing her out from under the blanket takes 1 second flat, and she comes out 50% faster for 3 seconds.',
    flavor: 'A corner of the quilt she has had since she was small. She goes under happily and comes back out for it.',
    cost: null,
  },
]

/**
 * Everything a toy **or bond tier** can change about Kara, resolved once at the start of a
 * night so nothing downstream has to ask which toy is equipped or how well she is loved.
 */
export interface Loadout {
  toy: ToyId
  maxHp: number
  walkSpeed: number
  bubbleCharges: number
  bubbleRegen: number
  blanketCoax: number
  /** Seconds of extra speed after emerging from the blanket, and how much. */
  emergeBoost: number
  emergeSpeed: number
  hold: boolean
  /** §3.4 T1. */
  earRadius: number
  /** §3.4 T2. */
  bellyCooldown: number
  /** §3.4 T3. */
  downDuration: number
}

/**
 * Resolve a night's toy and bond tier into plain numbers.
 *
 * Bond is applied **after** the toy, so the Blanket Scrap's flat 1.0s coax is not then
 * reduced further by tier — a toy that already gives you the floor should not be made
 * better by something unrelated.
 */
export function loadoutFor(toy: ToyId, bondTier = 0): Loadout {
  const base: Loadout = {
    toy,
    maxHp: KARA.hp,
    walkSpeed: KARA_WALK_SPEED,
    bubbleCharges: BUBBLES.maxCharges,
    bubbleRegen: BUBBLES.regen,
    blanketCoax: BLANKET.coax,
    emergeBoost: 0,
    emergeSpeed: 1,
    hold: false,
    earRadius: EAR_PERK_RADIUS,
    bellyCooldown: SHOW_BELLY.cooldown,
    downDuration: KARA.downDuration,
  }

  let out: Loadout
  if (toy === 'rope') out = { ...base, hold: true }
  else if (toy === 'bear') out = { ...base, maxHp: 150, walkSpeed: KARA_WALK_SPEED * 0.85 }
  else if (toy === 'monkey') out = { ...base, bubbleCharges: 4, bubbleRegen: 5 }
  else out = { ...base, blanketCoax: 1.0, emergeBoost: 3, emergeSpeed: 1.5 }

  // §3.4. Each tier is a thing about her, not a thing about your defenses.
  if (bondTier >= 1) out.earRadius = 350
  if (bondTier >= 2) {
    out.bellyCooldown = 11
    // §3.2: 3.0 − 0.4 × tier, floor 1.0. Never worsens a toy that already beat it.
    out.blanketCoax = Math.min(out.blanketCoax, Math.max(1.0, BLANKET.coax - 0.4 * bondTier))
  }
  if (bondTier >= 3) out.downDuration = 12

  return out
}
