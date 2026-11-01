import { NextResponse } from "next/server";

import { parseRirWorkbook } from "@/lib/quality-forms/rir-excel-import";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "לא נבחר קובץ Excel" }, { status: 400 });
    if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: "יש לבחור קובץ Excel בפורמט XLSX" }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "הקובץ גדול מדי. הגודל המרבי הוא 15MB" }, { status: 400 });

    const payload = await parseRirWorkbook(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ payload });
  } catch (error) {
    console.error("RIR import failed", error);
    const message = error instanceof Error && error.message.includes("RIR")
      ? error.message
      : "לא ניתן לקרוא את הקובץ. יש לבחור טופס RIR שנוצר במערכת";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
