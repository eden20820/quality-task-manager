import { NextResponse } from "next/server";

import { groupDailyItems, sendDailyDigest, type DailyFollowup, type DailyReminder, type DailyTask } from "@/lib/email/daily-digest";
import { canRetryDigestDelivery } from "@/lib/email/daily-digest-delivery";
import { getIsraelDigestSchedule } from "@/lib/email/daily-digest-schedule";
import {
  type DueCalibration,
  type ExpiringMaterial,
  type ExpiringSupplier,
} from "@/lib/email/expiry-alert";
import { createAdminClient } from "@/lib/supabase/admin";
import { reminderOccursOn } from "@/lib/reminders/recurrence";
import { syncPkaFromGoogleDrive } from "@/lib/pka-drive-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAuthorizedCronRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const presentedSecret = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!presentedSecret) return false;

  if (process.env.CRON_SECRET && presentedSecret === process.env.CRON_SECRET) {
    return true;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("verify_quality_cron_secret", {
      candidate: presentedSecret,
    });
    if (error) {
      console.error("Cron secret verification error:", error);
      return false;
    }
    return data === true;
  } catch (error) {
    console.error("Cron authorization error:", error);
    return false;
  }
}

async function getDigestOrganizationId(supabase: ReturnType<typeof createAdminClient>) {
  const slug = process.env.DAILY_DIGEST_ORGANIZATION_SLUG?.trim() || "caeli";
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  // Backward-compatible deployment ordering: code may reach production a few
  // minutes before the database migration is applied.
  if (error?.code === "42P01" || error?.code === "PGRST205") return null;
  if (error || !data) throw new Error(`Active digest organization was not found for ${slug}`);
  return data.id as string;
}

