"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

type Result = { success: boolean; message: string; imported?: number };

async function authorized() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", user.id).single();
  if (!profile?.is_active) throw new Error("User is not active");
  return { supabase, user };
}

function clean(value: unknown) { return String(value ?? "").trim(); }
function dateValue(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = clean(value);
  const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (match) {
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return null;
}

const names = ["שם ציוד", "שם המכשיר", "מכשיר", "ציוד", "פירוט", "equipment", "equipment name"];
const dates = ["תאריך כיול הבא", "כיול הבא", "מועד כיול הבא", "תוקף כיול", "next calibration", "next calibration date", "due date"];
const codes = ["מספר ציוד", "מספר מכשיר", "מק״ט", "מקט", "equipment id", "equipment code", "id"];
const serials = ["מספר סידורי", "מס סידורי", "serial", "serial number"];
const locations = ["מיקום", "מחלקה", "location", "department"];
function findHeader(row: unknown[], aliases: string[]) {
  const normalized = row.map((v) => clean(v).toLowerCase());
  return normalized.findIndex((value) => aliases.some((alias) => value === alias || value.includes(alias)));
}

export async function importCalibrations(formData: FormData): Promise<Result> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return { success: false, message: "יש לבחור קובץ Excel" };
    const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const rowsToInsert: Array<Record<string, unknown>> = [];
    const { supabase, user } = await authorized();
    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
      const headerIndex = rows.findIndex((row) => findHeader(row, names) >= 0 && findHeader(row, dates) >= 0);
      if (headerIndex < 0) continue;
      const header = rows[headerIndex];
      const nameIndex = findHeader(header, names); const dateIndex = findHeader(header, dates);
      const codeIndex = findHeader(header, codes); const serialIndex = findHeader(header, serials); const locationIndex = findHeader(header, locations);
      for (const row of rows.slice(headerIndex + 1)) {
        const equipmentName = clean(row[nameIndex]); const nextDate = dateValue(row[dateIndex]);
        if (!equipmentName || !nextDate) continue;
        rowsToInsert.push({ equipment_name: equipmentName, next_calibration_date: nextDate, equipment_code: codeIndex >= 0 ? clean(row[codeIndex]) || null : null, serial_number: serialIndex >= 0 ? clean(row[serialIndex]) || null : null, location: locationIndex >= 0 ? clean(row[locationIndex]) || null : null, source_file_name: file.name, created_by: user.id });
      }
    }
    if (!rowsToInsert.length) return { success: false, message: "לא נמצאו שורות עם שם ציוד ותאריך כיול הבא. הקובץ שהועלה נראה כסיכום עלויות; יש להעלות את טבלת מעקב הציוד." };
    const { error } = await supabase.from("calibration_items").insert(rowsToInsert);
    if (error) throw error;
    revalidatePath("/calibrations"); revalidatePath("/"); revalidatePath("/calendar");
    return { success: true, message: `יובאו ${rowsToInsert.length} פריטי כיול`, imported: rowsToInsert.length };
  } catch (error) { console.error(error); return { success: false, message: "ייבוא הכיולים נכשל" }; }
}

export async function createCalibration(_: Result, formData: FormData): Promise<Result> {
  try {
    const equipmentName = clean(formData.get("equipment_name"));
    const nextDate = clean(formData.get("next_calibration_date"));
    if (!equipmentName || !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return { success: false, message: "יש להזין שם ציוד ותאריך תקין" };
    const { supabase, user } = await authorized();
    const { error } = await supabase.from("calibration_items").insert({ equipment_name: equipmentName, equipment_code: clean(formData.get("equipment_code")) || null, serial_number: clean(formData.get("serial_number")) || null, location: clean(formData.get("location")) || null, next_calibration_date: nextDate, notes: clean(formData.get("notes")) || null, created_by: user.id });
    if (error) throw error;
    revalidatePath("/calibrations"); revalidatePath("/"); revalidatePath("/calendar");
    return { success: true, message: "הכיול נוסף" };
  } catch (error) { console.error(error); return { success: false, message: "שמירת הכיול נכשלה" }; }
}

export async function deleteCalibration(id: string) {
  const { supabase } = await authorized();
  await supabase.from("calibration_items").delete().eq("id", id);
  revalidatePath("/calibrations"); revalidatePath("/"); revalidatePath("/calendar");
}
