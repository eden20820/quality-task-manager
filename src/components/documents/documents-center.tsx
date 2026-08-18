"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Search, Trash2, Upload } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export type DocumentRow = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  storage_path: string;
  created_at: string;
};

const categories = ["נהלים", "הוראות עבודה", "טפסים", "מפרטים", "תעודות", "דוחות", "אחר"];
const maxFileSize = 6 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function safeFileName(name: string) {
  const extension = name.includes(".") ? `.${name.split(".").pop()}` : "";
  return `${crypto.randomUUID()}${extension.toLowerCase()}`;
}

export function DocumentsCenter({ initialDocuments }: { initialDocuments: DocumentRow[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState(initialDocuments);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((document) =>
      (categoryFilter === "all" || document.category === categoryFilter) &&
      (!query || document.title.toLowerCase().includes(query) || document.file_name.toLowerCase().includes(query) || document.description?.toLowerCase().includes(query))
    );
  }, [documents, search, categoryFilter]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError(""); setMessage("");
    const form = new FormData(formElement);
    const file = fileInput.current?.files?.[0];
    const title = String(form.get("title") ?? "").trim();
    const category = String(form.get("category") ?? "אחר");
    const description = String(form.get("description") ?? "").trim();
    if (!file || !title) return setError("יש לבחור קובץ ולמלא שם מסמך");
    if (file.size > maxFileSize) return setError("גודל הקובץ המרבי הוא 6MB");

    setBusy(true);
    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) { setBusy(false); return setError("לא ניתן לזהות את המשתמש"); }

    const storagePath = `${userData.user.id}/${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("quality-documents").upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
    if (uploadError) { setBusy(false); return setError(`העלאת הקובץ נכשלה: ${uploadError.message}`); }

    const { data: created, error: insertError } = await supabase.from("quality_documents").insert({
      title, category, description: description || null, file_name: file.name,
      file_size: file.size, mime_type: file.type || null, storage_path: storagePath,
      uploaded_by: userData.user.id,
    }).select("id, title, category, description, file_name, file_size, mime_type, storage_path, created_at").single();

    if (insertError || !created) {
      await supabase.storage.from("quality-documents").remove([storagePath]);
      setBusy(false); return setError(`שמירת המסמך נכשלה: ${insertError?.message ?? "שגיאה לא ידועה"}`);
    }
    setDocuments((current) => [created as DocumentRow, ...current]);
    formElement.reset();
    setBusy(false); setMessage("המסמך הועלה בהצלחה"); router.refresh();
  }

  async function downloadDocument(document: DocumentRow) {
    setError("");
    const supabase = createClient();
    const { data, error: downloadError } = await supabase.storage.from("quality-documents").download(document.storage_path);
    if (downloadError || !data) return setError("הורדת המסמך נכשלה");
    const url = URL.createObjectURL(data); const anchor = window.document.createElement("a");
    anchor.href = url; anchor.download = document.file_name; anchor.click(); URL.revokeObjectURL(url);
  }

  async function deleteDocument(document: DocumentRow) {
    if (!window.confirm(`למחוק את המסמך "${document.title}"?`)) return;
    setError("");
    const supabase = createClient();
    const { error: storageError } = await supabase.storage.from("quality-documents").remove([document.storage_path]);
    if (storageError) return setError("מחיקת הקובץ נכשלה");
    const { error: databaseError } = await supabase.from("quality_documents").delete().eq("id", document.id);
    if (databaseError) return setError("הקובץ נמחק, אך מחיקת הרשומה נכשלה");
    setDocuments((current) => current.filter((item) => item.id !== document.id));
  }

  return <div className="space-y-7">
    <div><h2 className="text-3xl font-extrabold sm:text-4xl">מרכז מסמכים</h2><p className="mt-2 text-base text-slate-500 sm:text-lg">העלאה, שמירה ואיתור של מסמכי מחלקת האיכות</p></div>

    <form onSubmit={handleUpload} className="rounded-2xl border bg-white p-6 shadow-sm">
      <h3 className="flex items-center gap-2 text-xl font-extrabold"><Upload className="h-5 w-5" /> העלאת מסמך חדש</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <input name="title" required placeholder="שם המסמך" className="h-11 rounded-lg border px-3" />
        <select name="category" className="h-11 rounded-lg border bg-white px-3">{categories.map((category) => <option key={category}>{category}</option>)}</select>
        <input ref={fileInput} name="file" type="file" required className="h-11 rounded-lg border bg-white p-2" />
        <button disabled={busy} className="h-11 rounded-lg bg-slate-950 font-bold text-white disabled:opacity-50">{busy ? "מעלה..." : "העלה מסמך"}</button>
      </div>
      <textarea name="description" rows={2} placeholder="תיאור או הערה (לא חובה)" className="mt-4 w-full rounded-lg border p-3" />
      <p className="mt-2 text-xs text-slate-500">גודל מרבי: 6MB</p>
      {error && <p className="mt-3 font-bold text-red-600">{error}</p>}{message && <p className="mt-3 font-bold text-emerald-600">{message}</p>}
    </form>

    <div className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-[1fr_240px]">
      <label className="relative"><Search className="absolute right-3 top-3 h-5 w-5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש לפי שם, קובץ או תיאור" className="h-11 w-full rounded-lg border pr-10 pl-3" /></label>
      <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-11 rounded-lg border bg-white px-3"><option value="all">כל הקטגוריות</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
    </div>

    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      {visibleDocuments.length ? <div className="divide-y">{visibleDocuments.map((document) => <div key={document.id} className="grid items-center gap-4 p-5 md:grid-cols-[1fr_150px_120px_110px]">
        <div className="flex min-w-0 items-start gap-3"><FileText className="mt-1 h-6 w-6 shrink-0 text-blue-600" /><div className="min-w-0"><p className="truncate font-extrabold">{document.title}</p><p className="truncate text-sm text-slate-500">{document.file_name}{document.description ? ` • ${document.description}` : ""}</p></div></div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{document.category}</span>
        <div className="text-sm text-slate-500"><p>{formatDate(document.created_at)}</p><p>{formatSize(document.file_size)}</p></div>
        <div className="flex gap-2"><button onClick={() => downloadDocument(document)} aria-label="הורד" className="rounded-lg border p-2 hover:bg-slate-50"><Download className="h-5 w-5" /></button><button onClick={() => deleteDocument(document)} aria-label="מחק" className="rounded-lg border p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-5 w-5" /></button></div>
      </div>)}</div> : <div className="flex h-56 flex-col items-center justify-center text-slate-500"><FileText className="mb-3 h-10 w-10" /><p className="font-bold">אין מסמכים להצגה</p></div>}
    </div>
    <p className="text-sm font-semibold text-slate-500">מוצגים {visibleDocuments.length} מתוך {documents.length} מסמכים</p>
  </div>;
}
