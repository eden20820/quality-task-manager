import { NextResponse } from "next/server";
import { extractDevelopmentInspectionPayload } from "@/lib/quality-forms/development-inspection-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "יש לבחור קובץ PDF" }, { status: 400 });
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "הקובץ גדול מדי. הגודל המרבי הוא 12MB" }, { status: 400 });
    return NextResponse.json({ payload: await extractDevelopmentInspectionPayload(new Uint8Array(await file.arrayBuffer())) });
  } catch (error) { console.error("Development inspection import failed", error); return NextResponse.json({ error: error instanceof Error ? error.message : "לא ניתן לקרוא את הטופס" }, { status: 400 }); }
}
