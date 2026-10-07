# Multi-tenant foundation

Quality Task Manager uses one codebase and one Supabase project while keeping
each customer's data isolated by `organization_id`.

## Current rollout

The first migration creates the `caeli` workspace and assigns all existing
profiles and business records to it. Existing authenticated flows continue to
work because new rows receive the user's active organization by default.

Do not onboard a second production customer until tenant-aware background email
delivery, storage paths, and the organization administration screen have been
completed. Interactive database access is already isolated by restrictive RLS.

## Core model

- `organizations`: company identity, branding, locale, and timezone.
- `organization_members`: user membership and role in each workspace.
- `organization_modules`: module feature flags and module-level configuration.
- `organization_settings`: notification schedule and customer-specific fields.
- `profiles.active_organization_id`: the workspace selected by the user.
- Business and audit tables: scoped by a required `organization_id`.

## Security model

`is_organization_member()` is the common RLS predicate. It requires an active
membership, active profile, and active organization. Every existing business
table receives a restrictive RLS policy, which is combined with its existing
operation-specific policies instead of replacing them.

`has_organization_role()` is used for organization-level configuration. The
supported roles are `owner`, `admin`, `quality_manager`, `member`, and `viewer`.

Service-role jobs bypass RLS and must always filter explicitly by
`organization_id`. The PKA Drive synchronization is scoped using
`PKA_SYNC_ORGANIZATION_SLUG` (default: `caeli`).

## Adding a customer later

Customer provisioning should run server-side with the service role:

1. Insert a row into `organizations`.
2. Insert the first owner into `organization_members`.
3. Set that user's `profiles.active_organization_id`.
4. Configure modules and notification recipients.
5. Create tenant-prefixed storage paths.
6. Import the customer's initial data through the existing preview flows.

The organization trigger creates the default module and settings records. A
future onboarding UI should call a single transactional database function for
the remaining steps rather than issuing client-side inserts.

## Next implementation phase

1. Tenant-aware consolidated email jobs and per-company recipients.
2. Private storage paths in the form
   `{organization_id}/{module}/{record_id}/...` with signed URLs.
3. Super-admin customer onboarding and workspace switching.
4. Per-company terminology, branding, import mappings, and custom fields.
5. Export, backup, retention, and customer offboarding controls.
