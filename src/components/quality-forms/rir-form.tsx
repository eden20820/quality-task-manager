"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  RotateCcw,
  Save,
} from "lucide-react";

import {
  measurementState,
  resizeMeasurementRows,
  RIR_DRAFT_STORAGE_KEY,
  summarizeMeasurementColumn,
  summarizePassFail,
  type RirAttribute,
  type RirMeasurementRow,
  type RirPassFail,
} from "@/lib/quality-forms/rir";

type RirDetails = {
  catalogNumber: string;
  partName: string;
  supplierName: string;
  receivedQuantity: string;
  orderNumber: string;
  lotNumber: string;
  drawingNumber: string;
  drawingRevision: string;
  comments: string;
  documents: { coc: boolean; cot: boolean; coa: boolean; other: boolean };
  otherDocument: string;
};

type RirApproval = {
  disposition: "" | "approved" | "hold" | "rejected" | "special";
  ncNumber: string;
  ncDecision: "" | "accept" | "reject" | "rework";
  specialConditions: string;
  approvedParts: string;
  rejectedParts: string;
  inspectorName: string;
  inspectionDate: string;
  reviewerName: string;
  reviewDate: string;
};

type RirDraft = {
  version: 1;
  savedAt: string;
  details: RirDetails;
  attributes: RirAttribute[];
  rows: RirMeasurementRow[];
  approval: RirApproval;
  sampleSize: number;
};

const steps = ["פרטי קבלה", "הגדרת הבדיקה", "תוצאות", "סיכום ואישור"] as const;

const emptyDetails: RirDetails = {
  catalogNumber: "",
  partName: "",
  supplierName: "",
  receivedQuantity: "",
  orderNumber: "",
  lotNumber: "",
  drawingNumber: "",
  drawingRevision: "",
  comments: "",
  documents: { coc: false, cot: false, coa: false, other: false },
  otherDocument: "",
};

const emptyApproval: RirApproval = {
  disposition: "",
  ncNumber: "",
  ncDecision: "",
  specialConditions: "",
  approvedParts: "",
  rejectedParts: "",
  inspectorName: "",
  inspectionDate: "",
  reviewerName: "",
  reviewDate: "",
};

function createAttributes(count: number, current: RirAttribute[] = []) {
  return Array.from({ length: count }, (_, index) => current[index] ?? {
    id: `measurement-${index + 1}`,
    name: `מידה ${index + 1}`,
    equipment: "קליבר",
    min: "",
    max: "",
  });
}

function formatMetric(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 3 }).format(value);
}

