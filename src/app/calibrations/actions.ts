"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

type Result = { success: boolean; message: string; imported?: number; removed?: number; missingDates?: number };

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
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
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
const nextDates = ["ת.כיול הבא", "תאריך כיול הבא", "כיול הבא", "מועד כיול הבא", "תוקף כיול", "next calibration", "next calibration date", "due date"];
const lastDates = ["ת.כיול אחרון", "תאריך כיול אחרון", "כיול אחרון", "last calibration", "last calibration date"];
const serials = ["מס' סידורי של המכשיר /משקל", "מספר סידורי", "מס סידורי", "מספר ציוד", "מספר מכשיר", "serial", "serial number", "equipment id", "equipment code"];
const models = ["דגם מכשיר", "דגם", "model"];
const locations = ["מיקום", "מחלקה", "location", "department"];
const certificates = ["מס' תעודת כיול", "תעודת כיול", "מספר תעודה", "certificate"];
const labs = ["מעבדה מכיילת", "מעבדת כיול", "calibration lab", "laboratory"];
const notes = ["הערות", "הערה", "notes"];
function findHeader(row: unknown[], aliases: string[]) {
  const normalized = row.map((v) => clean(v).toLowerCase());
  return normalized.findIndex((value) => aliases.some((alias) => value === alias || value.includes(alias)));
}

export async function importCalibrations(formData: FormData): Promise<Result> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return { success: false, message: "יש לבחור קובץ Excel" };
    const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const rowsToUpsert: Array<Record<string, unknown>> = [];
    const { supabase, user } = await authorized();
    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true, range: "A1:H1000" });
      const headerIndex = rows.findIndex((row) => findHeader(row, names) >= 0 && findHeader(row, nextDates) >= 0);
      if (headerIndex < 0) continue;
      const header = rows[headerIndex];
      const nameIndex = findHeader(header, names); const nextDateIndex = findHeader(header, nextDates); const lastDateIndex = findHeader(header, lastDates);
      const serialIndex = findHeader(header, serials); const modelIndex = findHeader(header, models); const locationIndex = findHeader(header, locations);
      const certificateIndex = findHeader(header, certificates); const labIndex = findHeader(header, labs); const notesIndex = findHeader(header, notes);
      const isRemovedSheet = sheetName.trim().includes("הוסרו");
      for (const [rowOffset, row] of rows.slice(headerIndex + 1).entries()) {
        const equipmentName = clean(row[nameIndex]);
        if (!equipmentName || /^(עודכן ע|תאריך:|תפקיד:)/.test(equipmentName)) continue;
        const serialNumber = serialIndex >= 0 ? clean(row[serialIndex]) : "";
        const rowKey = `${equipmentName.toLowerCase()}|${serialNumber.toLowerCase() || `no-serial-${headerIndex + rowOffset + 2}`}`;
        rowsToUpsert.push({ equipment_name: equipmentName, equipment_code: serialNumber || null, serial_number: serialNumber || null, model: modelIndex >= 0 ? clean(row[modelIndex]) || null : null, location: locationIndex >= 0 ? clean(row[locationIndex]) || null : null, last_calibration_date: lastDateIndex >= 0 ? dateValue(row[lastDateIndex]) : null, next_calibration_date: nextDateIndex >= 0 ? dateValue(row[nextDateIndex]) : null, certificate_number: certificateIndex >= 0 ? clean(row[certificateIndex]) || null : null, calibration_lab: labIndex >= 0 ? clean(row[labIndex]) || null : null, notes: notesIndex >= 0 ? clean(row[notesIndex]) || null : null, is_active: !isRemovedSheet, row_key: rowKey, source_file_name: file.name, created_by: user.id, updated_at: new Date().toISOString() });
      }
    }
    if (!rowsToUpsert.length) return { success: false, message: "לא נמצאה טבלת כיולים תקינה בקובץ" };
    const { error } = await supabase.from("calibration_items").upsert(rowsToUpsert, { onConflict: "row_key" });
    if (error) throw error;
    revalidatePath("/calibrations"); revalidatePath("/"); revalidatePath("/calendar");
    const removed = rowsToUpsert.filter((item) => item.is_active === false).length;
    const missingDates = rowsToUpsert.filter((item) => item.is_active === true && !item.next_calibration_date).length;
    return { success: true, message: `הסנכרון הושלם: ${rowsToUpsert.length - removed} כלים פעילים, ${removed} כלים שהוסרו ו־${missingDates} כלים ללא מועד כיול הבא`, imported: rowsToUpsert.length - removed, removed, missingDates };
  } catch (error) { console.error(error); return { success: false, message: "ייבוא הכיולים נכשל" }; }
}

