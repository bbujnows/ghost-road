import { Application, Container } from 'pixi.js'
import { Kara } from './kara'
import { LightingSystem } from './lighting'
import { buildPlaceholderScene } from './world'

export const WORLD_WIDTH = 1280
export const WORLD_HEIGHT = 720

export interface GameState {
  paused: boolean
  /** How lit the point under the cursor is, 0..1. Here to make the lightmap legible while building. */
  lightUnderCursor: number
}

/**
 * Skeleton only. This mounts Pixi, establishes the render layering, and demonstrates
 * the lightmap. There is deliberately no gameplay here — no enemies, no wards, no
 * economy, no waves. Those come out of the design doc (docs/design-prompt.md).
 *
 * Render layering is the one architectural decision already made, and it matters:
 *
 *   scene  →  lighting.overlay (multiply)  →  foreground
 *
 * Anything that must stay visible in unlit areas goes in `foreground`. That is where
 * Kara's white markings live, and it is why she reads as four pale paws in the dark.
 */
export class Game {
  private app = new Application()
  private lighting!: LightingSystem
  private scene = new Container()
  private foreground = new Container()

  private kara!: Kara
  private paused = false
  private pointer = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }

  private stateHandler: ((s: GameState) => void) | null = null
  private detach: (() => void)[] = []

  async mount(host: HTMLElement) {
    await this.app.init({
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      background: 0x0b1114,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    })
    host.appendChild(this.app.canvas)

    this.lighting = new LightingSystem(WORLD_WIDTH, WORLD_HEIGHT)
    this.scene.addChild(buildPlaceholderScene(WORLD_WIDTH, WORLD_HEIGHT))

    // Two placeholder lights, purely so the lightmap has something to show. Counts,
    // colors, radii, and whether the moon is even a light source are design questions.
    this.lighting.add({ x: WORLD_WIDTH / 2, y: 60, radius: 900, color: 0x5f7fa8, intensity: 0.16 })
    this.lighting.add({
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT - 100,
      radius: 190,
      color: 0xffc078,
      intensity: 0.5,
      flicker: 0.04,
    })

    this.kara = new Kara(WORLD_WIDTH / 2 - 90, WORLD_HEIGHT - 90)
    this.scene.addChild(this.kara.body)
    this.foreground.addChild(this.kara.markings)

    this.app.stage.addChild(this.scene, this.lighting.overlay, this.foreground)

    this.bindInput()
    this.app.ticker.add((ticker) => this.tick(Math.min(ticker.deltaMS / 1000, 0.05)))
  }

  onState(handler: (s: GameState) => void) {
    this.stateHandler = handler
  }

  private bindInput() {
    const canvas = this.app.canvas
    canvas.style.cursor = 'crosshair'

    const toWorld = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      return {
        x: ((e.clientX - r.left) / r.width) * WORLD_WIDTH,
        y: ((e.clientY - r.top) / r.height) * WORLD_HEIGHT,
      }
    }

    const onMove = (e: MouseEvent) => {
      this.pointer = toWorld(e)
    }
    // Walking her around is the only interaction wired up — it is what proves the
    // markings-above-the-overlay layering actually works.
    const onDown = (e: MouseEvent) => {
      const p = toWorld(e)
      this.kara.moveTo(p.x, p.y)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault()
        this.paused = !this.paused
      }
    }

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)

    this.detach.push(
      () => canvas.removeEventListener('mousemove', onMove),
      () => canvas.removeEventListener('mousedown', onDown),
      () => window.removeEventListener('keydown', onKey),
    )
  }

  private tick(dt: number) {
    if (!this.paused) {
      this.kara.update(dt, this.lighting)
      this.lighting.update(this.app.renderer, dt)
    }

    this.stateHandler?.({
      paused: this.paused,
      lightUnderCursor: this.lighting.lightAt(this.pointer.x, this.pointer.y),
    })
  }

  destroy() {
    for (const off of this.detach) off()
    this.detach = []
    this.lighting?.destroy()
    this.app.destroy(true, { children: true })
  }
}
