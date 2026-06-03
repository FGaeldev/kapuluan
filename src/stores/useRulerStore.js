/**
 * useRulerStore.js
 *
 * Purpose:  Tracks all rulers (player + bots) and which municipalities
 *           each one controls. Provides color assignment per ruler.
 *
 * Rulers:
 *   - One player ruler, identified by GID_2 of their starting municipality
 *   - N bot rulers, each seeded to a random municipality at game start
 *
 * Territory:
 *   - Each ruler starts with one municipality
 *   - rulerOf map: GID_2 → rulerId for fast lookup in MapStage
 *
 * Usage:    Call initRulers(geojson, playerGID2) once on game start.
 *           Read rulerOf in MapStage for per-feature color lookup.
 *
 * Dependencies: zustand, immer
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ── Ruler colors ──────────────────────────────────────────────────────────────
// Player is always index 0 (gold). Bots cycle through the rest.
// Values are Pixi hex integers.
export const RULER_COLORS = [
  0xFFD700,   // 0 — Player: gold
  0xE05252,   // 1 — Bot: red
  0x5B8DD9,   // 2 — Bot: blue
  0x7BC67E,   // 3 — Bot: green
  0xE09C3B,   // 4 — Bot: orange
  0xB57FD4,   // 5 — Bot: purple
  0x4DC9C9,   // 6 — Bot: teal
]

const BOT_COUNT = 6   // Hardcoded for now — make configurable later

const useRulerStore = create(
  immer((set) => ({
    // Array of ruler objects: { id, name, color, isPlayer, startGID2 }
    rulers: [],

    // Fast lookup: GID_2 string → ruler id (number)
    // Null means uncontrolled territory
    rulerOf: {},

    // Player's ruler id — always 0
    playerRulerId: 0,

    /**
     * Initialize all rulers and assign starting municipalities.
     * Called once when the player confirms their starting municipality.
     *
     * Player gets their chosen municipality.
     * Bots each get a random municipality from a different region,
     * ensuring geographic spread at game start.
     *
     * @param {object} geojson      - Full GeoJSON FeatureCollection with REGION property
     * @param {string} playerGID2   - GID_2 of player's chosen starting municipality
     */
    initRulers: (geojson, playerGID2) => set((state) => {
      const features = geojson.features

      // Build region → feature indices map for bot placement
      const regionMap = {}
      features.forEach((f, i) => {
        const r = f.properties.REGION
        if (!regionMap[r]) regionMap[r] = []
        regionMap[r].push(i)
      })

      const usedGIDs   = new Set([playerGID2])
      const usedRegions = new Set()

      // Find player's region so bots avoid starting there
      const playerFeature = features.find(f => f.properties.GID_2 === playerGID2)
      if (playerFeature) usedRegions.add(playerFeature.properties.REGION)

      // Build ruler list — player first, then bots
      const rulers = [
        {
          id:       0,
          name:     'Player',
          color:    RULER_COLORS[0],
          isPlayer: true,
          startGID2: playerGID2,
        },
      ]

      const rulerOf = { [playerGID2]: 0 }

      // Assign bots to regions not yet used, for geographic spread
      const availableRegions = Object.keys(regionMap).filter(r => !usedRegions.has(r))

      for (let i = 0; i < BOT_COUNT; i++) {
        const rulerId = i + 1
        const color   = RULER_COLORS[rulerId % RULER_COLORS.length]

        // Pick a region — prefer unused ones for spread, fall back to any
        let targetRegion = availableRegions[i % availableRegions.length]
        if (!targetRegion) {
          // All regions used — pick any region with unused municipalities
          targetRegion = Object.keys(regionMap).find(r =>
            regionMap[r].some(idx => !usedGIDs.has(features[idx].properties.GID_2))
          )
        }

        // Pick a random unused municipality from that region
        let startGID2 = null
        if (targetRegion) {
          const candidates = regionMap[targetRegion].filter(
            idx => !usedGIDs.has(features[idx].properties.GID_2)
          )
          if (candidates.length > 0) {
            const picked = candidates[Math.floor(Math.random() * candidates.length)]
            startGID2 = features[picked].properties.GID_2
            usedGIDs.add(startGID2)
            rulerOf[startGID2] = rulerId
          }
        }

        rulers.push({
          id:       rulerId,
          name:     `Bot ${i + 1}`,
          color,
          isPlayer: false,
          startGID2,
        })
      }

      state.rulers  = rulers
      state.rulerOf = rulerOf
    }),
  }))
)

export default useRulerStore
