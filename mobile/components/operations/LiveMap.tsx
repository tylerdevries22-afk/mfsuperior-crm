import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { THEME } from "@/theme";

/**
 * Live map built on MapLibre GL.
 *
 * Why MapLibre rather than Mapbox or Google: MapLibre is the community fork of
 * Mapbox GL taken before its licence change, so it is the same rendering
 * engine with no token, no billing account, and no per-load pricing. Mapbox
 * requires a card from day one and charges past 50k loads a month; Google
 * requires billing outright. Tiles come from OpenFreeMap, which serves
 * OpenStreetMap vector tiles with no key and no request limit, and can be
 * swapped for self-hosted tiles later by changing one style URL — so the same
 * component scales from demo to production without a rewrite, and carries no
 * freight-specific assumptions that would stop another industry reusing it.
 *
 * It renders through a WebView because Expo Go bundles `RNCWebView` but no
 * native map module — `expo-maps` and `@maplibre/maplibre-react-native` both
 * need a development build. Moving to one later means swapping this component
 * for the native MapLibre SDK while keeping the same style URL and GeoJSON.
 *
 * The page is built **once**. Marker updates are pushed in through
 * `injectJavaScript`, never by rebuilding `source`: replacing the source
 * remounts the map, which at one position update per second would flicker
 * continuously and throw away the camera. Markers carry a CSS transform
 * transition, so MapLibre repositioning them reads as a glide rather than a
 * jump, and continuous motion costs no JS animation.
 */

export interface MapMarker {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly label: string;
  readonly sublabel?: string;
  /** Body colour of the vehicle glyph. Cosmetic — status rides on `statusColor`. */
  readonly color: string;
  /** Small dot on the marker, so status survives a cosmetic body colour. */
  readonly statusColor?: string;
  /** `data:` URI. A bundled asset path will not resolve inside the WebView. */
  readonly avatarUri?: string;
  readonly active?: boolean;
}

export interface LiveMapProps {
  readonly markers: readonly MapMarker[];
  readonly onSelectMarker?: (id: string) => void;
  readonly selectedId?: string | null;
  readonly style?: object;
  /** Fraction of the viewport covered by an overlay, so the camera clears it. */
  readonly bottomInsetRatio?: number;
  /** Recentres the camera on this marker when it changes. */
  readonly focusId?: string | null;
  /** Milliseconds a marker takes to glide to a new position. */
  readonly glideMs?: number;
}

/** Free OpenStreetMap vector tiles, no key, no request limit. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** Colorado, corner to corner. The map opens on the state it operates in. */
const HOME_BOUNDS: readonly [[number, number], [number, number]] = [
  [-109.06, 36.99],
  [-102.04, 41.0],
];

/**
 * Box truck matching the mark in `assets/brand/mf-logo-mark.png`: three-quarter
 * front, box body with the lime swoosh, heavy black outline. Inline SVG rather
 * than a raster so it stays crisp at every zoom, recolours from one path, and
 * adds about a kilobyte instead of five images.
 */
function truckSvg(body: string): string {
  return `
<svg width="44" height="30" viewBox="0 0 44 30" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#111" stroke-width="1.6" stroke-linejoin="round">
    <path d="M2 8 L24 5 L24 22 L2 24 Z" fill="${body}"/>
    <path d="M4 17 L24 13 L24 18 L4 20 Z" fill="#C8DC1E" stroke="none" opacity=".95"/>
    <path d="M24 6 L33 8 L36 13 L36 21 L24 22 Z" fill="${body}"/>
    <path d="M26 9 L32 10 L34 13.5 L26 13.5 Z" fill="#1B1B1B" stroke="none"/>
    <rect x="36" y="14" width="4" height="5" rx="1" fill="${body}"/>
  </g>
  <g fill="#1B1B1B">
    <circle cx="12" cy="24" r="3.4"/><circle cx="12" cy="24" r="1.3" fill="#9AA0A6"/>
    <circle cx="31" cy="23" r="3.4"/><circle cx="31" cy="23" r="1.3" fill="#9AA0A6"/>
  </g>
</svg>`.trim();
}

