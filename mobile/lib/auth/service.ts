/**
 * Composition root for the Supabase auth service. The runtime identity is
 * derived from `/api/auth/sync`, never from Supabase user or app metadata, so
 * the client cannot widen its own authorization. Implementation lives in the
 * sibling modules below; this file pins the public surface.
 */
export { SupabaseAuthService } from "./SupabaseAuthService";
export type {
  AuthCallbackResult,
  AuthEnrollmentResult,
  AuthIdentity,
  LogoutQueuePurger,
  MfaChallenge,
  TotpEnrollment,
} from "./service-types";
