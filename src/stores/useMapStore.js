/**
 * useMapStore.js
 *
 * Purpose:  Manages map state — loaded municipality geodata, viewport
 *           transform (pan/zoom), selected municipality, label toggle,
 *           and the player's chosen starting municipality.
 *
 * Usage:    useMapStore() in any map or UI component.
 *
 * Dependencies: zustand, immer
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const useMapStore = create(
  immer((set) => ({
    // Raw GeoJSON FeatureCollection loaded from public/data/municipalities.geojson
    geojson: null,

    // Currently hovered/selected municipality feature properties (info panel)
    selectedProvince: null,

    // The municipality the player has confirmed as their starting territory
    playerMunicipality: null,

    // Viewport transform — controls pan and zoom of the map
    transform: {
      x: 0,
      y: 0,
      scale: 1,
    },

    // Whether municipality name labels are visible on the map
    labelsVisible: true,

    /**
     * Store loaded GeoJSON data after fetch.
     * @param {object} data - GeoJSON FeatureCollection
     */
    setGeojson: (data) => set((state) => {
      state.geojson = data
    }),

    /**
     * Set the active selected municipality (info panel / setup highlight).
     * @param {object|null} province - GeoJSON feature properties or null
     */
    setSelectedProvince: (province) => set((state) => {
      state.selectedProvince = province
    }),

    /**
     * Confirm the player's starting municipality.
     * Called when player clicks Confirm during setup phase.
     * @param {object} province - GeoJSON feature properties
     */
    setPlayerMunicipality: (province) => set((state) => {
      state.playerMunicipality = province
    }),

    /**
     * Update the viewport pan/zoom transform.
     * @param {object} transform - { x, y, scale }
     */
    setTransform: (transform) => set((state) => {
      state.transform = transform
    }),

    /**
     * Toggle municipality label visibility on/off.
     */
    toggleLabels: () => set((state) => {
      state.labelsVisible = !state.labelsVisible
    }),
  }))
)

export default useMapStore
