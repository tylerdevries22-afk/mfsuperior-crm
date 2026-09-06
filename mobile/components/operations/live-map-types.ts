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
