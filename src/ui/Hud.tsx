import type { GameState } from '../game/Game'
import { OIL_PER_LIT_KILL, OIL_PER_WAVE } from '../game/balance'
import './hud.css'

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

/** What she is doing, when it is something the player did not just ask for. */
const KARA_STATE: Partial<Record<GameState['karaState'], string>> = {
  belly: 'on her back',
  blanket: 'under the blanket',
  coax: 'coming out',
  down: 'down',
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
}: HudProps) {
  if (!state) return null

  const hpPct = (state.homesteadHp / state.homesteadMaxHp) * 100

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="panel">
          <span className="label">First Night</span>
          <span className="value">
            Wave {state.wave} / {state.waveCount}
          </span>
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
          <span className={`probe band-${state.bandUnderCursor}`}>
            under cursor {state.lightUnderCursor.toFixed(2)} — {BAND_LABEL[state.bandUnderCursor]}
          </span>
        </div>
        )}

        <KaraPanel state={state} />

        <div className="panel controls">
          {CONTROLS.map((c) => (
            <div key={c.key} className="control">
              <kbd>{c.key}</kbd>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
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
            <p className="eyebrow">Ghost Road · First Night</p>
            <h1>The road has been quiet for forty years.</h1>
            <p className="lede">It is not quiet tonight.</p>
            <Rules state={state} />
            <button type="button" className="primary" onClick={onBegin}>
              Hold the night
            </button>
            <p className="footnote">or press Space</p>
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

      {state.phase === 'failed' && (
        <Curtain
          title="The hollow took the homestead."
          sub="Kara is fine. She always is."
          action="Hold the night again"
          hint="or press R"
          onAction={onRestart}
        />
      )}

      {state.phase === 'complete' && (
        <Curtain
          title="Dawn."
          sub="She stayed on the porch all night."
          action="Hold it again"
          hint="or press R"
          onAction={onRestart}
        />
      )}
    </div>
  )
}
