import { Container, Graphics } from 'pixi.js'
import { BLANKET, BUBBLES, HOLD, KARA, KARA_WALK_SPEED, LEAD, SHOW_BELLY } from './balance'
import type { LightingSystem } from './lighting'
import { form } from './shading'
import { loadoutFor } from './toys'
import type { Loadout, ToyId } from './toys'
import { HOMESTEAD } from './world'

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
 * ── What she can do ─────────────────────────────────────────────────────────
 *
 * Built: Ear-Perk (passive), Send, Bubbles, Show Belly, the Blanket, going Down, and
 * Hold when the Rope is equipped. Every one of them traces to something the real dog
 * does.
 *
 * **Every stat a toy can change is read from `loadout`, never from the balance constant
 * directly.** Reading `BUBBLES.maxCharges` where the Sock Monkey is meant to apply is
 * the bug this structure exists to prevent, and it would be invisible until someone
 * wondered why a toy did nothing.
 *
 * Not built, and specified in the design doc: the bark (§10), the hose (§3.3), the
 * dropped ball (§3.5), bond (§3.4), and Lead.
 */

/** Lab/pit mix: warm gold coat. */
const GOLD = 0xc9954a
const GOLD_SHADE = 0xac7c39
/** The far-side legs, pushed back so she has depth. */
const GOLD_FAR = 0x8a6531
const WHITE = 0xf6f1e6
const WHITE_FAR = 0xcfc9bb
const NOSE = 0x241e1a

/**
 * Drawn large for detail, then scaled down.
 *
 * **Raised 0.58 → 0.72 on 2026-07-29 (fix-plan F3).** At 0.58 she was ~29px and, in the
 * recorded session, the hardest actor on screen to find — in several frames she could not
 * be located without knowing where to look. The whole positioning is *the tower defense
 * where you watch the dog, not the road*, and that sentence was not true of the thing on
 * screen. At 0.72 she is ~36px at the shoulder against a 96px cabin wall, still correctly
 * proportioned for a dog beside a one-storey cabin.
 */
const SCALE = 0.72

/** How far over she goes on a Show Belly. Just past upside-down, so the belly faces up. */
const ROLL_ANGLE = Math.PI * 0.86
/** Seconds to get over onto her back. The way back up takes the whole recovery. */
const ROLL_IN = 0.25
/** Rig-local height of her spine — the axis she rolls around. */
const ROLL_PIVOT_Y = -24

const ease = (t: number) => t * t * (3 - 2 * t)

/**
 * What she is doing, and therefore what the player is allowed to ask of her.
 *
 * `down` is the only one she does not choose. §3.1: she is never permanently lost —
 * at 0 HP she limps home and is unavailable, and the player is blind for that stretch.
 * That is the entire cost, and it is enough.
 */
export type KaraMode = 'free' | 'belly' | 'blanket' | 'coax' | 'down' | 'hold' | 'errand'

/** Why she is away from where you put her. */
export type Errand = 'ball' | 'fetch'

/**
 * The quilt off the porch rail. Drawn under the darkness overlay on purpose: a dog
 * under a blanket in an unlit yard is a dog nobody can find, which is exactly the
 * bargain the ability offers.
 */
function quiltShape(): Graphics {
  const g = new Graphics()
  const CLOTH = 0x6d4f52
  const PATCH = 0x8a5f56
  const PALE = 0x9c8a76

  g.ellipse(0, -1, 26, 5).fill({ color: 0x000000, alpha: 0.3 })
  // A lumpy mound with a dog-shaped ridge under it.
  g.moveTo(-25, -1)
    .quadraticCurveTo(-22, -15, -10, -18)
    .quadraticCurveTo(2, -21, 12, -17)
    .quadraticCurveTo(24, -13, 25, -1)
    .quadraticCurveTo(0, 3, -25, -1)
    .fill(CLOTH)
  // Patchwork, following the curve rather than sitting flat on it.
  g.moveTo(-14, -14).lineTo(-3, -18).lineTo(-1, -8).lineTo(-12, -4).fill({ color: PATCH, alpha: 0.7 })
  g.moveTo(4, -18).lineTo(15, -14).lineTo(14, -5).lineTo(3, -8).fill({ color: PALE, alpha: 0.35 })
  // Stitching, and the ragged trailing edge.
  g.moveTo(-25, -1).quadraticCurveTo(0, 2, 25, -1).stroke({ width: 1.2, color: PALE, alpha: 0.4 })
  for (let i = 0; i < 7; i++) {
    const x = -22 + i * 7
    g.moveTo(x, 0).lineTo(x + 2, 3).lineTo(x + 4, 0).fill({ color: CLOTH, alpha: 0.85 })
  }
  return g
}

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
  /** Rotates about her spine for the Show Belly roll. */
  roll: Container
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
  /** 0 on her feet, 1 fully on her back. */
  roll: number
}

