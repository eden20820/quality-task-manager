"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
} from "lucide-react";

import {
  createExpiryItem,
  updateExpiryItem,
} from "@/app/expiry/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ExpiryRow = {
  id: string;
  material: string;
  expiry: string;
  quantity: number | null;
  location: string;
  daysLeft: number;
  isRejected?: boolean;
};

type Filter = "all" | "expired" | "30" | "90";

type Props = {
  rows: ExpiryRow[];
};

type FormMode = "create" | "edit";

type MaterialFormValues = {
  id: string;
  material: string;
  expiry: string;
  quantity: string;
  location: string;
  isRejected: boolean;
};

const emptyForm: MaterialFormValues = {
  id: "",
  material: "",
  expiry: "",
  quantity: "",
  location: "",
  isRejected: false,
};

function displayDateToInputDate(value: string) {
  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4})$/
  );

  if (!match) {
    return "";
  }

  const [, day, month, year] = match;

  return `${year}-${month}-${day}`;
}

function getDaysText(daysLeft: number) {
  if (daysLeft === 9999) {
    return "ללא תאריך";
  }

  if (daysLeft < 0) {
    return `פג לפני ${Math.abs(daysLeft)} ימים`;
  }

  if (daysLeft === 0) {
    return "פג היום";
  }

  return `${daysLeft} ימים`;
}

function getRowClass(daysLeft: number) {
  if (daysLeft === 9999) {
    return "";
  }

  if (daysLeft < 0) {
    return "bg-red-50";
  }

  if (daysLeft <= 30) {
    return "bg-orange-50";
  }

  if (daysLeft <= 90) {
    return "bg-yellow-50";
  }

  return "";
}

