import { Platform } from "react-native";

import { ChunkedSecureStoreAdapter } from "../../lib/auth/secureStore";
import { createPayoutSecureStorage } from "../payoutStorage";

const originalPlatform = Platform.OS;
const originalDemo = process.env.EXPO_PUBLIC_DEMO_AUTH_ENABLED;

afterEach(() => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
  if (originalDemo === undefined) delete process.env.EXPO_PUBLIC_DEMO_AUTH_ENABLED;
  else process.env.EXPO_PUBLIC_DEMO_AUTH_ENABLED = originalDemo;
});

describe("payout storage platform boundary", () => {
  it("supports demo handles across store instances in the same browser session", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    process.env.EXPO_PUBLIC_DEMO_AUTH_ENABLED = "true";
    const first = createPayoutSecureStorage();
    const second = createPayoutSecureStorage();
    await first.setItem("demo-driver", "@sample-driver");
    expect(await second.getItem("demo-driver")).toBe("@sample-driver");
    expect(await second.getItem("other-driver")).toBeNull();
    await second.removeItem("demo-driver");
    expect(await first.getItem("demo-driver")).toBeNull();
  });

  it("refuses browser handle reads, writes, and deletes outside demo mode", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    delete process.env.EXPO_PUBLIC_DEMO_AUTH_ENABLED;
    const storage = createPayoutSecureStorage();
    for (const operation of [
      () => storage.getItem("driver"),
      () => storage.setItem("driver", "@sample"),
      () => storage.removeItem("driver"),
    ]) await expect(operation()).rejects.toThrow("Manage payout handles in the mobile app.");
  });

  it.each(["ios", "android"])("keeps %s handles in secure device storage", (platform) => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: platform });
    expect(createPayoutSecureStorage()).toBeInstanceOf(ChunkedSecureStoreAdapter);
  });
});
