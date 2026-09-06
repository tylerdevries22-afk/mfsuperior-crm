import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { THEME } from "@/theme";

import { buildMapHtml } from "./live-map-document";
import type { LiveMapProps } from "./live-map-types";
export type { LiveMapProps, MapMarker } from "./live-map-types";

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
    () => buildMapHtml(bottomInsetRatio, glideMs),
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
