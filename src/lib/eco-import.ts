import * as XLSX from "xlsx";

export type EcoImportData = {
  reference_number: string;
  eco_project: string | null;
  eco_owner_name: string | null;
  eco_description: string;
  name: string;
  opened_at: string;
  status: "open" | "closed";
  closed_at: string | null;
  notes: string | null;
};

export type ExistingEco = EcoImportData & { id: string };
export type EcoImportAction = "new" | "update" | "duplicate" | "unchanged" | "invalid";
export type EcoImportResolution = "import" | "keep" | "skip";

export type EcoImportChange = { field: string; before: string; after: string };
export type EcoImportRow = {
  key: string;
  rowNumber: number;
  label: string;
  action: EcoImportAction;
  resolution: EcoImportResolution;
  changes: EcoImportChange[];
  error?: string;
  existingId?: string;
  data?: EcoImportData;
};

export type EcoImportPreview = {
  fileName: string;
  rows: EcoImportRow[];
  newCount: number;
  updatedCount: number;
  duplicateCount: number;
  unchangedCount: number;
  invalidCount: number;
  ignoredCount: number;
};

const REQUIRED_HEADERS = ["number", "project", "owner", "description", "opened", "status"] as const;
type HeaderKey = (typeof REQUIRED_HEADERS)[number] | "closed" | "comments";

const HEADER_ALIASES: Record<HeaderKey, string[]> = {
  number: ["no", "eco no", "eco number", "מספר eco", "מספר"],
  project: ["project", "פרויקט"],
  owner: ["name", "owner", "responsible", "אחראי", "שם"],
  description: ["description", "תיאור"],
  opened: ["opened", "open date", "opened date", "תאריך פתיחה"],
  status: ["status", "מצב", "סטטוס"],
  closed: ["closing cancellation date", "closing date", "cancel date", "close date", "תאריך סגירה", "תאריך ביטול"],
  comments: ["comments", "comment", "notes", "הערות", "הערה"],
};

const FIELD_LABELS: Array<[keyof EcoImportData, string]> = [
  ["eco_project", "Project"],
  ["eco_owner_name", "Name"],
  ["eco_description", "Description"],
  ["opened_at", "Open Date"],
  ["status", "Status"],
  ["closed_at", "Close / Cancel Date"],
  ["notes", "Notes"],
];

function clean(value: unknown) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeHeader(value: unknown) {
  return clean(value).toLowerCase().replace(/[._/\\()-]/g, " ").replace(/\s+/g, " ").trim();
}

function headerIndex(row: unknown[], key: HeaderKey) {
  const normalized = row.map(normalizeHeader);
  return normalized.findIndex((value) => HEADER_ALIASES[key].some((alias) => value === alias));
}

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseEcoDate(value: unknown): string | null {
  if (value === null || value === undefined || clean(value) === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return isoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? isoDate(parsed.y, parsed.m, parsed.d) : null;
  }
  const text = clean(value);
  let match = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!match) return null;
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  return isoDate(year, Number(match[2]), Number(match[1]));
}

function parseStatus(value: unknown): "open" | "closed" | null {
  const status = clean(value).toLowerCase();
  if (["open", "opened", "פתוח", "פתוחה", "נפתח"].includes(status)) return "open";
  if (["closed", "close", "cancelled", "canceled", "סגור", "סגורה", "נסגר", "בוטל", "מבוטל"].includes(status)) return "closed";
  return null;
}

function normalizeReference(value: unknown) {
  return clean(value).toUpperCase().replace(/[–—/]/g, "-").replace(/\s+/g, "");
}

function isSafeReference(reference: string) {
  return /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(reference) && /\d/.test(reference);
}

function comparable(value: unknown) {
  return clean(value).toLocaleLowerCase("he-IL");
}

function display(value: unknown) {
  return clean(value) || "ריק";
}

type ParsedCandidate = { rowNumber: number; data?: EcoImportData; error?: string; ignored?: boolean };

