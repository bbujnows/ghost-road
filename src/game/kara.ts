import { Container, Graphics } from 'pixi.js'
import { EAR_PERK_RADIUS } from './balance'
import type { LightingSystem } from './lighting'

/**
 * What Kara can hear. The caller works out visibility, because that depends on the
 * lightmap; she only needs to know what is out there and what is about to be seen.
 */
export interface Threat {
  x: number
  y: number
  /** Currently in the dim band or brighter — the player can already see it. */
  visible: boolean
  /** Will be visible in EAR_PERK_LEAD seconds. This is what she tells you about. */
  soonVisible: boolean
}

/**
 * Kara.
 *
 * A Labrador retriever / pit bull mix with floppy ears, a warm gold coat, and white
 * running from all four paws up her belly and chest to her throat.
 *
 * ── Anatomy notes, learned the hard way ─────────────────────────────────────
 *
 * All geometry is in a rig-local space where **y = 0 is the ground** and the paws
 * rest on it. Everything else is negative. Keeping that invariant is what stops legs
 * sinking or floating.
 *
 * The white belly band must be drawn INSIDE the torso's lower edge, never below it.
 * The markings render above the darkness overlay, so anything that spills past the
 * body's silhouette reads as a detached white bar hanging under the dog rather than
 * as her belly.
 *
 * The head is short-muzzled and broad — a lab/pit skull, not a snout. A long tapering
 * muzzle plus a floppy ear reads unmistakably as a duck.
 *
 * ── Why the rig is built twice ──────────────────────────────────────────────
 *
 * Her gold body sits UNDER the darkness overlay and goes dark with everything else,
 * while her white paws, belly and chest sit ABOVE it so she stays trackable in an
 * unlit stretch of road. Those are two display layers that must move as one animal, so
 * `createRig()` is called twice — once drawing the coat, once drawing only the white —
 * and `poseRig()` applies identical transforms to both every frame.
 *
 * Her abilities (the bark, Ear-Perk, Show Belly, the hose, bubbles, the ball stash,
 * toys, the blanket, bond) are specified in the design doc and are NOT built yet.
 */

/** Lab/pit mix: warm gold coat. */
const GOLD = 0xc9954a
const GOLD_SHADE = 0xac7c39
/** The far-side legs, pushed back so she has depth. */
const GOLD_FAR = 0x8a6531
const WHITE = 0xf6f1e6
const WHITE_FAR = 0xcfc9bb
const NOSE = 0x241e1a

const WALK_SPEED = 95

/**
 * Drawn large for detail, then scaled down. She stands ~29px at the shoulder against
 * a 96px cabin wall, which is about right for a dog beside a one-storey cabin.
 */
const SCALE = 0.58

// Skeleton, in rig-local px. Ground is y = 0.
const HIP = { x: -14, y: -20 }
const SHOULDER = { x: 14, y: -20 }
const THIGH = 11
const SHANK = 9
const HEAD_BASE = { x: 25, y: -39 }

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
  walk: number
  moving: boolean
  breath: number
  /** 0 relaxed, 1 fully perked. */
  earLift: number
  tailWag: number
}

/** The torso outline, shared so the belly band can hug its real lower edge. */
function torso(g: Graphics, color: number) {
  g.moveTo(-20, -31)
    // Back: rises to the withers, dips slightly over the shoulder.
    .quadraticCurveTo(-6, -36, 12, -35)
    .quadraticCurveTo(19, -34, 21, -30)
    // Chest, deeper than the haunch — the pit shows here.
    .quadraticCurveTo(24, -25, 20, -20)
    // Belly, running back between the legs.
    .quadraticCurveTo(2, -17.5, -16, -20)
    // Haunch.
    .quadraticCurveTo(-23, -24, -20, -31)
    .fill(color)
}

function makeLeg(mode: 'coat' | 'markings', far: boolean, hip: { x: number; y: number }): Leg {
  const root = new Container()
  root.position.set(hip.x, hip.y)

  const knee = new Container()
  knee.position.set(0, THIGH)

  if (mode === 'coat') {
    const coat = far ? GOLD_FAR : GOLD
    // Thigh is thicker at the top so the leg tapers into the paw.
    root.addChild(
      new Graphics()
        .moveTo(-3.6, 0)
        .lineTo(3.6, 0)
        .lineTo(2.6, THIGH + 1)
        .lineTo(-2.6, THIGH + 1)
        .fill(coat),
    )
    knee.addChild(new Graphics().roundRect(-2.3, 0, 4.6, SHANK, 2).fill(coat))
  } else {
    // All four paws are white, and in the dark they are the brightest thing on her.
    knee.addChild(
      new Graphics()
        .roundRect(-2.4, SHANK - 3.5, 4.8, 3.5, 1.6)
        .fill(far ? WHITE_FAR : WHITE)
        .ellipse(0, SHANK, 3, 1.8)
        .fill(far ? WHITE_FAR : WHITE),
    )
  }

  root.addChild(knee)
  return { root, knee }
}

