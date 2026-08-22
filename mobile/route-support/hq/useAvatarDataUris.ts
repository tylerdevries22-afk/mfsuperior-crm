import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useState } from "react";

import { resolveDriverAvatar } from "@/components/operations";
import type { Driver } from "@/domain/types";

/**
 * Bundled portraits as `data:` URIs, for use inside the map WebView.
 *
 * The WebView cannot resolve a packaged asset path, and in a production build
 * the local `file://` URI is outside anything it is allowed to read. Reading
 * each portrait once and inlining it as base64 sidesteps both, and the result
 * is cached in state so a per-second position update never re-reads the disk.
 */
export function useAvatarDataUris(drivers: readonly Driver[]): Readonly<Record<string, string>> {
  const [uris, setUris] = useState<Readonly<Record<string, string>>>({});
  const key = drivers.map((driver) => driver.id).join(",");

  useEffect(() => {
    let active = true;

    async function load() {
      const entries = await Promise.all(
        drivers.map(async (driver) => {
          // A driver whose portrait comes from the API already has a URL the
          // WebView can load directly.
          if (driver.avatarUrl) return [driver.id, driver.avatarUrl] as const;

          const source = resolveDriverAvatar(driver);
          if (!source || typeof source === "number") {
            const asset = Asset.fromModule(source as number);
            try {
              await asset.downloadAsync();
              if (!asset.localUri) return null;
              const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              return [driver.id, `data:image/webp;base64,${base64}`] as const;
            } catch {
              // A portrait that will not load is not worth failing the map for;
              // the marker simply renders without one.
              return null;
            }
          }
          return null;
        }),
      );

      if (!active) return;
      setUris(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
    }

    void load();
    return () => {
      active = false;
    };
    // `key` stands in for the driver list so a new array identity with the same
    // drivers does not re-read every portrait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return uris;
}
