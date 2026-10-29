import { NextResponse } from "next/server";

import { buildRirWorkbook } from "@/lib/quality-forms/rir-excel";
import type { RirFormPayload } from "@/lib/quality-forms/rir";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isValidPayload(value: unknown): value is RirFormPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<RirFormPayload>;
  return Boolean(
    payload.details
    && payload.approval
    && Array.isArray(payload.attributes)
    && payload.attributes.length >= 1
    && payload.attributes.length <= 8
    && Array.isArray(payload.rows)
    && payload.rows.length >= 1
    && payload.rows.length <= 200
    && payload.rows.every((row) => Array.isArray(row.values) && row.values.length === payload.attributes?.length),
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });

  try {
    const payload: unknown = await request.json();
    if (!isValidPayload(payload)) {
      return NextResponse.json({ error: "נתוני הטופס אינם תקינים" }, { status: 400 });
    }

    const workbook = await buildRirWorkbook(payload);
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=RIR-report.xlsx",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("RIR export failed", error);
    return NextResponse.json({ error: "לא ניתן ליצור את קובץ ה-Excel כרגע" }, { status: 500 });
  }
}
