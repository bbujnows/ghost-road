import type { Group } from './balance'

/**
 * The seven nights (design doc §6, consult §7).
 *
 * **Each night adds exactly one thing**, and bosses land on 3, 5 and 7 — the consult's
 * structure, which supersedes the doc's boss-every-night table. The three bosses that
 * are not here are not cut; they are blocked on systems that do not exist. See §6.
 *
 * Ordering note, and it is deliberate: Night 3 pairs **The Unseen** with the **Bell
 * Witch**, so the one night you most need Kara's ears is the one night they lie to you.
 * Night 4 then puts the Bone Dog on the board and asks you to trust them again.
 */
export interface NightSpec {
  n: number
  name: string
  /** The line under the title on the briefing screen. */
  lede: string
  /** The one new thing, said plainly. The player should never be surprised by a system. */
  teaches: string
  startingOil: number
  /** §2.2. Shrinks every light's radius. 0 is a clear night. */
  fog: number
  /**
   * Seconds between gusts, or 0 for a still night. A gust puts out every lantern that
   * has not been upgraded to Storm Glass — which is what finally makes that branch
   * something other than insurance against one enemy.
   */
  wind: number
  waves: { groups: Group[] }[]
}

/** Shorthand, because the wave tables are the readable part and should stay that way. */
const g = (kind: Group['kind'], count: number, gap: number, start = 0): Group => ({
  kind,
  count,
  gap,
  start,
})

