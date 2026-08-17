import { NextResponse } from "next/server";

import { groupDailyItems, sendDailyDigest, type DailyReminder, type DailyTask } from "@/lib/email/daily-digest";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { date, hour } = israelDateParts();
  if (hour !== 8) return NextResponse.json({ ok: true, skipped: true, reason: "Not 08:00 in Asia/Jerusalem" });

  const supabase = createAdminClient();
  const [tasksResult, remindersResult, profilesResult] = await Promise.all([
    supabase.from("tasks").select("id, title, description, priority, assignees").eq("due_date", date).not("status", "in", "(completed,cancelled)"),
    supabase.from("reminders").select("id, title, notes, created_by").eq("reminder_date", date),
    supabase.from("profiles").select("id, email, full_name, is_active").eq("is_active", true),
  ]);

  const loadError = tasksResult.error ?? remindersResult.error ?? profilesResult.error;
  if (loadError) {
    console.error("Daily digest load error:", loadError);
    return NextResponse.json({ ok: false, error: "Failed to load daily items" }, { status: 500 });
  }

  const recipients = groupDailyItems({
    tasks: (tasksResult.data ?? []) as DailyTask[],
    reminders: (remindersResult.data ?? []) as DailyReminder[],
    profiles: profilesResult.data ?? [],
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
