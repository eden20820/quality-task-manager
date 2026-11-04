import { NextResponse } from "next/server";

import { sendAdhesionLeakTestAlerts } from "@/lib/email/adhesion-leak-test";
import { archiveQualityFormExport } from "@/lib/quality-forms/form-archive-server";
import { isAdhesionLeakTestPayload } from "@/lib/quality-forms/adhesion-leak-test";
import { buildAdhesionLeakTestPdf } from "@/lib/quality-forms/adhesion-leak-test-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  try {
    const payload: unknown = await request.json();
    if (!isAdhesionLeakTestPayload(payload)) return NextResponse.json({ error: "נתוני הטופס אינם תקינים" }, { status: 400 });
    const buffer = await buildAdhesionLeakTestPdf(payload);
    const archived = await archiveQualityFormExport({
      bytes: new Uint8Array(buffer),
      supplierName: "בדיקת-אטימות",
      date: payload.testDate,
      catalogNumber: payload.testedProduct || "ללא-מוצר",
      extension: "pdf",
      mimeType: "application/pdf",
      formTitle: "טופס בדיקת אטימות – הדבקה",
    });
    const emails = await sendAdhesionLeakTestAlerts(payload);
    const sent = emails.filter((email) => email.status === "sent").length;
    const emailStatus = sent === emails.length ? "sent" : sent > 0 ? "partial" : "failed";
    return NextResponse.json({ saved: true, fileName: archived.fileName, emailStatus });
  } catch (error) {
    console.error("Adhesion leak test save failed", error);
    return NextResponse.json({ error: "לא ניתן לשמור את הטופס כרגע" }, { status: 500 });
  }
}
