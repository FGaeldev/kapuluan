/**
 * loadGameData.js
 *
 * Purpose:  Fetches and parses all game data JSON files from /public/data/.
 *           Called once on app init. Hydrates Zustand stores.
 *
 * Usage:    Call loadGameData() inside a useEffect in App.jsx.
 *
 * Dependencies: useMapStore
 */

import useMapStore from '../stores/useMapStore'

/**
 * Fetch province GeoJSON and push into map store.
 * Logs error and leaves store null if fetch fails.
 *
 * @returns {Promise<void>}
 */
export async function loadGameData() {
  try {
    const res = await fetch('/data/provinces.geojson')

    if (!res.ok) {
      throw new Error(`Failed to fetch provinces.geojson — status ${res.status}`)
    }

    const data = await res.json()
    useMapStore.getState().setGeojson(data)

    console.log(data.features[0].properties);

    console.info(`[Kapuluan] Loaded ${data.features.length} province features.`)
  } catch (err) {
    console.error('[Kapuluan] loadGameData failed:', err)
  }
}