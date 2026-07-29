import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import type { Light } from './lighting'

export interface Vec2 {
  x: number
  y: number
}

/**
 * The hollow.
 *
 * Still procedural vector work rather than the hand-painted parallax the art direction
 * calls for, but built in the same layers: sky, three ridge bands separated by mist,
 * the ground, the road, and the homestead.
 *
 * Two things here are load-bearing rather than decorative:
 *
 *  - The road's shape wanders enough that lighting all of it is unaffordable, which is
 *    the entire Night 1 lesson.
 *  - The homestead's windows and porch lantern are real lights, and their glow is drawn
 *    into an `emissive` layer that sits ABOVE the darkness overlay. The thing you are
 *    defending must always be legible, the same way Kara's white markings must be.
 */

/**
 * The authored road. ~1070px end to end — a Road Walker at 30 px/s crosses it in about
 * 35 seconds, and **every pacing number in the game is derived from that figure.**
 */
export const AUTHORED_ROAD: Vec2[] = [
  { x: 680, y: -60 },
  { x: 650, y: 90 },
  { x: 510, y: 200 },
  { x: 490, y: 320 },
  { x: 670, y: 400 },
  { x: 820, y: 470 },
  { x: 760, y: 560 },
  { x: 640, y: 645 },
]

/**
 * The road in play. The Long Road generates a new one per run, so this cannot be a fixed
 * literal any more — but it **must stay the same array object for the life of the page.**
 * `Enemy` captures it by reference as its path, so `setRoad()` replaces the contents in
 * place rather than rebinding. Reassigning would leave every live enemy walking a road
 * that no longer exists.
 */
export const ROAD: Vec2[] = AUTHORED_ROAD.map((p) => ({ ...p }))

/** Only safe with an empty board: anything mid-walk keeps its path index, not its place. */
export function setRoad(points: Vec2[]) {
  ROAD.length = 0
  for (const p of points) ROAD.push({ ...p })
}

export const HOMESTEAD: Vec2 = { x: 640, y: 640 }

export interface BuiltScene {
  scene: Container
  /**
   * The cabin, deliberately NOT added to `scene`.
   *
   * It has to live in the caller's y-sorted actor layer instead: enemies walk *to* the
   * homestead, and with the cabin in the background every one of them drew on top of it —
   * the recorded session has hooded figures standing at roof height. Painter's algorithm
   * over the actors is the only version of this that is right in every case.
   */
  homestead: Container
  /** Drawn above the lightmap — glows that must never be swallowed by the dark. */
  emissive: Container
  /** Lights the scene itself contributes, registered by the caller. */
  lights: Light[]
  smoke: Smoke
}

export function roadLength(): number {
  let total = 0
  for (let i = 1; i < ROAD.length; i++) {
    total += Math.hypot(ROAD[i].x - ROAD[i - 1].x, ROAD[i].y - ROAD[i - 1].y)
  }
  return total
}

/** Deterministic noise, so the hollow looks the same every night. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function verticalGradient(w: number, h: number, stops: [number, string][]): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w))
  canvas.height = Math.max(1, Math.round(h))
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
  for (const [at, color] of stops) g.addColorStop(at, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return Texture.from(canvas)
}

function radialGlow(size: number, color: string): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, color)
  g.addColorStop(0.4, color.replace(/[\d.]+\)$/, '0.35)'))
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return Texture.from(canvas)
}

/** Chimney smoke. Cheap, but it is the difference between a house and a home. */
export class Smoke {
  readonly container = new Container()
  private puffs: { x: number; y: number; life: number; size: number; drift: number }[] = []
  private spawn = 0
  private readonly gfx = new Graphics()

  private readonly ox: number
  private readonly oy: number

  constructor(ox: number, oy: number) {
    this.ox = ox
    this.oy = oy
    this.container.addChild(this.gfx)
  }

