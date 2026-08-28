import { fetchWithRetry } from "./external-fetch";

export interface ExpoPushMessage {
  readonly body: string;
  readonly data: Record<string, string>;
  readonly title: string;
  readonly to: string;
}

/** Sends one push through Expo with a bounded timeout and one safe retry. */
export async function sendExpoPushNotification(message: ExpoPushMessage): Promise<boolean> {
  try {
    const response = await fetchWithRetry(
      "https://exp.host/--/api/v2/push/send",
      {
        body: JSON.stringify({ ...message, sound: "default" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { maxAttempts: 2, retryUnsafe: true, timeoutMs: 8_000 },
    );
    return response.ok;
  } catch {
    return false;
  }
}
