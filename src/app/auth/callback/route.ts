import { NextResponse } from "next/server";
import { provisionAuthorizedPortalUser } from "@/lib/auth/authorized-users";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        try {
          await provisionAuthorizedPortalUser(data.user);
        } catch (provisionError) {
          console.error("Authorized portal user provisioning failed", provisionError);
        }
      }
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
