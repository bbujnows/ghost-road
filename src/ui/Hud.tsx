import type { GameState } from '../game/Game'
import { OIL_PER_LIT_KILL, OIL_PER_WAVE } from '../game/balance'
import { TOYS } from '../game/toys'
import type { ToyId } from '../game/toys'
import './hud.css'

/**
 * The light probe is a tuning instrument, not a HUD element (fix-plan, cut list 2). Flip
 * it on while balancing; the player is meant to read the bands off the board.
 */
const SHOW_LIGHT_PROBE = false

const BAND_LABEL = {
  dark: 'dark · invisible, cannot be hurt',
  dim: 'dim · you can see it, not hurt it',
  lit: 'lit · your lanterns can kill it',
} as const

const CONTROLS = [
  { key: '1 / 2', label: 'Select ward' },
  { key: 'Left click', label: 'Place it, or pick one to upgrade' },
  { key: 'Q / E', label: 'Buy an upgrade branch' },
  { key: 'Right click', label: 'Send Kara' },
  { key: 'X', label: 'Show Belly' },
  { key: 'B', label: 'Bubble at cursor' },
  { key: 'Z', label: 'Under the blanket' },
  { key: 'F', label: 'Fast-forward' },
  { key: 'Space', label: 'Pause' },
  { key: '?', label: 'Help' },
]

/** Keyed by the night just finished, so the button names where you are going. */
const NEXT_NIGHT: Record<number, string> = {
  1: 'Second Night',
  2: 'Third Night',
  3: 'Fourth Night',
  4: 'Fifth Night',
  5: 'Sixth Night',
  6: 'Seventh Night',
}

/** What she is doing, when it is something the player did not just ask for. */
const KARA_STATE: Partial<Record<GameState['karaState'], string>> = {
  belly: 'on her back',
  blanket: 'under the blanket',
  coax: 'coming out',
  down: 'down',
  hold: 'holding the line',
}

/**
 * Kara's cooldowns, unlike her Ear-Perk, must be on screen — a resource the player
 * cannot count is a resource they will not spend.
 *
 * Her health is here for a narrower reason: the Bone Dog is the first thing that can
 * hurt her, and a player who cannot see the damage landing will read her going Down as
 * the game taking her away rather than as something they were shown coming.
 */
function KaraPanel({ state }: { state: GameState }) {
  const hpPct = (state.karaHp / state.karaMaxHp) * 100
  const note = KARA_STATE[state.karaState]

  return (
    <div className={`panel kara-panel ${state.karaState === 'down' ? 'kara-down' : ''}`}>
      <span className="label">
        Kara
        {note && (
          <span className="kara-note">
            {' '}
            — {note}
            {state.karaStateRemaining > 0 && ` ${Math.ceil(state.karaStateRemaining)}s`}
          </span>
        )}
      </span>

      <div className="meter">
        <div className="meter-fill kara" style={{ width: `${hpPct}%` }} />
      </div>

      <div className={`ability ${state.bellyReady ? 'ready' : 'cooling'}`}>
        <kbd>X</kbd>
        <span className="ability-name">Show Belly</span>
        <span className="ability-state">
          {state.bellyReady ? 'ready' : `${Math.ceil(state.bellyCooldown)}s`}
        </span>
      </div>

      <div className={`ability ${state.bubbleCharges > 0 ? 'ready' : 'cooling'}`}>
        <kbd>B</kbd>
        <span className="ability-name">Bubbles</span>
        <span className="pips">
          {Array.from({ length: state.bubbleMax }, (_, i) => (
            <span key={i} className={`pip ${i < state.bubbleCharges ? 'full' : ''}`} />
          ))}
        </span>
      </div>

      {state.hasHold && (
        <div className={`ability ${state.holdReady ? 'ready' : 'cooling'}`}>
          <kbd>H</kbd>
          <span className="ability-name">Hold</span>
          <span className="ability-state">
            {state.karaState === 'hold'
              ? 'holding'
              : state.holdCooldown > 0
                ? `${Math.ceil(state.holdCooldown)}s`
                : 'ready'}
          </span>
        </div>
      )}

      <div className={`ability ${state.karaState === 'free' ? 'ready' : 'cooling'}`}>
        <kbd>Z</kbd>
        <span className="ability-name">Blanket</span>
        <span className="ability-state">
          {state.karaState === 'blanket'
            ? state.karaStateRemaining > 0
              ? `${Math.ceil(state.karaStateRemaining)}s`
              : 'call her'
            : 'hide'}
        </span>
      </div>
    </div>
  )
}

