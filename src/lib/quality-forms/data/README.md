# Private parts catalog

Company records live in Supabase `quality_parts_catalog`, not in this repository. The three business fields are `catalog_number`, `part_name`, `revision`; the only additional column is the technical `organization_id` ownership key. No prices, stock quantities, suppliers, source spreadsheets or previous-number mappings are stored.

The public migration contains schema and organization-scoped read/write policies only. Apply it using an authorized database administrator. Load initial records separately through a private, approved data channel. Never commit catalog seed SQL, exported records, real company fixtures or workbook attachments.

`parts-catalog-server.ts` uses the logged-in session, an explicit active-organization filter, and database RLS. Form clients receive only the three permitted fields after authorization. Conflicting name/version variants remain selectable instead of being resolved silently. If the migration has not been applied, forms still allow manual entry.