function Field({ label, value, onChange, type = "text", placeholder, min }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "number" | "date"; placeholder?: string; min?: number }) {
  return <label className="block text-sm font-bold text-slate-700"><span>{label}</span><input type={type} min={min} step={type === "number" ? "any" : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>;
}

function StepProgress({ currentStep, onStep }: { currentStep: number; onStep: (step: number) => void }) {
  return <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">{steps.map((step, index) => <li key={step}><button type="button" onClick={() => onStep(index)} aria-current={currentStep === index ? "step" : undefined} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-right transition ${currentStep === index ? "border-slate-950 bg-slate-950 text-white shadow-md" : index < currentStep ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}><span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${currentStep === index ? "bg-white text-slate-950" : index < currentStep ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{index < currentStep ? <Check className="h-4 w-4" /> : index + 1}</span><span className="text-sm font-extrabold">{step}</span></button></li>)}</ol>;
}

function PassFailControl({ value, onChange, label }: { value: RirPassFail; onChange: (value: RirPassFail) => void; label: string }) {
  return <div className="grid min-w-40 grid-cols-2 gap-1" role="group" aria-label={label}><button type="button" onClick={() => onChange("Pass")} className={`h-9 rounded-lg border text-xs font-extrabold transition ${value === "Pass" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"}`}>תקין</button><button type="button" onClick={() => onChange("Fail")} className={`h-9 rounded-lg border text-xs font-extrabold transition ${value === "Fail" ? "border-red-600 bg-red-600 text-white" : "border-red-200 bg-white text-red-700 hover:bg-red-50"}`}>לא תקין</button></div>;
}

function DetailsStep({ details, onChange }: { details: RirDetails; onChange: (details: RirDetails) => void }) {
  const update = (key: keyof Omit<RirDetails, "documents">, value: string) => onChange({ ...details, [key]: value });
  const toggleDocument = (key: keyof RirDetails["documents"]) => onChange({ ...details, documents: { ...details.documents, [key]: !details.documents[key] } });

  return <div className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5"><h2 className="text-xl font-black">פרטי קבלה ופריט</h2><p className="mt-1 text-sm text-slate-500">הפרטים שיופיעו בראש דוח ביקורת הקבלה.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Field label="מק״ט / מספר קטלוגי" value={details.catalogNumber} onChange={(value) => update("catalogNumber", value)} /><Field label="שם הפריט" value={details.partName} onChange={(value) => update("partName", value)} /><Field label="שם הספק" value={details.supplierName} onChange={(value) => update("supplierName", value)} /><Field label="כמות שהתקבלה" type="number" min={0} value={details.receivedQuantity} onChange={(value) => update("receivedQuantity", value)} /><Field label="מספר הזמנה" value={details.orderNumber} onChange={(value) => update("orderNumber", value)} /><Field label="מספר אצווה" value={details.lotNumber} onChange={(value) => update("lotNumber", value)} /><Field label="מספר שרטוט" value={details.drawingNumber} onChange={(value) => update("drawingNumber", value)} /><Field label="רוויזיית שרטוט" value={details.drawingRevision} onChange={(value) => update("drawingRevision", value)} /></div><label className="mt-4 block text-sm font-bold text-slate-700">הערות<textarea value={details.comments} onChange={(event) => update("comments", event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-black">מסמכים מצורפים</h2><div className="mt-4 flex flex-wrap gap-3">{([['coc', 'COC'], ['cot', 'COT'], ['coa', 'COA'], ['other', 'אחר']] as const).map(([key, label]) => <label key={key} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-4 font-bold transition ${details.documents[key] ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}><input type="checkbox" checked={details.documents[key]} onChange={() => toggleDocument(key)} className="h-4 w-4 accent-blue-600" />{label}</label>)}</div>{details.documents.other ? <div className="mt-4 max-w-md"><Field label="שם המסמך האחר" value={details.otherDocument} onChange={(value) => update("otherDocument", value)} /></div> : null}</section></div>;
}

function SetupStep({ sampleSize, attributes, onSampleSize, onAttributeCount, onAttribute }: { sampleSize: number; attributes: RirAttribute[]; onSampleSize: (size: number) => void; onAttributeCount: (count: number) => void; onAttribute: (index: number, attribute: RirAttribute) => void }) {
  return <div className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-xl font-black">מבנה הבדיקה</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-700">מספר דגימות<input type="number" min={1} max={200} value={sampleSize} onChange={(event) => onSampleSize(Math.min(200, Math.max(1, Number(event.target.value) || 1)))} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /><span className="mt-1 block text-xs font-medium text-slate-500">בין 1 ל־200 דגימות</span></label><label className="block text-sm font-bold text-slate-700">מספר עמודות מדידה<select value={attributes.length} onChange={(event) => onAttributeCount(Number(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">{Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select><span className="mt-1 block text-xs font-medium text-slate-500">בנוסף יופיעו בדיקה חזותית ופונקציונלית</span></label></div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-4"><h2 className="text-xl font-black">מאפייני מדידה</h2><p className="mt-1 text-sm text-slate-500">ערך שנמצא בדיוק על גבול המינימום או המקסימום ייחשב תקין, בהתאם לקובץ המקורי.</p></div><div className="space-y-3">{attributes.map((attribute, index) => <div key={attribute.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[56px_1.4fr_1fr_0.7fr_0.7fr]"><span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-black text-white">{index + 1}</span><Field label="שם המאפיין" value={attribute.name} onChange={(value) => onAttribute(index, { ...attribute, name: value })} /><Field label="ציוד מדידה" value={attribute.equipment} onChange={(value) => onAttribute(index, { ...attribute, equipment: value })} /><Field label="מינימום" type="number" value={attribute.min} onChange={(value) => onAttribute(index, { ...attribute, min: value })} /><Field label="מקסימום" type="number" value={attribute.max} onChange={(value) => onAttribute(index, { ...attribute, max: value })} /></div>)}</div></section></div>;
}

function ResultsStep({ attributes, rows, onRows }: { attributes: RirAttribute[]; rows: RirMeasurementRow[]; onRows: (updater: (rows: RirMeasurementRow[]) => RirMeasurementRow[]) => void }) {
  const updateValue = (rowIndex: number, columnIndex: number, value: string) => onRows((current) => current.map((row, index) => index === rowIndex ? { ...row, values: row.values.map((entry, valueIndex) => valueIndex === columnIndex ? value : entry) } : row));
  const updateStatus = (rowIndex: number, key: "visual" | "functional", value: RirPassFail) => onRows((current) => current.map((row, index) => index === rowIndex ? { ...row, [key]: value } : row));

  function pasteMeasurements(event: React.ClipboardEvent<HTMLInputElement>, rowIndex: number, columnIndex: number) {
    const text = event.clipboardData.getData("text/plain");
    const matrix = text.replace(/\r/g, "").split("\n").filter((line, index, lines) => line || index < lines.length - 1).map((line) => line.split("\t"));
    if (matrix.length === 1 && matrix[0].length === 1) return;
    event.preventDefault();
    onRows((current) => current.map((row, currentRowIndex) => {
      const sourceRow = matrix[currentRowIndex - rowIndex];
      if (!sourceRow) return row;
      const values = [...row.values];
      sourceRow.forEach((value, sourceColumnIndex) => {
        const targetColumn = columnIndex + sourceColumnIndex;
        if (targetColumn < values.length) values[targetColumn] = value.trim();
      });
      return { ...row, values };
    }));
  }

  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6"><div><h2 className="text-xl font-black">תוצאות הבדיקה</h2><p className="mt-1 text-sm text-slate-500">אפשר להדביק כמה תאים יחד ישירות מאקסל. תאים תקינים נצבעים בירוק וחריגות באדום.</p></div><span className="text-sm font-extrabold text-slate-600">{rows.length} דגימות</span></div><div className="max-h-[64vh] overflow-auto"><table className="w-full min-w-max border-collapse text-sm"><thead className="sticky top-0 z-20 bg-slate-100 shadow-sm"><tr><th className="sticky right-0 z-30 w-24 border-b border-l border-slate-300 bg-slate-100 p-3 text-center">דגימה</th>{attributes.map((attribute, index) => <th key={attribute.id} className="min-w-44 border-b border-l border-slate-300 p-3 text-center"><span className="block font-black">{index + 1}. {attribute.name}</span><span className="mt-1 block text-[11px] font-semibold text-slate-500">{attribute.min || "—"} עד {attribute.max || "—"} · {attribute.equipment || "ללא ציוד"}</span></th>)}<th className="min-w-44 border-b border-l border-slate-300 p-3 text-center">בדיקה חזותית</th><th className="min-w-44 border-b border-slate-300 p-3 text-center">בדיקה פונקציונלית</th></tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={row.specimen} className="[content-visibility:auto]"><th className="sticky right-0 z-10 border-b border-l border-slate-200 bg-white p-3 text-center font-black text-slate-700">{row.specimen}</th>{attributes.map((attribute, columnIndex) => {
          const state = measurementState(row.values[columnIndex] ?? "", attribute.min, attribute.max);
          const stateClass = state === "pass" ? "border-emerald-300 bg-emerald-50 text-emerald-950" : state === "fail" || state === "invalid" ? "border-red-300 bg-red-50 text-red-950" : state === "unconfigured" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-red-200 bg-red-50/60 text-slate-900";
          return <td key={attribute.id} className="border-b border-l border-slate-200 p-2"><input type="number" step="any" value={row.values[columnIndex] ?? ""} onChange={(event) => updateValue(rowIndex, columnIndex, event.target.value)} onPaste={(event) => pasteMeasurements(event, rowIndex, columnIndex)} aria-label={`דגימה ${row.specimen}, ${attribute.name}`} className={`h-10 w-full rounded-lg border px-3 text-center font-bold outline-none focus:ring-2 focus:ring-blue-400 ${stateClass}`} /></td>;
        })}<td className={`border-b border-l border-slate-200 p-2 ${row.visual ? "bg-white" : "bg-red-50/60"}`}><PassFailControl value={row.visual} onChange={(value) => updateStatus(rowIndex, "visual", value)} label={`בדיקה חזותית לדגימה ${row.specimen}`} /></td><td className={`border-b border-slate-200 p-2 ${row.functional ? "bg-white" : "bg-red-50/60"}`}><PassFailControl value={row.functional} onChange={(value) => updateStatus(rowIndex, "functional", value)} label={`בדיקה פונקציונלית לדגימה ${row.specimen}`} /></td></tr>)}</tbody></table></div></section>;
}

