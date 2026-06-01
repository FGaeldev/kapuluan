/**
 * useMapStore.js
 *
 * Purpose:  Manages map state — loaded province geodata, viewport
 *           transform (pan/zoom), and currently selected province.
 *
 * Usage:    useMapStore() in any map or UI component.
 *
 * Dependencies: zustand, immer
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const useMapStore = create(
  immer((set) => ({
    // Raw GeoJSON FeatureCollection loaded from public/data/provinces.geojson
    geojson: null,

    // Currently hovered/selected province feature properties
    selectedProvince: null,

    // Viewport transform — controls pan and zoom of the map
    transform: {
      x: 0,
      y: 0,
      scale: 1,
    },

    /**
     * Store loaded GeoJSON data after fetch.
     * @param {object} data - GeoJSON FeatureCollection
     */
    setGeojson: (data) => set((state) => {
      state.geojson = data
    }),

    /**
     * Set the active selected province.
     * @param {object|null} province - GeoJSON feature properties or null
     */
    setSelectedProvince: (province) => set((state) => {
      state.selectedProvince = province
    }),

    /**
     * Update the viewport pan/zoom transform.
     * @param {object} transform - { x, y, scale }
     */
    setTransform: (transform) => set((state) => {
      state.transform = transform
    }),
  }))
)

export default useMapStore