import { Container, Graphics } from 'pixi.js'

/**
 * Placeholder scene. This exists only so the lightmap has a surface to fall on while
 * the engine is being built.
 *
 * Nothing here is a design decision that should survive: not the road's shape, not the
 * treeline, not where the homestead sits, not the palette. The design doc decides the
 * map, and the real art direction calls for hand-painted parallax layers and fog
 * volumes rather than flat vector shapes.
 */
export function buildPlaceholderScene(width: number, height: number): Container {
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

  // A road, so there is somewhere obviously unlit to walk Kara into.
  const road = new Graphics()
  road
    .moveTo(width / 2 + 40, -60)
    .quadraticCurveTo(width / 2 - 190, height * 0.4, width / 2 + 60, height * 0.66)
    .quadraticCurveTo(width / 2 + 180, height * 0.82, width / 2, height - 90)
    .stroke({ width: 48, color: 0x3d3a30, cap: 'round' })
  scene.addChild(road)

  return scene
}
