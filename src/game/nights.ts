/**
 * Seven nights. Placeholder pacing — the real curve, the folklore bosses, and the
 * between-nights ball-stash economy come out of the design doc.
 */
export interface WaveSpawn {
  kind: string
  count: number
  /** Seconds between spawns within this group. */
  gap: number
  /** Seconds after the wave starts before this group begins. */
  delay: number
}

export interface Night {
  index: number
  name: string
  /** Flavour line shown between nights. */
  epigraph: string
  startingOil: number
  waves: WaveSpawn[][]
}

export const NIGHTS: Night[] = [
  {
    index: 1,
    name: 'First Night',
    epigraph: 'The road has been quiet for forty years. It is not quiet tonight.',
    startingOil: 90,
    waves: [
      [{ kind: 'walker', count: 4, gap: 1.8, delay: 0 }],
      [{ kind: 'walker', count: 6, gap: 1.4, delay: 0 }],
      [
        { kind: 'walker', count: 5, gap: 1.4, delay: 0 },
        { kind: 'crawler', count: 4, gap: 1.0, delay: 4 },
      ],
    ],
  },
  {
    index: 2,
    name: 'Second Night',
    epigraph: 'Kara will not come inside. She keeps looking at the treeline.',
    startingOil: 110,
    waves: [
      [{ kind: 'crawler', count: 8, gap: 0.9, delay: 0 }],
      [
        { kind: 'walker', count: 6, gap: 1.2, delay: 0 },
        { kind: 'unseen', count: 2, gap: 3, delay: 6 },
      ],
      [
        { kind: 'unseen', count: 4, gap: 2.4, delay: 0 },
        { kind: 'crawler', count: 6, gap: 0.8, delay: 5 },
      ],
    ],
  },
  {
    index: 3,
    name: 'Third Night',
    epigraph: 'Something up the hollow is counting the lanterns.',
    startingOil: 130,
    waves: [
      [{ kind: 'unseen', count: 5, gap: 2, delay: 0 }],
      [
        { kind: 'walker', count: 8, gap: 1, delay: 0 },
        { kind: 'unseen', count: 4, gap: 2.2, delay: 5 },
      ],
      [{ kind: 'hollow', count: 1, gap: 1, delay: 0 }],
    ],
  },
]
