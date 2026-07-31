import { useCallback, useEffect, useRef, useState } from 'react'
import { Game } from './game/Game'
import type { GameState, Mode, WardId } from './game/Game'
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
  const selectWard = useCallback((id: WardId) => gameRef.current?.selectWard(id), [])
  const ringBell = useCallback(() => gameRef.current?.ringBell(), [])
  const buyUpgrade = useCallback((slot: number) => gameRef.current?.buyUpgrade(slot), [])
  const restartCampaign = useCallback(() => gameRef.current?.restartCampaign(), [])
  const chooseToy = useCallback((id: ToyId) => gameRef.current?.chooseToy(id), [])
  const setMode = useCallback((m: Mode) => gameRef.current?.setMode(m), [])
  const toggleAudio = useCallback(() => void gameRef.current?.toggleAudio(), [])
  const buy = useCallback((id: string) => gameRef.current?.buy(id), [])
  const toggleFetching = useCallback(() => gameRef.current?.toggleFetching(), [])
  const setHard = useCallback((hard: boolean) => gameRef.current?.setHard(hard), [])
  const abandon = useCallback(() => gameRef.current?.abandonNight(), [])
  const clearTool = useCallback(() => gameRef.current?.clearTool(), [])

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
          onRingBell={ringBell}
          onBuyUpgrade={buyUpgrade}
          onRestartCampaign={restartCampaign}
          onChooseToy={chooseToy}
          onSetMode={setMode}
          onToggleAudio={toggleAudio}
          onBuy={buy}
          onToggleFetching={toggleFetching}
          onSetHard={setHard}
          onAbandon={abandon}
          onClearTool={clearTool}
        />
      </div>
    </div>
  )
}
