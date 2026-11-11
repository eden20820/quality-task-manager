import { NextResponse } from "next/server";
import { extractEcoFormPayload } from "@/lib/quality-forms/eco-form-pdf";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf") || file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "יש לבחור קובץ PDF עד 20MB" }, { status: 400 });
    return NextResponse.json({ payload: await extractEcoFormPayload(new Uint8Array(await file.arrayBuffer())) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "לא ניתן לקרוא את הקובץ" }, { status: 400 }); }
}
