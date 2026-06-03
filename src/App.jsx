/**
 * App.jsx
 *
 * Purpose:  Root shell. Loads game data on mount, then renders
 *           the map canvas and the appropriate UI layer based on
 *           the current game phase.
 *
 * Phase rendering:
 *   'menu'    — MainMenu overlays the map (map loads silently behind it)
 *   'setup'   — SetupOverlay guides municipality selection
 *   'playing' — UIOverlay shows HUD, info panel, and game controls
 *
 * The map (GameCanvas) always renders — it's visible as a backdrop
 * behind the main menu and is ready instantly when setup begins.
 *
 * Dependencies: React, GameCanvas, UIOverlay, MainMenu, SetupOverlay, loadGameData
 */

import { useEffect } from 'react'
import GameCanvas from './components/map/GameCanvas'
import MainMenu from './components/ui/MainMenu'
import SetupOverlay from './components/ui/SetupOverlay'
import UIOverlay from './components/ui/UIOverlay'
import { loadGameData } from './data/loadGameData'
import useGameStore from './stores/useGameStore'
import './index.css'

function App() {
  const phase = useGameStore((s) => s.phase)

  // Load all GeoJSON game data once on mount.
  // Runs regardless of phase — map is ready behind the menu.
  useEffect(() => {
    loadGameData()
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-stone-950">

      {/* Map always renders — backdrop for menu, active during setup/playing */}
      <GameCanvas />

      {/* Phase-specific UI layers */}
      {phase === 'menu'    && <MainMenu />}
      {phase === 'setup'   && <SetupOverlay />}
      {phase === 'playing' && <UIOverlay />}

    </div>
  )
}

export default App
