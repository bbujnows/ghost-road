import { Container, Graphics } from 'pixi.js'
import type { Vec2 } from './enemies'

/**
 * Placeholder art. Everything here is flat vector stand-in geometry for what the
 * design doc calls for — hand-painted parallax layers, fog volumes, ember and rain
 * particles. The shapes are correct; the paint is not here yet.
 */
export function buildWorld(width: number, height: number, road: Vec2[]): Container {
  const world = new Container()

  world.addChild(new Graphics().rect(0, 0, width, height).fill(0x1e2b2a))

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
  world.addChild(ridges)

  // The old logging road.
  const roadGfx = new Graphics()
  roadGfx.moveTo(road[0].x, road[0].y)
  for (let i = 1; i < road.length; i++) roadGfx.lineTo(road[i].x, road[i].y)
  roadGfx.stroke({ width: 54, color: 0x33322b, cap: 'round', join: 'round' })

  roadGfx.moveTo(road[0].x, road[0].y)
  for (let i = 1; i < road.length; i++) roadGfx.lineTo(road[i].x, road[i].y)
  roadGfx.stroke({ width: 44, color: 0x3d3a30, cap: 'round', join: 'round' })
  world.addChild(roadGfx)

  // Treeline. Deliberately crowds the road so unlit gaps exist by default.
  const trees = new Graphics()
  let seed = 8
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  for (let i = 0; i < 90; i++) {
    const x = rand() * width
    const y = 140 + rand() * (height - 200)
    const onRoad = road.some((p) => Math.hypot(p.x - x, p.y - y) < 70)
    if (onRoad) continue
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
  world.addChild(trees)

  // The homestead. Everything on this map exists to keep things off this porch.
  const home = new Graphics()
  const hx = width / 2
  const hy = height - 60
  home
    .roundRect(hx - 70, hy - 46, 140, 62, 4)
    .fill(0x2e2822)
    .moveTo(hx - 82, hy - 44)
    .lineTo(hx, hy - 84)
    .lineTo(hx + 82, hy - 44)
    .fill(0x241f1a)
    .roundRect(hx - 66, hy + 10, 132, 12, 3)
    .fill(0x3a322a)
    .rect(hx - 14, hy - 30, 28, 22)
    .fill(0xffd8a0)
  world.addChild(home)

  return world
}

export const HOMESTEAD = (width: number, height: number) => ({ x: width / 2, y: height - 70 })