function createRig(mode: 'coat' | 'markings'): Rig {
  const root = new Container()
  root.scale.set(SCALE)

  const core = new Container()

  const farRear = makeLeg(mode, true, { x: HIP.x - 4, y: HIP.y })
  const farFront = makeLeg(mode, true, { x: SHOULDER.x - 4, y: SHOULDER.y })
  const nearRear = makeLeg(mode, false, HIP)
  const nearFront = makeLeg(mode, false, SHOULDER)

  const tail = new Container()
  tail.position.set(-19, -31)

  const head = new Container()
  head.position.set(HEAD_BASE.x, HEAD_BASE.y)

  const ear = new Container()
  ear.position.set(1, -8)

  if (mode === 'coat') {
    tail.addChild(
      new Graphics()
        .moveTo(0, 0)
        .quadraticCurveTo(-9, -3, -16, -11)
        .stroke({ width: 4.5, color: GOLD, cap: 'round' })
        .circle(-16, -11, 2.2)
        .fill(GOLD),
    )

    const body = new Graphics()
    torso(body, GOLD)
    // Shading inside the silhouette, never a blob sitting on top of it.
    body.ellipse(-11, -25, 8, 6).fill({ color: GOLD_SHADE, alpha: 0.45 })
    body.moveTo(14, -34).quadraticCurveTo(19, -27, 17, -20).stroke({ width: 1, color: GOLD_SHADE, alpha: 0.5 })
    // Neck, filling the gap from the withers up to the skull.
    body
      .moveTo(13, -34)
      .quadraticCurveTo(20, -40, 28, -41)
      .lineTo(29, -33)
      .quadraticCurveTo(21, -30, 16, -27)
      .fill(GOLD)
    core.addChild(body)

    const skull = new Graphics()
    // Broad cranium.
    skull.ellipse(4, -4, 9, 8).fill(GOLD)
    // Short blocky muzzle with a defined stop — lab/pit, not a snout.
    skull
      .moveTo(9, -7)
      .quadraticCurveTo(17, -7.5, 19, -4.5)
      .quadraticCurveTo(19, -0.5, 15, 0)
      .quadraticCurveTo(10, 0.5, 8, -1)
      .fill(GOLD)
    // Jowl.
    skull.ellipse(12, -0.5, 5, 2.4).fill({ color: GOLD_SHADE, alpha: 0.5 })
    skull.circle(18.6, -4.2, 2.3).fill(NOSE)
    skull.circle(6.5, -6.4, 1.7).fill(NOSE)
    skull.circle(7.1, -7, 0.6).fill({ color: 0xffffff, alpha: 0.8 })
    head.addChild(skull)

    // Floppy ear, hung from behind the eye and falling past the jaw.
    ear.addChild(
      new Graphics()
        .moveTo(0, 0)
        .quadraticCurveTo(-6.5, 2, -6, 11)
        .quadraticCurveTo(-2.5, 14.5, 1.5, 7)
        .quadraticCurveTo(3, 3, 0, 0)
        .fill(GOLD_SHADE),
    )
    head.addChild(ear)
  } else {
    // White chest and belly, clipped to the inside of the torso outline. The band
    // follows the same curve as the body's lower edge, one pixel up.
    const white = new Graphics()
    white
      .moveTo(20, -21)
      .quadraticCurveTo(2, -18.5, -16, -21)
      .quadraticCurveTo(2, -22.5, 19, -25)
      .fill(WHITE)
    // Chest, rising to the throat.
    white
      .moveTo(20.5, -21)
      .quadraticCurveTo(23.5, -25, 20.5, -30)
      .quadraticCurveTo(16, -27, 15, -21)
      .fill(WHITE)
    // Up the front of the neck.
    white.moveTo(20, -30).quadraticCurveTo(24, -33, 27, -36).lineTo(28, -32).quadraticCurveTo(24, -29, 21, -27).fill(WHITE)
    core.addChild(white)

    // Throat and chin.
    head.addChild(new Graphics().ellipse(9, 0.5, 5.5, 2.2).fill(WHITE))
  }

  core.addChild(head)
  root.addChild(tail, farRear.root, farFront.root, core, nearRear.root, nearFront.root)

  return { root, core, head, ear, tail, legs: [farRear, farFront, nearRear, nearFront] }
}

