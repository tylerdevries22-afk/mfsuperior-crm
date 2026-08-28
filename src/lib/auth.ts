import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  accounts,
  organizationMemberships,
  organizations,
  sessions,
  users,
  verificationTokens,
} from "@/lib/db/schema";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

// NextAuth() runs at module load. Read provider creds straight from
// process.env so build-time page-data collection never trips strict env
// validation; serverless cold starts always re-evaluate this module with the
// runtime env present.
const nextAuth = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
      // Supabase invitations create the canonical user first. Automatic
      // Google linking is safe here because the production signIn callback
      // independently requires that exact email to hold an active, scoped
      // admin membership before Auth.js reaches account linking.
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "database" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user }) {
      if (process.env.NODE_ENV !== "production") return true;
      return webAdminAccessAllowed({ email: user.email });
    },
    async session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

/**
 * Returns only production sessions backed by an active organization-admin
 * membership. Keeping this check in the shared auth boundary protects pages,
 * API routes, and direct Server Action requests, including sessions created
 * before the OAuth sign-in gate was deployed.
 */
export async function auth() {
  const session = await nextAuth.auth();
  if (!session?.user || process.env.NODE_ENV !== "production") return session;
  const allowed = await webAdminAccessAllowed({
    email: session.user.email,
    userId: session.user.id,
  });
  return allowed ? session : null;
}

async function webAdminAccessAllowed(identity: {
  readonly email?: string | null;
  readonly userId?: string | null;
}): Promise<boolean> {
  const organizationSlug = process.env.WEB_ADMIN_ORGANIZATION_SLUG?.trim()
    || "mf-superior";
  if (!/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(organizationSlug)) {
    return false;
  }
  const normalizedEmail = identity.email?.trim().toLowerCase();
  const identityFilter = identity.userId
    ? eq(users.id, identity.userId)
    : normalizedEmail
      ? sql`lower(${users.email}) = ${normalizedEmail}`
      : null;
  if (!identityFilter) return false;

  const [membership] = await db
    .select({ id: organizationMemberships.id })
    .from(organizationMemberships)
    .innerJoin(users, eq(users.id, organizationMemberships.userId))
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMemberships.organizationId),
    )
    .where(and(
      identityFilter,
      eq(organizationMemberships.role, "admin"),
      eq(organizationMemberships.status, "active"),
      eq(organizations.status, "active"),
      eq(organizations.slug, organizationSlug),
    ))
    .limit(1);
  return Boolean(membership);
}