export const NIGHTS: NightSpec[] = [
  {
    n: 1,
    name: 'First Night',
    lede: 'The road has been quiet for forty years. It is not quiet tonight.',
    teaches: 'Light makes ground fightable. Iron does the fighting.',
    startingOil: 75,
    fog: 0,
    wind: 0,
    waves: [
      { groups: [g('walker', 6, 4.0)] },
      { groups: [g('walker', 8, 3.5)] },
      // The Tallow Man closes the night. He is the first thing that attacks your
      // lanterns rather than your house, and he arrives once you have some to lose.
      { groups: [g('walker', 10, 3.0), g('tallowMan', 1, 0, 30)] },
    ],
  },
  {
    n: 2,
    name: 'Second Night',
    lede: 'Something came down off the ridge before dark and did not come back up.',
    teaches: 'Crawlers. Fast and flimsy — one lit strip kills them, if you have one there.',
    startingOil: 85,
    fog: 0,
    wind: 0,
    waves: [
      { groups: [g('walker', 6, 4.0), g('crawler', 3, 1.4, 16)] },
      { groups: [g('walker', 7, 3.8), g('crawler', 5, 1.1, 12)] },
      { groups: [g('walker', 8, 3.4), g('crawler', 6, 1.0, 10), g('tallowMan', 1, 0, 26)] },
    ],
  },
  {
    n: 3,
    name: 'Third Night',
    lede: 'Her ears go up at nothing. She is not wrong. She is being lied to.',
    teaches: 'The Unseen are invisible outside light — and the Bell Witch makes Kara cry wolf.',
    startingOil: 95,
    fog: 0.15,
    wind: 0,
    waves: [
      { groups: [g('walker', 6, 4.0), g('unseen', 3, 3.0, 14)] },
      { groups: [g('walker', 6, 3.8), g('crawler', 4, 1.1, 10), g('unseen', 5, 2.4, 18)] },
      {
        groups: [
          g('walker', 8, 3.4),
          g('unseen', 6, 2.2, 12),
          g('tallowMan', 1, 0, 24),
          g('bellWitch', 1, 0, 34),
        ],
      },
    ],
  },
  {
    n: 4,
    name: 'Fourth Night',
    lede: 'There is a dog on the road that runs like her and has nothing white on it.',
    teaches: 'Bone Dogs ignore the house and come for Kara. Put her under the blanket, or use her as bait.',
    startingOil: 105,
    fog: 0.25,
    wind: 0,
    waves: [
      { groups: [g('walker', 7, 3.8), g('boneDog', 2, 7, 14)] },
      { groups: [g('walker', 7, 3.6), g('crawler', 5, 1.1, 10), g('boneDog', 3, 6, 18)] },
      {
        groups: [
          g('walker', 8, 3.2),
          g('unseen', 5, 2.4, 8),
          g('boneDog', 4, 5, 16),
          g('tallowMan', 2, 8, 28),
        ],
      },
    ],
  },
  {
    n: 5,
    name: 'Fifth Night',
    lede: 'The wind came up at moonrise and the hollow filled with weather.',
    teaches: 'Wind puts out every lantern that is not Storm Glass. And something is walking that does not attack.',
    startingOil: 115,
    fog: 0.5,
    wind: 22,
    waves: [
      { groups: [g('walker', 8, 3.6), g('crawler', 5, 1.1, 12)] },
      { groups: [g('walker', 8, 3.4), g('unseen', 6, 2.2, 10), g('boneDog', 3, 6, 20)] },
      {
        groups: [
          g('walker', 8, 3.2),
          g('crawler', 6, 1.0, 8),
          g('boneDog', 3, 6, 18),
          g('greenbrier', 1, 0, 30),
        ],
      },
    ],
  },
  {
    n: 6,
    name: 'Sixth Night',
    lede: 'The oil is nearly gone. What you have built is what you have.',
    teaches: 'Starting oil cut hard. Every wave you clear still pays — but the opening is yours to solve.',
    // ⚠ **Destacked 2026-07-29 (fix-plan F2).** This night shipped with 60 oil, fog 0.60 and gusts
    // every 26s — three heavy modifiers at once, against the *explicit* fairness rule written for
    // the Nightly Road generator: stacked-modifier difficulty is super-linear while oil compensation
    // is linear. Measured: at fog 0.60 a lantern's lit pool falls 102px → 67px, and 60 oil buys two
    // lanterns and one strip, covering ~134px of a 1070px road with zero wards carried in. The
    // recorded session died here at 5 oil with one lantern up.
    //
    // Night 6's identity is *scarcity*, so scarcity stays and the weather gives way. 75 is still the
    // sharpest drop in the campaign — a 35% cut from Night 5.
    startingOil: 75,
    fog: 0.35,
    wind: 0,
    waves: [
      { groups: [g('walker', 8, 3.6), g('unseen', 4, 2.6, 12), g('crawler', 4, 1.2, 20)] },
      {
        groups: [
          g('walker', 8, 3.4),
          g('crawler', 6, 1.0, 10),
          g('boneDog', 3, 6, 16),
          g('tallowMan', 2, 9, 26),
        ],
      },
      {
        groups: [
          g('walker', 10, 3.0),
          g('unseen', 7, 2.0, 8),
          g('boneDog', 4, 5, 18),
          g('tallowMan', 2, 8, 30),
        ],
      },
    ],
  },
  {
    n: 7,
    name: 'Seventh Night',
    lede: 'The road is open all the way to the top of the hollow, and all of it is coming down.',
    teaches: 'Everything at once, in fog that halves every lantern you own. Hold until dawn.',
    startingOil: 130,
    fog: 0.8,
    wind: 18,
    waves: [
      {
        groups: [
          g('walker', 9, 3.2),
          g('crawler', 6, 1.0, 10),
          g('unseen', 5, 2.4, 18),
        ],
      },
      {
        groups: [
          g('walker', 9, 3.0),
          g('unseen', 7, 2.0, 8),
          g('boneDog', 4, 5, 16),
          g('tallowMan', 2, 8, 26),
        ],
      },
      {
        groups: [
          g('walker', 10, 2.8),
          g('crawler', 8, 0.9, 6),
          g('unseen', 8, 1.8, 12),
          g('boneDog', 4, 5, 20),
          g('tallowMan', 2, 7, 28),
          g('drover', 1, 0, 40),
        ],
      },
    ],
  },
]

export function waveSizeOf(night: number, wave: number): number {
  return NIGHTS[night].waves[wave].groups.reduce((n, group) => n + group.count, 0)
}
