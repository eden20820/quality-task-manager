import { NextResponse } from "next/server";

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
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=adhesion-leak-test.pdf", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Adhesion leak test PDF export failed", error);
    return NextResponse.json({ error: "לא ניתן ליצור את מסמך ה-PDF כרגע" }, { status: 500 });
  }
}
