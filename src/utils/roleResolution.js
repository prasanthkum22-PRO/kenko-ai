/**
 * Pure role-resolution helpers. Kept framework-free so the routing matrix can
 * be exercised by unit tests.
 *
 * The authoritative application role ALWAYS comes from a stored server-side
 * profile. There is no email-prefix heuristic and no client-invented role.
 */

/**
 * Choose the authoritative profile from the profile found under the verified
 * Firebase UID plus any profiles found under the verified email.
 *
 * Rules:
 *  - An explicit non-patient role wins over a defaulted patient record
 *    (heals UID/profile mismatches, e.g. provisioned demo staff).
 *  - Otherwise the UID profile is authoritative.
 *  - Returns null when no profile exists (caller decides provisioning).
 */
export function pickAuthoritativeProfile(profileUid, emailProfiles = []) {
  const candidates = [];
  if (profileUid) candidates.push(profileUid);
  for (const ep of emailProfiles) {
    if (!profileUid || ep.uid !== profileUid.uid) candidates.push(ep);
  }
  return (
    candidates.find((c) => c.role && String(c.role).toLowerCase() !== 'patient') ||
    candidates[0] ||
    null
  );
}

/** Normalize a stored role to lowercase, or null when unassigned. */
export function normalizeRole(role) {
  return role ? String(role).toLowerCase() : null;
}