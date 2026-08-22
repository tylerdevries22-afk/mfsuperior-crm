import { useCallback, useMemo, useRef } from "react";
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
 */

export interface MapMarker {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly label: string;
  readonly sublabel?: string;
  /** Any CSS colour. Callers use it to encode status. */
  readonly color: string;
  /** Drawn larger with a pulsing halo, for the currently tracked subject. */
  readonly active?: boolean;
}

export interface LiveMapProps {
  readonly markers: readonly MapMarker[];
  /** Fraction of the viewport covered by an overlay, so pins stay clear of it. */
  readonly bottomInsetRatio?: number;
  readonly onSelectMarker?: (id: string) => void;
  readonly selectedId?: string | null;
  readonly style?: object;
}

/** Free OpenStreetMap vector tiles, no key, no request limit. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

function buildHtml(
  markers: readonly MapMarker[],
  selectedId: string | null,
  bottomInsetRatio: number,
): string {
  const payload = JSON.stringify({ markers, selectedId, bottomInsetRatio });
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
  .pin { width:16px; height:16px; border-radius:50%; border:2px solid rgba(0,0,0,.45); cursor:pointer; }
  .pin.active { width:22px; height:22px; box-shadow:0 0 0 6px rgba(255,255,255,.14); }
  .pin.active::after {
    content:''; position:absolute; inset:-8px; border-radius:50%;
    border:2px solid currentColor; animation:pulse 1.8s ease-out infinite;
  }
  @keyframes pulse { 0%{transform:scale(.7);opacity:.7} 100%{transform:scale(1.5);opacity:0} }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var data = ${payload};
  var post = function (msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  };
  var map = new maplibregl.Map({
    container: 'map',
    style: '${STYLE_URL}',
    center: [-104.99, 39.74],
    zoom: 6,
    attributionControl: { compact: true }
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  function render() {
    var bounds = new maplibregl.LngLatBounds();
    var any = false;
    data.markers.forEach(function (m) {
      var el = document.createElement('div');
      el.className = 'pin' + (m.id === data.selectedId ? ' active' : '');
      el.style.background = m.color;
      el.style.color = m.color;
      el.style.position = 'relative';
      el.addEventListener('click', function () { post({ type: 'select', id: m.id }); });
      new maplibregl.Marker({ element: el })
        .setLngLat([m.longitude, m.latitude])
        .setPopup(new maplibregl.Popup({ offset: 18, closeButton: false })
          .setHTML('<strong>' + m.label + '</strong>' + (m.sublabel ? '<br/>' + m.sublabel : '')))
        .addTo(map);
      bounds.extend([m.longitude, m.latitude]);
      any = true;
    });
    if (!any) return;
    // The sheet covers the lower part of the canvas, so bias the fit upward;
    // without this, pins settle underneath it and look missing.
    var inset = Math.round(window.innerHeight * (data.bottomInsetRatio || 0));
    map.fitBounds(bounds, {
      padding: { top: 72, left: 48, right: 48, bottom: inset + 72 },
      maxZoom: 11,
      duration: 0
    });
  }

  map.on('load', function () { render(); post({ type: 'ready' }); });
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
}: LiveMapProps) {
  const webRef = useRef<WebView>(null);
  const html = useMemo(
    () => buildHtml(markers, selectedId, bottomInsetRatio),
    [bottomInsetRatio, markers, selectedId],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as { type: string; id?: string };
        if (message.type === "select" && message.id) onSelectMarker?.(message.id);
      } catch {
        // A malformed frame from the page is not worth surfacing to the user.
      }
    },
    [onSelectMarker],
  );

  return (
    <View style={[styles.fill, style]}>
      <WebView
        allowsInlineMediaPlayback
        androidLayerType="hardware"
        originWhitelist={["*"]}
        onMessage={handleMessage}
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
