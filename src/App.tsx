import { useCallback, useEffect, useRef, useState } from 'react'
import { Game } from './game/Game'
import type { GameState } from './game/Game'
import type { ToyId } from './game/toys'
import { Hud } from './ui/Hud'
import './App.css'

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [state, setState] = useState<GameState | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const game = new Game()
    gameRef.current = game
    let cancelled = false

    game.onState((s) => {
      if (!cancelled) setState(s)
    })

    game.mount(host).catch((err) => console.error('Ghost Road failed to start', err))

    return () => {
      cancelled = true
      gameRef.current = null
      game.destroy()
    }
  }, [])

  const begin = useCallback(() => gameRef.current?.beginNight(), [])
  const toggleHelp = useCallback(() => gameRef.current?.toggleHelp(), [])
  const resume = useCallback(() => gameRef.current?.resume(), [])
  const restart = useCallback(() => gameRef.current?.restart(), [])
  const toggleSpeed = useCallback(() => gameRef.current?.toggleSpeed(), [])
  const selectWard = useCallback((id: 'lantern' | 'iron') => gameRef.current?.selectWard(id), [])
  const buyUpgrade = useCallback((slot: number) => gameRef.current?.buyUpgrade(slot), [])
  const restartCampaign = useCallback(() => gameRef.current?.restartCampaign(), [])
  const chooseToy = useCallback((id: ToyId) => gameRef.current?.chooseToy(id), [])

  return (
    <div className="app">
      <div className="stage">
        <div className="canvas-host" ref={hostRef} />
        <Hud
          state={state}
          onBegin={begin}
          onToggleHelp={toggleHelp}
          onResume={resume}
          onRestart={restart}
          onToggleSpeed={toggleSpeed}
          onSelectWard={selectWard}
          onBuyUpgrade={buyUpgrade}
          onRestartCampaign={restartCampaign}
          onChooseToy={chooseToy}
        />
      </div>
    </div>
  )
}
