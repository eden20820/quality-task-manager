import { NextResponse } from "next/server";

import { groupDailyItems, sendDailyDigest, type DailyFollowup, type DailyReminder, type DailyTask } from "@/lib/email/daily-digest";
import { EXPIRY_RECIPIENTS, sendExpiryAlert, type ExpiringMaterial } from "@/lib/email/expiry-alert";
import { createAdminClient } from "@/lib/supabase/admin";
import { reminderOccursOn } from "@/lib/reminders/recurrence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function israelDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

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

async function processDailyDigest(date: string) {
  const supabase = createAdminClient();
  const [tasksResult, remindersResult, profilesResult, followupsResult] = await Promise.all([
    supabase.from("tasks").select("id, title, description, priority, assignees").eq("due_date", date).not("status", "in", "(completed,cancelled)"),
    supabase.from("reminders").select("id, title, notes, created_by, reminder_date, repeat_unit, repeat_interval").lte("reminder_date", date),
    supabase.from("profiles").select("id, email, full_name, is_active").eq("is_active", true),
    supabase.from("quality_followups").select("id, category, reference_number, name, quantity, opened_at, created_at, notes").eq("status", "open").eq("alerts_enabled", true),
  ]);

  const loadError = tasksResult.error ?? remindersResult.error ?? profilesResult.error ?? followupsResult.error;
  if (loadError) {
    console.error("Daily digest load error:", loadError);
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
  const recipients = groupDailyItems({
    tasks: (tasksResult.data ?? []) as DailyTask[],
    reminders: (remindersResult.data ?? []).filter((reminder) => reminderOccursOn(reminder, date)) as DailyReminder[],
    profiles: profilesResult.data ?? [],
    followups: weeklyFollowups,
  });
  if (recipients.length === 0) return NextResponse.json({ ok: true, date, sent: 0, message: "No daily items" });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    const { data: claim, error: claimError } = await supabase
      .from("daily_digest_notifications")
      .insert({ digest_date: date, recipient_email: recipient.email, status: "sending" })
      .select("id")
      .single();

    if (claimError?.code === "23505") {
      skipped += 1;
      continue;
    }
    if (claimError || !claim) {
      console.error("Daily digest claim error:", claimError);
      failed += 1;
      continue;
    }

    const result = await sendDailyDigest(recipient);
    const update = result.status === "sent"
      ? { status: "sent", provider_message_id: result.messageId, error_message: null }
      : { status: "failed", provider_message_id: null, error_message: result.error };
    const { error: updateError } = await supabase.from("daily_digest_notifications").update(update).eq("id", claim.id);
    if (updateError) console.error("Daily digest log update error:", updateError);

    if (result.status === "sent") sent += 1;
    else failed += 1;
  }

  return NextResponse.json({ ok: failed === 0, date, recipients: recipients.length, sent, failed, skipped }, { status: failed ? 500 : 200 });
}

async function processExpiryAlerts(date: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("expiry_items")
    .select("id, material_name, expiry_date, quantity, location")
    .eq("expiry_date", date)
    .eq("is_active", true)
    .eq("is_rejected", false)
    .order("material_name");

  if (error) {
    console.error("Expiry alert load error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load expiring materials" }, { status: 500 });
  }

  const materials = (data ?? []) as ExpiringMaterial[];
  if (materials.length === 0) return NextResponse.json({ ok: true, date, sent: 0, message: "No expiring materials" });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const recipient of EXPIRY_RECIPIENTS) {
    const { data: claim, error: claimError } = await supabase
      .from("expiry_alert_notifications")
      .insert({ expiry_date: date, recipient_email: recipient.email, status: "sending" })
      .select("id")
      .single();

    if (claimError?.code === "23505") {
      skipped += 1;
      continue;
    }
    if (claimError || !claim) {
      console.error("Expiry alert claim error:", claimError);
      failed += 1;
      continue;
    }

    const result = await sendExpiryAlert(recipient, materials);
    const update = result.status === "sent"
      ? { status: "sent", provider_message_id: result.messageId, error_message: null }
      : { status: "failed", provider_message_id: null, error_message: result.error };
    const { error: updateError } = await supabase.from("expiry_alert_notifications").update(update).eq("id", claim.id);
    if (updateError) console.error("Expiry alert log update error:", updateError);
    if (result.status === "sent") sent += 1;
    else failed += 1;
  }

  return NextResponse.json({ ok: failed === 0, date, materials: materials.length, sent, failed, skipped }, { status: failed ? 500 : 200 });
}

export async function GET(request: Request) {
  if (!(await isAuthorizedCronRequest(request))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { date, hour } = israelDateParts();
  if (hour === 8) return processDailyDigest(date);
  if (hour === 10) return processExpiryAlerts(date);
  return NextResponse.json({ ok: true, skipped: true, reason: "No scheduled email for this Israel hour" });
}
