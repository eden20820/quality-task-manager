import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export const getPortalUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, is_active, dashboard_cleared_at")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) return null;
  return { user, profile };
});