function SummaryStep({ details, attributes, rows, approval, onApproval }: { details: RirDetails; attributes: RirAttribute[]; rows: RirMeasurementRow[]; approval: RirApproval; onApproval: (approval: RirApproval) => void }) {
  const numericSummaries = useMemo(() => attributes.map((attribute, index) => summarizeMeasurementColumn(rows, index, attribute.min, attribute.max)), [attributes, rows]);
  const visualSummary = useMemo(() => summarizePassFail(rows, "visual"), [rows]);
  const functionalSummary = useMemo(() => summarizePassFail(rows, "functional"), [rows]);
  const totalRejected = numericSummaries.reduce((total, summary) => total + summary.rejected, 0) + visualSummary.rejected + functionalSummary.rejected;
  const entered = numericSummaries.reduce((total, summary) => total + summary.entered, 0) + visualSummary.entered + functionalSummary.entered;
  const expected = rows.length * (attributes.length + 2);
  const complete = entered === expected;
  const update = (key: keyof RirApproval, value: string) => onApproval({ ...approval, [key]: value });
  const columns = [...attributes.map((attribute, index) => ({ label: attribute.name, summary: numericSummaries[index], numeric: true as const })), { label: "חזותית", summary: { ...visualSummary, maximum: null, minimum: null, average: null, standardDeviation: null }, numeric: false as const }, { label: "פונקציונלית", summary: { ...functionalSummary, maximum: null, minimum: null, average: null, standardDeviation: null }, numeric: false as const }];

  return <div className="space-y-6"><section className={`rounded-2xl border p-5 shadow-sm ${!complete ? "border-amber-200 bg-amber-50" : totalRejected ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}><div className="flex items-start gap-3"><CheckCircle2 className={`mt-0.5 h-6 w-6 shrink-0 ${!complete ? "text-amber-600" : totalRejected ? "text-red-600" : "text-emerald-600"}`} /><div><h2 className="text-lg font-black">{!complete ? "הטופס עדיין לא הושלם" : totalRejected ? "נמצאו תוצאות חריגות" : "כל התוצאות שהוזנו תקינות"}</h2><p className="mt-1 text-sm font-semibold text-slate-600">הוזנו {entered} מתוך {expected} תוצאות. {totalRejected ? `${totalRejected} תוצאות סומנו כחריגות.` : "לא נמצאו חריגות בתוצאות שהוזנו."}</p></div></div></section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-4 sm:p-6"><h2 className="text-xl font-black">סיכום מחושב</h2><p className="mt-1 text-sm text-slate-500">החישובים תואמים לנוסחאות שבטופס RIR המקורי.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-100"><tr><th className="p-3 text-right">מדד</th>{columns.map((column, index) => <th key={`${column.label}-${index}`} className="p-3 text-center">{column.label}</th>)}</tr></thead><tbody className="divide-y">{([['מקסימום', 'maximum'], ['מינימום', 'minimum'], ['ממוצע', 'average'], ['סטיית תקן', 'standardDeviation'], ['כמות שהוזנה', 'entered'], ['מאושר', 'approved'], ['נדחה', 'rejected']] as const).map(([label, key]) => <tr key={key}><th className="p-3 text-right font-extrabold text-slate-700">{label}</th>{columns.map((column, index) => <td key={`${key}-${index}`} className={`p-3 text-center font-bold ${key === "rejected" && column.summary.rejected ? "bg-red-50 text-red-700" : key === "approved" ? "text-emerald-700" : ""}`}>{column.numeric || !["maximum", "minimum", "average", "standardDeviation"].includes(key) ? formatMetric(column.summary[key]) : "—"}</td>)}</tr>)}</tbody></table></div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-xl font-black">החלטה ואישור</h2><p className="mt-1 text-sm text-slate-500">פריט: {details.partName || "לא הוזן"} · ספק: {details.supplierName || "לא הוזן"}</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([['approved', 'מאושר'], ['hold', 'החזקה / אי־התאמה'], ['rejected', 'נדחה'], ['special', 'מאושר בתנאים מיוחדים']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => update("disposition", value)} className={`min-h-12 rounded-xl border px-4 text-sm font-extrabold transition ${approval.disposition === value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>)}</div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="מספר אי־התאמה" value={approval.ncNumber} onChange={(value) => update("ncNumber", value)} /><label className="block text-sm font-bold text-slate-700">החלטת אי־התאמה<select value={approval.ncDecision} onChange={(event) => update("ncDecision", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-semibold"><option value="">ללא החלטה</option><option value="accept">קבלה</option><option value="reject">דחייה</option><option value="rework">עיבוד מחדש</option></select></label><Field label="מספר חלקים מאושרים" type="number" min={0} value={approval.approvedParts} onChange={(value) => update("approvedParts", value)} /><Field label="מספר חלקים שנדחו" type="number" min={0} value={approval.rejectedParts} onChange={(value) => update("rejectedParts", value)} /></div><label className="mt-4 block text-sm font-bold text-slate-700">תנאים מיוחדים / פירוט החלטה<textarea value={approval.specialConditions} onChange={(event) => update("specialConditions", event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="שם הבודק" value={approval.inspectorName} onChange={(value) => update("inspectorName", value)} /><Field label="תאריך בדיקה" type="date" value={approval.inspectionDate} onChange={(value) => update("inspectionDate", value)} /><Field label="נבדק ואושר על ידי" value={approval.reviewerName} onChange={(value) => update("reviewerName", value)} /><Field label="תאריך אישור" type="date" value={approval.reviewDate} onChange={(value) => update("reviewDate", value)} /></div></section></div>;
}

export function RirForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [details, setDetails] = useState<RirDetails>(emptyDetails);
  const [sampleSize, setSampleSize] = useState(10);
  const [attributes, setAttributes] = useState<RirAttribute[]>(() => createAttributes(3));
  const [rows, setRows] = useState<RirMeasurementRow[]>(() => resizeMeasurementRows([], 10, 3));
  const [approval, setApproval] = useState<RirApproval>(emptyApproval);
  const [draftMessage, setDraftMessage] = useState("");

  function changeSampleSize(size: number) {
    setSampleSize(size);
    setRows((current) => resizeMeasurementRows(current, size, attributes.length));
  }

  function changeAttributeCount(count: number) {
    setAttributes((current) => createAttributes(count, current));
    setRows((current) => resizeMeasurementRows(current, sampleSize, count));
  }

  function updateAttribute(index: number, attribute: RirAttribute) {
    setAttributes((current) => current.map((entry, currentIndex) => currentIndex === index ? attribute : entry));
  }

  function saveDraft() {
    const draft: RirDraft = { version: 1, savedAt: new Date().toISOString(), details, attributes, rows, approval, sampleSize };
    try {
      window.localStorage.setItem(RIR_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setDraftMessage("הטיוטה נשמרה בדפדפן הזה");
    } catch {
      setDraftMessage("לא ניתן לשמור את הטיוטה בדפדפן הזה");
    }
  }

  function loadDraft() {
    const saved = window.localStorage.getItem(RIR_DRAFT_STORAGE_KEY);
    if (!saved) { setDraftMessage("לא נמצאה טיוטה שמורה בדפדפן הזה"); return; }
    try {
      const draft = JSON.parse(saved) as RirDraft;
      if (draft.version !== 1 || !draft.details || !draft.approval || !Array.isArray(draft.rows) || !Array.isArray(draft.attributes) || !draft.attributes.length) throw new Error("Invalid draft");
      const safeSampleSize = Math.min(200, Math.max(1, Number(draft.sampleSize) || 10));
      const safeAttributes = draft.attributes.slice(0, 8);
      setDetails(draft.details);
      setAttributes(safeAttributes);
      setRows(resizeMeasurementRows(draft.rows, safeSampleSize, safeAttributes.length));
      setApproval(draft.approval);
      setSampleSize(safeSampleSize);
      setDraftMessage("הטיוטה נטענה בהצלחה");
    } catch {
      setDraftMessage("הטיוטה השמורה אינה תקינה");
    }
  }

  function resetForm() {
    if (!window.confirm("לנקות את כל הנתונים שהוזנו בטופס?")) return;
    setDetails(emptyDetails);
    setSampleSize(10);
    setAttributes(createAttributes(3));
    setRows(resizeMeasurementRows([], 10, 3));
    setApproval(emptyApproval);
    setCurrentStep(0);
    setDraftMessage("");
    window.localStorage.removeItem(RIR_DRAFT_STORAGE_KEY);
  }

  return <div className="space-y-5"><header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><Link href="/forms" className="inline-flex items-center gap-2 text-sm font-extrabold text-blue-700 hover:text-blue-900"><ArrowRight className="h-4 w-4" />חזרה לבחירת טופס</Link><div className="mt-3 flex items-center gap-3"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ClipboardCheck className="h-6 w-6" /></span><div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">דוח ביקורת קבלה (RIR)</h1><p className="mt-1 text-sm font-medium text-slate-500">Quality Form 8.4.2.2.0 · Rev. 02</p></div></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={loadDraft} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50"><FileSpreadsheet className="h-4 w-4" />טעינת טיוטה</button><button type="button" onClick={saveDraft} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white hover:bg-slate-800"><Save className="h-4 w-4" />שמירת טיוטה</button><button type="button" onClick={resetForm} aria-label="ניקוי הטופס" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50"><RotateCcw className="h-4 w-4" /></button></div></header>
    {draftMessage ? <p aria-live="polite" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{draftMessage}</p> : null}
    <StepProgress currentStep={currentStep} onStep={setCurrentStep} />
    {currentStep === 0 ? <DetailsStep details={details} onChange={setDetails} /> : null}
    {currentStep === 1 ? <SetupStep sampleSize={sampleSize} attributes={attributes} onSampleSize={changeSampleSize} onAttributeCount={changeAttributeCount} onAttribute={updateAttribute} /> : null}
    {currentStep === 2 ? <ResultsStep attributes={attributes} rows={rows} onRows={setRows} /> : null}
    {currentStep === 3 ? <SummaryStep details={details} attributes={attributes} rows={rows} approval={approval} onApproval={setApproval} /> : null}
    <footer className="sticky bottom-3 z-30 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur"><button type="button" onClick={() => setCurrentStep((step) => Math.max(0, step - 1))} disabled={currentStep === 0} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-40"><ArrowRight className="h-4 w-4" />הקודם</button><span className="hidden text-sm font-bold text-slate-500 sm:block">שלב {currentStep + 1} מתוך {steps.length}</span>{currentStep < steps.length - 1 ? <button type="button" onClick={() => setCurrentStep((step) => Math.min(steps.length - 1, step + 1))} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-extrabold text-white">הבא<ArrowLeft className="h-4 w-4" /></button> : <button type="button" onClick={saveDraft} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-extrabold text-white"><Save className="h-4 w-4" />שמירת טיוטה</button>}</footer>
  </div>;
}

