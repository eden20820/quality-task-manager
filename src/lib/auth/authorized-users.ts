import "server-only";

import { createClient, type User } from "@supabase/supabase-js";

export const CAELI_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";
const AUTHORIZED_USERS = new Map([
  ["gal.pesso@caeli.pro", { role: "member" }],
]);

export function isAuthorizedPortalEmail(value: unknown): value is string {
  return typeof value === "string" && AUTHORIZED_USERS.has(value.trim().toLowerCase());
}

export async function provisionAuthorizedPortalUser(user: Pick<User, "id" | "email" | "user_metadata">) {
  const email = user.email?.trim().toLowerCase();
  const authorization = email ? AUTHORIZED_USERS.get(email) : undefined;
  if (!email || !authorization) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase admin configuration is missing");

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const fullName = typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name.trim()
    : typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name.trim()
      : email;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    email,
    full_name: fullName || email,
    is_active: true,
    active_organization_id: CAELI_ORGANIZATION_ID,
  }, { onConflict: "id" });
  if (profileError) throw new Error(`Authorized profile provisioning failed: ${profileError.message}`);

  const { error: membershipError } = await admin.from("organization_members").upsert({
    organization_id: CAELI_ORGANIZATION_ID,
    user_id: user.id,
    role: authorization.role,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,user_id" });
  if (membershipError) throw new Error(`Authorized membership provisioning failed: ${membershipError.message}`);
}
