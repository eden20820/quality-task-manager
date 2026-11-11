# Company-domain enrollment

## One-time production setup

Run `supabase/migrations/20261111160000_company_domain_enrollment.sql` in the
project's Supabase SQL Editor as the database owner. This migration is
transactional and safe to run again. Deploying the Next.js code does not apply
database migrations. Existing authorized members continue to work while the
migration is pending; new enrollments show an access-setup error until it runs.

The existing Google/Supabase OAuth provider must allow the intended company
accounts. No provider settings or deployment environment variables change here.

## Access contract

- Only a session whose current, confirmed `auth.users.email` has the exact
  `caeli.pro` domain can enroll. An editable profile email, display name or
  `user_metadata.email` cannot authorize enrollment.
- The RPC has no caller-supplied user, company, role or activation parameters.
- New staff receive the existing `member` role in Caeli, never owner/admin.
- Existing owner/admin/quality-manager roles are preserved.
- An existing inactive membership, or an inactive profile associated with an
  existing membership, stays suspended. To restore such an account an
  administrator must explicitly reactivate it; login does not undo suspension.
- An inactive company, an unconfirmed email, a banned identity, an anonymous
  session, a subdomain or a lookalike domain cannot enroll.
- Previously manually authorized accounts outside this domain retain their
  existing access; this change does not automatically authorize new outsiders.
- Shared read policies cover tasks and files, expiry tracking/imports,
  reminders/calendar, documents and archived forms, calibrations, followups
  (PKA/NC/ECO), suppliers, binders/entries, settings and the private part catalog.
  Existing write permissions and restrictive tenant policies are unchanged.
- Server pages wait for enrollment/profile repair before reading tab data, to
  avoid an empty first render from parallel App Router queries.

No Supabase service-role key is used by this enrollment flow. RLS stays enabled.

## Verification

Unit tests cover exact-domain eligibility, confirmed sessions, RPC failures,
preserving existing access, enrollment ordering, and the data-client barrier on
all 13 direct-data portal pages. An isolated PostgreSQL/PGlite execution of the
migration additionally checked repeatable enrollment, shared reads on all 13
business tables, cross-company isolation, owner preservation, rejected
spoofed/unconfirmed/banned/suspended/anonymous callers, rejected role escalation,
and inactive-company denial. This is not a live production authentication test.

After applying SQL, test with a new verified company account: sign in, open
dashboard, tasks, calendar, expiry, calibrations, suppliers, binders, PKA/NC/ECO,
documents and the form archive, and open a shared document. Then confirm that
the membership role is `member` and not an administrative role.
