import { cache } from "react";

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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, is_active, dashboard_cleared_at")
    .eq("id", userId)
    .single();

  if (profileError || !profile) return null;
  return { userId, profile };
});
