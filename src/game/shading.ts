import { FillGradient } from 'pixi.js'

/**
 * Vertical shading for Graphics fills.
 *
 * Everything on this board used to be a flat colour, which in a game lit by pools of
 * lamplight reads as a paper cut-out standing in the light rather than a thing the light
 * has fallen on. A two-stop vertical gradient costs nothing and gives every silhouette a
 * top and an underside.
 *
 * **Two rules make this safe to use freely:**
 *
 *  - `textureSpace: 'local'` means the gradient is normalised to the *bounds of the shape
 *    being filled*, so one gradient object serves every enemy of a kind at any size. No
 *    silhouette, hit box or path moves — only the colour inside it.
 *  - Gradients are **cached by colour and shared**. A `FillGradient` owns a texture, so a
 *    fresh one per enemy instance would mean a texture per enemy and a draw call per
 *    texture. Built once, reused forever.
 */

const cache = new Map<string, FillGradient>()

/** Scale a packed RGB toward black or white, clamped. */
function scale(color: number, k: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * k))
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * k))
  const b = Math.min(255, Math.round((color & 0xff) * k))
  return (r << 16) | (g << 8) | b
}

/** A cached top-to-bottom gradient between two explicit colours. */
export function shade(top: number, bottom: number): FillGradient {
  const key = `${top}:${bottom}`
  const hit = cache.get(key)
  if (hit) return hit

  const g = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    textureSpace: 'local',
    colorStops: [
      { offset: 0, color: top },
      { offset: 1, color: bottom },
    ],
  })
  cache.set(key, g)
  return g
}

/**
 * The standard body shading: lit from above and falling away underneath.
 *
 * The midpoint of the two factors is close to 1, so a shape shaded this way keeps roughly
 * the average value it had when it was flat — this adds form without quietly making the
 * roster brighter or darker than the balance of the frame expects.
 */
export function form(color: number): FillGradient {
  return shade(scale(color, 1.24), scale(color, 0.64))
}

/**
 * Shading for something lit from *below* — anything standing over a salt line or a lit
 * strip of iron, and the drowned, who carry their own cold light up out of the water.
 */
export function underlit(color: number): FillGradient {
  return shade(scale(color, 0.68), scale(color, 1.2))
}
