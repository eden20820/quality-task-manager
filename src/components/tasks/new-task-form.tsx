"use client";

import { useRef, useState } from "react";
import { FilePlus2, Paperclip, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { createTask } from "@/app/tasks/new/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 20;

type UploadedFile = {
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number;
};

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function safeFileName(name: string) {
  return name.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "_");
}

function formatFileSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.ceil(size / 1024)} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function NewTaskForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function addFiles(selected: FileList | null) {
    if (!selected?.length) return;

    const incoming = Array.from(selected);
    const oversized = incoming.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setMessage(`הקובץ "${oversized.name}" גדול מ-10MB`);
      return;
    }

    const existing = new Set(files.map(fileKey));
    const additions = incoming.filter((file) => !existing.has(fileKey(file)));
    const combined = [...files, ...additions];
    if (combined.length > MAX_FILES) {
      setMessage(`ניתן לצרף עד ${MAX_FILES} קבצים למשימה`);
      return;
    }
    setFiles(combined);
    setMessage("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;

    setBusy(true);
    setMessage(files.length > 0 ? "מעלה קבצים..." : "שומר משימה...");

    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setBusy(false);
      setMessage("ההתחברות פגה. יש להתחבר מחדש.");
      return;
    }

    const uploaded: UploadedFile[] = [];
    for (const file of files) {
      const storagePath = `${userData.user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error } = await supabase.storage.from("task-files").upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

      if (error) {
        if (uploaded.length > 0) {
          await supabase.storage.from("task-files").remove(uploaded.map((item) => item.storage_path));
        }
        setBusy(false);
        setMessage(`העלאת הקובץ "${file.name}" נכשלה: ${error.message}`);
        return;
      }

      uploaded.push({
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type || null,
        file_size: file.size,
      });
    }

    const formData = new FormData(form);
    formData.delete("files");
    formData.set("uploaded_files", JSON.stringify(uploaded));
    setMessage("שומר משימה...");

    const result = await createTask(formData);
    if (!result.success) {
      if (uploaded.length > 0) {
        await supabase.storage.from("task-files").remove(uploaded.map((item) => item.storage_path));
      }
      setBusy(false);
      setMessage(result.error);
      return;
    }

    router.push("/tasks");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold sm:text-4xl">משימה חדשה</h2>
        <p className="mt-2 text-lg text-slate-500">הזן את פרטי המשימה ושייך אותה לעובדים הרלוונטיים</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="space-y-2">
          <label htmlFor="title" className="text-base font-bold">כותרת המשימה</label>
          <Input id="title" name="title" required placeholder="לדוגמה: בדיקת חלק CNC" className="h-12 text-base" />
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="text-base font-bold">תיאור</label>
          <textarea id="description" name="description" placeholder="פרט מה נדרש לבצע" className="min-h-36 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400" />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-base font-bold">סטטוס</label>
            <Select name="status" defaultValue="new">
              <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">חדשה</SelectItem>
                <SelectItem value="in_progress">בטיפול</SelectItem>
                <SelectItem value="waiting">ממתינה</SelectItem>
                <SelectItem value="completed">הושלמה</SelectItem>
                <SelectItem value="cancelled">בוטלה</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-base font-bold">עדיפות</label>
            <Select name="priority" defaultValue="normal">
              <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">רגילה</SelectItem>
                <SelectItem value="high">גבוהה</SelectItem>
                <SelectItem value="urgent">דחופה</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="due_date" className="text-base font-bold">תאריך יעד</label>
            <Input id="due_date" name="due_date" type="date" className="h-12 text-base" />
          </div>

          <div className="space-y-2">
            <label className="text-base font-bold">אחראים</label>
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <label className="flex items-center gap-3 text-base"><input name="assignees" value="eden" type="checkbox" defaultChecked className="h-5 w-5" /><span>עדן</span></label>
              <label className="flex items-center gap-3 text-base"><input name="assignees" value="sergey" type="checkbox" defaultChecked className="h-5 w-5" /><span>סרגיי</span></label>
              <label className="flex items-center gap-3 text-base"><input name="assignees" value="quality_manager" type="checkbox" className="h-5 w-5" /><span>מנהל איכות</span></label>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-base font-bold">קבצים מצורפים</label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />

          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 sm:p-8">
            <div className="text-center">
              <Paperclip className="mx-auto h-7 w-7 text-slate-500" />
              <p className="mt-2 text-sm text-slate-500">תמונות, PDF, Word או Excel — עד 10MB לקובץ</p>
              <Button type="button" variant="outline" className="mt-4 gap-2 bg-white font-bold" onClick={() => fileInputRef.current?.click()}>
                <FilePlus2 className="h-4 w-4" />
                {files.length > 0 ? "הוסף קבצים נוספים" : "בחר קבצים"}
              </Button>
            </div>

            {files.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-slate-200 pt-4">
                {files.map((file) => (
                  <div key={fileKey(file)} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                    <span className="min-w-0 truncate font-semibold">{file.name}</span>
                    <span className="shrink-0 text-xs text-slate-500">{formatFileSize(file.size)}</span>
                    <button type="button" aria-label={`הסר את ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)))} className="shrink-0 rounded-md p-1.5 text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {message && <p role="status" className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">{message}</p>}

        <div className="flex justify-start gap-3 border-t border-slate-200 pt-6">
          <Button type="submit" size="lg" disabled={busy} className="px-8 text-base font-bold">{busy ? "שומר..." : "שמור משימה"}</Button>
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => router.push("/tasks")} className="px-8 text-base font-bold">ביטול</Button>
        </div>
      </form>
    </div>
  );
}
