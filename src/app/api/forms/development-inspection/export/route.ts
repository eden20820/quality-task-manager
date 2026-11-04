import { NextResponse } from "next/server";
import { isDevelopmentInspectionPayload } from "@/lib/quality-forms/development-inspection";
import { buildDevelopmentInspectionPdf } from "@/lib/quality-forms/development-inspection-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  try {
    const payload: unknown = await request.json();
    if (!isDevelopmentInspectionPayload(payload)) return NextResponse.json({ error: "נתוני הטופס אינם תקינים" }, { status: 400 });
    const buffer = await buildDevelopmentInspectionPdf(payload);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=development-inspection.pdf", "Cache-Control": "no-store" } });
  } catch (error) { console.error("Development inspection export failed", error); return NextResponse.json({ error: "לא ניתן ליצור את מסמך ה-PDF כרגע" }, { status: 500 }); }
}
