import type { GameState } from '../game/Game'
import './hud.css'

const WARD_KEYS = [
  { key: '1', id: 'lantern', name: 'Lantern Post', cost: 30 },
  { key: '2', id: 'hose', name: 'Spring Line', cost: 55 },
] as const

const COMMANDS = [
  { key: 'RMB', label: 'Send Kara' },
  { key: 'B', label: 'Bubbles' },
  { key: 'X', label: 'Show Belly' },
  { key: 'Z', label: 'Blanket' },
  { key: 'Space', label: 'Pause' },
]

export function Hud({ state }: { state: GameState | null }) {
  if (!state) return null

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="panel">
          <span className="label">{state.nightName}</span>
          <span className="value">
            Wave {state.wave} / {state.waveCount}
          </span>
        </div>

        <div className="panel">
          <span className="label">Homestead</span>
          <div className="meter">
            <div className="meter-fill home" style={{ width: `${state.homesteadHp}%` }} />
          </div>
        </div>

        <div className="panel">
          <span className="label">Lamp oil</span>
          <span className="value oil">{state.oil}</span>
        </div>

        <div className="panel">
          <span className="label">Ball stash</span>
          <span className="value">{state.balls}</span>
        </div>
      </div>

      <div className="hud-bottom">
        <div className="panel kara">
          <div className="kara-head">
            <span className="label">Kara</span>
            {state.karaAlert && <span className="tell">ears up</span>}
          </div>
          <div className="meter">
            <div className="meter-fill kara-hp" style={{ width: `${state.karaHp}%` }} />
          </div>
          <div className="kara-row">
            <span className="state">{state.karaState}</span>
            <span className="bond">bond {state.bond}</span>
          </div>
        </div>

        <div className="panel wards">
          {WARD_KEYS.map((w) => (
            <div key={w.id} className={`ward ${state.selectedWard === w.id ? 'selected' : ''}`}>
              <kbd>{w.key}</kbd>
              <span className="ward-name">{w.name}</span>
              <span className="ward-cost">{w.cost}</span>
            </div>
          ))}
        </div>

        <div className="panel commands">
          {COMMANDS.map((c) => (
            <div key={c.key} className="command">
              <kbd>{c.key}</kbd>
              <span>{c.label}</span>
            </div>
          ))}
          <div className={`command ${state.bellyReady ? 'ready' : 'cooling'}`}>
            <span>{state.bellyReady ? 'belly ready' : 'belly cooling'}</span>
          </div>
        </div>
      </div>

      {state.barking && <div className="bark">KARA IS BARKING</div>}
      {state.paused && <div className="veil">Paused</div>}
      {state.outcome === 'lost' && <div className="veil">The hollow took the homestead.</div>}
      {state.outcome === 'survived' && <div className="veil">Dawn. She stayed on the porch all night.</div>}
    </div>
  )
}