export async function createCalibration(_: Result, formData: FormData): Promise<Result> {
  try {
    const equipmentName = clean(formData.get("equipment_name"));
    const nextDate = clean(formData.get("next_calibration_date"));
    if (!equipmentName) return { success: false, message: "יש להזין שם מכשיר" };
    if (nextDate && !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return { success: false, message: "תאריך הכיול אינו תקין" };
    const { supabase, user } = await authorized();
    const serialNumber = clean(formData.get("serial_number"));
    const { error } = await supabase.from("calibration_items").insert({ equipment_name: equipmentName, equipment_code: serialNumber || null, serial_number: serialNumber || null, model: clean(formData.get("model")) || null, location: clean(formData.get("location")) || null, last_calibration_date: clean(formData.get("last_calibration_date")) || null, next_calibration_date: nextDate || null, certificate_number: clean(formData.get("certificate_number")) || null, calibration_lab: clean(formData.get("calibration_lab")) || null, notes: clean(formData.get("notes")) || null, is_active: true, row_key: `${equipmentName.toLowerCase()}|${serialNumber.toLowerCase() || crypto.randomUUID()}`, created_by: user.id });
    if (error) throw error;
    revalidatePath("/calibrations"); revalidatePath("/"); revalidatePath("/calendar");
    return { success: true, message: "הכיול נוסף" };
  } catch (error) { console.error(error); return { success: false, message: "שמירת הכיול נכשלה" }; }
}

export async function updateCalibration(formData: FormData): Promise<Result> {
  try {
    const id = clean(formData.get("id"));
    const equipmentName = clean(formData.get("equipment_name"));
    const nextDate = clean(formData.get("next_calibration_date"));
    if (!id || !equipmentName) return { success: false, message: "יש להזין שם מכשיר" };
    if (nextDate && !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return { success: false, message: "תאריך הכיול אינו תקין" };
    const { supabase } = await authorized();
    const serialNumber = clean(formData.get("serial_number"));
    const { data: existing } = await supabase.from("calibration_items").select("row_key").eq("id", id).single();
    const { error } = await supabase.from("calibration_items").update({
      equipment_name: equipmentName,
      equipment_code: serialNumber || null,
      serial_number: serialNumber || null,
      model: clean(formData.get("model")) || null,
      location: clean(formData.get("location")) || null,
      last_calibration_date: clean(formData.get("last_calibration_date")) || null,
      next_calibration_date: nextDate || null,
      certificate_number: clean(formData.get("certificate_number")) || null,
      calibration_lab: clean(formData.get("calibration_lab")) || null,
      notes: clean(formData.get("notes")) || null,
      is_active: clean(formData.get("is_active")) === "true",
      row_key: serialNumber ? `${equipmentName.toLowerCase()}|${serialNumber.toLowerCase()}` : existing?.row_key,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw error;
    revalidatePath("/calibrations"); revalidatePath("/"); revalidatePath("/calendar");
    return { success: true, message: "פרטי המכשיר עודכנו" };
  } catch (error) { console.error(error); return { success: false, message: "עדכון המכשיר נכשל" }; }
}

export async function deleteCalibration(id: string) {
  const { supabase } = await authorized();
  await supabase.from("calibration_items").delete().eq("id", id);
  revalidatePath("/calibrations"); revalidatePath("/"); revalidatePath("/calendar");
}
