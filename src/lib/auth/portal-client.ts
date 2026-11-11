import "server-only";
import { redirect } from "next/navigation";
import { getPortalUser } from "./portal-user";
import { createClient } from "@/lib/supabase/server";

// Wait for membership repair before any tab reads its organization data.
// A layout-only check can race parallel App Router page rendering.
export async function createPortalClient() {
  const user = await getPortalUser();
  if (!user) redirect("/login");
  if (!user.profile.is_active) redirect("/login?error=not-authorized");
  return createClient();
}