export function ExpiryTable({ rows }: Props) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<Filter>("all");

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [formMode, setFormMode] =
    useState<FormMode>("create");

  const [formValues, setFormValues] =
    useState<MaterialFormValues>(emptyForm);

  const [message, setMessage] = useState("");
  const [isPending, startTransition] =
    useTransition();

  const filteredRows = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        row.material
          .toLowerCase()
          .includes(normalizedSearch) ||
        row.location
          .toLowerCase()
          .includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      switch (filter) {
        case "expired":
          return row.daysLeft < 0;

        case "30":
          return (
            row.daysLeft >= 0 &&
            row.daysLeft <= 30
          );

        case "90":
          return (
            row.daysLeft > 30 &&
            row.daysLeft <= 90
          );

        default:
          return true;
      }
    });
  }, [rows, search, filter]);

  const expiredCount = rows.filter(
    (row) => row.daysLeft < 0
  ).length;

  function openCreateDialog() {
    setFormMode("create");
    setFormValues(emptyForm);
    setMessage("");
    setDialogOpen(true);
  }

  function openEditDialog(row: ExpiryRow) {
    setFormMode("edit");

    setFormValues({
      id: row.id,
      material: row.material,
      expiry: displayDateToInputDate(row.expiry),
      quantity:
        row.quantity === null
          ? ""
          : String(row.quantity),
      location: row.location,
      isRejected: row.isRejected ?? false,
    });

    setMessage("");
    setDialogOpen(true);
  }

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const formData = new FormData(
      event.currentTarget
    );

    if (formMode === "edit") {
      formData.set("item_id", formValues.id);
    }

    formData.set(
      "is_rejected",
      formValues.isRejected ? "true" : "false"
    );

    setMessage("");

    startTransition(async () => {
      const result =
        formMode === "create"
          ? await createExpiryItem(formData)
          : await updateExpiryItem(formData);

      if (!result.success) {
        setMessage(result.message);
        return;
      }

      setDialogOpen(false);
      setFormValues(emptyForm);
      router.refresh();
    });
  }

  function exportToCsv() {
    const header = [
      "חומר",
      "תאריך תפוגה",
      "כמות",
      "מיקום",
      "נותרו",
    ];

    const csvRows = filteredRows.map((row) => [
      row.material,
      row.expiry,
      row.quantity ?? "",
      row.location,
      getDaysText(row.daysLeft),
    ]);

    const csv = [header, ...csvRows]
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell).replace(
              /"/g,
              '""'
            );

            return `"${value}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [`\uFEFF${csv}`],
      {
        type: "text/csv;charset=utf-8",
      }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "expiry-materials.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="space-y-5">
        {expiredCount > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />

            <span className="font-semibold text-red-700">
              קיימים {expiredCount} חומרים שפג
              תוקפם
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm">
          <div className="relative w-full max-w-sm">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <Input
              className="pr-10"
              placeholder="חיפוש לפי חומר או מיקום..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={
                filter === "all"
                  ? "default"
                  : "outline"
              }
              onClick={() => setFilter("all")}
            >
              הכל
            </Button>

            <Button
              type="button"
              variant={
                filter === "expired"
                  ? "default"
                  : "outline"
              }
              onClick={() =>
                setFilter("expired")
              }
            >
              פגי תוקף
            </Button>

            <Button
              type="button"
              variant={
                filter === "30"
                  ? "default"
                  : "outline"
              }
              onClick={() => setFilter("30")}
            >
              עד 30 יום
            </Button>

            <Button
              type="button"
              variant={
                filter === "90"
                  ? "default"
                  : "outline"
              }
              onClick={() => setFilter("90")}
            >
              עד 90 יום
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.refresh()}
            >
              <RefreshCcw className="ml-2 h-4 w-4" />
              רענון
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={exportToCsv}
              disabled={filteredRows.length === 0}
            >
              <Download className="ml-2 h-4 w-4" />
              ייצוא
            </Button>

            <Button
              type="button"
              onClick={openCreateDialog}
            >
              <Plus className="ml-2 h-4 w-4" />
              הוסף חומר
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-right font-bold">
                  חומר
                </TableHead>

                <TableHead className="text-right font-bold">
                  תפוגה
                </TableHead>

                <TableHead className="text-right font-bold">
                  נותרו
                </TableHead>

                <TableHead className="text-right font-bold">
                  כמות
                </TableHead>

                <TableHead className="text-right font-bold">
                  מיקום
                </TableHead>

                <TableHead className="w-28 text-center font-bold">
                  פעולות
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={`${getRowClass(
                      row.daysLeft
                    )} transition hover:bg-slate-100`}
                  >
                    <TableCell className="font-semibold">
                      {row.material}

                      {row.isRejected && (
                        <span className="mr-2 rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                          נפסל
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      {row.expiry}
                    </TableCell>

                    <TableCell>
                      {getDaysText(row.daysLeft)}
                    </TableCell>

                    <TableCell>
                      {row.quantity ?? "—"}
                    </TableCell>

                    <TableCell>
                      {row.location || "—"}
                    </TableCell>

                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          openEditDialog(row)
                        }
                      >
                        <Pencil className="ml-2 h-4 w-4" />
                        עריכה
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-48 text-center text-slate-500"
                  >
                    לא נמצאו חומרים התואמים לחיפוש
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-sm font-medium text-slate-500">
          מוצגות {filteredRows.length} מתוך{" "}
          {rows.length} רשומות
        </p>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!isPending) {
            setDialogOpen(open);
          }
        }}
      >
        <DialogContent
          dir="rtl"
          className="sm:max-w-xl"
        >
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-right text-2xl font-extrabold">
                {formMode === "create"
                  ? "הוספת חומר"
                  : "עריכת חומר"}
              </DialogTitle>

              <DialogDescription className="text-right">
                מלא את פרטי החומר ושמור את
                השינויים.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="material_name"
                  className="font-bold"
                >
                  שם החומר
                </label>

                <Input
                  id="material_name"
                  name="material_name"
                  required
                  value={formValues.material}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      material: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="expiry_date"
                    className="font-bold"
                  >
                    תאריך תפוגה
                  </label>

                  <Input
                    id="expiry_date"
                    name="expiry_date"
                    type="date"
                    required
                    value={formValues.expiry}
                    onChange={(event) =>
                      setFormValues(
                        (current) => ({
                          ...current,
                          expiry:
                            event.target.value,
                        })
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="quantity"
                    className="font-bold"
                  >
                    כמות
                  </label>

                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min="0"
                    step="any"
                    value={formValues.quantity}
                    onChange={(event) =>
                      setFormValues(
                        (current) => ({
                          ...current,
                          quantity:
                            event.target.value,
                        })
                      )
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="location"
                  className="font-bold"
                >
                  מיקום
                </label>

                <Input
                  id="location"
                  name="location"
                  value={formValues.location}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={formValues.isRejected}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      isRejected:
                        event.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-slate-950"
                />

                <span className="font-bold">
                  סמן כחומר שנפסל
                </span>
              </label>

              {message && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                  {message}
                </div>
              )}
            </div>

            <DialogFooter className="mt-7 gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  setDialogOpen(false)
                }
              >
                ביטול
              </Button>

              <Button
                type="submit"
                disabled={isPending}
                className="min-w-32 gap-2 font-bold"
              >
                {isPending && (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                )}

                {isPending
                  ? "שומר..."
                  : formMode === "create"
                    ? "הוסף חומר"
                    : "שמור שינויים"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}