import { NextResponse } from "next/server";

import { ONLINE_FORM_CATEGORY } from "@/lib/quality-forms/form-archive";
import { catalogNumbersMatch, parseArchivedFormFileName } from "@/lib/quality-forms/form-suggestions";
import { parseRirWorkbook } from "@/lib/quality-forms/rir-excel-import";
import { parseShelfProductInspectionDocx } from "@/lib/quality-forms/shelf-product-docx-import";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ArchivedForm = {
  file_name: string;
  storage_path: string;
};

async function readItemFromForm(fileName: string, bytes: Uint8Array) {
  if (/\.xlsx$/i.test(fileName)) {
    const payload = await parseRirWorkbook(bytes);
    return { catalogNumber: payload.details.catalogNumber, partName: payload.details.partName };
  }
  if (/\.docx$/i.test(fileName)) {
    const payload = await parseShelfProductInspectionDocx(bytes);
    return { catalogNumber: payload.catalogNumber, partName: payload.productName };
  }
  return null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });

  const catalogNumber = new URL(request.url).searchParams.get("catalogNumber")?.trim() ?? "";
  if (catalogNumber.length < 2 || catalogNumber.length > 120) {
    return NextResponse.json({ error: "יש להזין מק״ט תקין" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("quality_documents")
    .select("file_name, storage_path")
    .eq("category", ONLINE_FORM_CATEGORY)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("Archived form item lookup failed", error);
    return NextResponse.json({ partName: null });
  }

  const candidates = (data as ArchivedForm[] | null ?? []).filter((form) => {
    const parsed = parseArchivedFormFileName(form.file_name);
    return parsed && catalogNumbersMatch(parsed.catalogNumber, catalogNumber) && /\.(xlsx|docx)$/i.test(form.file_name);
  });

  for (const form of candidates.slice(0, 10)) {
    try {
      const { data: file, error: downloadError } = await supabase.storage.from("quality-documents").download(form.storage_path);
      if (downloadError || !file) continue;
      const item = await readItemFromForm(form.file_name, new Uint8Array(await file.arrayBuffer()));
      if (item?.partName && catalogNumbersMatch(item.catalogNumber, catalogNumber)) {
        return NextResponse.json({ partName: item.partName });
      }
    } catch {
      // The archive may contain older or unrelated files; continue to the next exact catalog match.
    }
  }

  return NextResponse.json({ partName: null });
}
