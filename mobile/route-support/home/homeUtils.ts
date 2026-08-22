/**
 * Ported from the Appliance Diagnostic Systems `homeUtils` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d. The reference resolves a tenant
 * timezone; freight operations run in the device's own zone, so these read it
 * directly and stay consistent with the schedule's date handling.
 */

export interface Greeting {
  readonly text: string;
  readonly sub: string;
}

export function getGreeting(now: Date = new Date()): Greeting {
  const h = now.getHours();
  if (h < 5) return { text: "Good Evening", sub: "Late night?" };
  if (h < 12) return { text: "Good Morning", sub: "Let's get after it" };
  if (h < 17) return { text: "Good Afternoon", sub: "Keep it rolling" };
  return { text: "Good Evening", sub: "Wrapping up" };
}

/** The reference greets by time of day; MF adds the first name when known. */
export function greetingFor(displayName?: string | null, now: Date = new Date()): string {
  const { text } = getGreeting(now);
  const first = displayName?.trim().split(/\s+/)[0];
  return first ? `${text}, ${first}` : text;
}

export function formattedDate(now: Date = new Date()): string {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatCurrency(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toLocaleString()}`;
}
