import type { StyleSpecification } from "maplibre-gl";

/**
 * Raster basemap that works without API keys.
 * Prefer this over remote vector styles that can fail silently in browsers/WebViews.
 */
export const FINDIT_MAP_STYLE: StyleSpecification = {
  version: 8,
  name: "FINDIT",
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: "carto",
      type: "raster",
      source: "carto",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

/** Inline JSON for WebViews that cannot import the TS module. */
export const FINDIT_MAP_STYLE_JSON = JSON.stringify(FINDIT_MAP_STYLE);
