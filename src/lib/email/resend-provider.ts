import { Resend } from "resend";
import {
  ProviderRateLimitError,
  type EmailProvider,
  type ProviderResult,
  type ProviderSendInput,
} from "@/lib/email/provider";

/**
 * Resend-backed EmailProvider.
 *
 * Limitations vs. Gmail:
 *   - No draft concept: createDraft sends immediately.
 *   - No thread fetching: getThreadMessages returns [] (reply detection disabled).
 *   - Threading: uses In-Reply-To header; threadId is the Resend message id.
 */
export class ResendProvider implements EmailProvider {
  readonly name = "resend" as const;
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async createDraft(input: ProviderSendInput): Promise<ProviderResult> {
    // Resend has no draft concept — delegate to send.
    return this.send(input);
  }

  async send(input: ProviderSendInput): Promise<ProviderResult> {
    const headers: Record<string, string> = { ...input.headers };
    if (input.inReplyTo) {
      headers["In-Reply-To"] = input.inReplyTo;
      headers["References"] = input.inReplyTo;
    }

    const { data, error } = await this.client.emails.send({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers,
    });

    if (error) {
      const msg = "message" in error ? (error as { message: string }).message : String(error);
      if ("name" in error && (error as { name: string }).name === "rate_limit_exceeded") {
        throw new ProviderRateLimitError(`Resend rate limit: ${msg}`);
      }
      throw new Error(`Resend error: ${msg}`);
    }

    if (!data?.id) {
      throw new Error("Resend did not return a message id");
    }

    return {
      providerMessageId: data.id,
      // Resend has no thread concept; the message id doubles as thread id so
      // follow-up steps can pass it back as inReplyTo for threading.
      threadId: data.id,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getThreadMessages(_threadId: string) {
    // Resend does not expose thread/inbox data — reply detection is not
    // available with this provider.
    return [];
  }
}
