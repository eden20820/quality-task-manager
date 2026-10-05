import { NextResponse } from "next/server";

import { syncPkaFromGoogleDrive } from "@/lib/pka-drive-sync";
import { isIsraelSixAm } from "@/lib/israel-sync-schedule";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function isAuthorized(request: Request) {
  const authorization = request.headers.get("authorization");
  const secret = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secret) return false;
  if (process.env.CRON_SECRET && secret === process.env.CRON_SECRET) return true;
  try {
    const { data, error } = await createAdminClient().rpc("verify_quality_cron_secret", { candidate: secret });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) return new NextResponse("Unauthorized", { status: 401 });
  if (!isIsraelSixAm(new Date())) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Outside the 06:00 Israel sync window" });
  }
  try {
    const result = await syncPkaFromGoogleDrive();
    console.info("[cron/pka-drive-sync] completed", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PKA sync error";
    console.error("[cron/pka-drive-sync] failed", { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
