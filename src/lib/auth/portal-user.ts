import { cache } from "react";

import { CAELI_ORGANIZATION_ID, isAuthorizedPortalEmail, provisionAuthorizedPortalUser } from "@/lib/auth/authorized-users";
import { createClient } from "@/lib/supabase/server";

export const getPortalUser = cache(async () => {
  const supabase = await createClient();

  // getClaims מאמת את ה-JWT מול ה-JWKS המקומי (מקוישד) של הפרויקט,
  // ולכן ברוב המקרים לא דורש קריאת רשת לשרת ה-Auth בכל בקשה —
  // בניגוד ל-getUser() שתמיד עושה round-trip. דורש שהפרויקט
  // מוגדר עם JWT signing keys א-סימטריים (ראה הערה ב-README).
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data) return null;

  const userId = data.claims.sub;
  if (!userId) return null;

  const email = typeof data.claims.email === "string" ? data.claims.email.trim().toLowerCase() : null;
  const loadProfile = () => supabase
    .from("profiles")
    .select("full_name, is_active, dashboard_cleared_at, active_organization_id")
    .eq("id", userId)
    .single();

  let { data: profile, error: profileError } = await loadProfile();

  // Users who were already signed in before being allowlisted do not pass
  // through the OAuth callback again. Repair their tenant membership lazily so
  // organization-scoped RLS policies expose the same Caeli data immediately.
  if (isAuthorizedPortalEmail(email)) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", CAELI_ORGANIZATION_ID)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!profile?.is_active || profile.active_organization_id !== CAELI_ORGANIZATION_ID || !membership) {
      try {
        const metadata = typeof data.claims.user_metadata === "object" && data.claims.user_metadata !== null
          ? data.claims.user_metadata
          : {};
        await provisionAuthorizedPortalUser({ id: userId, email, user_metadata: metadata });
        const refreshed = await loadProfile();
        profile = refreshed.data;
        profileError = refreshed.error;
      } catch (provisionError) {
        console.error("Authorized portal access repair failed", provisionError);
      }
    }
  }

  if (profileError || !profile) return null;
  return { userId, profile };
});
