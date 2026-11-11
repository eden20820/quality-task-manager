import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const CAELI_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";
export function isAuthorizedPortalEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.trim().toLowerCase().split("@");
  return parts.length === 2 && Boolean(parts[0]) && !/\s/.test(parts[0]) && parts[1] === "caeli.pro";
}

// The database decides using auth.uid() and confirmed auth.users email.
// No service key or editable user metadata participates in authorization.
export async function provisionAuthorizedPortalUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Company access requires a verified session");
  if (!isAuthorizedPortalEmail(data.user.email)) return false;
  if (!data.user.email_confirmed_at) throw new Error("Company email is not confirmed");
  // Keep already-authorized employees working during the one-time DB rollout.
  const [{ data: profile }, { data: member }] = await Promise.all([
    supabase.from("profiles").select("is_active,active_organization_id").eq("id", data.user.id).maybeSingle(),
    supabase.from("organization_members").select("is_active").eq("organization_id", CAELI_ORGANIZATION_ID).eq("user_id", data.user.id).eq("is_active", true).maybeSingle(),
  ]);
  if (profile?.is_active && profile.active_organization_id === CAELI_ORGANIZATION_ID && member?.is_active) return true;
  const { data: organizationId, error: joinError } = await supabase.rpc("join_caeli_workspace");
  if (joinError) throw new Error(`Company workspace provisioning failed: ${joinError.code ?? "unknown"}`);
  if (organizationId !== CAELI_ORGANIZATION_ID) throw new Error("Company workspace provisioning did not complete");
  return true;
}
