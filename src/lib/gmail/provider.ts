import { gmail_v1 } from "googleapis";
import { getGmailClient } from "./oauth";
import { buildRawMime, toGmailRaw } from "@/lib/email/mime";
import {
  ProviderAuthError,
  ProviderRateLimitError,
  type EmailProvider,
  type ProviderResult,
  type ProviderSendInput,
} from "@/lib/email/provider";

/**
 * Gmail-backed implementation of EmailProvider.
 *
 * Notes:
 *   - All calls are scoped to the authed user (per-user OAuth tokens).
 *   - Threading: pass `threadId` to keep follow-ups in the same conversation.
 *   - Drafts vs sends: same MIME, different endpoint.
 *   - Errors translate Google's HTTP status into our auth/rate-limit types
 *     so upstream retry/pause logic doesn't have to know about Google.
 */
export class GmailProvider implements EmailProvider {
  readonly name = "gmail" as const;

  constructor(private readonly userId: string) {}

  async createDraft(input: ProviderSendInput): Promise<ProviderResult> {
    const gmail = await getGmailClient(this.userId);
    const raw = this.buildRaw(input);

    let response: { data: gmail_v1.Schema$Draft };
    try {
      response = await gmail.users.drafts.create({
        userId: "me",
        requestBody: {
          message: {
            raw,
            ...(input.threadId ? { threadId: input.threadId } : {}),
          },
        },
      });
    } catch (err) {
      throw translateGmailError(err);
    }

    const message = response.data.message;
    if (!message?.id || !message?.threadId || !response.data.id) {
      throw new Error("Gmail did not return draft + message ids");
    }
    return {
      providerMessageId: message.id,
      threadId: message.threadId,
      draftId: response.data.id,
    };
  }

  async send(input: ProviderSendInput): Promise<ProviderResult> {
    const gmail = await getGmailClient(this.userId);
    const raw = this.buildRaw(input);

    let response: { data: gmail_v1.Schema$Message };
    try {
      response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw,
          ...(input.threadId ? { threadId: input.threadId } : {}),
        },
      });
    } catch (err) {
      throw translateGmailError(err);
    }

    if (!response.data.id || !response.data.threadId) {
      throw new Error("Gmail did not return message + thread ids");
    }
    return {
      providerMessageId: response.data.id,
      threadId: response.data.threadId,
    };
  }

  async getThreadMessages(threadId: string) {
    const gmail = await getGmailClient(this.userId);
    let response: { data: gmail_v1.Schema$Thread };
    try {
      response = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Message-Id"],
      });
    } catch (err) {
      throw translateGmailError(err);
    }
    const messages = response.data.messages ?? [];
    return messages.map((m) => {
      const headers = m.payload?.headers ?? [];
      const h = (name: string) =>
        headers.find((x) => x.name?.toLowerCase() === name.toLowerCase())
          ?.value ?? "";
      return {
        id: m.id ?? "",
        threadId: m.threadId ?? "",
        from: h("From"),
        to: h("To"),
        subject: h("Subject"),
        internalDate: Number(m.internalDate ?? 0),
      };
    });
  }

  private buildRaw(input: ProviderSendInput): string {
    const message = buildRawMime({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      inReplyTo: input.inReplyTo,
      extraHeaders: input.headers,
    });
    return toGmailRaw(message);
  }
}

type GoogleApiError = {
  code?: number;
  errors?: unknown;
  response?: { status?: number; headers?: Record<string, string> };
};

function translateGmailError(raw: unknown): Error {
  const err = raw as GoogleApiError & { message?: string };
  const status = err.response?.status ?? err.code;
  const msg =
    err.message ??
    (typeof err === "string" ? err : "Gmail API request failed");
  if (status === 401 || status === 403) {
    return new ProviderAuthError(`Gmail rejected the request (${status}): ${msg}`);
  }
  if (status === 429) {
    const retry = Number(err.response?.headers?.["retry-after"] ?? 0);
    return new ProviderRateLimitError(
      `Gmail rate-limited the request: ${msg}`,
      Number.isFinite(retry) ? retry : undefined,
    );
  }
  return new Error(`Gmail API error (${status ?? "?"}): ${msg}`);
}
