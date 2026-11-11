import "server-only";
import { cache } from "react";
import { normalizeCatalog, type CatalogItem } from "./parts-catalog";
import { getPortalUser } from "@/lib/auth/portal-user";
import { createClient } from "@/lib/supabase/server";

// Read only through the user's session. The database enforces company RLS too.
// No company records or fallback snapshots are bundled into application code.
export const loadPartsCatalog = cache(async (): Promise<CatalogItem[]> => {
  const user = await getPortalUser();
  const organizationId = user?.profile.active_organization_id;
  if (!user?.profile.is_active || !organizationId) return [];
  const supabase = await createClient();
  const items: CatalogItem[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("quality_parts_catalog")
      .select("catalog_number,part_name,revision").eq("organization_id", organizationId)
      .order("catalog_number").order("part_name").order("revision").range(offset, offset + 999);
    if (error) {
      // Missing migration must not prevent users from filling forms manually.
      console.error("Parts catalog unavailable", { code: error.code });
      return [];
    }
    const rows = data ?? [];
    items.push(...rows.map(row => ({ catalogNumber: row.catalog_number, partName: row.part_name, revision: row.revision })));
    if (rows.length < 1000) break;
  }
  return normalizeCatalog(items);
});
