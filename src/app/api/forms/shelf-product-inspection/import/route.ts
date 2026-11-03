import { NextResponse } from "next/server";

import { parseShelfProductInspectionDocx } from "@/lib/quality-forms/shelf-product-docx-import";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "יש לבחור קובץ Word" }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".docx")) return NextResponse.json({ error: "יש לבחור קובץ Word בפורמט DOCX" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "הקובץ גדול מדי. הגודל המרבי הוא 10MB" }, { status: 400 });
    const payload = await parseShelfProductInspectionDocx(new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ payload });
  } catch (error) {
    console.error("Shelf product inspection import failed", error);
    const message = error instanceof Error && error.message.includes("טופס ביקורת")
      ? error.message
      : "לא ניתן לקרוא את הקובץ. יש לבחור טופס ביקורת קבלה למוצר מדף שנוצר במערכת";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