function buildHtml(bottomInsetRatio: number, glideMs: number): string {
  const bounds = JSON.stringify(HOME_BOUNDS);
  const truck = JSON.stringify(truckSvg("__BODY__"));
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<style>
  html, body, #map { margin:0; padding:0; height:100%; width:100%; background:${THEME.background}; }
  .maplibregl-ctrl-attrib { font-size: 9px; }
  /*
    44x44 hit area around a smaller glyph, per the touch-target minimum.
    The absolute positioning is not decoration: MapLibre places markers with
    position absolute from its own stylesheet, and this rule loads after it, so
    anything else here (relative, static) drops every marker into document flow
    and stacks them 44px apart instead of putting them on their coordinates.
    It doubles as the containing block for the avatar and status dot below.
  */
  .unit { position:absolute; top:0; left:0; width:44px; height:44px; cursor:pointer;
          display:flex; align-items:center; justify-content:center; }
  .unit svg { filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); }
  .unit .avatar { position:absolute; top:-8px; left:-8px; width:22px; height:22px;
                  border-radius:50%; border:2px solid #fff; object-fit:cover;
                  box-shadow:0 1px 3px rgba(0,0,0,.5); background:#333; }
  .unit .status { position:absolute; right:-1px; bottom:1px; width:10px; height:10px;
                  border-radius:50%; border:2px solid rgba(0,0,0,.55); }
  .unit.active { z-index:5; }
  .unit.active .halo { position:absolute; inset:-4px; border-radius:50%;
                       border:2px solid ${THEME.primary}; animation:pulse 1.8s ease-out infinite; }
  @keyframes pulse { 0%{transform:scale(.75);opacity:.85} 100%{transform:scale(1.35);opacity:0} }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var post = function (msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  };
  var GLIDE = ${glideMs};
  var TRUCK = ${truck};
  var HOME = ${bounds};
  var map = new maplibregl.Map({
    container: 'map',
    style: '${STYLE_URL}',
    bounds: HOME,
    attributionControl: { compact: true }
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  function framePadding() {
    var inset = Math.round(window.innerHeight * ${bottomInsetRatio});
    return { top: 56, left: 40, right: 40, bottom: inset + 40 };
  }

  var units = {};
  var meta = {};
  var selected = null;

  function build(id) {
    var el = document.createElement('div');
    el.className = 'unit';
    // MapLibre writes transform on this element; transitioning it turns each
    // discrete position update into a continuous glide.
    el.style.transition = 'transform ' + GLIDE + 'ms linear';
    el.addEventListener('click', function (e) { e.stopPropagation(); post({ type: 'select', id: id }); });
    var marker = new maplibregl.Marker({ element: el }).setLngLat([0, 0]).addTo(map);
    return { el: el, marker: marker, sig: null };
  }

  function paint(unit, id) {
    var m = meta[id];
    if (!m) return;
    // Only redraw the glyph when something visual actually changed; repainting
    // every tick would restart the avatar decode and kill the glide.
    var sig = [m.color, m.statusColor, m.avatarUri ? '1' : '0', id === selected ? 'a' : ''].join('|');
    if (unit.sig === sig) return;
    unit.sig = sig;
    // Toggle, never assign: MapLibre puts its own marker class on this element
    // and that class is what positions it. Rewriting className drops it, and
    // every marker after the first falls into document flow — stacking one
    // below the next instead of sitting on its coordinate.
    unit.el.classList.toggle('active', id === selected);
    unit.el.innerHTML =
      (id === selected ? '<div class="halo"></div>' : '') +
      TRUCK.split('__BODY__').join(m.color) +
      (m.avatarUri ? '<img class="avatar" src="' + m.avatarUri + '" alt="" />' : '') +
      (m.statusColor ? '<span class="status" style="background:' + m.statusColor + '"></span>' : '');
  }

  // Portraits are tens of kilobytes each, so they travel on their own channel
  // and only when they change. Pushing them with every position tick would put
  // a quarter of a megabyte a second through the bridge for nothing.
  window.__setMeta = function (list) {
    meta = {};
    list.forEach(function (m) { meta[m.id] = m; });
    Object.keys(units).forEach(function (id) { units[id].sig = null; paint(units[id], id); });
  };

  window.__setPositions = function (list, selectedId) {
    selected = selectedId;
    var next = {};
    list.forEach(function (p) {
      var unit = units[p.id] || (units[p.id] = build(p.id));
      unit.marker.setLngLat([p.lng, p.lat]);
      paint(unit, p.id);
      next[p.id] = true;
    });
    Object.keys(units).forEach(function (id) {
      if (!next[id]) { units[id].marker.remove(); delete units[id]; }
    });
  };

  window.__focus = function (lng, lat) {
    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 9), duration: 600, padding: framePadding() });
  };

  window.__home = function () {
    map.fitBounds(HOME, { padding: framePadding(), duration: 600 });
  };

  // The home view is framed here rather than in the constructor: at construction
  // the container has not been laid out, so window.innerHeight is still zero and
  // the padding meant to clear the sheet would be computed from nothing — which
  // is what left the map zoomed in past the corners of the state.
  map.on('load', function () {
    map.resize();
    map.fitBounds(HOME, { padding: framePadding(), duration: 0 });
    post({ type: 'ready' });
  });

  window.addEventListener('resize', function () { map.resize(); });
  map.on('error', function (e) { post({ type: 'error', message: String(e && e.error && e.error.message) }); });
