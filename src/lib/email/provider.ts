/**
 * Email provider interface. The compose pipeline produces a `ComposedEmail`
 * (subject, html, text, headers); a provider wraps the underlying ESP
 * (Gmail today, Resend tomorrow once a domain is purchased).
 *
 * The provider does NOT compose — it only sends what it's given. Variable
 * substitution, footer injection, and tracking happen upstream in
 * `lib/email/compose.ts`.
 */

export type ProviderSendInput = {
  /** Mailbox display: "Display Name <addr@host>" or "addr@host". */
  from: string;
  /** Single recipient (no CC/BCC for v1; one outreach email = one recipient). */
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Free-form headers (List-Unsubscribe, etc.). */
  headers?: Record<string, string>;
  /** When set, replies on the existing Gmail thread (sets In-Reply-To). */
  inReplyTo?: string;
  /** Gmail thread id to reply on; supersedes `inReplyTo` for Gmail provider. */
  threadId?: string;
};

export type ProviderResult = {
  providerMessageId: string;
  threadId: string;
  /** Set when the provider created a draft instead of a send. */
  draftId?: string;
};

export interface EmailProvider {
  name: "gmail" | "resend";
  /** Create an unsent draft in the user's mailbox. */
  createDraft(input: ProviderSendInput): Promise<ProviderResult>;
  /** Send immediately, no draft step. */
  send(input: ProviderSendInput): Promise<ProviderResult>;
  /** Fetch messages on a thread (for reply detection). */
  getThreadMessages(threadId: string): Promise<
    Array<{
      id: string;
      threadId: string;
      from: string;
      to: string;
      subject: string;
      internalDate: number;
    }>
  >;
}

export class ProviderAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderAuthError";
  }
}

export class ProviderRateLimitError extends Error {
  retryAfterSeconds?: number;
  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "ProviderRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
