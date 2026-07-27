import { Container, Graphics } from 'pixi.js'
import type { LightingSystem } from './lighting'

/**
 * Kara.
 *
 * She is a real dog — a Labrador retriever / pit bull mix with floppy ears, a warm
 * gold coat, and white running from all four paws up her belly and chest to her
 * throat. The design doc is explicit that she should read as a real dog with weight
 * and personality, not a sprite that slides around, so she is built as an articulated
 * side-view rig: two-segment legs on a walk cycle, a head that leads into turns, a
 * tail that wags when she is happy, and a ribcage that breathes when she is still.
 *
 * ── Why the rig is built twice ──────────────────────────────────────────────
 *
 * Her gold body has to sit UNDER the darkness overlay and go dark with everything
 * else, while her white paws, belly and chest sit ABOVE it so she stays trackable in
 * an unlit stretch of road. Those are two different display layers, but they have to
 * move as one animal.
 *
 * So `createRig()` is called twice — once drawing the coat, once drawing only the
 * white — and `poseRig()` applies identical transforms to both every frame. The two
 * layers are the same skeleton rendered in two places in the display list.
 *
 * Her abilities (the bark, Ear-Perk, Show Belly, the hose, bubbles, the ball stash,
 * toys, the blanket, bond) are specified in the design doc and are NOT built yet.
 */

/** Lab/pit mix: warm gold coat. */
const GOLD = 0xc9954a
const GOLD_SHADE = 0xb07f3c
/** The far-side legs, pushed back so she has depth. */
const GOLD_FAR = 0x8f6832
/** White from all four paws up the belly and chest to the throat. */
const WHITE = 0xf6f1e6
const NOSE = 0x2a2320

const WALK_SPEED = 95

// Proportions, in world px. She is about 52 long and 30 at the shoulder.
const BODY_LEN = 40
const BODY_H = 19
const HIP = { x: -15, y: -20 }
const SHOULDER = { x: 13, y: -21 }
const THIGH = 11
const SHANK = 10

interface Leg {
  root: Container
  knee: Container
}

interface Rig {
  root: Container
  /** Torso transform — carries the breathing and the walk bob. */
  core: Container
  head: Container
  ear: Container
  tail: Container
  /** [far rear, far front, near rear, near front] */
  legs: Leg[]
}

interface Pose {
  facing: 1 | -1
  /** Radians of walk cycle. */
  walk: number
  moving: boolean
  breath: number
  /** 0 relaxed, 1 fully perked. */
  earLift: number
  tailWag: number
}

function makeLeg(mode: 'coat' | 'markings', far: boolean, hip: { x: number; y: number }): Leg {
  const root = new Container()
  root.position.set(hip.x, hip.y)

  const knee = new Container()
  knee.position.set(0, THIGH)

  if (mode === 'coat') {
    const coat = far ? GOLD_FAR : GOLD
    root.addChild(new Graphics().roundRect(-3, 0, 6, THIGH + 2, 3).fill(coat))
    knee.addChild(new Graphics().roundRect(-2.5, 0, 5, SHANK, 2.5).fill(coat))
  } else {
    // Only the paw is white, and it is the brightest thing on her in the dark.
    knee.addChild(
      new Graphics().ellipse(0, SHANK + 1, 4, 3).fill(far ? 0xd8d2c4 : WHITE),
    )
  }

  root.addChild(knee)
  return { root, knee }
}

function createRig(mode: 'coat' | 'markings'): Rig {
  const root = new Container()
  const core = new Container()

  const farRear = makeLeg(mode, true, { x: HIP.x - 3, y: HIP.y })
  const farFront = makeLeg(mode, true, { x: SHOULDER.x - 3, y: SHOULDER.y })
  const nearRear = makeLeg(mode, false, HIP)
  const nearFront = makeLeg(mode, false, SHOULDER)

  const tail = new Container()
  tail.position.set(-BODY_LEN / 2 - 1, -26)

  const head = new Container()
  head.position.set(SHOULDER.x + 9, -33)

  const ear = new Container()
  ear.position.set(-1, -3)

  if (mode === 'coat') {
    // Tail: thick at the base, tapering. The lab shows here.
    tail.addChild(
      new Graphics()
        .moveTo(0, 0)
        .quadraticCurveTo(-11, -5, -19, -14)
        .stroke({ width: 5, color: GOLD, cap: 'round' }),
    )

    // Torso. The pit shows in the chest, so the front is deeper than the haunch.
    const torso = new Graphics()
    torso
      .moveTo(-BODY_LEN / 2, -24)
      .quadraticCurveTo(0, -30, BODY_LEN / 2, -25)
      .quadraticCurveTo(BODY_LEN / 2 + 6, -18, BODY_LEN / 2 - 2, -24 + BODY_H)
      .quadraticCurveTo(0, -20 + BODY_H, -BODY_LEN / 2, -24 + BODY_H - 3)
      .quadraticCurveTo(-BODY_LEN / 2 - 5, -18, -BODY_LEN / 2, -24)
      .fill(GOLD)
    // Haunch, so the back leg has somewhere to come from.
    torso.ellipse(-13, -18, 11, 10).fill(GOLD_SHADE)
    torso.ellipse(14, -20, 10, 9).fill(GOLD)
    core.addChild(torso)

    // Head: skull, muzzle, nose, eye.
    const skull = new Graphics()
    skull.ellipse(0, 0, 10, 8.5).fill(GOLD)
    skull.moveTo(4, 1).quadraticCurveTo(15, -1, 16, 3).quadraticCurveTo(15, 7, 4, 6).fill(GOLD)
    skull.circle(16, 3, 2.4).fill(NOSE)
    skull.circle(3, -2, 1.6).fill(NOSE)
    head.addChild(skull)

    // Floppy ear, hung from the back of the skull.
    ear.addChild(
      new Graphics()
        .moveTo(0, 0)
        .quadraticCurveTo(-7, 3, -6, 12)
        .quadraticCurveTo(-2, 14, 1, 6)
        .fill(GOLD_SHADE),
    )
    head.addChild(ear)
  } else {
    // The white: throat, chest, and the belly line running back between the legs.
    const blaze = new Graphics()
    blaze
      .moveTo(BODY_LEN / 2 - 3, -26)
      .quadraticCurveTo(BODY_LEN / 2 + 5, -18, BODY_LEN / 2 - 4, -24 + BODY_H)
      .quadraticCurveTo(-6, -19 + BODY_H, -BODY_LEN / 2 + 3, -22 + BODY_H)
      .quadraticCurveTo(-4, -14 + BODY_H, BODY_LEN / 2 - 6, -16 + BODY_H)
      .fill(WHITE)
    core.addChild(blaze)

    // Throat, up under the jaw.
    head.addChild(new Graphics().ellipse(2, 6, 6, 3.5).fill(WHITE))
  }

  core.addChild(head)
  root.addChild(farRear.root, farFront.root, core, nearRear.root, nearFront.root)

  // Tail behind everything.
  root.addChildAt(tail, 0)

  return { root, core, head, ear, tail, legs: [farRear, farFront, nearRear, nearFront] }
}