/** Applied identically to both rigs, so the coat and the white move as one animal. */
function poseRig(rig: Rig, p: Pose) {
  rig.root.scale.x = SCALE * p.facing

  const bob = p.moving ? Math.abs(Math.sin(p.walk)) * 1.5 : 0
  rig.core.position.y = -bob
  // Breathing shallows out when she is listening. A still dog is a worried dog.
  rig.core.scale.y = p.moving ? 1 : 1 + Math.sin(p.breath) * 0.018 * (1 - p.earLift * 0.7)

  // Listening: the head comes up and levels off, and the whole body goes still.
  rig.head.rotation =
    (p.moving ? Math.sin(p.walk * 2) * 0.05 : Math.sin(p.breath * 0.7) * 0.03) * (1 - p.earLift) -
    p.earLift * 0.1
  rig.head.position.y =
    HEAD_BASE.y + (p.moving ? Math.sin(p.walk * 2 + 1) * 0.7 : 0) - p.earLift * 2.6
  rig.head.position.x = HEAD_BASE.x + p.earLift * 1.2

  // The ear is the tell. Floppy at rest, and on a perk it swings up and back and
  // stiffens — a floppy-eared dog cannot prick its ears, it lifts them at the base.
  rig.ear.rotation = -p.earLift * 0.95 + (p.moving ? Math.sin(p.walk * 2) * 0.14 : 0) * (1 - p.earLift * 0.7)
  rig.ear.scale.set(1 + p.earLift * 0.08, 1 - p.earLift * 0.16)

  rig.tail.rotation = p.tailWag

  // Diagonal gait: each leg a half cycle out of phase with its diagonal partner.
  const phases = [0, Math.PI, Math.PI, 0]
  const swing = p.moving ? 0.7 : 0
  for (let i = 0; i < rig.legs.length; i++) {
    const leg = rig.legs[i]
    const a = p.walk + phases[i]
    leg.root.rotation = Math.sin(a) * swing
    // The knee only bends on the forward swing, which is what stops it looking like a
    // pendulum and starts it looking like a dog.
    leg.knee.rotation = Math.max(0, Math.sin(a + 0.6)) * swing * 0.85
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

  /**
   * §3.2 Ear-Perk. True while she is telling the player about something they cannot
   * see yet. This is the game's primary tell, and it is deliberately not surfaced in
   * the HUD — the player is meant to learn to watch her ears instead of the road.
   */
  alert = false

  private target: { x: number; y: number } | null = null
  private facing: 1 | -1 = -1
  private walk = 0
  private breath = Math.random() * Math.PI * 2
  private earLift = 0
  private idleFlick = 0
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

  update(dt: number, lighting: LightingSystem, threats: Threat[] = []) {
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

    // ── Ear-Perk (§3.2) ──────────────────────────────────────────────────────
    //
    // She perks at what is about to be seen, not at whatever happens to be nearby.
    // Tying the tell to impending visibility rather than raw proximity is what keeps
    // it meaningful: at 280px and 30px/s, "anything within earshot" would leave her
    // ears up for nine seconds at a stretch and the signal would mean nothing.
    let listening: Threat | null = null
    let nearest = Infinity

    for (const t of threats) {
      const d = Math.hypot(t.x - this.x, t.y - this.y)
      if (d > EAR_PERK_RADIUS || d >= nearest) continue
      if (t.visible || !t.soonVisible) continue
      nearest = d
      listening = t
    }

    this.alert = listening !== null

    // Idle flicks, so she is never completely still when nothing is coming.
    this.earTimer -= dt
    if (this.earTimer <= 0) {
      this.earTimer = 2.5 + Math.random() * 4
      this.idleFlick = 1
    }
    this.idleFlick = Math.max(0, this.idleFlick - dt * 3)

    // A perk snaps up fast and comes down slowly — the shape of actually hearing
    // something. An idle flick is a much smaller, quicker motion.
    const earTarget = this.alert ? 1 : this.idleFlick * 0.45
    const rate = earTarget > this.earLift ? 11 : 2.4
    this.earLift += (earTarget - this.earLift) * Math.min(1, dt * rate)

    // She turns to look at it, but only when she is not already going somewhere.
    if (listening && !moving) {
      const dx = listening.x - this.x
      if (Math.abs(dx) > 6) this.facing = dx > 0 ? 1 : -1
    }

    // A dog that has heard something stops wagging.
    const wagIdle = Math.sin(this.breath * 0.9) * 0.12
    const wagTarget = (moving ? Math.sin(this.walk * 1.4) * 0.5 : wagIdle) * (1 - this.earLift * 0.85)
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
