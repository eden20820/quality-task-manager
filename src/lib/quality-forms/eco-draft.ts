import { isEcoFormPayload, type EcoFormPayload } from "./eco-form";

export type EcoDraft = { version: 1; token: string; updatedAt: string; payload: EcoFormPayload };
export class EcoDraftConflict extends Error { constructor() { super("הטיוטה השתנתה בלשונית אחרת. יש לרענן לפני המשך השמירה האוטומטית"); } }
export function ecoDraftKey(scope: string, archiveId: string | null) { return JSON.stringify([scope, archiveId || "new"]); }
export function validEcoDraft(value: unknown): value is EcoDraft {
  const record = value as EcoDraft | undefined;
  return Boolean(record && record.version === 1 && typeof record.token === "string" && typeof record.updatedAt === "string" && Number.isFinite(Date.parse(record.updatedAt)) && isEcoFormPayload(record.payload));
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("אחסון טיוטות אינו זמין בדפדפן זה")); return; }
    const request = indexedDB.open("quality-eco-drafts", 1);
    let settled = false;
    const timeout = setTimeout(() => { settled = true; reject(new Error("אחסון הטיוטות אינו מגיב כרגע")); }, 5000);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => { clearTimeout(timeout); if (settled) { request.result.close(); return; } settled = true; request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => { clearTimeout(timeout); settled = true; reject(request.error); };
    request.onblocked = () => { clearTimeout(timeout); settled = true; reject(new Error("יש לסגור לשוניות ישנות כדי לאפשר שמירת טיוטות")); };
  });
}
export async function readEcoDraft(key: string): Promise<EcoDraft | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("drafts", "readonly");
    const request = transaction.objectStore("drafts").get(key);
    transaction.oncomplete = () => { db.close(); if (request.result !== undefined && !validEcoDraft(request.result)) reject(new Error("הטיוטה השמורה אינה תקינה")); else resolve(request.result ?? null); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}
// A read/write transaction provides compare-and-swap across tabs. Never overwrite
// a newer draft silently. No business data is sent to an external storage service.
export async function replaceEcoDraft(key: string, expected: string | null, next: EcoDraft | null): Promise<void> {
  if (next && !validEcoDraft(next)) throw new Error("נתוני הטיוטה אינם תקינים");
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("drafts", "readwrite"), store = transaction.objectStore("drafts");
    let conflict = false;
    const current = store.get(key);
    current.onsuccess = () => {
      if ((current.result?.token ?? null) !== expected) { conflict = true; transaction.abort(); return; }
      if (next) store.put(next, key); else store.delete(key);
    };
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(conflict ? new EcoDraftConflict() : transaction.error ?? new Error("שמירת הטיוטה נכשלה")); };
  });
}

export interface EcoDraftStorage { replace: typeof replaceEcoDraft }
// Serializes writes (including a final flush or deletion), preserving edits made
// while a previous transaction is still in flight.
export class EcoDraftWriter {
  private tail: Promise<void> = Promise.resolve();
  constructor(readonly key: string, private token: string | null, private storage: EcoDraftStorage = { replace: replaceEcoDraft }) {}
  write(payload: EcoFormPayload) {
    const record: EcoDraft = { version: 1, token: crypto.randomUUID(), updatedAt: new Date().toISOString(), payload };
    return this.queue(async () => { await this.storage.replace(this.key, this.token, record); this.token = record.token; return record.updatedAt; });
  }
  clear() { return this.queue(async () => { await this.storage.replace(this.key, this.token, null); this.token = null; }); }
  private queue<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.tail.then(operation);
    this.tail = task.then(() => {}, () => {});
    return task;
  }
}