export function parseEcoWorkbook(buffer: ArrayBuffer | Uint8Array): { candidates: ParsedCandidate[]; ignoredCount: number } {
  const workbook = XLSX.read(buffer, { cellDates: false });
  const candidates: ParsedCandidate[] = [];
  let ignoredCount = 0;
  let foundTable = false;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: true });
    const headerRow = rows.findIndex((row) => REQUIRED_HEADERS.every((key) => headerIndex(row, key) >= 0));
    if (headerRow < 0) continue;
    foundTable = true;
    const header = rows[headerRow];
    const columns = Object.fromEntries((Object.keys(HEADER_ALIASES) as HeaderKey[]).map((key) => [key, headerIndex(header, key)])) as Record<HeaderKey, number>;

    for (let index = headerRow + 1; index < rows.length; index += 1) {
      const row = rows[index];
      if (row.every((value) => clean(value) === "")) continue;
      const first = clean(row[columns.number]);
      if (/^(approved by|date|signature)\s*:/i.test(first)) {
        ignoredCount += 1;
        continue;
      }
      const reference = normalizeReference(row[columns.number]);
      if (!isSafeReference(reference)) {
        candidates.push({ rowNumber: index + 1, error: "מספר ECO חסר או אינו מזהה בטוח" });
        continue;
      }
      const project = clean(row[columns.project]);
      const owner = clean(row[columns.owner]);
      const description = clean(row[columns.description]);
      const opened = parseEcoDate(row[columns.opened]);
      const status = parseStatus(row[columns.status]);
      const closedRaw = columns.closed >= 0 ? row[columns.closed] : "";
      const closed = parseEcoDate(closedRaw);
      const errors: string[] = [];
      if (!project) errors.push("Project חסר");
      if (!owner) errors.push("Name חסר");
      if (!description) errors.push("Description חסר");
      if (!opened) errors.push("Open Date חסר או לא תקין");
      if (!status) errors.push("Status אינו תקין");
      if (clean(closedRaw) && !closed) errors.push("Close / Cancel Date אינו תקין");
      if (status === "closed" && !closed) errors.push("לרשומה סגורה חסר תאריך סגירה");
      if (errors.length || !opened || !status) {
        candidates.push({ rowNumber: index + 1, error: errors.join("; ") });
        continue;
      }
      candidates.push({
        rowNumber: index + 1,
        data: {
          reference_number: reference,
          eco_project: project,
          eco_owner_name: owner,
          eco_description: description,
          name: description,
          opened_at: opened,
          status,
          closed_at: status === "closed" ? closed : null,
          notes: columns.comments >= 0 ? clean(row[columns.comments]) || null : null,
        },
      });
    }
  }

  if (!foundTable) {
    throw new Error(`מבנה הקובץ אינו תקין. נדרשות העמודות: ${REQUIRED_HEADERS.map((key) => HEADER_ALIASES[key][0]).join(", ")}`);
  }
  return { candidates, ignoredCount };
}

const LEGACY_PREFIX = "ECO_IMPORT_JSON:";

export function packLegacyEcoNotes(data: EcoImportData) {
  return `${LEGACY_PREFIX}${JSON.stringify({ project: data.eco_project, description: data.eco_description, owner: data.eco_owner_name, comments: data.notes })}`;
}

export function unpackLegacyEcoNotes(notes: string | null) {
  if (!notes?.startsWith(LEGACY_PREFIX)) return null;
  try {
    return JSON.parse(notes.slice(LEGACY_PREFIX.length)) as { project: string | null; description: string; owner?: string | null; comments: string | null };
  } catch {
    return null;
  }
}

export function repackLegacyEcoNotes(
  data: NonNullable<ReturnType<typeof unpackLegacyEcoNotes>>,
) {
  return `${LEGACY_PREFIX}${JSON.stringify(data)}`;
}

const OPENER_PREFIX = "FOLLOWUP_META_JSON:";

export function packLegacyOpenerNotes(openedByName: string | null, notes: string | null) {
  return `${OPENER_PREFIX}${JSON.stringify({ openedByName, notes })}`;
}

export function unpackLegacyOpenerNotes(notes: string | null) {
  if (!notes?.startsWith(OPENER_PREFIX)) return null;
  try {
    return JSON.parse(notes.slice(OPENER_PREFIX.length)) as { openedByName: string | null; notes: string | null };
  } catch {
    return null;
  }
}

export function buildEcoPreview(fileName: string, parsed: ReturnType<typeof parseEcoWorkbook>, existing: ExistingEco[]): EcoImportPreview {
  const existingByReference = new Map(existing.map((row) => [normalizeReference(row.reference_number), row]));
  const occurrences = new Map<string, number>();
  for (const candidate of parsed.candidates) {
    if (candidate.data) occurrences.set(candidate.data.reference_number, (occurrences.get(candidate.data.reference_number) ?? 0) + 1);
  }

  const rows: EcoImportRow[] = parsed.candidates.map((candidate) => {
    if (!candidate.data) return { key: `row-${candidate.rowNumber}`, rowNumber: candidate.rowNumber, label: `שורה ${candidate.rowNumber}`, action: "invalid", resolution: "skip", changes: [], error: candidate.error };
    const data = candidate.data;
    if ((occurrences.get(data.reference_number) ?? 0) > 1) return { key: `${data.reference_number}-${candidate.rowNumber}`, rowNumber: candidate.rowNumber, label: data.reference_number, action: "duplicate", resolution: "skip", changes: [], error: "מספר ECO מופיע יותר מפעם אחת בקובץ", data };
    const old = existingByReference.get(data.reference_number);
    if (!old) return { key: data.reference_number, rowNumber: candidate.rowNumber, label: data.reference_number, action: "new", resolution: "import", changes: [], data };
    const changes = FIELD_LABELS.flatMap(([field, label]) => comparable(old[field]) === comparable(data[field]) ? [] : [{ field: label, before: display(old[field]), after: display(data[field]) }]);
    if (!changes.length) return { key: data.reference_number, rowNumber: candidate.rowNumber, label: data.reference_number, action: "unchanged", resolution: "skip", changes: [], existingId: old.id, data };
    return { key: data.reference_number, rowNumber: candidate.rowNumber, label: data.reference_number, action: "update", resolution: "keep", changes, existingId: old.id, data };
  });

  return {
    fileName,
    rows,
    newCount: rows.filter((row) => row.action === "new").length,
    updatedCount: rows.filter((row) => row.action === "update").length,
    duplicateCount: rows.filter((row) => row.action === "duplicate").length,
    unchangedCount: rows.filter((row) => row.action === "unchanged").length,
    invalidCount: rows.filter((row) => row.action === "invalid").length,
    ignoredCount: parsed.ignoredCount,
  };
}
