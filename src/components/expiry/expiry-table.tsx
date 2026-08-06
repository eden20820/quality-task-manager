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
  deleteExpiryItem,
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

type Tab = "all" | "expired" | "upcoming" | "valid";

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
  const [tab, setTab] = useState<Tab>("expired");

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [formMode, setFormMode] =
    useState<FormMode>("create");

  const [formValues, setFormValues] =
    useState<MaterialFormValues>(emptyForm);

  const [message, setMessage] = useState("");
  const [deletingItemId, setDeletingItemId] =
    useState<string | null>(null);

  const [isPending, startTransition] =
    useTransition();

  const counts = useMemo(() => {
    return {
      all: rows.length,
      expired: rows.filter(
        (row) => row.daysLeft < 0
      ).length,
      upcoming: rows.filter(
        (row) =>
          row.daysLeft >= 0 &&
          row.daysLeft <= 90
      ).length,
      valid: rows.filter(
        (row) => row.daysLeft > 90
      ).length,
    };
  }, [rows]);

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

      switch (tab) {
        case "expired":
          return row.daysLeft < 0;

        case "upcoming":
          return (
            row.daysLeft >= 0 &&
            row.daysLeft <= 90
          );

        case "valid":
          return row.daysLeft > 90;

        default:
          return true;
      }
    });
  }, [rows, search, tab]);

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

  function handleDelete(row: ExpiryRow) {
    const confirmed = window.confirm(
      `האם למחוק את החומר "${row.material}"?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingItemId(row.id);
    setMessage("");

    startTransition(async () => {
      const result = await deleteExpiryItem(
        row.id
      );

      if (!result.success) {
        window.alert(result.message);
        setDeletingItemId(null);
        return;
      }

      setDeletingItemId(null);
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

  const tabs: {
    key: Tab;
    label: string;
    count: number;
  }[] = [
    {
      key: "expired",
      label: "פגי תוקף",
      count: counts.expired,
    },
    {
      key: "upcoming",
      label: "עד 90 יום",
      count: counts.upcoming,
    },
    {
      key: "valid",
      label: "מעל 90 יום",
      count: counts.valid,
    },
    {
      key: "all",
      label: "הכול",
      count: counts.all,
    },
  ];

  return (
    <>
      <div className="space-y-5">
        {counts.expired > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />

            <span className="font-semibold text-red-700">
              קיימים {counts.expired} חומרים שפג
              תוקפם
            </span>
          </div>
        )}

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
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
                disabled={
                  filteredRows.length === 0
                }
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

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
                  tab === item.key
                    ? "bg-slate-950 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{item.label}</span>

                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    tab === item.key
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.count}
                </span>
              </button>
            ))}
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

                <TableHead className="w-44 text-center font-bold">
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

                    <TableCell>
                      <div className="flex justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            deletingItemId === row.id
                          }
                          onClick={() =>
                            openEditDialog(row)
                          }
                        >
                          <Pencil className="ml-2 h-4 w-4" />
                          עריכה
                        </Button>

                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={
                            deletingItemId === row.id
                          }
                          onClick={() =>
                            handleDelete(row)
                          }
                        >
                          {deletingItemId ===
                          row.id ? (
                            <>
                              <LoaderCircle className="ml-2 h-4 w-4 animate-spin" />
                              מוחק...
                            </>
                          ) : (
                            "מחק"
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-48 text-center text-slate-500"
                  >
                    אין חומרים בכרטיסייה הזו
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
                      material:
                        event.target.value,
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
                      location:
                        event.target.value,
                    }))
                  }
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={
                    formValues.isRejected
                  }
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