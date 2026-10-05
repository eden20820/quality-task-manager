import "server-only";

import { downloadPkaWorkbookFromDrive } from "@/lib/google-drive";
import { buildPkaPreview, packPkaNotes, parsePkaWorkbook, selectPkaRowsForAutomaticSync, unpackPkaNotes, type ExistingPka } from "@/lib/pka-import";
import { createAdminClient } from "@/lib/supabase/admin";

type StoredPka = {
  id: string;
  reference_number: string;
  name: string | null;
  quantity: number | null;
  opened_at: string;
  status: "open" | "closed";
  closed_at: string | null;
  notes: string | null;
  created_by: string;
};

function existingPka(row: StoredPka): ExistingPka {
  const packed = unpackPkaNotes(row.notes);
  return packed
    ? { id: row.id, ...packed }
    : {
        id: row.id,
        reference_number: row.reference_number,
        opened_at: row.opened_at,
        customer_order: null,
        part_number: null,
        revision: null,
        product_name: row.name ?? "",
        assembly_description: null,
        assembly_name: null,
        final_product: null,
        required_quantity: row.quantity ?? 0,
        produced_quantity: null,
        status: row.status,
        due_date: null,
        closed_at: row.closed_at,
        notes: row.notes,
      };
}

export type PkaDriveSyncResult = {
  added: number;
  updated: number;
  unchanged: number;
  duplicates: number;
  invalid: number;
  ignored: number;
};

export async function syncPkaFromGoogleDrive(): Promise<PkaDriveSyncResult> {
  const workbook = await downloadPkaWorkbookFromDrive();
  const parsed = parsePkaWorkbook(workbook);
  const supabase = createAdminClient();
  const { data: storedRows, error: loadError } = await supabase
    .from("quality_followups")
    .select("id,reference_number,name,quantity,opened_at,status,closed_at,notes,created_by")
    .eq("category", "pka");
  if (loadError) throw loadError;

  const stored = (storedRows ?? []) as StoredPka[];
  const preview = buildPkaPreview("Google Drive: מעקב פקעות.xlsx", parsed, stored.map(existingPka));
  const selected = selectPkaRowsForAutomaticSync(preview.rows);
  if (selected.length) {
    const creatorEmail = process.env.PKA_SYNC_CREATED_BY_EMAIL?.trim() || "eden@caeli.pro";
    const { data: creator, error: creatorError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", creatorEmail)
      .eq("is_active", true)
      .single();
    if (creatorError || !creator) throw new Error(`Active sync user was not found for ${creatorEmail}`);

    const createdByById = new Map(stored.map((row) => [row.id, row.created_by]));
    const now = new Date().toISOString();
    const values = selected.map((row) => ({
      category: "pka",
      reference_number: row.data!.reference_number,
      name: row.data!.product_name,
      quantity: row.data!.required_quantity,
      opened_at: row.data!.opened_at,
      status: row.data!.status,
      closed_at: row.data!.status === "closed" ? row.data!.closed_at : null,
      alerts_enabled: row.data!.status !== "closed",
      notes: packPkaNotes(row.data!),
      created_by: row.existingId ? createdByById.get(row.existingId) ?? creator.id : creator.id,
      updated_at: now,
    }));
    const { error: mergeError } = await supabase
      .from("quality_followups")
      .upsert(values, { onConflict: "category,reference_number", ignoreDuplicates: false });
    if (mergeError) throw mergeError;
  }

  return {
    added: preview.newCount,
    updated: preview.updatedCount,
    unchanged: preview.unchangedCount,
    duplicates: preview.duplicateCount,
    invalid: preview.invalidCount,
    ignored: preview.ignoredCount,
  };
}
