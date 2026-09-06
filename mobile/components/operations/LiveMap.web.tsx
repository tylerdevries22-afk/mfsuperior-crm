import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { buildMapHtml } from "./live-map-document";
import type { LiveMapProps } from "./live-map-types";
export type { LiveMapProps, MapMarker } from "./live-map-types";

export function LiveMap({
  markers, onSelectMarker, selectedId = null, style, bottomInsetRatio = 0,
  focusId = null, glideMs = 900,
}: LiveMapProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const html = useMemo(() => buildMapHtml(bottomInsetRatio, glideMs), [bottomInsetRatio, glideMs]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.source !== "mf-fleet-map") return;
      if (event.data.type === "ready") setLoadVersion((version) => version + 1);
      if (event.data.type === "select" && markers.some(({ id }) => id === event.data.id)) {
        onSelectMarker?.(event.data.id);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [markers, onSelectMarker]);

  useEffect(() => {
    if (!loadVersion) return;
    frame.current?.contentWindow?.postMessage({
      source: "mf-fleet-parent",
      meta: markers.map(({ id, color, statusColor, avatarUri }) => ({ id, color, statusColor, avatarUri })),
      positions: markers.map(({ id, latitude, longitude }) => ({ id, lat: latitude, lng: longitude })),
      selectedId,
      focus: markers.find(({ id }) => id === focusId),
    }, "*");
  }, [focusId, markers, loadVersion, selectedId]);

  return <View style={[{ flex: 1 }, style]}>
    <iframe
      ref={frame}
      sandbox="allow-scripts"
      srcDoc={html}
      style={{ border: 0, height: "100%", width: "100%" }}
      title="Live fleet map"
    />
  </View>;
}