  update(dt: number) {
    this.spawn -= dt
    if (this.spawn <= 0) {
      this.spawn = 0.7
      this.puffs.push({ x: 0, y: 0, life: 1, size: 3 + Math.random() * 2, drift: 0.5 + Math.random() * 0.7 })
    }

    // One reused Graphics rather than a fresh child per puff per frame, which leaked.
    this.gfx.clear()
    for (const p of this.puffs) {
      // Short-lived and barely grown. A long life plus 2x growth turns eleven
      // overlapping circles into a solid beam across the sky rather than a plume.
      p.life -= dt * 0.42
      p.y -= 11 * dt
      p.x += p.drift * 7 * dt
      this.gfx
        .circle(this.ox + p.x, this.oy + p.y, p.size * (1.6 - p.life * 0.6))
        .fill({ color: 0x6d7b7a, alpha: p.life * 0.085 })
    }
    this.puffs = this.puffs.filter((p) => p.life > 0)
  }
}

// ─── The homestead ──────────────────────────────────────────────────────────

const WINDOW_GLOW = 0xffd9a0

function buildHomestead(): { body: Container; emissive: Container; lights: Light[] } {
  const body = new Container()
  const emissive = new Container()
  const g = new Graphics()

  // Local coordinates: (0,0) is the base of the cabin at ground level.
  const W = 210
  const H = 96
  const left = -W / 2
  const right = W / 2
  const eave = -H
  const ridge = -H - 56

  // Stone chimney, behind the roof.
  g.rect(right - 58, ridge - 26, 26, 96).fill(0x554f45)
  for (let i = 0; i < 7; i++) {
    g.rect(right - 58, ridge - 26 + i * 13, 26, 2).fill({ color: 0x3d382f, alpha: 0.6 })
  }
  g.rect(right - 62, ridge - 32, 34, 8).fill(0x615a4e)

  // Log walls, with courses so it reads as a cabin rather than a box.
  g.rect(left, eave, W, H).fill(0x5a4835)
  for (let i = 1; i < 8; i++) {
    g.rect(left, eave + (H / 8) * i, W, 2).fill({ color: 0x3f3226, alpha: 0.75 })
  }
  // Corner notching.
  g.rect(left - 5, eave, 8, H).fill(0x4a3b2b)
  g.rect(right - 3, eave, 8, H).fill(0x4a3b2b)

  // Roof: overhanging, with shingle courses.
  g.moveTo(left - 26, eave + 6)
    .lineTo(0, ridge)
    .lineTo(right + 26, eave + 6)
    .lineTo(right + 26, eave + 16)
    .lineTo(0, ridge + 10)
    .lineTo(left - 26, eave + 16)
    .fill(0x3b332a)

  for (let i = 1; i < 6; i++) {
    const t = i / 6
    const y = ridge + (eave + 6 - ridge) * t
    const halfW = (W / 2 + 26) * t
    g.moveTo(-halfW, y).lineTo(halfW, y).stroke({ width: 1.5, color: 0x2c261f, alpha: 0.7 })
  }

  // Porch: deck, posts, railing, steps.
  const deckY = 4
  g.rect(left - 18, deckY, W + 36, 12).fill(0x4d3f30)
  g.rect(left - 18, deckY + 12, W + 36, 6).fill(0x352b21)

  for (const px of [left - 10, left + 60, right - 60, right + 4]) {
    g.rect(px, eave + 30, 7, -deckY + 30 + H - 30).fill(0x4a3c2d)
  }
  g.rect(left - 12, deckY - 22, W + 24, 4).fill(0x453828)
  g.rect(left - 12, deckY - 34, W + 24, 3).fill({ color: 0x453828, alpha: 0.8 })

  // Steps down to the yard.
  for (let i = 0; i < 3; i++) {
    g.rect(-34 + i * 3, deckY + 16 + i * 7, 68 - i * 6, 7).fill(i % 2 ? 0x413528 : 0x4a3c2d)
  }

  // Door and windows. These are cut out of the wall, then lit from behind.
  g.rect(-22, eave + 22, 44, H - 22).fill(0x2a2119)
  g.rect(-18, eave + 26, 36, H - 30).fill(0x8a6b42)
  g.circle(12, eave + 62, 2.5).fill(0xd8c188)

  const windows: Vec2[] = [
    { x: left + 42, y: eave + 30 },
    { x: right - 42, y: eave + 30 },
  ]
  for (const w of windows) {
    g.rect(w.x - 21, w.y - 3, 42, 40).fill(0x2a2119)
    g.rect(w.x - 18, w.y, 36, 34).fill(WINDOW_GLOW)
    g.rect(w.x - 1.5, w.y, 3, 34).fill({ color: 0x2a2119, alpha: 0.8 })
    g.rect(w.x - 18, w.y + 15.5, 36, 3).fill({ color: 0x2a2119, alpha: 0.8 })
  }

  // A lantern hung by the door — the light the player never has to pay for.
  g.rect(-46, deckY - 34, 2, 14).fill(0x2f2820)
  g.roundRect(-52, deckY - 22, 13, 15, 2).fill(0x6b5744)
  g.rect(-50, deckY - 20, 9, 11).fill(0xffe0a8)

  body.addChild(g)

  // ── Emissive pass: the glows, drawn above the darkness so they never vanish.
  const windowGlowTex = radialGlow(128, 'rgba(255,217,160,1)')
  for (const w of windows) {
    const glow = new Sprite(windowGlowTex)
    glow.anchor.set(0.5)
    glow.width = 150
    glow.height = 140
    glow.alpha = 0.5
    glow.blendMode = 'add'
    glow.position.set(w.x, w.y + 17)
    emissive.addChild(glow)

    const pane = new Graphics().rect(w.x - 18, w.y, 36, 34).fill({ color: WINDOW_GLOW, alpha: 0.85 })
    emissive.addChild(pane)
  }

  const lanternGlow = new Sprite(windowGlowTex)
  lanternGlow.anchor.set(0.5)
  lanternGlow.width = 120
  lanternGlow.height = 120
  lanternGlow.alpha = 0.45
  lanternGlow.blendMode = 'add'
  lanternGlow.position.set(-45, deckY - 14)
  emissive.addChild(lanternGlow)
  emissive.addChild(new Graphics().rect(-50, deckY - 20, 9, 11).fill({ color: 0xffe8c0, alpha: 0.9 }))

  // ── Real lights, so the porch actually illuminates the ground in front of it.
  const lights: Light[] = [
    { x: 0, y: -30, radius: 300, color: 0xffc078, intensity: 0.62, flicker: 0.02 },
    { x: -45, y: deckY - 14, radius: 210, color: 0xffc890, intensity: 0.5, flicker: 0.05 },
    { x: left + 42, y: eave + 47, radius: 150, color: 0xffd9a0, intensity: 0.34 },
    { x: right - 42, y: eave + 47, radius: 150, color: 0xffd9a0, intensity: 0.34 },
  ]

  return { body, emissive, lights }
}

