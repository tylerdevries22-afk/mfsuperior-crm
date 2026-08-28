import { fetchWithRetry } from "./external-fetch";

export interface ExpoPushMessage {
  readonly body: string;
  readonly data: Record<string, string>;
  readonly title: string;
  readonly to: string;
}

export interface ExpoPushResult {
  readonly accepted: boolean;
  readonly permanentlyRejected: boolean;
}

/** Sends one push through Expo with a bounded timeout and one safe retry. */
export async function sendExpoPushNotification(message: ExpoPushMessage): Promise<ExpoPushResult> {
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
    const payload: unknown = await response.json().catch(() => null);
    const ticket = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
    const details = ticket && isRecord(ticket.details) ? ticket.details : null;
    return {
      accepted: response.ok && ticket?.status === "ok",
      permanentlyRejected: details?.error === "DeviceNotRegistered",
    };
  } catch {
    return { accepted: false, permanentlyRejected: false };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
