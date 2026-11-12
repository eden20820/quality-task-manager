# ECO editor productivity

## Drafts and recovery

- Autosave is **device/browser-local**, not a cloud or archive save. The UI states this explicitly. Users must click Save to persist a business record in the system.
- `quality-eco-drafts` IndexedDB database, version 1, `drafts` store. Keys contain active organization ID, authenticated user ID and original archive record ID (or `new`). Do not use a shared fallback scope.
- The complete editable payload is retained, including pictures, attachments, signatures and layout. Writes are debounced 500 ms; visibility changes and unmount request a final flush. Before-unload warns if writes are outstanding.
- Opening a form offers recovery before enabling editing, never overwrites a candidate with an empty form. Archive handoff is consumed only after initialization, including React StrictMode.
- Writes/deletions use an IndexedDB read/write transaction with token compare-and-swap. Concurrent tabs cannot silently overwrite each other. A conflict keeps the current editor available for explicit server-side Save.
- Successful explicit Save queues local cleanup after existing writes. Failed server saves retain the draft. Download and preview do not delete it.
- Browser storage failures show an error and preserve manual saving. Browser-data deletion/private browsing may remove local drafts. This is not a backup or cross-device sync service.

## Preview

`POST /api/forms/eco/preview` authenticates an active portal user and organization, validates payload and byte budget, and calls the same PDF renderer as export. It never imports the archiver or writes records, objects or emails. PDF output is inline and `private, no-store`.

The modal uses the shared accessible dialog with focus management. Requests abort on close or after 30 seconds; object URLs are revoked on close/unmount. Editing is inert while preview is open so the displayed snapshot cannot silently become stale.

## Navigation and history

- The editor is a centered single column without a section sidebar or mobile section picker. Existing inline reorder controls remain available on each document block.
- Undo/redo is one document-wide, immutable history bounded to 50 steps. Consecutive typing within one field is grouped within 700 ms; structural edits, catalog fills, image/signature changes and checkbox operations remain distinct.
- Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y work inside the editor. Loading/recovering a document and confirmed New/Clear establish a new history boundary.
- No database migrations or new production credentials are needed for these features.

## Verification

Run `npm test -- --maxWorkers=2` and `npm run build -- --webpack`.
Tests include real React hook lifecycle/StrictMode with fake IndexedDB transactions, debounce/recovery, archive handoff, isolation, concurrent writes, cleanup, unavailable storage, history/layout behavior and preview authorization/no-archive behavior.

Browser interaction and responsive visual QA still require a compatible Next.js preview or the deployed portal; managed preview currently passes unsupported Vite-style flags to `next dev`.
