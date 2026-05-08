import { google, type calendar_v3 } from "googleapis";
import { getGoogleAccessToken } from "@/lib/gmail/oauth";
import { ProviderAuthError } from "@/lib/email/provider";

/**
 * Google Calendar client wrapper, scoped to the same OAuth user as Gmail/Drive.
 *
 * Scope on the OAuth client is `calendar.events` — the app can read and write
 * events on the user's calendars but cannot create/delete entire calendars.
 * That's the right blast-radius for a CRM that schedules follow-up calls
 * and demos.
 */

export type CalendarEventRef = {
  id: string;
  htmlLink: string;
  start: string;
  end: string;
  summary: string;
};

export async function getCalendarClient(
  userId: string,
): Promise<calendar_v3.Calendar> {
  const accessToken = await getGoogleAccessToken(userId);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

function rethrow(err: unknown): never {
  const e = err as { code?: number; status?: number; message?: string };
  if (
    e.code === 401 ||
    e.status === 401 ||
    e.code === 403 ||
    e.status === 403
  ) {
    throw new ProviderAuthError(
      e.message ?? "Calendar token expired or insufficient scope",
    );
  }
  throw err;
}

export type CreateEventInput = {
  summary: string;
  description?: string;
  /** ISO-8601 timestamp. */
  startsAt: string;
  /** Defaults to 30 minutes after `startsAt`. */
  endsAt?: string;
  /** IANA timezone, e.g. "America/Denver". Defaults to "America/Denver". */
  timeZone?: string;
  /** Optional invitee emails. */
  attendees?: string[];
  /** Optional Google Meet link generation. */
  withMeet?: boolean;
  /** Calendar to write to. Defaults to the user's primary calendar. */
  calendarId?: string;
};

/**
 * Create a calendar event. Returns the created event reference.
 *
 * Defaults match the CRM's typical use case: 30-minute slot on the primary
 * calendar in America/Denver, no Meet link unless requested.
 */
export async function createEvent(
  userId: string,
  input: CreateEventInput,
): Promise<CalendarEventRef> {
  const cal = await getCalendarClient(userId);
  const timeZone = input.timeZone ?? "America/Denver";
  const start = new Date(input.startsAt);
  const end = input.endsAt
    ? new Date(input.endsAt)
    : new Date(start.getTime() + 30 * 60 * 1000);

  const requestBody: calendar_v3.Schema$Event = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: start.toISOString(), timeZone },
    end: { dateTime: end.toISOString(), timeZone },
    attendees: input.attendees?.map((email) => ({ email })),
  };

  if (input.withMeet) {
    requestBody.conferenceData = {
      createRequest: {
        requestId: `mfs-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  let res;
  try {
    res = await cal.events.insert({
      calendarId: input.calendarId ?? "primary",
      requestBody,
      conferenceDataVersion: input.withMeet ? 1 : 0,
      sendUpdates: input.attendees?.length ? "all" : "none",
    });
  } catch (err) {
    rethrow(err);
  }

  const e = res.data;
  return {
    id: e.id ?? "",
    htmlLink: e.htmlLink ?? "",
    start: e.start?.dateTime ?? "",
    end: e.end?.dateTime ?? "",
    summary: e.summary ?? "",
  };
}

/**
 * List the next N upcoming events on the user's primary calendar.
 * Used for the admin "Upcoming follow-ups" panel.
 */
export async function listUpcomingEvents(
  userId: string,
  limit = 10,
): Promise<CalendarEventRef[]> {
  const cal = await getCalendarClient(userId);
  let res;
  try {
    res = await cal.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: limit,
      singleEvents: true,
      orderBy: "startTime",
    });
  } catch (err) {
    rethrow(err);
  }
  return (res.data.items ?? []).map((e) => ({
    id: e.id ?? "",
    htmlLink: e.htmlLink ?? "",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    summary: e.summary ?? "(no title)",
  }));
}

export async function userHasCalendarConnection(
  userId: string,
): Promise<boolean> {
  try {
    await getGoogleAccessToken(userId);
    return true;
  } catch {
    return false;
  }
}
