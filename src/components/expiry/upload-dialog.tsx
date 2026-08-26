"use client";

import { useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCcw,
  Upload,
  X,
} from "lucide-react";

import {
  confirmExpiryImport,
  previewExpiryImport,
  type ExpiryImportPreview,
} from "@/app/expiry/actions";
import { Button } from "@/components/ui/button";

type ImportResult = {
  insertedRows: number;
  updatedRows: number;
  unchangedRows: number;
  inactiveRows: number;
  invalidRows: number;
};

export function UploadDialog() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] =
    useState<ExpiryImportPreview | null>(null);

  const [result, setResult] =
    useState<ImportResult | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [isReading, setIsReading] = useState(false);

  const [isConfirming, startConfirmTransition] =
    useTransition();

  function openFilePicker() {
    inputRef.current?.click();
  }

  function resetImport() {
    setPreview(null);
    setResult(null);
    setErrorMessage("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleFileSelected(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsReading(true);
    setPreview(null);
    setResult(null);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.set("file", file);

      const importPreview =
        await previewExpiryImport(formData);

      setPreview(importPreview);
    } catch (error) {
      console.error("Preview expiry import error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "לא ניתן לקרוא את קובץ ה־Excel"
      );
    } finally {
      setIsReading(false);
    }
  }

  function handleConfirmImport() {
    if (!preview) {
      return;
    }

    setErrorMessage("");

    startConfirmTransition(async () => {
      try {
        const importResult = await confirmExpiryImport(
          preview.items,
          preview.fileName
        );

        setResult(importResult);
        setPreview(null);

        if (inputRef.current) {
          inputRef.current.value = "";
        }
      } catch (error) {
        console.error("Confirm expiry import error:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "הסנכרון נכשל. נסה שוב."
        );
      }
    });
  }

  return (
    <section
      dir="rtl"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        hidden
        onChange={handleFileSelected}
      />

      <div className="flex flex-col items-center justify-between gap-6 p-8 md:flex-row">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-50">
            <FileSpreadsheet className="h-9 w-9 text-emerald-600" />
          </div>

          <div>
            <h2 className="text-xl font-extrabold text-slate-950">
              סנכרון קובץ Excel
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              העלה קובץ מעקב מעודכן. לפני השמירה יוצג סיכום
              השינויים הצפויים.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={openFilePicker}
          disabled={isReading || isConfirming}
          className="min-w-44 gap-2 font-bold"
        >
          {isReading ? (
            <>
              <LoaderCircle className="h-5 w-5 animate-spin" />
              קורא את הקובץ...
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              בחירת קובץ Excel
            </>
          )}
        </Button>
      </div>

      {errorMessage && (
        <div className="mx-8 mb-8 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

          <div className="flex-1">
            <p className="font-bold">לא ניתן להשלים את הפעולה</p>
            <p className="mt-1 text-sm">{errorMessage}</p>
          </div>

          <button
            type="button"
            onClick={() => setErrorMessage("")}
            aria-label="סגירת הודעת שגיאה"
            className="rounded-md p-1 transition hover:bg-red-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {preview && (
        <div className="border-t border-slate-200 bg-slate-50 p-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-medium text-slate-500">
                הקובץ שנבחר
              </p>

              <p className="mt-1 font-bold text-slate-950">
                {preview.fileName}
              </p>
            </div>

            <button
              type="button"
              onClick={resetImport}
              disabled={isConfirming}
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-slate-950 disabled:opacity-50"
            >
              <RefreshCcw className="h-4 w-4" />
              בחירת קובץ אחר
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <PreviewCard
              label="חומרים חדשים"
              value={preview.newCount}
              className="text-emerald-600"
            />

            <PreviewCard
              label="חומרים שיעודכנו"
              value={preview.updatedCount}
              className="text-blue-600"
            />

            <PreviewCard
              label="ללא שינוי"
              value={preview.unchangedCount}
              className="text-slate-700"
            />

            <PreviewCard
              label="יהפכו ללא פעילים"
              value={preview.inactiveCount}
              className="text-orange-600"
            />

            <PreviewCard
              label="שורות לא תקינות"
              value={preview.invalidCount}
              className="text-red-600"
            />
          </div>

          {preview.errors.length > 0 && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="h-5 w-5" />
                שורות שלא ייובאו
              </div>

              <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
                {preview.errors.slice(0, 20).map((error, index) => (
                  <div
                    key={`${error.row}-${error.message}-${index}`}
                    className="rounded-lg bg-white/70 px-3 py-2 text-sm text-amber-900"
                  >
                    שורה {error.row}: {error.message}
                  </div>
                ))}

                {preview.errors.length > 20 && (
                  <p className="text-sm font-medium text-amber-800">
                    קיימות עוד {preview.errors.length - 20} שגיאות
                    שאינן מוצגות כאן.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={resetImport}
              disabled={isConfirming}
              className="font-bold"
            >
              ביטול
            </Button>

            <Button
              type="button"
              onClick={handleConfirmImport}
              disabled={
                isConfirming ||
                preview.items.length === 0
              }
              className="min-w-40 gap-2 font-bold"
            >
              {isConfirming ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  מסנכרן...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  אישור סנכרון
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="border-t border-emerald-200 bg-emerald-50 p-8">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" />

            <div className="flex-1">
              <h3 className="text-lg font-extrabold text-emerald-900">
                הסנכרון הסתיים בהצלחה
              </h3>

              <div className="mt-4 grid gap-3 text-sm text-emerald-900 sm:grid-cols-2 xl:grid-cols-5">
                <ResultItem
                  label="נוספו"
                  value={result.insertedRows}
                />

                <ResultItem
                  label="עודכנו"
                  value={result.updatedRows}
                />

                <ResultItem
                  label="ללא שינוי"
                  value={result.unchangedRows}
                />

                <ResultItem
                  label="הפכו ללא פעילים"
                  value={result.inactiveRows}
                />

                <ResultItem
                  label="לא תקינים"
                  value={result.invalidRows}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setResult(null)}
              aria-label="סגירת סיכום הסנכרון"
              className="rounded-md p-1 text-emerald-700 transition hover:bg-emerald-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function PreviewCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className={`text-3xl font-extrabold ${className}`}>
        {value}
      </p>

      <p className="mt-2 text-sm font-medium text-slate-500">
        {label}
      </p>
    </div>
  );
}

function ResultItem({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-white/70 px-4 py-3">
      <span className="font-extrabold">{value}</span>
      <span className="mr-2">{label}</span>
    </div>
  );
}
