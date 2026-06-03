/**
 * loadGameData.js
 *
 * Purpose:  Fetches and parses all game data JSON files from /public/data/.
 *           Called once on app init. Hydrates Zustand stores.
 *
 * Usage:    Call loadGameData() inside a useEffect in App.jsx.
 *
 * Dependencies: useMapStore
 *
 * Data source: GADM Level 2 (municipalities.geojson)
 *   - NAME_1 = Province name
 *   - NAME_2 = Municipality name (expected — confirm via console on first load)
 */

import useMapStore from '../stores/useMapStore'

/**
 * Fetch municipality GeoJSON and push into map store.
 * Logs first feature's properties so name keys can be confirmed in DevTools.
 * Logs error and leaves store null if fetch fails.
 *
 * @returns {Promise<void>}
 */
export async function loadGameData() {
  try {
    const res = await fetch('/data/municipalities.geojson')

    if (!res.ok) {
      throw new Error(`Failed to fetch municipalities.geojson — status ${res.status}`)
    }

    const data = await res.json()
    useMapStore.getState().setGeojson(data)

    // Confirm property keys — check NAME_2 exists for municipality name
    console.log('[Kapuluan] Sample feature properties:', data.features[0].properties)
    console.info(`[Kapuluan] Loaded ${data.features.length} municipality features.`)
  } catch (err) {
    console.error('[Kapuluan] loadGameData failed:', err)
  }
}
