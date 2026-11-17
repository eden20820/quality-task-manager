import { NextResponse } from "next/server";

import { buildRirWorkbook } from "@/lib/quality-forms/rir-excel";
import { archiveQualityFormExport } from "@/lib/quality-forms/form-archive-server";
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
    && payload.attributes.length <= 8
    && typeof payload.includeVisual === "boolean"
    && typeof payload.includeFunctional === "boolean"
    && (payload.attributes.length > 0 || payload.includeVisual || payload.includeFunctional)
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

    const normalizedPayload: RirFormPayload = {
      ...payload,
      details: {
        ...payload.details,
        drawingRevision: payload.details.drawingRevision.trim() || "01",
      },
    };
    const workbook = await buildRirWorkbook(normalizedPayload);
    workbook.eachSheet((worksheet) => {
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (cell.value === "Rev.: 00") cell.value = "Rev.: 01";
        });
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = new Uint8Array(buffer);
    const { fileName } = await archiveQualityFormExport({
      bytes,
      supplierName: payload.details.supplierName,
      date: payload.approval.inspectionDate,
      catalogNumber: payload.details.catalogNumber,
      extension: "xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      formTitle: "דוח ביקורת קבלה RIR",
    });
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="RIR-report.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("RIR export failed", error);
    return NextResponse.json({ error: "לא ניתן ליצור ולשמור את קובץ ה-Excel כרגע" }, { status: 500 });
  }
}