async function processDailyDigest(date: string) {
  const supabase = createAdminClient();
  const organizationId = await getDigestOrganizationId(supabase);
  let memberUserIds: string[] | null = null;
  if (organizationId) {
    const { data: memberships, error: membershipsError } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    if (membershipsError) throw membershipsError;
    memberUserIds = (memberships ?? []).map((membership) => membership.user_id as string);
  }

  let tasksQuery = supabase.from("tasks").select("id, title, description, priority, assignees").eq("due_date", date).not("status", "in", "(completed,cancelled)");
  let remindersQuery = supabase.from("reminders").select("id, title, notes, created_by, reminder_date, repeat_unit, repeat_interval").lte("reminder_date", date);
  let profilesQuery = supabase.from("profiles").select("id, email, full_name, is_active").eq("is_active", true);
  let followupsQuery = supabase.from("quality_followups").select("id, category, reference_number, name, quantity, assignee_key, opened_at, created_at, notes").in("status", ["open", "waiting"]).eq("alerts_enabled", true);
  let materialsQuery = supabase.from("expiry_items").select("id, material_name, expiry_date, quantity, location").eq("expiry_date", date).eq("is_active", true).eq("is_rejected", false).order("material_name");
  let suppliersQuery = supabase.from("suppliers").select("id, supplier_name, product_service, certification_type, expiration_date").eq("expiration_date", date).order("supplier_name");
  let calibrationsQuery = supabase.from("calibration_items").select("id, equipment_name, serial_number, location, next_calibration_date").eq("next_calibration_date", date).eq("is_active", true).order("equipment_name");

  if (organizationId) {
    tasksQuery = tasksQuery.eq("organization_id", organizationId);
    remindersQuery = remindersQuery.eq("organization_id", organizationId);
    profilesQuery = profilesQuery.in("id", memberUserIds?.length ? memberUserIds : ["00000000-0000-0000-0000-000000000000"]);
    followupsQuery = followupsQuery.eq("organization_id", organizationId);
    materialsQuery = materialsQuery.eq("organization_id", organizationId);
    suppliersQuery = suppliersQuery.eq("organization_id", organizationId);
    calibrationsQuery = calibrationsQuery.eq("organization_id", organizationId);
  }

  const [tasksResult, remindersResult, profilesResult, followupsResult, materialsResult, suppliersResult, calibrationsResult] = await Promise.all([
    tasksQuery,
    remindersQuery,
    profilesQuery,
    followupsQuery,
    materialsQuery,
    suppliersQuery,
    calibrationsQuery,
  ]);

  const queryResults = [
    ["tasks", tasksResult],
    ["reminders", remindersResult],
    ["profiles", profilesResult],
    ["followups", followupsResult],
    ["materials", materialsResult],
    ["suppliers", suppliersResult],
    ["calibrations", calibrationsResult],
  ] as const;
  const failedQueries = queryResults.filter(([, result]) => result.error);
  for (const [source, result] of failedQueries) {
    console.error("[cron/daily-digest] source load failed", { date, source, error: result.error });
  }
  if (failedQueries.length === queryResults.length) {
    return NextResponse.json({ ok: false, error: "Failed to load daily items" }, { status: 500 });
  }

  const weeklyFollowups = ((followupsResult.data ?? []) as DailyFollowup[]).filter((item) => {
    const createdDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(item.created_at));
    const created = new Date(`${createdDate}T12:00:00Z`);
    const current = new Date(`${date}T12:00:00Z`);
    const daysOpen = Math.round((current.getTime() - created.getTime()) / 86_400_000);
    return daysOpen >= 7 && daysOpen % 7 === 0;
  });
  const qualityAlerts = {
    materials: (materialsResult.data ?? []) as ExpiringMaterial[],
    suppliers: (suppliersResult.data ?? []) as ExpiringSupplier[],
    calibrations: (calibrationsResult.data ?? []) as DueCalibration[],
  };
  const recipients = groupDailyItems({
    tasks: (tasksResult.data ?? []) as DailyTask[],
    reminders: (remindersResult.data ?? []).filter((reminder) => reminderOccursOn(reminder, date)) as DailyReminder[],
    profiles: profilesResult.data ?? [],
    followups: weeklyFollowups,
    qualityAlerts,
  });
  console.info("[cron/daily-digest] unified digest loaded", {
    date,
    tasks: tasksResult.data?.length ?? 0,
    reminders: remindersResult.data?.length ?? 0,
    followups: weeklyFollowups.length,
    materials: qualityAlerts.materials.length,
    suppliers: qualityAlerts.suppliers.length,
    calibrations: qualityAlerts.calibrations.length,
    recipients: recipients.length,
  });
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, date, sent: 0, skipped: true, reason: "No relevant daily items" });
  }
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    let { data: claim, error: claimError } = await supabase
      .from("daily_digest_notifications")
      .insert({
        ...(organizationId ? { organization_id: organizationId } : {}),
        digest_date: date,
        recipient_email: recipient.email,
        status: "sending",
      })
      .select("id")
      .single();

    if (claimError?.code === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("daily_digest_notifications")
        .select("id, status, updated_at")
        .eq("digest_date", date)
        .eq("recipient_email", recipient.email)
        .match(organizationId ? { organization_id: organizationId } : {})
        .single();

      if (existingError || !existing || !canRetryDigestDelivery(existing)) {
        if (existingError) console.error("Daily digest retry lookup error:", existingError);
        skipped += 1;
        continue;
      }

      const retryStartedAt = new Date().toISOString();
      const retryResult = await supabase
        .from("daily_digest_notifications")
        .update({ status: "sending", provider_message_id: null, error_message: null, updated_at: retryStartedAt })
        .eq("id", existing.id)
        .eq("updated_at", existing.updated_at)
        .neq("status", "sent")
        .select("id")
        .maybeSingle();
      claim = retryResult.data;
      claimError = retryResult.error;
      if (!claim && !claimError) {
        skipped += 1;
        continue;
      }
    }
    if (claimError || !claim) {
      console.error("Daily digest claim error:", claimError);
      failed += 1;
      continue;
    }

    const result = await sendDailyDigest(recipient);
    const update = result.status === "sent"
      ? { status: "sent", provider_message_id: result.messageId, error_message: null, updated_at: new Date().toISOString() }
      : { status: "failed", provider_message_id: null, error_message: result.error, updated_at: new Date().toISOString() };
    const { error: updateError } = await supabase.from("daily_digest_notifications").update(update).eq("id", claim.id);
    if (updateError) console.error("Daily digest log update error:", updateError);

    if (result.status === "sent") sent += 1;
    else failed += 1;
  }

  return NextResponse.json({
    ok: failed === 0,
    date,
    recipients: recipients.length,
    materials: qualityAlerts.materials.length,
    suppliers: qualityAlerts.suppliers.length,
    calibrations: qualityAlerts.calibrations.length,
    sent,
    failed,
    skipped,
  }, { status: failed ? 500 : 200 });
}

export async function GET(request: Request) {
  if (!(await isAuthorizedCronRequest(request))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { date, hour, isWeekend } = getIsraelDigestSchedule();
  console.info("[cron/daily-digest] authorized request", { date, israelHour: hour, isWeekend });

  // Supabase Cron invokes this route hourly. Reuse it for the daily PKA pull so
  // the schedule follows Israel time and daylight saving time reliably.
  let pkaSync: Awaited<ReturnType<typeof syncPkaFromGoogleDrive>> | null = null;
  if (hour === 6) {
    try {
      pkaSync = await syncPkaFromGoogleDrive();
      console.info("[cron/daily-digest] PKA workbook sync completed", pkaSync);
    } catch (error) {
      console.error("[cron/daily-digest] PKA workbook sync failed", {
        message: error instanceof Error ? error.message : "Unknown sync error",
      });
      return NextResponse.json({ ok: false, error: "PKA workbook sync failed" }, { status: 500 });
    }
  }

  if (isWeekend) {
    return NextResponse.json({ ok: true, pkaSync, skipped: true, reason: "Daily emails are disabled on Friday and Saturday" });
  }
  if (hour >= 8) return processDailyDigest(date);
  return NextResponse.json({ ok: true, pkaSync, skipped: true, reason: "No scheduled email for this Israel hour" });
}
