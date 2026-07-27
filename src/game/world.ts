import { Container, Graphics } from 'pixi.js'

export interface Vec2 {
  x: number
  y: number
}

/**
 * Placeholder scene geometry. The real art direction calls for hand-painted parallax
 * layers and fog volumes; this is flat vector stand-in so the lightmap has a surface.
 *
 * The road's shape, however, is load-bearing: it wanders enough that lighting all of
 * it is unaffordable, which is the entire Night 1 lesson.
 */

/** ~1060px end to end. A Road Walker at 30 px/s crosses it in about 35 seconds. */
export const ROAD: Vec2[] = [
  { x: 680, y: -60 },
  { x: 650, y: 90 },
  { x: 510, y: 200 },
  { x: 490, y: 320 },
  { x: 670, y: 400 },
  { x: 820, y: 470 },
  { x: 760, y: 560 },
  { x: 640, y: 645 },
]

export const HOMESTEAD: Vec2 = { x: 640, y: 655 }

export function roadLength(): number {
  let total = 0
  for (let i = 1; i < ROAD.length; i++) {
    total += Math.hypot(ROAD[i].x - ROAD[i - 1].x, ROAD[i].y - ROAD[i - 1].y)
  }
  return total
}

export function buildScene(width: number, height: number): Container {
  const scene = new Container()

  scene.addChild(new Graphics().rect(0, 0, width, height).fill(0x1e2b2a))

  // Ridge lines receding into the hollow.
  const ridges = new Graphics()
  const bands: [number, number, number][] = [
    [120, 0x24332f, 60],
    [190, 0x1f2c29, 45],
    [250, 0x1a2523, 30],
  ]
  for (const [baseY, color, amp] of bands) {
    ridges.moveTo(0, baseY)
    for (let x = 0; x <= width; x += 40) {
      ridges.lineTo(x, baseY - Math.sin(x * 0.006) * amp - Math.sin(x * 0.021) * amp * 0.4)
    }
    ridges.lineTo(width, height).lineTo(0, height).fill(color)
  }
  scene.addChild(ridges)

  // The old logging road.
  const road = new Graphics()
  road.moveTo(ROAD[0].x, ROAD[0].y)
  for (let i = 1; i < ROAD.length; i++) road.lineTo(ROAD[i].x, ROAD[i].y)
  road.stroke({ width: 54, color: 0x33322b, cap: 'round', join: 'round' })

  road.moveTo(ROAD[0].x, ROAD[0].y)
  for (let i = 1; i < ROAD.length; i++) road.lineTo(ROAD[i].x, ROAD[i].y)
  road.stroke({ width: 44, color: 0x3d3a30, cap: 'round', join: 'round' })
  scene.addChild(road)

  // Treeline, crowding the road so unlit gaps exist by default.
  const trees = new Graphics()
  let seed = 8
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  for (let i = 0; i < 110; i++) {
    const x = rand() * width
    const y = 140 + rand() * (height - 200)
    if (ROAD.some((p) => Math.hypot(p.x - x, p.y - y) < 74)) continue
    const h = 26 + rand() * 40
    trees
      .moveTo(x, y)
      .lineTo(x - h * 0.28, y + h * 0.5)
      .lineTo(x + h * 0.28, y + h * 0.5)
      .fill({ color: 0x141d1c, alpha: 0.9 })
      .moveTo(x, y - h * 0.35)
      .lineTo(x - h * 0.2, y + h * 0.1)
      .lineTo(x + h * 0.2, y + h * 0.1)
      .fill({ color: 0x182321, alpha: 0.9 })
  }
  scene.addChild(trees)

  // The homestead. Everything on this map exists to keep things off this porch.
  const home = new Graphics()
  const { x: hx, y: hy } = HOMESTEAD
  home
    .roundRect(hx - 70, hy - 52, 140, 62, 4)
    .fill(0x2e2822)
    .moveTo(hx - 82, hy - 50)
    .lineTo(hx, hy - 90)
    .lineTo(hx + 82, hy - 50)
    .fill(0x241f1a)
    .roundRect(hx - 66, hy + 4, 132, 12, 3)
    .fill(0x3a322a)
    .rect(hx - 14, hy - 36, 28, 22)
    .fill(0xffd8a0)
  scene.addChild(home)

  return scene
}
