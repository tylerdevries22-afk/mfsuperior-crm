import * as Notifications from "expo-notifications";

export async function expoPushToken(projectId: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await withTimeout(
        Notifications.getExpoPushTokenAsync({ projectId }),
        8_000,
      );
      return result.data;
    } catch {
      if (attempt === 2) return null;
    }
  }
  return null;
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Notification token request timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
