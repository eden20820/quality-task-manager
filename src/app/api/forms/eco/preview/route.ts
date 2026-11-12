import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/auth/portal-user";
import { buildEcoFormPdf } from "@/lib/quality-forms/eco-form-pdf";
import { isEcoFormPayload } from "@/lib/quality-forms/eco-form";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const portal = await getPortalUser();
  if (!portal) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  if (!portal.profile.is_active || !portal.profile.active_organization_id) return NextResponse.json({ error: "אין הרשאה לצפייה בטופס" }, { status: 403 });
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 3_800_000) return NextResponse.json({ error: "הטופס גדול מדי לתצוגה מקדימה" }, { status: 413 });
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "נתוני הטופס אינם תקינים" }, { status: 400 }); }
    if (!isEcoFormPayload(payload)) return NextResponse.json({ error: "נתוני טופס ECO אינם תקינים" }, { status: 400 });
    // Preview uses the exact export renderer, without archiving or notifications.
    const bytes = await buildEcoFormPdf(payload);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=ECO-preview.pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return NextResponse.json({ error: "לא ניתן להציג תצוגה מקדימה כרגע" }, { status: 500 }); }
}