/**
 * §4. One toy per night, chosen before it starts.
 *
 * Every one of them names its cost on the card. A toy that is only upside is a toy that
 * is mandatory, and a mandatory choice is not one.
 */
function ToyPicker({ toy, onChoose }: { toy: ToyId; onChoose: (id: ToyId) => void }) {
  return (
    <div className="toys">
      <p className="eyebrow">What she takes out with her</p>
      {TOYS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toy ${toy === t.id ? 'chosen' : ''}`}
          onClick={() => onChoose(t.id)}
        >
          <span className="toy-name">{t.name}</span>
          <span className="toy-effect">{t.effect}</span>
          {t.cost && <span className="toy-cost">{t.cost}</span>}
          <span className="toy-flavor">{t.flavor}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * §7.2. What today's road drew, and where the streak stands.
 *
 * The toy is *shown*, not chosen. Everyone gets the same one, which is what makes the
 * day comparable — the loadout is part of the puzzle rather than a lever you pull.
 */
function NightlyBrief({ state }: { state: GameState }) {
  const toy = TOYS.find((t) => t.id === state.toy)

  return (
    <div className="toys">
      <p className="eyebrow">Tonight, for everybody</p>

      {state.nightlyModifiers.length > 0 && (
        <div className="draw">
          {state.nightlyModifiers.map((m) => (
            <span key={m} className="draw-chip">
              {m}
            </span>
          ))}
        </div>
      )}

      {toy && (
        <div className="toy chosen">
          <span className="toy-name">{toy.name}</span>
          <span className="toy-effect">{toy.effect}</span>
          {toy.cost && <span className="toy-cost">{toy.cost}</span>}
        </div>
      )}

      <p className="streak-line">
        {state.streak > 0
          ? `${state.streak} night${state.streak > 1 ? 's' : ''} held in a row`
          : 'No streak going.'}
        {state.bestStreak > 0 && <span className="sub"> · best {state.bestStreak}</span>}
      </p>
    </div>
  )
}

/**
 * §8. Where the run stands, and what the escalation has already done to the roster.
 *
 * The scaling is stated rather than hidden. A player who cannot see that enemies have
 * 60% more health does not experience escalation, they experience their build getting
 * quietly worse.
 */
function LongRoadBrief({ state }: { state: GameState }) {
  const step = state.runNight - 7
  const hp = Math.round(0.12 * step * 100)
  const speed = Math.round((Math.min(1.5, 1 + 0.03 * step) - 1) * 100)

  return (
    <div className="draw longroad-brief">
      <span className="draw-chip">night {state.runNight}</span>
      <span className="draw-chip">+{hp}% health</span>
      {speed > 0 && <span className="draw-chip">+{speed}% speed</span>}
      {state.fog > 0 && <span className="draw-chip">fog {Math.round(state.fog * 100)}%</span>}
      {state.gustIn > 0 && <span className="draw-chip">wind</span>}
      {state.bestRun > 0 && <span className="draw-chip best">furthest {state.bestRun}</span>}
    </div>
  )
}

/**
 * The upgrade tree for whichever placed ward is selected.
 *
 * Two branches, and taking a tier in one closes the other for good — so the panel has
 * to make the commitment legible *before* the click, not explain it afterward. A closed
 * branch stays on screen, greyed, rather than disappearing: the player needs to see the
 * road they did not take, or the choice never registers as one.
 */
function UpgradePanel({ state, onBuy }: { state: GameState; onBuy: (slot: number) => void }) {
  const sel = state.selection
  if (!sel) return null

  const committed = sel.branches.some((b) => b.tier > 0)

  return (
    <div className="panel upgrades">
      <span className="label">
        {sel.kind === 'lantern' ? 'Lantern Post' : 'Cold Iron'}
        <span className="upgrade-hint"> — Esc to close</span>
      </span>

      {sel.branches.map((b, i) => (
        <button
          key={b.id}
          type="button"
          className={`branch ${b.open ? '' : 'closed'} ${b.affordable ? 'affordable' : ''}`}
          disabled={!b.affordable}
          onClick={() => onBuy(i)}
        >
          <div className="branch-head">
            <kbd>{i === 0 ? 'Q' : 'E'}</kbd>
            <span className="branch-name">{b.name}</span>
            <span className="pips">
              {Array.from({ length: b.maxTier }, (_, t) => (
                <span key={t} className={`pip ${t < b.tier ? 'full' : ''}`} />
              ))}
            </span>
            <span className="branch-cost">
              {b.tier >= b.maxTier ? 'max' : b.open ? b.cost : '—'}
            </span>
          </div>
          <span className="branch-note">{b.note}</span>
        </button>
      ))}

      <span className="sub">
        {committed
          ? 'Committed. The other branch is closed for this ward.'
          : 'Taking a tier closes the other branch on this ward.'}
      </span>
    </div>
  )
}

export interface HudProps {
  state: GameState | null
  onBegin: () => void
  onToggleHelp: () => void
  onResume: () => void
  onRestart: () => void
  onToggleSpeed: () => void
  onSelectWard: (id: 'lantern' | 'iron') => void
  onBuyUpgrade: (slot: number) => void
  onRestartCampaign: () => void
  onChooseToy: (id: ToyId) => void
  onSetMode: (mode: GameState['mode']) => void
  onToggleAudio: () => void
}

/**
 * Every overlay in this game must have a visible way out. The tab can auto-pause
 * without the player having pressed anything, so "press Space" is not an exit — it is
 * a shortcut for people who already know it.
 */
function Curtain({
  title,
  sub,
  action,
  hint,
  onAction,
}: {
  title: string
  sub?: string
  action: string
  hint?: string
  onAction: () => void
}) {
  return (
    <div className="veil">
      <div className="curtain">
        <p className="curtain-title">{title}</p>
        {sub && <p className="veil-sub">{sub}</p>}
        <button type="button" className="primary" onClick={onAction}>
          {action}
        </button>
        {hint && <p className="footnote">{hint}</p>}
      </div>
    </div>
  )
}

function Rules({ state }: { state: GameState }) {
  return (
    <ol className="rules">
      <li>
        <strong>Things come up the road.</strong> Anything that reaches the porch takes a bite out
        of the homestead. Lose it all and the night is over.
      </li>
      <li>
        <strong>The dark protects them.</strong> Out in the unlit road they are invisible and
        cannot be hurt at all. Light is not scenery here — it is what makes ground fightable.
      </li>
      <li>
        <strong>Lanterns don't kill. Iron does.</strong> A lantern ({state.lanternCost} oil)
        lights a stretch of road — the <span className="ring-lit">inner ring</span> is where its
        light is strong enough to fight in. A board of{' '}
        <span className="ring-iron">cold iron nails</span> ({state.ironCost} oil) lies along the
        road bed and burns whatever walks it — <em>but only in light</em>. You need both, and
        where they overlap is where the road bites.
      </li>
      <li>
        <strong>Every wave you survive pays {OIL_PER_WAVE} oil</strong>, and each kill in the
        light adds {OIL_PER_LIT_KILL} more. Anything that reaches the porch pays nothing.
      </li>
      <li>
        <strong>Kara works in the dark</strong> — the only thing that does. Right click sends her.
        Watch her ears: she lifts them about two seconds before something becomes visible, and
        she turns to face it. That tell is the game's radar, and it is the only one you get.
      </li>
      <li>
        <strong>Press X to Show Belly.</strong> She flops onto her back and her white belly
        throws light across the area — enough to make a whole clump of them killable for a
        moment, anywhere on the map. She is helpless for two seconds afterward.
      </li>
      <li>
        <strong>Press B to blow a bubble</strong> at your cursor. She chases it at nearly twice
        her walking speed, and the bubble drifts and glows — enough light to reveal what's out
        there, never enough to kill it.
      </li>
      <li>
        <strong>Not everything on the road wants the house.</strong> <em>Crawlers</em> are quick
        and flimsy — one lit iron strip finishes them, but they cross a gap in your coverage
        before you can patch it. The <em>Tallow Man</em> walks past your lanterns and pinches
        them out; a post set back from the road bed is out of his reach, and Kara standing over
        one will run him off it. <em>Bone Dogs</em> ignore the homestead entirely and come for
        her.
      </li>
      <li>
        <strong>Kara can be hurt, and never lost.</strong> At zero she limps to the porch and is
        gone for twenty-five seconds — and you are blind for all of it. <strong>Press Z</strong>{' '}
        and she ducks under the porch quilt, where nothing can touch her. She will not come out
        for three seconds, and coaxing her out takes three more. Six seconds of not having her.
        Watch for the one white paw sticking out.
      </li>
      <li>
        <strong>She is also bait.</strong> A Bone Dog chasing her goes wherever she goes — which
        can be straight across your iron.
      </li>
      <li>
        <strong>Click a ward you have already built to upgrade it.</strong> Each one has two
        branches — a lantern can become a <em>Storm Glass</em> (bigger, and eventually impossible
        to put out) or a <em>Mirror Back</em> (the same light, thrown along the road instead of
        into the trees). Iron becomes <em>Graveyard Iron</em> (a much harder bite, and at the top
        it takes anything you can merely <span className="ring-dim">see</span>) or{' '}
        <em>Rail Iron</em> (longer, and rough enough to wade through).{' '}
        <strong>Taking either tier closes the other branch on that ward for good.</strong>
      </li>
    </ol>
  )
}

export function Hud({
  state,
  onBegin,
  onToggleHelp,
  onResume,
  onRestart,
  onToggleSpeed,
  onSelectWard,
  onBuyUpgrade,
  onRestartCampaign,
  onChooseToy,
  onSetMode,
  onToggleAudio,
}: HudProps) {
  if (!state) return null

  const hpPct = (state.homesteadHp / state.homesteadMaxHp) * 100

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="panel">
          <span className="label">
            {state.mode === 'nightly'
              ? `Nightly · ${state.nightlyKey}`
              : state.mode === 'longroad'
                ? `Long Road · Night ${state.runNight}`
                : `${state.nightName} · ${state.night}/${state.nightCount}`}
          </span>
          <span className="value">
            Wave {state.wave} / {state.waveCount}
          </span>
          {(state.fog > 0 || state.gustIn > 0) && (
            <span className={`sub ${state.gustWarning ? 'blocked' : ''}`}>
              {state.gustWarning
                ? 'wind coming'
                : [
                    state.fog > 0 ? `fog ${Math.round(state.fog * 100)}%` : null,
                    state.gustIn > 0 ? `gust ${Math.ceil(state.gustIn)}s` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
          )}
        </div>

        <div className="panel">
          <span className="label">Homestead</span>
          <div className="meter">
            <div className="meter-fill home" style={{ width: `${hpPct}%` }} />
          </div>
          <span className="sub">{state.homesteadHp} left</span>
        </div>

        <div className="panel">
          <span className="label">Lamp oil</span>
          <span className={`value oil ${state.canAffordSelected ? '' : 'short'}`}>{state.oil}</span>
          <span className="sub">
            {state.canAffordSelected
              ? 'enough for the selected ward'
              : `selected ward needs ${state.selectedWard === 'lantern' ? state.lanternCost : state.ironCost}`}
          </span>
        </div>

        <div className="panel">
          <span className="label">On the road</span>
          <span className="value">{state.walkersAlive}</span>
          <span className={`sub ${state.lanternsOut > 0 ? 'blocked' : ''}`}>
            {state.lanternsOut > 0
              ? `${state.lanternsOut} lantern${state.lanternsOut > 1 ? 's' : ''} out · ${Math.ceil(state.relightIn)}s`
              : 'all lanterns lit'}
          </span>
        </div>

        <div className="top-buttons">
          {/* §11: silent by default. It is a game played at a desk, so sound is opt-in —
              and the bark is worth opting in for exactly once. */}
          <button
            type="button"
            className={`speed-btn ${state.audioOn ? 'active' : ''}`}
            onClick={onToggleAudio}
            title={state.audioOn ? 'Sound on' : 'Sound off — she is worth hearing'}
          >
            {state.audioOn ? '♪' : '♪̸'}
          </button>
          <button
            type="button"
            className={`speed-btn ${state.speed > 1 ? 'active' : ''}`}
            onClick={onToggleSpeed}
            title="Fast-forward (F)"
          >
            {state.speed > 1 ? '2×' : '1×'}
          </button>
          <button type="button" className="help-btn" onClick={onToggleHelp}>
            ?
          </button>
        </div>
      </div>

      <div className="hud-bottom">
        {/* The upgrade panel takes the shop's place rather than sitting beside it — the
            bottom bar is already three panels wide, and a selected ward is a mode. */}
        {state.selection ? (
          <UpgradePanel state={state} onBuy={onBuyUpgrade} />
        ) : (
        <div className="panel wards">
          <div
            className={`ward ${state.selectedWard === 'lantern' ? 'selected' : ''}`}
            onClick={() => onSelectWard('lantern')}
          >
            <kbd>1</kbd>
            <span className="ward-name">Lantern Post</span>
            <span className="ward-role">light</span>
            <span className="ward-cost">{state.lanternCost}</span>
          </div>
          <div
            className={`ward ${state.selectedWard === 'iron' ? 'selected' : ''}`}
            onClick={() => onSelectWard('iron')}
          >
            <kbd>2</kbd>
            <span className="ward-name">Cold Iron</span>
            <span className="ward-role">damage, in light</span>
            <span className="ward-cost">{state.ironCost}</span>
          </div>
          <span className="hint">
            {state.placementBlocker ? (
              <span className="blocked">{state.placementBlocker}</span>
            ) : (
              'Click to place it here'
            )}
          </span>
          {/* A superb build tool and a tell that does the player's reading for them. The
              bands are meant to be learned from the board, so it ships off. */}
          {SHOW_LIGHT_PROBE && (
            <span className={`probe band-${state.bandUnderCursor}`}>
              under cursor {state.lightUnderCursor.toFixed(2)} — {BAND_LABEL[state.bandUnderCursor]}
            </span>
          )}
        </div>
        )}

        <KaraPanel state={state} />
      </div>

      {state.phase === 'break' && state.breakRemaining > 0 && (
        <div className="banner">
          Next wave in {Math.ceil(state.breakRemaining)}
          {state.nextWaveCount > 0 && (
            <span className="banner-detail"> — {state.nextWaveCount} coming down the road</span>
          )}
        </div>
      )}

      {state.phase === 'briefing' && (
        <div className="veil">
          <div className="sheet">
            <div className="modes">
              <button
                type="button"
                className={`mode ${state.mode === 'campaign' ? 'on' : ''}`}
                onClick={() => onSetMode('campaign')}
              >
                The Seven Nights
              </button>
              <button
                type="button"
                className={`mode ${state.mode === 'nightly' ? 'on' : ''}`}
                onClick={() => onSetMode('nightly')}
              >
                The Nightly Road
                {state.streak > 0 && <span className="streak">{state.streak}</span>}
              </button>
              {/* Locked rather than hidden: §8 gates it on holding all seven, and a
                  player should be able to see what they are working toward. */}
              <button
                type="button"
                className={`mode ${state.mode === 'longroad' ? 'on' : ''} ${state.longRoadUnlocked ? '' : 'locked'}`}
                disabled={!state.longRoadUnlocked}
                onClick={() => onSetMode('longroad')}
                title={state.longRoadUnlocked ? undefined : 'Hold all seven nights first'}
              >
                The Long Road
                {state.longRoadUnlocked && state.bestRun > 0 && (
                  <span className="streak">{state.bestRun}</span>
                )}
              </button>
            </div>

            <p className="eyebrow">
              {state.mode === 'nightly'
                ? `Ghost Road · ${state.nightlyKey}`
                : state.mode === 'longroad'
                  ? `Ghost Road · The Long Road · Night ${state.runNight}`
                  : `Ghost Road · ${state.nightName} · ${state.night} of ${state.nightCount}`}
            </p>
            <h1>{state.nightLede}</h1>
            <p className="lede">{state.nightTeaches}</p>
            {/* The full rules only on the First Night. After that the briefing is one
                line about the one new thing, because re-reading eight rules to start a
                four-minute night is how a desk-break game stops being one. */}
            {state.night === 1 ? (
              <Rules state={state} />
            ) : (
              <p className="footnote sheet-note">Press ? at any time for the full rules.</p>
            )}
            {state.mode === 'nightly' ? (
              <NightlyBrief state={state} />
            ) : (
              <>
                {state.mode === 'longroad' && <LongRoadBrief state={state} />}
                <ToyPicker toy={state.toy} onChoose={onChooseToy} />
              </>
            )}

            {state.mode === 'nightly' && state.nightlyPlayed ? (
              <>
                <button type="button" className="primary" disabled>
                  Already walked today
                </button>
                <p className="footnote">A new road at midnight. One attempt each.</p>
              </>
            ) : (
              <>
                <button type="button" className="primary" onClick={onBegin}>
                  Hold the night
                </button>
                <p className="footnote">
                  {state.mode === 'nightly' ? 'One attempt. No retries.' : 'or press Space'}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {state.helpOpen && (
        <div className="veil">
          <div className="sheet">
            <p className="eyebrow">How to hold the night</p>
            <Rules state={state} />
            <div className="control-grid">
              {CONTROLS.map((c) => (
                <div key={c.key} className="control">
                  <kbd>{c.key}</kbd>
                  <span>{c.label}</span>
                </div>
              ))}
              <div className="control">
                <kbd>R</kbd>
                <span>Retry, after a loss</span>
              </div>
            </div>
            <button type="button" className="primary" onClick={onToggleHelp}>
              Back to it
            </button>
            {/* Progress persists across sessions, so there has to be a way to let it go.
                Buried in the help sheet on purpose — it is not a thing to hit by accident. */}
            <button type="button" className="quiet" onClick={onRestartCampaign}>
              Start the seven nights over
            </button>
          </div>
        </div>
      )}

      {state.paused && !state.helpOpen && state.phase !== 'failed' && state.phase !== 'complete' && (
        <Curtain
          title="Paused"
          sub="The road waits."
          action="Resume"
          hint="or press Space"
          onAction={onResume}
        />
      )}

      {/* The Nightly Road has no retry and no next. Both curtains say so plainly and
          send you back to the campaign, which is the thing you can still play. */}
      {state.phase === 'failed' && state.mode === 'nightly' && (
        <Curtain
          title="The hollow took the homestead."
          sub={`That was today's road. There is another one tomorrow.${state.bestStreak > 0 ? ` Best streak: ${state.bestStreak}.` : ''}`}
          action="Back to the seven nights"
          hint="or press R"
          onAction={onRestart}
        />
      )}

      {state.phase === 'complete' && state.mode === 'nightly' && (
        <Curtain
          title="Held."
          sub={`${state.streak} night${state.streak === 1 ? '' : 's'} in a row.${state.streak >= state.bestStreak ? ' Your best yet.' : ` Best: ${state.bestStreak}.`}`}
          action="Back to the seven nights"
          hint="A new road at midnight"
          onAction={onRestart}
        />
      )}

      {/* §8: a run has a definite ending, which is what makes the number mean anything. */}
      {state.phase === 'failed' && state.mode === 'longroad' && (
        <Curtain
          title={`The run ends at night ${state.runNight}.`}
          sub={
            state.runNight - 1 >= state.bestRun
              ? `${state.runNight - 1} nights held — further than you have been.`
              : `${state.runNight - 1} nights held. Furthest: ${state.bestRun}.`
          }
          action="Walk a new road"
          hint="A different hollow every run"
          onAction={onRestart}
        />
      )}

      {state.phase === 'complete' && state.mode === 'longroad' && (
        <Curtain
          title="Dawn."
          sub={`Night ${state.runNight} held. The road keeps going.`}
          action={`On to night ${state.runNight + 1}`}
          hint="or press R"
          onAction={onRestart}
        />
      )}

      {state.phase === 'failed' && state.mode === 'campaign' && (
        <Curtain
          title="The hollow took the homestead."
          sub="Kara is fine. She always is."
          action={`Hold the ${state.nightName.toLowerCase()} again`}
          hint="or press R"
          onAction={onRestart}
        />
      )}

      {state.phase === 'complete' && state.mode === 'campaign' && (
        <Curtain
          title={state.finalNight ? 'Seven nights. Dawn.' : 'Dawn.'}
          sub={
            state.finalNight
              ? 'The road is quiet again. She stayed on the porch for every one of them.'
              : 'She stayed on the porch all night.'
          }
          action={state.finalNight ? 'Walk it again' : `On to the ${NEXT_NIGHT[state.night] ?? 'next night'}`}
          hint="or press R"
          onAction={onRestart}
        />
      )}
    </div>
  )
}
