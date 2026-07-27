import type { Map as LeafletMap, TileLayer } from "leaflet"

export type LeafletModule = typeof import("leaflet")

const AMAP_TILE_URL =
  "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}"

let leafletPromise: Promise<LeafletModule> | null = null

export function loadLeaflet() {
  leafletPromise ??= import("leaflet")
  return leafletPromise
}

export function addDomesticTileLayer(L: LeafletModule, map: LeafletMap): TileLayer {
  map.attributionControl.setPrefix(false)

  return L.tileLayer(AMAP_TILE_URL, {
    subdomains: ["1", "2", "3", "4"],
    minZoom: 3,
    maxZoom: 18,
    tileSize: 256,
    keepBuffer: 2,
    crossOrigin: "anonymous",
    attribution: "高德地图",
    className: "nature-amap-tile",
  }).addTo(map)
}
