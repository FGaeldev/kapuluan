/**
 * SetupOverlay.jsx
 *
 * Purpose:  Overlay rendered during the 'setup' phase while the player
 *           picks their starting municipality on the map.
 *
 *           On confirm: saves playerMunicipality, initializes all rulers
 *           (player + bots) via useRulerStore.initRulers(), then transitions
 *           to 'playing' phase.
 *
 * Usage:    Rendered by App.jsx when phase === 'setup'.
 *
 * Dependencies: React, Tailwind, useGameStore, useMapStore, useRulerStore
 */

import useGameStore from '../../stores/useGameStore'
import useMapStore from '../../stores/useMapStore'
import useRulerStore from '../../stores/useRulerStore'

export default function SetupOverlay() {
  const setPhase              = useGameStore((s) => s.setPhase)
  const selectedProvince      = useMapStore((s) => s.selectedProvince)
  const geojson               = useMapStore((s) => s.geojson)
  const setPlayerMunicipality = useMapStore((s) => s.setPlayerMunicipality)
  const setSelectedProvince   = useMapStore((s) => s.setSelectedProvince)
  const initRulers            = useRulerStore((s) => s.initRulers)

  /**
   * Confirm the selected municipality as the player's starting territory.
   * 1. Saves playerMunicipality to map store (triggers fog of war in MapStage)
   * 2. Initializes all rulers — player + bots — via ruler store
   * 3. Transitions to 'playing' phase
   */
  function handleConfirm() {
    if (!selectedProvince || !geojson) return

    setPlayerMunicipality(selectedProvince)
    initRulers(geojson, selectedProvince.GID_2)
    setSelectedProvince(null)
    setPhase('playing')
  }

  /**
   * Cancel setup — return to main menu without selecting.
   */
  function handleBack() {
    setSelectedProvince(null)
    setPhase('menu')
  }

  return (
    <div className="absolute inset-0 z-40 pointer-events-none">

      {/* ── Instruction banner ───────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3 bg-stone-950/90 border-b border-amber-900/60 pointer-events-auto">
        <div>
          <p className="text-amber-300 text-sm font-serif tracking-wide">
            Choose Your Starting Municipality
          </p>
          <p className="text-stone-500 text-xs mt-0.5">
            Click any territory on the map, then confirm your selection below.
          </p>
        </div>

        <button
          onClick={handleBack}
          className="text-xs px-3 py-1.5 rounded border border-stone-700 text-stone-400 hover:bg-stone-800 hover:text-stone-200 transition-colors"
        >
          ← Back
        </button>
      </div>

      {/* ── Selection confirm panel ──────────────────────────────── */}
      {selectedProvince && (
        <div className="absolute bottom-6 right-5 w-64 pointer-events-auto">
          <div className="bg-stone-950/95 border border-amber-700/60 rounded-lg p-4 shadow-2xl">
            <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">
              Selected Territory
            </p>
            <h2 className="text-amber-300 font-serif text-lg leading-tight">
              {selectedProvince.NAME_2}
            </h2>
            <p className="text-stone-400 text-xs mt-0.5 mb-1">
              {selectedProvince.NAME_1} Province
            </p>
            <p className="text-stone-600 text-xs mb-4">
              {selectedProvince.REGION}
            </p>

            <button
              onClick={handleConfirm}
              className="w-full py-2 bg-amber-700 hover:bg-amber-600 text-amber-100 text-sm font-serif tracking-wide rounded transition-colors"
            >
              Begin Here
            </button>
          </div>
        </div>
      )}

      {/* ── Idle prompt ──────────────────────────────────────────── */}
      {!selectedProvince && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
          <p className="text-stone-600 text-xs font-mono italic">
            No territory selected — click a municipality to begin
          </p>
        </div>
      )}

    </div>
  )
}