// ─── The scene ──────────────────────────────────────────────────────────────

export function buildScene(width: number, height: number): BuiltScene {
  const scene = new Container()
  const emissive = new Container()
  const rand = rng(20260727)

  // Sky, and a moon that is never enough.
  const sky = new Sprite(
    verticalGradient(4, height, [
      [0, '#0d1720'],
      [0.45, '#152229'],
      [1, '#1b2b2e'],
    ]),
  )
  sky.width = width
  sky.height = height
  scene.addChild(sky)

  const moon = new Graphics().circle(width / 2 + 190, 78, 26).fill({ color: 0xbcd0da, alpha: 0.5 })
  scene.addChild(moon)

  // Three ridge bands, each with its own treeline, separated by mist.
  const ridgeBands: [number, number, number, number][] = [
    [140, 0x1d2a30, 62, 0.55],
    [214, 0x18242a, 46, 0.75],
    [286, 0x131e21, 32, 1],
  ]

  for (const [baseY, color, amp, alpha] of ridgeBands) {
    const ridge = new Graphics()
    ridge.moveTo(0, baseY)
    for (let x = 0; x <= width; x += 24) {
      const y = baseY - Math.sin(x * 0.0055 + baseY) * amp - Math.sin(x * 0.019 + baseY) * amp * 0.35
      ridge.lineTo(x, y)
    }
    ridge.lineTo(width, height).lineTo(0, height).fill({ color, alpha })
    scene.addChild(ridge)

    // Conifer silhouettes standing on the ridge line.
    const crest = new Graphics()
    for (let x = 8; x < width; x += 15 + rand() * 22) {
      const y =
        baseY - Math.sin(x * 0.0055 + baseY) * amp - Math.sin(x * 0.019 + baseY) * amp * 0.35
      const h = 16 + rand() * 22
      const w = h * 0.3
      crest
        .moveTo(x, y - h)
        .lineTo(x - w, y + 3)
        .lineTo(x + w, y + 3)
        .fill({ color, alpha: Math.min(1, alpha + 0.15) })
    }
    scene.addChild(crest)

    // Mist sitting in the fold below each ridge.
    const mist = new Sprite(
      verticalGradient(4, 90, [
        [0, 'rgba(150,180,190,0)'],
        [0.5, 'rgba(150,180,190,0.09)'],
        [1, 'rgba(150,180,190,0)'],
      ]),
    )
    mist.width = width
    mist.height = 90
    mist.position.set(0, baseY - 10)
    scene.addChild(mist)
  }

  // Ground.
  const ground = new Sprite(
    verticalGradient(4, height - 280, [
      [0, '#1c2926'],
      [1, '#141e1c'],
    ]),
  )
  ground.width = width
  ground.position.set(0, 280)
  scene.addChild(ground)

  // Scrubby ground texture.
  const scrub = new Graphics()
  for (let i = 0; i < 260; i++) {
    const x = rand() * width
    const y = 300 + rand() * (height - 300)
    scrub.ellipse(x, y, 4 + rand() * 12, 1.5 + rand() * 3).fill({ color: 0x25332e, alpha: 0.5 })
  }
  scene.addChild(scrub)

  /**
   * The old logging road (fix-plan F4).
   *
   * **It used to be the brightest large shape in the frame after the cabin** — a pale tan
   * ribbon legible end to end at every fog density. In a game whose premise is that the
   * dark hides things, the terrain was competing with the lanterns instead of waiting for
   * them. It now sits *below* the ground plane in value, so an unlit stretch is a darker
   * absence and a lantern **discovers** the road rather than decorating it.
   *
   * The ruts are broken rather than continuous for the same reason the values dropped:
   * two unbroken parallel lines read as planking. Ruts that stop and start read as wear.
   */
  const road = new Graphics()
  road.moveTo(ROAD[0].x, ROAD[0].y)
  for (let i = 1; i < ROAD.length; i++) road.lineTo(ROAD[i].x, ROAD[i].y)
  road.stroke({ width: 60, color: 0x241f1a, cap: 'round', join: 'round' })

  road.moveTo(ROAD[0].x, ROAD[0].y)
  for (let i = 1; i < ROAD.length; i++) road.lineTo(ROAD[i].x, ROAD[i].y)
  road.stroke({ width: 48, color: 0x2c281f, cap: 'round', join: 'round' })

  // Walk the polyline once and scatter wear along it: broken ruts and loose gravel.
  const segments: { a: Vec2; b: Vec2; len: number }[] = []
  let roadLen = 0
  for (let i = 1; i < ROAD.length; i++) {
    const a = ROAD[i - 1]
    const b = ROAD[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    segments.push({ a, b, len })
    roadLen += len
  }
  const along = (d: number): { x: number; y: number; nx: number; ny: number } => {
    let left = Math.max(0, Math.min(roadLen - 0.001, d))
    for (const s of segments) {
      if (left > s.len) {
        left -= s.len
        continue
      }
      const t = left / s.len
      const dx = (s.b.x - s.a.x) / s.len
      const dy = (s.b.y - s.a.y) / s.len
      return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t, nx: -dy, ny: dx }
    }
    const last = segments[segments.length - 1]
    return { x: last.b.x, y: last.b.y, nx: 0, ny: 1 }
  }

  for (const offset of [-11, 11]) {
    let d = rand() * 40
    while (d < roadLen) {
      const runLength = 22 + rand() * 46
      const p = along(d)
      const q = along(Math.min(roadLen, d + runLength))
      road
        .moveTo(p.x + p.nx * offset, p.y + p.ny * offset)
        .lineTo(q.x + q.nx * offset, q.y + q.ny * offset)
        .stroke({ width: 6, color: 0x1f1c15, alpha: 0.7, cap: 'round' })
      d += runLength + 14 + rand() * 40
    }
  }

  for (let i = 0; i < 120; i++) {
    const p = along(rand() * roadLen)
    const side = (rand() - 0.5) * 40
    road
      .circle(p.x + p.nx * side, p.y + p.ny * side, 0.8 + rand() * 1.5)
      .fill({ color: 0x3a352b, alpha: 0.35 + rand() * 0.3 })
  }

  scene.addChild(road)

  // Treeline crowding the road, so unlit gaps exist by default.
  const trees = new Graphics()
  for (let i = 0; i < 150; i++) {
    const x = rand() * width
    const y = 300 + rand() * (height - 330)
    if (ROAD.some((p) => Math.hypot(p.x - x, p.y - y) < 78)) continue
    if (Math.hypot(HOMESTEAD.x - x, HOMESTEAD.y - y) < 230) continue

    const h = 30 + rand() * 52
    const w = h * 0.3
    trees.rect(x - 2, y, 4, 9).fill({ color: 0x1a1512, alpha: 0.95 })
    trees
      .moveTo(x, y - h)
      .lineTo(x - w, y + 4)
      .lineTo(x + w, y + 4)
      .fill({ color: 0x16211e, alpha: 0.95 })
    trees
      .moveTo(x, y - h * 0.55)
      .lineTo(x - w * 1.2, y + 4)
      .lineTo(x + w * 1.2, y + 4)
      .fill({ color: 0x121b19, alpha: 0.9 })
  }
  scene.addChild(trees)

  // A split-rail fence marking the yard.
  const fence = new Graphics()
  for (let i = 0; i <= 9; i++) {
    const fx = HOMESTEAD.x - 250 + i * 56
    const fy = HOMESTEAD.y - 92 + Math.sin(i * 0.9) * 5
    fence.rect(fx, fy, 5, 34).fill({ color: 0x3a3128, alpha: 0.9 })
    if (i < 9) {
      fence.rect(fx, fy + 9, 56, 3).fill({ color: 0x342c24, alpha: 0.75 })
      fence.rect(fx, fy + 21, 56, 3).fill({ color: 0x342c24, alpha: 0.75 })
    }
  }
  scene.addChild(fence)

  // The homestead itself.
  const { body, emissive: homeGlow, lights: homeLights } = buildHomestead()
  body.position.set(HOMESTEAD.x, HOMESTEAD.y)
  homeGlow.position.set(HOMESTEAD.x, HOMESTEAD.y)
  // Handed back rather than added — it belongs in the caller's y-sorted actor layer.
  emissive.addChild(homeGlow)

  const lights: Light[] = homeLights.map((l) => ({
    ...l,
    x: l.x + HOMESTEAD.x,
    y: l.y + HOMESTEAD.y,
  }))

  // Centred on the chimney cap: x = right - 45, y = ridge - 32 in homestead-local terms.
  const smoke = new Smoke(HOMESTEAD.x + 60, HOMESTEAD.y - 186)
  scene.addChild(smoke.container)

  return { scene, homestead: body, emissive, lights, smoke }
}