/** Applied identically to both rigs, so the coat and the white move as one animal. */
function poseRig(rig: Rig, p: Pose) {
  rig.root.scale.x = p.facing

  // Walk bob and breathing both live on the core, so the legs stay planted.
  const bob = p.moving ? Math.abs(Math.sin(p.walk)) * 1.6 : 0
  rig.core.position.y = -bob
  rig.core.scale.y = p.moving ? 1 : 1 + Math.sin(p.breath) * 0.02

  // Head leads: dips slightly as she walks, lifts when she is listening.
  rig.head.rotation = p.moving ? Math.sin(p.walk * 2) * 0.05 : Math.sin(p.breath * 0.7) * 0.03
  rig.head.position.y = -33 + (p.moving ? Math.sin(p.walk * 2 + 1) * 0.8 : 0) - p.earLift * 1.5

  // Floppy ears lift and swing back when she hears something.
  rig.ear.rotation = -p.earLift * 0.55 + (p.moving ? Math.sin(p.walk * 2) * 0.12 : 0)
  rig.tail.rotation = p.tailWag

  // Diagonal gait: each leg a half cycle out of phase with its diagonal partner.
  const phases = [0, Math.PI, Math.PI, 0]
  const swing = p.moving ? 0.75 : 0
  for (let i = 0; i < rig.legs.length; i++) {
    const leg = rig.legs[i]
    const a = p.walk + phases[i]
    leg.root.rotation = Math.sin(a) * swing
    // Knee only bends on the forward swing, which is what stops it looking like a
    // pendulum and starts it looking like a dog.
    leg.knee.rotation = Math.max(0, Math.sin(a + 0.6)) * swing * 0.9
  }
}

export class Kara {
  x: number
  y: number

  /** Coat and structure — sits under the darkness overlay. */
  readonly body = new Container()
  /** Paws, belly, chest — sits above it, so she never fully disappears. */
  readonly markings = new Container()

  private coatRig = createRig('coat')
  private markRig = createRig('markings')

  private target: { x: number; y: number } | null = null
  private facing: 1 | -1 = -1
  private walk = 0
  private breath = Math.random() * Math.PI * 2
  private earLift = 0
  private earTimer = 2 + Math.random() * 3
  private tailWag = 0

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    this.body.addChild(this.coatRig.root)
    this.markings.addChild(this.markRig.root)
  }

  moveTo(x: number, y: number) {
    this.target = { x, y }
  }

  update(dt: number, lighting: LightingSystem) {
    let moving = false

    if (this.target) {
      const dx = this.target.x - this.x
      const dy = this.target.y - this.y
      const dist = Math.hypot(dx, dy)

      if (dist < 4) {
        this.target = null
      } else {
        moving = true
        this.x += (dx / dist) * WALK_SPEED * dt
        this.y += (dy / dist) * WALK_SPEED * dt
        if (Math.abs(dx) > 1) this.facing = dx > 0 ? 1 : -1
        this.walk += dt * 9
      }
    }

    this.breath += dt * 1.6

    // Idle ear flicks — a dog is never completely still. Stands in for Ear-Perk,
    // which is a real detection mechanic and is not built yet.
    this.earTimer -= dt
    if (this.earTimer <= 0) {
      this.earTimer = 2.5 + Math.random() * 4
      this.earLift = 1
    }
    this.earLift = Math.max(0, this.earLift - dt * 3)

    // She wags when she is going somewhere, and settles when she stops.
    const wagTarget = moving ? Math.sin(this.walk * 1.4) * 0.5 : Math.sin(this.breath * 0.9) * 0.12
    this.tailWag += (wagTarget - this.tailWag) * Math.min(1, dt * 10)

    const pose: Pose = {
      facing: this.facing,
      walk: this.walk,
      moving,
      breath: this.breath,
      earLift: this.earLift,
      tailWag: this.tailWag,
    }
    poseRig(this.coatRig, pose)
    poseRig(this.markRig, pose)

    this.body.position.set(this.x, this.y)
    this.markings.position.set(this.x, this.y)

    // Her white picks up whatever light is nearest and never fully vanishes: in the
    // dark she is four pale paws and a chest moving through the black.
    const lit = lighting.lightAt(this.x, this.y)
    this.markings.alpha = 0.28 + 0.72 * lit
  }
}
