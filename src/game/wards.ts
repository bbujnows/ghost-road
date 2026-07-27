import { Container, Graphics } from 'pixi.js'
import { COLD_IRON, LANTERN } from './balance'
import type { Light, LightingSystem } from './lighting'
import type { RoadWalker } from './enemies'

/**
 * Wards, not guns — and after the roster split (consult §4), not even the lantern
 * shoots. Light and damage are separate purchases:
 *
 *  - The Lantern Post makes a stretch of road fightable. It deals nothing.
 *  - Cold Iron does the fighting, and only inside light.
 *
 * Salt lines, the church bell, the fiddler, the spring line, and the bottle tree are
 * specced (design doc §5 / consult §4) but not built. Build order is consult §9.
 */

export class Lantern {
  readonly light: Light
  readonly gfx = new Container()
  /** The flame itself, drawn above the darkness overlay and fed into the bloom. */
  readonly emissive = new Container()
  readonly x: number
  readonly y: number

  private housing = new Container()
  private flame = new Graphics()
  private sway = Math.random() * Math.PI * 2

  constructor(x: number, y: number, lighting: LightingSystem) {
    this.x = x
    this.y = y

    this.light = lighting.add({
      x,
      y,
      radius: LANTERN.radius,
      color: LANTERN.color,
      intensity: LANTERN.intensity,
      flicker: LANTERN.flicker,
    })

    // A post driven into the roadside, with a hooked arm and a hung lamp.
    const post = new Graphics()
    post.ellipse(0, 0, 9, 3.5).fill({ color: 0x000000, alpha: 0.3 })
    post.moveTo(-2, 0).lineTo(-2.5, -40).lineTo(2.5, -40).lineTo(2, 0).fill(0x4a3d30)
    post.moveTo(-1, -34).lineTo(-1, -38).lineTo(11, -38).lineTo(11, -35).fill(0x3d3128)
    post.ellipse(-6, -1, 4, 2.5).fill(0x3a3830)
    post.ellipse(6, -1, 3.5, 2).fill(0x342f28)

    // The lamp: an iron cage with glass panes and a cap.
    const lamp = new Graphics()
    lamp.moveTo(-6, -12).lineTo(6, -12).lineTo(4.5, 0).lineTo(-4.5, 0).fill(0x5c4a3a)
    lamp.moveTo(-4.5, -11).lineTo(4.5, -11).lineTo(3.5, -1).lineTo(-3.5, -1).fill(0xffcf90)
    lamp.rect(-7, -14, 14, 3).fill(0x4a3d30)
    lamp.rect(-0.7, -12, 1.4, 12).fill({ color: 0x4a3d30, alpha: 0.7 })
    lamp.moveTo(-2, -14).quadraticCurveTo(0, -19, 2, -14).stroke({ width: 1.2, color: 0x3d3128 })

    this.housing.position.set(10, -36)
    this.housing.addChild(lamp)

    this.gfx.addChild(post, this.housing)
    this.gfx.position.set(x, y)

    // The flame reads through the darkness, the way the homestead's windows do.
    this.flame.ellipse(0, -6, 3, 5).fill({ color: 0xfff0cc, alpha: 0.95 })
    this.flame.ellipse(0, -6, 6, 9).fill({ color: 0xffc078, alpha: 0.35 })
    this.emissive.position.set(x + 10, y - 36)
    this.emissive.addChild(this.flame)
  }

  /** Called every frame, including while a wave is between spawns. */
  animate(dt: number) {
    this.sway += dt * 2.4
    this.housing.rotation = Math.sin(this.sway) * 0.045
    this.flame.scale.set(1 + Math.sin(this.sway * 3.1) * 0.09, 1 + Math.sin(this.sway * 2.3) * 0.13)
    this.flame.position.x = Math.sin(this.sway) * 1.2
  }
}

/**
 * Cold Iron: a board of square-cut nails laid lengthwise along the road bed.
 *
 * It ticks against everything standing on it — but only what the light has made
 * damageable takes the bite. Laying iron in the dark is legal on purpose: it is an
 * investment waiting for a lantern, which is exactly the reveal/kill split the
 * design wants the player thinking about.
 */
export class ColdIron {
  readonly gfx = new Container()
  readonly x: number
  readonly y: number
  /** Radians; snapped to the nearest road segment at placement. */
  readonly angle: number

  private cooldown = 0
  private glints: Graphics

  constructor(x: number, y: number, angle: number) {
    this.x = x
    this.y = y
    this.angle = angle

    const L = COLD_IRON.length
    const W = COLD_IRON.width

    const board = new Graphics()
    // Shadow, then weathered board, then the nail heads in two staggered rows.
    board.roundRect(-L / 2, -W / 2 + 2, L, W, 4).fill({ color: 0x000000, alpha: 0.28 })
    board.roundRect(-L / 2, -W / 2, L, W - 3, 4).fill(0x3a332b)
    board.roundRect(-L / 2 + 2, -W / 2 + 2, L - 4, 4, 2).fill({ color: 0x474034, alpha: 0.8 })

    for (let i = 0; i < 9; i++) {
      const nx = -L / 2 + 8 + i * ((L - 16) / 8)
      board.rect(nx - 1.4, -6, 2.8, 2.8).fill(0x8d949c)
      board.rect(nx - 1.4 + 4, 3, 2.8, 2.8).fill(0x7a828b)
    }

    this.glints = new Graphics()

    this.gfx.addChild(board, this.glints)
    this.gfx.position.set(x, y)
    this.gfx.rotation = angle
  }

  /** True if a world point stands on the strip. */
  private covers(px: number, py: number): boolean {
    const dx = px - this.x
    const dy = py - this.y
    const cos = Math.cos(-this.angle)
    const sin = Math.sin(-this.angle)
    const lx = dx * cos - dy * sin
    const ly = dx * sin + dy * cos
    return Math.abs(lx) <= COLD_IRON.length / 2 && Math.abs(ly) <= COLD_IRON.width / 2
  }

  /** Returns the positions of everything it bit this tick, for the ember burst. */
  update(dt: number, walkers: RoadWalker[], lighting: LightingSystem): { x: number; y: number }[] {
    this.cooldown -= dt
    this.glints.clear()

    if (this.cooldown > 0) return []
    this.cooldown = COLD_IRON.tickInterval

    const hits: { x: number; y: number }[] = []
    for (const w of walkers) {
      if (!this.covers(w.x, w.y)) continue
      if (w.applyDamage(COLD_IRON.tickDamage, lighting) > 0) {
        hits.push({ x: w.x, y: w.y })
        // The nails glint where they bite.
        const lx = (Math.random() - 0.5) * COLD_IRON.length * 0.8
        this.glints.rect(lx, -5 + Math.random() * 10, 3, 3).fill({ color: 0xd8e2ea, alpha: 0.9 })
      }
    }
    return hits
  }
}