/** The torso outline, shared so the belly band can hug its real lower edge. */
/**
 * `shaded` puts a gradient through the gold so her back catches the light and her belly
 * falls into shadow. It is passed rather than assumed because **this is only ever safe on
 * the coat rig.** The markings rig draws the same silhouette in white, above the darkness
 * overlay, and that white is the one thing in the game the dark is never allowed to take —
 * a gradient through it would dim exactly the part §2.4 depends on staying legible.
 */
function torso(g: Graphics, color: number, shaded = false) {
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
    .fill(shaded ? { fill: form(color) } : { color })
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

/**
 * ⚠ **Exported for the Fetch, and for nothing else.**
 *
 * §6's Fetch is "a copy of Kara. Same silhouette, same gait — **but no white markings.**"
 * That only works if it is literally the same rig: a hand-drawn lookalike would differ by a
 * few pixels somewhere, and the player would learn to spot *that* instead of the paws,
 * which would quietly destroy §2.4 — the rule the whole art direction is built on.
 *
 * So the Fetch builds `createRig('coat')` and never `'markings'`, and the tell is exactly
 * the thing the design says it is.
 */
export { createRig, poseRig, SCALE as KARA_SCALE }
export type { Rig, Pose }

function createRig(mode: 'coat' | 'markings'): Rig {
  const root = new Container()
  root.scale.set(SCALE)

  // Everything hangs off the roll node, which pivots about her spine so a Show Belly
  // tips her over in place instead of swinging her around her feet.
  const roll = new Container()
  roll.pivot.set(0, ROLL_PIVOT_Y)
  roll.position.set(0, ROLL_PIVOT_Y)
  root.addChild(roll)

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
    torso(body, GOLD, true)
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
  roll.addChild(tail, farRear.root, farFront.root, core, nearRear.root, nearFront.root)

  return { root, roll, core, head, ear, tail, legs: [farRear, farFront, nearRear, nearFront] }
}

/** Applied identically to both rigs, so the coat and the white move as one animal. */
function poseRig(rig: Rig, p: Pose) {
  rig.root.scale.x = SCALE * p.facing

  // ── Show Belly ───────────────────────────────────────────────────────────
  // She goes over onto her spine. Rolling toward the camera (positive local
  // rotation, which the mirrored scale flips with her) is what turns the white
  // belly upward instead of hiding it behind her.
  rig.roll.rotation = p.roll * ROLL_ANGLE

  if (p.roll > 0) {
    // Legs splay and paddle at the air — the whole reason this animation is joyful.
    const paddle = Math.sin(p.walk * 3.4) * 0.5 * p.roll
    for (let i = 0; i < rig.legs.length; i++) {
      const leg = rig.legs[i]
      leg.root.rotation = (i % 2 === 0 ? -0.7 : -1.1) * p.roll + paddle * (i % 2 ? 1 : -1)
      leg.knee.rotation = 1.1 * p.roll
    }
    // Head lolls back, ear falls away from the skull, tail sweeps the ground.
    rig.head.rotation = 0.55 * p.roll
    rig.head.position.set(HEAD_BASE.x, HEAD_BASE.y + 2 * p.roll)
    rig.ear.rotation = 0.9 * p.roll
    rig.ear.scale.set(1, 1)
    rig.tail.rotation = Math.sin(p.walk * 2.2) * 0.5 * p.roll
    rig.core.position.y = 0
    rig.core.scale.y = 1
    return
  }

  rig.ear.scale.set(1, 1)

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

  /**
   * §3.2 Show Belly. 0 while she is on her feet, rising to 1 at the height of the
   * flash. The game drives her belly light straight off this envelope.
   */
  bellyGlow = 0

  /** §3.1. She is never permanently lost; at 0 this becomes 25 seconds of absence. */
  hp: number = KARA.hp

  /**
   * §4. The night's toy, resolved to plain numbers once so nothing downstream has to ask
   * which toy is equipped.
   */
  loadout: Loadout = loadoutFor('rope')

  private mode: KaraMode = 'free'

  get state(): KaraMode {
    return this.mode
  }

  /** True while she cannot be given an order. */
  get busy() {
    return this.mode !== 'free'
  }

  /**
   * Whether anything on the board can reach her. False under the blanket, false while
   * she is being coaxed out of it, and false once she is Down — a downed dog is out of
   * the fight, not a thing left on the field to be chewed on.
   */
  get targetable() {
    // Holding included on purpose: she is planted in the road with her feet dug in. It
    // is the most exposed she ever is, and it should be.
    return this.mode === 'free' || this.mode === 'belly' || this.mode === 'hold'
  }

  /** Seconds left in whatever is currently holding her, for the HUD. */
  get stateRemaining() {
    if (this.mode === 'down') return Math.max(0, this.downTimer)
    if (this.mode === 'coax') return Math.max(0, this.coaxTimer)
    if (this.mode === 'blanket') return Math.max(0, BLANKET.minimum - this.underTimer)
    return 0
  }

  get bellyReady() {
    return this.bellyCooldown <= 0 && !this.busy
  }

  get bellyCooldownRemaining() {
    return Math.max(0, this.bellyCooldown)
  }

  get bubbleCharges() {
    return Math.floor(this.charges)
  }

  private target: { x: number; y: number } | null = null
  private facing: 1 | -1 = -1
  private walk = 0
  private breath = Math.random() * Math.PI * 2
  private earLift = 0
  private idleFlick = 0
  private earTimer = 2 + Math.random() * 3
  private tailWag = 0
  private speed = KARA_WALK_SPEED

  private bellyTimer = 0
  private bellyCooldown = 0
  private roll = 0
  private charges: number = BUBBLES.maxCharges

  private downTimer = 0
  private underTimer = 0
  private coaxTimer = 0
  private holdTimer = 0
  private holdCooldown = 0
  /** Set each frame by update(); read by the audio layer for her tags. */
  private walking = false

  /**
   * §5, the Fiddler's *Shady Grove* branch. She moves to it.
   *
   * A multiplier rather than a loadout field because the Fiddler can be frightened
   * mid-wave and the music stops — this changes while she is walking, which nothing in
   * `loadout` does.
   */
  tempo = 1

  /**
   * One-shot flags the Game drains each frame. They exist because the bond and stash
   * ledgers belong to the Game, not to her — she does the thing, it does the accounting.
   */
  ignoredBall = false
  finishedErrand: Errand | null = null
  /** §3.4: −5 bond. Raised once, the frame she goes Down. */
  wentDown = false

  /** Last frame's delta, so pose() can ease things without threading dt through. */
  private dt = 1 / 60
  /** Seconds of Blanket Scrap speed left after she comes out. */
  private boost = 0
  /** 0 in the open, 1 completely hidden. Drives the quilt and hides the rigs. */
  private under = 0

  private quilt = quiltShape()
  /** One white paw left sticking out. In the dark it is the only way to find her. */
  private pawOut = new Graphics()

  /**
   * A soft warmth on the ground under her (fix-plan F3).
   *
   * Drawn above the darkness overlay, so she is findable at a glance at any fog density.
   * It is deliberately warm and deliberately *not* a UI marker: she reads as the one warm
   * thing in the hollow rather than as a tagged unit. It is also the whole tell that
   * separates her from a Bone Dog at 36px — the silhouette confusion is good and stays,
   * because it is the Fetch's foreshadowing, but warmth is something the dead do not have.
   */
  private halo = new Graphics()

  constructor(x: number, y: number) {
    this.x = x
    this.y = y

    this.quilt.alpha = 0
    this.pawOut
      .roundRect(-3, -5, 6, 5, 2)
      .fill(WHITE)
      .ellipse(0, 0, 3.6, 2.2)
      .fill(WHITE)
    this.pawOut.position.set(17, 0)
    this.pawOut.alpha = 0

    // Three rings rather than one, so the falloff reads as light on ground and not as a
    // flat disc with an edge.
    for (const [r, a] of [
      [46, 0.05],
      [30, 0.05],
      [17, 0.06],
    ] as const) {
      this.halo.ellipse(0, -3, r, r * 0.42).fill({ color: 0xffe6bd, alpha: a })
    }

    // §3.5. A scuffed tennis ball at her feet. In the markings layer so it survives the
    // dark — the whole point of the moment is that you cannot miss it.
    this.ballGfx
      .ellipse(0, 1, 6, 2.5)
      .fill({ color: 0x000000, alpha: 0.3 })
      .circle(0, -4, 5)
      .fill(0xc9d94f)
      .moveTo(-4.4, -6)
      .quadraticCurveTo(0, -3.4, 4.4, -6)
      .stroke({ width: 1, color: 0xf2f6d8, alpha: 0.8 })
    this.ballGfx.position.set(-20, 0)
    this.ballGfx.alpha = 0

    this.body.addChild(this.coatRig.root, this.quilt)
    // Halo first, so she stands on it rather than inside it.
    this.markings.addChild(this.halo, this.markRig.root, this.pawOut, this.ballGfx)
  }

  /**
   * A Send while she is under the blanket does not fail — it starts the coaxing, and
   * she goes where she was told once she is out. Making the player press the right key
   * to undo a thing they chose would be a tax on their own decision.
   */
  moveTo(x: number, y: number) {
    if (this.mode === 'blanket') {
      if (!this.leaveBlanket()) return
      this.target = { x, y }
      this.speed = this.loadout.walkSpeed
      return
    }
    if (this.busy) return
    this.target = { x, y }
    this.speed = this.loadout.walkSpeed
  }

  /**
   * §3.2 The Blanket. She loves being under blankets, and she goes willingly — pressing
   * `Z` again (or sending her) starts the coaxing, which she will not begin before the
   * three-second minimum. Six seconds from cover to having her back.
   *
   * Under it she is untargetable, blind, and contributes nothing. It is a panic button
   * and a total blackout at the same time, which is the honest price of invulnerability
   * in a game where her presence is the whole information system.
   */
  blanket(): boolean {
    if (this.mode === 'blanket') return this.leaveBlanket()
    if (this.mode !== 'free') return false

    this.mode = 'blanket'
    this.underTimer = 0
    this.target = null
    return true
  }

  private leaveBlanket(): boolean {
    if (this.mode !== 'blanket' || this.underTimer < BLANKET.minimum) return false
    this.mode = 'coax'
    this.coaxTimer = this.loadout.blanketCoax
    return true
  }

  get holdReady() {
    return this.loadout.hold && this.holdCooldown <= 0 && this.mode === 'free'
  }

  get holdCooldownRemaining() {
    return Math.max(0, this.holdCooldown)
  }

  /** True while she is planted. The Game reads this to stop things getting past her. */
  get holding() {
    return this.mode === 'hold'
  }

  /**
   * §3.5 / §9. She is off doing something that is not defending the homestead.
   *
   * The round trip is emergent from the distance rather than a timer, which is the honest
   * version: a ball thrown further costs more, and the cost is visible as her crossing the
   * yard rather than as a number counting down.
   */
  private errand: { kind: Errand; to: { x: number; y: number }; home: { x: number; y: number }; back: boolean } | null =
    null

  get errandKind(): Errand | null {
    return this.errand?.kind ?? null
  }

  /** §3.5. A ball is on the ground and she is looking at you. */
  ballOut = false
  private ballTimer = 0
  private ballGfx = new Graphics()

  /** True while she has dropped one and is waiting. The player has 6 seconds. */
  get waitingOnBall() {
    return this.ballOut
  }

  get ballSecondsLeft() {
    return Math.max(0, this.ballTimer)
  }

  /**
   * §3.5. Weighted to be *inconvenient* — the doc is explicit that the timing must not be
   * fair. The Game picks the moment; she only has to stop and stare.
   */
  dropBall() {
    if (this.mode !== 'free' || this.ballOut) return
    this.ballOut = true
    this.ballTimer = 6
    this.target = null
  }

  /** Throw it. Returns false if there is nothing to throw. */
  throwBall(x: number, y: number): boolean {
    if (!this.ballOut) return false
    this.ballOut = false
    this.ballTimer = 0
    this.beginErrand('ball', x, y)
    return true
  }

  /** §9. She drags something back out of the dark. Six seconds of not being here. */
  sendToFetch(x: number, y: number) {
    if (this.mode !== 'free') return false
    this.beginErrand('fetch', x, y)
    return true
  }

  private beginErrand(kind: Errand, x: number, y: number) {
    this.errand = { kind, to: { x, y }, home: { x: this.x, y: this.y }, back: false }
    this.mode = 'errand'
    this.target = { x, y }
    this.speed = kind === 'ball' ? BUBBLES.chaseSpeed : this.loadout.walkSpeed
  }

  /** §10: her tags only ring when she is on the move. A still dog is a silent dog. */
  get moving() {
    return this.walking
  }

  /** Free, standing still, and nobody has asked her for anything. §3.3 uses this. */
  get idle() {
    return this.mode === 'free' && this.target === null && !this.ballOut
  }

  /**
   * §5 Church Bell. It rings and she cannot hear anything else for a moment.
   *
   * This is the bell's whole price. It reveals the entire board and freezes it, and in
   * exchange the player loses the instrument they normally read the dark with — so the
   * bell is not a free button, it is a trade of one kind of sight for another.
   */
  deafen(seconds: number) {
    this.deafFor = Math.max(this.deafFor, seconds)
  }

  get deafened() {
    return this.deafFor > 0
  }

  private deafFor = 0

  /**
   * §3.2 **Lead.** The last thing she learns, and the only ability gated behind having
   * actually looked after her.
   *
   * She walks ahead and the fog is not there where she is. She does not fight the Drover;
   * she makes it possible to. The Game owns the gating — Bond T4, Night 7, once — because
   * she has no idea what night it is.
   */
  lead(): boolean {
    if (this.mode !== 'free') return false
    this.leading = LEAD.duration
    return true
  }

  get leadRemaining() {
    return Math.max(0, this.leading)
  }

  private leading = 0

  /**
   * §3.2 Hold, granted by the Rope (§4). She plants herself and nothing gets past. `H`
   * again lets go early, which matters — the full 8 seconds costs her half her health,
   * and a player who cannot stop paying will simply never press it.
   */
  hold(): boolean {
    if (this.mode === 'hold') {
      this.mode = 'free'
      this.holdTimer = 0
      return true
    }
    if (!this.holdReady) return false

    this.mode = 'hold'
    this.holdTimer = HOLD.maxDuration
    this.holdCooldown = HOLD.cooldown
    this.target = null
    return true
  }

  /** Called by the Game while she is actually straining against something. */
  strain(dt: number) {
    if (this.mode !== 'hold') return
    this.bite(HOLD.strain * dt)
  }

  /**
   * Something got to her. 2× while she is on her back, which is the first time Show
   * Belly's vulnerability has ever cost anything.
   */
  bite(amount: number) {
    if (!this.targetable) return

    this.hp -= amount * (this.roll > 0 ? SHOW_BELLY.vulnerability : 1)
    if (this.hp > 0) return

    // §3.1 Down. She limps to the porch and lies there. She is not lost.
    this.hp = 0
    this.mode = 'down'
    this.wentDown = true
    this.errand = null
    this.ballOut = false
    this.downTimer = this.scarredDown ?? this.loadout.downDuration
    this.roll = 0
    this.bellyGlow = 0
    // Two dogs can put her Down inside the 2.2s roll. If the envelope were left running
    // it would finish and hand her back to 'free' with the Down clock still going —
    // Show Belly would silently cancel the punishment it exists to expose her to.
    this.bellyTimer = 0
    this.target = { x: HOMESTEAD.x - 60, y: HOMESTEAD.y + 40 }
    this.speed = KARA.limpSpeed
  }

  /**
   * §7.2 scar 2, "Broken porch": her Down recovery goes 25s → 40s for the rest of the run.
   * Null restores whatever the loadout says, which is how Normal and a fresh Hard run get
   * their number back.
   */
  setDownDuration(seconds: number | null) {
    this.scarredDown = seconds
  }

  private scarredDown: number | null = null

  /** Between waves she gets a breather. Not from the doc — see KARA.healPerWave. */
  rest(amount: number) {
    if (this.mode === 'down') return
    this.hp = Math.min(this.loadout.maxHp, this.hp + amount)
  }

  /**
   * Starting a night — a retry or the next one. She starts it whole, whatever happened in
   * the last one, and the night's toy is applied here because it is chosen on the
   * briefing screen and must be in force before the first spawn.
   */
  reset(x: number, y: number, toy: ToyId, bondTier = 0) {
    this.loadout = loadoutFor(toy, bondTier)

    this.x = x
    this.y = y
    this.hp = this.loadout.maxHp
    this.mode = 'free'
    this.target = null
    this.speed = this.loadout.walkSpeed
    this.bellyTimer = 0
    this.bellyCooldown = 0
    this.roll = 0
    this.bellyGlow = 0
    this.charges = this.loadout.bubbleCharges
    this.holdTimer = 0
    this.holdCooldown = 0
    this.boost = 0
    this.errand = null
    this.ballOut = false
    this.ballTimer = 0
    this.ignoredBall = false
    this.finishedErrand = null
    this.wentDown = false
    this.leading = 0
    this.deafFor = 0
    this.under = 0
    this.downTimer = 0
    this.underTimer = 0
    this.coaxTimer = 0
    this.alert = false
  }

  /**
   * She chases a bubble without hesitation — nearly twice her walking speed. This is
   * her blink, and the reason it costs a charge rather than a cooldown is that the
   * player should be able to spend both at once when it matters.
   */
  chaseBubble(x: number, y: number): boolean {
    if (this.busy || this.charges < 1) return false
    this.charges -= 1
    this.target = { x, y }
    this.speed = BUBBLES.chaseSpeed
    return true
  }

  /** Returns false if she is on cooldown or already down. */
  showBelly(): boolean {
    if (!this.bellyReady) return false
    this.mode = 'belly'
    this.bellyTimer = SHOW_BELLY.flash + SHOW_BELLY.recovery
    this.bellyCooldown = this.loadout.bellyCooldown
    this.target = null
    return true
  }

  update(dt: number, lighting: LightingSystem, threats: Threat[] = []) {
    this.dt = dt
    let moving = false

    // §3.2 Lead. The clear air travels with her, so it is written every frame she has it.
    this.leading = Math.max(0, this.leading - dt)
    lighting.fogClear = this.leading > 0 ? { x: this.x, y: this.y, radius: LEAD.radius } : null

    this.bellyCooldown = Math.max(0, this.bellyCooldown - dt)
    this.charges = Math.min(
      this.loadout.bubbleCharges,
      this.charges + dt / this.loadout.bubbleRegen,
    )

    // ── The blanket ──────────────────────────────────────────────────────────
    // She goes under fast and comes out slowly, and no part of her works while she is
    // under: no ears, no light, no position. That blackout is the price.
    if (this.mode === 'blanket' || this.mode === 'coax') {
      this.alert = false
      this.bellyGlow = 0
      this.roll = 0

      if (this.mode === 'blanket') {
        this.underTimer += dt
        this.under = Math.min(1, this.underTimer / BLANKET.settle)
      } else {
        this.coaxTimer -= dt
        // She stays covered until the last half-second, then shrugs it off.
        this.under = Math.min(1, Math.max(0, this.coaxTimer / 0.5))
        if (this.coaxTimer <= 0) {
          this.mode = 'free'
          this.under = 0
          this.boost = this.loadout.emergeBoost
        }
      }

      // She squirms under there, because of course she does.
      this.breath += dt * 2.2
      this.pose(false, lighting)
      return
    }

    this.under = 0

    // ── Show Belly envelope ──────────────────────────────────────────────────
    if (this.bellyTimer > 0) {
      this.bellyTimer = Math.max(0, this.bellyTimer - dt)
      const elapsed = SHOW_BELLY.flash + SHOW_BELLY.recovery - this.bellyTimer

      if (elapsed < ROLL_IN) this.roll = ease(elapsed / ROLL_IN)
      else if (elapsed < SHOW_BELLY.flash) this.roll = 1
      else this.roll = 1 - ease((elapsed - SHOW_BELLY.flash) / SHOW_BELLY.recovery)

      // Light holds, then eases out over the last 0.4s of the flash — and is gone
      // before she is back on her feet, so the reward ends before the risk does.
      const fadeFrom = SHOW_BELLY.flash - 0.4
      if (elapsed < fadeFrom) this.bellyGlow = this.roll
      else if (elapsed < SHOW_BELLY.flash) this.bellyGlow = 1 - (elapsed - fadeFrom) / 0.4
      else this.bellyGlow = 0

      this.walk += dt * 9
      if (this.bellyTimer <= 0) this.mode = 'free'
      this.pose(false, lighting)
      return
    }

    this.roll = 0
    this.bellyGlow = 0

    this.holdCooldown = Math.max(0, this.holdCooldown - dt)
    this.boost = Math.max(0, this.boost - dt)

    // ── The dropped ball (§3.5) ──────────────────────────────────────────────
    // She waits six seconds and then picks it back up, disappointed. The Game charges
    // the bond either way; all she does is stand there and look at you.
    if (this.ballOut) {
      this.ballTimer -= dt
      if (this.ballTimer <= 0) {
        this.ballOut = false
        this.ignoredBall = true
      }
    }

    // ── Errands (§3.5 fetching the ball, §9 fetching the stash) ──────────────
    // Out to the point, then straight back to where she was standing. The whole cost is
    // the crossing, and the player watches her do it.
    if (this.mode === 'errand' && this.errand && !this.target) {
      if (!this.errand.back) {
        this.errand.back = true
        this.target = { ...this.errand.home }
        this.speed = this.loadout.walkSpeed
      } else {
        this.finishedErrand = this.errand.kind
        this.errand = null
        this.mode = 'free'
      }
    }

    // ── Hold (§3.2, Rope toy) ────────────────────────────────────────────────
    // She does not move and does not take orders, but she is still listening — planted
    // is not the same as absent, and her ears are the one thing this never costs.
    if (this.mode === 'hold') {
      this.holdTimer -= dt
      if (this.holdTimer <= 0) this.mode = 'free'
      this.target = null
    }

    // ── Down (§3.1) ──────────────────────────────────────────────────────────
    // She keeps limping toward the porch while the clock runs, so the player watches
    // her go rather than seeing her switch off. Nothing else about her works.
    if (this.mode === 'down') {
      this.downTimer -= dt
      if (this.downTimer <= 0) {
        this.mode = 'free'
        this.hp = this.loadout.maxHp
        this.speed = this.loadout.walkSpeed
      }
      this.alert = false
      this.earLift = Math.max(0, this.earLift - dt * 2)
      this.tailWag += (0 - this.tailWag) * Math.min(1, dt * 4)
    }

    if (this.target) {
      const dx = this.target.x - this.x
      const dy = this.target.y - this.y
      const dist = Math.hypot(dx, dy)

      if (dist < 4) {
        this.target = null
        this.speed = this.loadout.walkSpeed
      } else {
        moving = true
        // The Blanket Scrap's parting gift: she comes out of the quilt already running.
        const v = this.speed * (this.boost > 0 ? this.loadout.emergeSpeed : 1) * this.tempo * dt
        this.x += (dx / dist) * v
        this.y += (dy / dist) * v
        if (Math.abs(dx) > 1) this.facing = dx > 0 ? 1 : -1
        // Chasing a bubble, her legs go over faster than a walk.
        this.walk += dt * (this.speed > KARA_WALK_SPEED ? 15 : 9)
      }
    }

    this.breath += dt * 1.6

    // A downed dog is not listening for you. This is the blindness the player is paying
    // for, and it has to be total or the Bone Dog costs nothing.
    if (this.mode === 'down') {
      this.pose(moving, lighting)
      return
    }

    // ── Ear-Perk (§3.2) ──────────────────────────────────────────────────────
    //
    // She perks at what is about to be seen, not at whatever happens to be nearby.
    // Tying the tell to impending visibility rather than raw proximity is what keeps
    // it meaningful: at 280px and 30px/s, "anything within earshot" would leave her
    // ears up for nine seconds at a stretch and the signal would mean nothing.
    let listening: Threat | null = null
    let nearest = Infinity

    // The bell just went. She cannot pick anything out of that.
    this.deafFor = Math.max(0, this.deafFor - dt)
    if (this.deafFor > 0) threats = []

    for (const t of threats) {
      const d = Math.hypot(t.x - this.x, t.y - this.y)
      if (d > this.loadout.earRadius || d >= nearest) continue
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

    this.pose(moving, lighting)
  }

  private pose(moving: boolean, lighting: LightingSystem) {
    this.walking = moving
    const pose: Pose = {
      facing: this.facing,
      walk: this.walk,
      moving,
      breath: this.breath,
      earLift: this.earLift,
      tailWag: this.tailWag,
      roll: this.roll,
    }
    poseRig(this.coatRig, pose)
    poseRig(this.markRig, pose)

    this.body.position.set(this.x, this.y)
    this.markings.position.set(this.x, this.y)

    // Holding: front end down, weight back, whole body braced against the road. A dog
    // that is refusing to move looks nothing like a dog that is standing still.
    const brace = this.mode === 'hold' ? 1 : 0
    for (const rig of [this.coatRig, this.markRig]) {
      rig.root.rotation = brace * -0.09 * this.facing
      rig.root.scale.y = SCALE * (1 - brace * 0.06)
    }

    // ── Under the blanket ────────────────────────────────────────────────────
    // She goes, and the quilt comes. One white paw is left out — in an unlit yard it is
    // the only thing on screen that says where she is, which is §2.4 doing its job in
    // the one situation where the rest of her has stopped.
    this.coatRig.root.alpha = 1 - this.under
    this.markRig.root.alpha = 1 - this.under
    this.quilt.alpha = this.under
    this.pawOut.alpha = this.under
    if (this.under > 0) {
      // Not still under there. She never is.
      const squirm = Math.sin(this.breath * 1.6) * 0.9 * this.under
      this.quilt.scale.set(this.under, this.under * (1 + Math.sin(this.breath * 2.4) * 0.03))
      this.quilt.position.x = squirm
      this.pawOut.position.set(17 * this.facing + squirm, -1 + Math.sin(this.breath * 3) * 0.6)
    }

    // Her white picks up whatever light is nearest and never fully vanishes: in the
    // dark she is four pale paws and a chest moving through the black. On her back it
    // is fully lit by her own reflection, which is the point of the ability.
    // Her halo breathes with her, and goes out entirely under the blanket — hidden is
    // hidden, and a glow that survived it would give away the one thing it buys.
    this.halo.alpha = (1 - this.under) * (this.mode === 'down' ? 0.45 : 1)
    this.halo.scale.set(1 + Math.sin(this.breath * 0.8) * 0.04)

    // The ball sits on the ground in front of her and rocks slightly, because she is
    // nosing at it. It fades rather than blinking out when the moment passes.
    this.ballGfx.alpha += ((this.ballOut ? 1 : 0) - this.ballGfx.alpha) * Math.min(1, this.dt * 6)
    if (this.ballGfx.alpha > 0.01) {
      this.ballGfx.position.x = -20 * this.facing
      this.ballGfx.rotation = Math.sin(this.breath * 3.1) * 0.25 * this.ballGfx.alpha
    }

    const lit = lighting.lightAt(this.x, this.y)
    // Floor raised 0.28 → 0.42 (fix-plan F3): she is the stated exception to the dark and
    // should look like it.
    const glow = Math.max(0.42 + 0.58 * lit, this.roll)
    // Down, her white goes dull. She is still findable — just plainly not in this.
    this.markings.alpha = this.mode === 'down' ? glow * 0.5 : glow
    this.body.alpha = this.mode === 'down' ? 0.75 : 1
  }
}