</script>
</body>
</html>`;
}

export function LiveMap({
  markers,
  onSelectMarker,
  selectedId = null,
  style,
  bottomInsetRatio = 0,
  focusId = null,
  glideMs = 900,
}: LiveMapProps) {
  const webRef = useRef<WebView>(null);
  const ready = useRef(false);

  /**
   * Deliberately excludes `markers` and `selectedId`: those flow in through
   * `injectJavaScript`. Adding either here reintroduces the remount that makes
   * live tracking flicker.
   */
  const html = useMemo(
    () => buildHtml(bottomInsetRatio, glideMs),
    [bottomInsetRatio, glideMs],
  );

  /**
   * Portraits and livery only change when the fleet does, so they are pushed on
   * their own channel and skipped when identical. Positions ride a compact
   * payload that stays small enough to send every tick.
   */
  const lastMeta = useRef("");
  const push = useCallback(() => {
    if (!ready.current) return;
    const meta = JSON.stringify(
      markers.map(({ id, color, statusColor, avatarUri }) => ({ id, color, statusColor, avatarUri })),
    );
    if (meta !== lastMeta.current) {
      lastMeta.current = meta;
      webRef.current?.injectJavaScript(`window.__setMeta(${meta}); true;`);
    }
    const positions = JSON.stringify(
      markers.map(({ id, latitude, longitude }) => ({ id, lat: latitude, lng: longitude })),
    );
    webRef.current?.injectJavaScript(
      `window.__setPositions(${positions}, ${JSON.stringify(selectedId)}); true;`,
    );
  }, [markers, selectedId]);

  useEffect(push, [push]);

  useEffect(() => {
    if (!ready.current || !focusId) return;
    const target = markers.find((marker) => marker.id === focusId);
    if (!target) return;
    webRef.current?.injectJavaScript(
      `window.__focus(${target.longitude}, ${target.latitude}); true;`,
    );
  }, [focusId, markers]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as { type: string; id?: string };
        if (message.type === "ready") {
          ready.current = true;
          // A reloaded page has no meta, so the cache must not claim otherwise.
          lastMeta.current = "";
          push();
          return;
        }
        if (message.type === "select" && message.id) onSelectMarker?.(message.id);
      } catch {
        // A malformed frame from the page is not worth surfacing to the user.
      }
    },
    [onSelectMarker, push],
  );

  return (
    <View style={[styles.fill, style]}>
      <WebView
        allowsInlineMediaPlayback
        androidLayerType="hardware"
        onMessage={handleMessage}
        originWhitelist={["*"]}
        ref={webRef}
        setSupportMultipleWindows={false}
        source={{ html }}
        style={styles.fill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: THEME.background },
});
