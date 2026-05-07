import { unsubscribeUrl } from "@/lib/tracking/unsubscribe";

/**
 * CAN-SPAM compliant footer.
 *
 * Required by 15 U.S.C. § 7704 on every commercial email:
 *   1. Sender's valid physical postal address.
 *   2. Clear and conspicuous opt-out mechanism.
 *   3. Identification as a commercial message (subject line / context).
 *
 * The unsubscribe link uses an HMAC-bound token (see lib/tracking/unsubscribe).
 * Gmail also surfaces a native unsubscribe button when we set the
 * List-Unsubscribe header (RFC 8058) — see compose.ts for the header.
 */

export type FooterInputs = {
  leadId: string;
  businessName: string;
  businessAddress: string; // multi-line; \n separated
  businessMc?: string | null;
  businessUsdot?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildFooter(inputs: FooterInputs): { html: string; text: string } {
  const url = unsubscribeUrl(inputs.leadId);
  const addressLines = inputs.businessAddress
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const credentials = [
    inputs.businessMc?.trim() ? `MC# ${inputs.businessMc.trim()}` : null,
    inputs.businessUsdot?.trim() ? `USDOT# ${inputs.businessUsdot.trim()}` : null,
  ].filter(Boolean) as string[];

  const html = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.55;color:#64748b;">
  <tr><td>
    <strong style="color:#0f172a;">${escapeHtml(inputs.businessName)}</strong><br />
    ${addressLines.map((l) => escapeHtml(l)).join("<br />")}
    ${credentials.length ? `<br /><span style="font-family:'SF Mono',Menlo,Consolas,monospace;">${credentials.map(escapeHtml).join(" &middot; ")}</span>` : ""}
    <br /><br />
    You're receiving this email because we identified ${escapeHtml(inputs.businessName)} as a potential carrier partner. If this isn't a fit, <a href="${url}" style="color:#1747d6;text-decoration:underline;">unsubscribe</a> and we won't email you again.
  </td></tr>
</table>`;

  const textLines: string[] = [];
  textLines.push("");
  textLines.push("--");
  textLines.push(inputs.businessName);
  for (const l of addressLines) textLines.push(l);
  if (credentials.length) textLines.push(credentials.join(" · "));
  textLines.push("");
  textLines.push(
    "You're receiving this email because we identified your company as a potential carrier partner.",
  );
  textLines.push(`Unsubscribe: ${url}`);

  return { html, text: textLines.join("\n") };
}

/**
 * Headers Gmail requires (RFC 8058) for one-click unsubscribe in its UI.
 * Returns header lines suitable for assembling raw RFC 5322 email.
 */
export function unsubscribeHeaders(leadId: string, mailtoFallback: string): {
  listUnsubscribe: string;
  listUnsubscribePost: string;
} {
  const httpUrl = unsubscribeUrl(leadId);
  return {
    listUnsubscribe: `<mailto:${mailtoFallback}?subject=unsubscribe>, <${httpUrl}>`,
    listUnsubscribePost: "List-Unsubscribe=One-Click",
  };
}
