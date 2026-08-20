"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Gauge, ListChecks, Plus, Trash2, Truck } from "lucide-react";

import { createReminder, deleteReminder, type ReminderActionResult } from "@/app/calendar/actions";
import { reminderOccursOn, type RecurringReminder } from "@/lib/reminders/recurrence";

export type CalendarTask = { id: string; title: string; due_date: string; priority: string };
export type Reminder = RecurringReminder & { id: string; title: string; notes: string | null };
export type CalendarCalibration = { id: string; equipment_name: string; equipment_code: string | null; location: string | null; next_calibration_date: string };
export type CalendarFollowup = { id: string; category: "pka" | "nonconformity" | "eco"; reference_number: string; name: string | null; quantity: number | null; opened_at: string; created_at: string };
export type CalendarSupplier = { id: string; supplier_name: string; product_service: string | null; certification_type: string | null; expiration_date: string };

const initialState: ReminderActionResult = { success: false, message: "" };
const weekDays = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function CalendarView({ initialMonth, tasks, reminders, calibrations, followups, suppliers }: { initialMonth: string; tasks: CalendarTask[]; reminders: Reminder[]; calibrations: CalendarCalibration[]; followups: CalendarFollowup[]; suppliers: CalendarSupplier[] }) {
  const month = useMemo(() => {
    const [year, monthNumber] = initialMonth.split("-").map(Number);
    return new Date(year, monthNumber - 1, 1);
  }, [initialMonth]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth()
      ? dateKey(today)
      : dateKey(month);
  });
  const [state, formAction, pending] = useActionState(createReminder, initialState);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
  }, [month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, { tasks: CalendarTask[]; reminders: Reminder[]; calibrations: CalendarCalibration[]; followups: CalendarFollowup[]; suppliers: CalendarSupplier[] }>();
    const get = (key: string) => map.get(key) ?? { tasks: [], reminders: [], calibrations: [], followups: [], suppliers: [] };
    tasks.forEach((task) => { const value = get(task.due_date); value.tasks.push(task); map.set(task.due_date, value); });
    reminders.forEach((reminder) => {
      cells.forEach((day) => {
        const key = dateKey(day);
        if (!reminderOccursOn(reminder, key)) return;
        const value = get(key); value.reminders.push(reminder); map.set(key, value);
      });
    });
    calibrations.forEach((item) => { const value = get(item.next_calibration_date); value.calibrations.push(item); map.set(item.next_calibration_date, value); });
    suppliers.forEach((item) => { const value = get(item.expiration_date); value.suppliers.push(item); map.set(item.expiration_date, value); });
    followups.forEach((item) => {
      const created = new Date(item.created_at);
      const createdDay = new Date(created.getFullYear(), created.getMonth(), created.getDate());
      cells.forEach((day) => {
        const daysSinceCreated = Math.round((day.getTime() - createdDay.getTime()) / 86_400_000);
        if (daysSinceCreated < 7 || daysSinceCreated % 7 !== 0) return;
        const key = dateKey(day);
        const value = get(key); value.followups.push(item); map.set(key, value);
      });
    });
    return map;
  }, [tasks, reminders, calibrations, followups, suppliers, cells]);

  const selectedEvents = eventsByDate.get(selectedDate) ?? { tasks: [], reminders: [], calibrations: [], followups: [], suppliers: [] };

  return <div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-3xl font-extrabold sm:text-4xl">יומן ותזכורות</h2><p className="mt-2 text-base text-slate-500 sm:text-lg">משימות עם דדליין ותזכורות שהוספת ידנית</p></div>
      <Link href="/calendar" className="rounded-lg border bg-white px-4 py-2 font-bold hover:bg-slate-50">חזרה להיום</Link>
    </div>

    <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b p-3 sm:p-5">
          <Link aria-label="החודש הבא" href={`/calendar?month=${monthKey(new Date(month.getFullYear(), month.getMonth() + 1, 1))}`} className="rounded-lg p-2 hover:bg-slate-100"><ChevronRight /></Link>
          <h3 className="text-base font-extrabold sm:text-xl">{new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(month)}</h3>
          <Link aria-label="החודש הקודם" href={`/calendar?month=${monthKey(new Date(month.getFullYear(), month.getMonth() - 1, 1))}`} className="rounded-lg p-2 hover:bg-slate-100"><ChevronLeft /></Link>
        </div>
        <div className="grid grid-cols-7 border-b bg-slate-50">{weekDays.map((day) => <div key={day} className="p-1.5 text-center text-xs font-bold text-slate-500 sm:p-3 sm:text-sm">{day}</div>)}</div>
        <div className="grid grid-cols-7">{cells.map((day) => {
          const key = dateKey(day); const events = eventsByDate.get(key); const currentMonth = day.getMonth() === month.getMonth(); const today = key === dateKey(new Date());
          const eventCount = (events?.tasks.length ?? 0) + (events?.reminders.length ?? 0) + (events?.calibrations.length ?? 0) + (events?.followups.length ?? 0) + (events?.suppliers.length ?? 0);
          return <button key={key} aria-label={`${day.getDate()} בחודש, ${eventCount} אירועים`} onClick={() => setSelectedDate(key)} className={`min-h-16 min-w-0 border-b border-l p-1 text-right transition hover:bg-blue-50 sm:min-h-28 sm:p-2 ${selectedDate === key ? "bg-blue-50 ring-2 ring-inset ring-blue-500" : ""} ${currentMonth ? "" : "bg-slate-50 text-slate-400"}`}>
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:h-7 sm:w-7 sm:text-sm ${today ? "bg-blue-600 text-white" : ""}`}>{day.getDate()}</span>
            <div className="mt-1 flex flex-wrap justify-center gap-1 sm:hidden">{events?.tasks.length ? <i className="h-2 w-2 rounded-full bg-amber-400" /> : null}{events?.reminders.length ? <i className="h-2 w-2 rounded-full bg-blue-500" /> : null}{events?.calibrations.length ? <i className="h-2 w-2 rounded-full bg-emerald-500" /> : null}{events?.suppliers.length ? <i className="h-2 w-2 rounded-full bg-violet-500" /> : null}{events?.followups.length ? <i className="h-2 w-2 rounded-full bg-red-500" /> : null}{eventCount > 2 ? <span className="text-[9px] font-bold text-slate-500">+{eventCount}</span> : null}</div>
            <div className="mt-2 hidden space-y-1 sm:block">{events?.tasks.slice(0, 1).map((task) => <div key={task.id} className="truncate rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">{task.title}</div>)}{events?.reminders.slice(0, 1).map((item) => <div key={item.id} className="truncate rounded bg-blue-100 px-2 py-1 text-xs font-bold text-blue-900">{item.title}</div>)}{events?.calibrations.slice(0, 1).map((item) => <div key={item.id} className="truncate rounded bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-900">כיול: {item.equipment_name}</div>)}{events?.suppliers.slice(0, 1).map((item) => <div key={item.id} className="truncate rounded bg-violet-100 px-2 py-1 text-xs font-bold text-violet-900">תוקף ספק: {item.supplier_name}</div>)}{events?.followups.slice(0, 1).map((item) => <div key={item.id} className="truncate rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-900">התראה: {item.reference_number}</div>)}</div>
          </button>;
        })}</div>
      </section>

      <aside className="flex flex-col gap-5">
        <section className="order-2 rounded-2xl border bg-white p-5 shadow-sm xl:order-1">
          <h3 className="flex items-center gap-2 text-xl font-extrabold"><Plus className="h-5 w-5" /> תזכורת חדשה</h3>
          <form action={formAction} className="mt-4 space-y-3">
            <input name="title" required placeholder="מה להזכיר?" className="h-11 w-full rounded-lg border px-3" />
            <input name="reminder_date" type="date" required defaultValue={selectedDate} key={selectedDate} className="h-11 w-full rounded-lg border px-3" />
            <select name="repeat" defaultValue="none" className="h-11 w-full rounded-lg border bg-white px-3">
              <option value="none">ללא חזרה</option>
              <option value="daily">כל יום</option>
              <option value="monthly">כל חודש</option>
              <option value="quarterly">כל 3 חודשים</option>
              <option value="semiannual">כל 6 חודשים</option>
              <option value="yearly">כל שנה</option>
            </select>
            <textarea name="notes" placeholder="הערה (לא חובה)" rows={3} className="w-full rounded-lg border p-3" />
            <button disabled={pending} className="h-11 w-full rounded-lg bg-slate-950 font-bold text-white disabled:opacity-50">{pending ? "שומר..." : "הוסף תזכורת"}</button>
            {state.message && <p className={`text-sm font-bold ${state.success ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>}
          </form>
        </section>
        <section className="order-1 rounded-2xl border bg-white p-5 shadow-sm xl:order-2">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold"><CalendarDays className="h-5 w-5" /> {new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${selectedDate}T12:00:00`))}</h3>
          <div className="space-y-3">
            {selectedEvents.tasks.map((task) => <Link key={task.id} href={`/tasks/${task.id}/edit`} className="block rounded-xl border-r-4 border-amber-400 bg-amber-50 p-3 hover:bg-amber-100"><span className="flex items-center gap-2 font-bold"><ClipboardList className="h-4 w-4" />{task.title}</span><span className="mt-1 block text-xs text-slate-500">דדליין של משימה</span></Link>)}
            {selectedEvents.reminders.map((item) => <div key={item.id} className="rounded-xl border-r-4 border-blue-500 bg-blue-50 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-bold">{item.title}</p>{item.notes && <p className="mt-1 text-sm text-slate-600">{item.notes}</p>}</div><form action={deleteReminder.bind(null, item.id)}><button aria-label="מחק תזכורת" className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-600"><Trash2 className="h-4 w-4" /></button></form></div></div>)}
            {selectedEvents.calibrations.map((item) => <Link key={item.id} href="/calibrations" className="block rounded-xl border-r-4 border-emerald-500 bg-emerald-50 p-3"><p className="flex items-center gap-2 font-bold"><Gauge className="h-4 w-4" />כיול: {item.equipment_name}</p><p className="mt-1 text-xs text-slate-500">{[item.equipment_code, item.location].filter(Boolean).join(" • ") || "מועד כיול"}</p></Link>)}
            {selectedEvents.suppliers.map((item) => <Link key={item.id} href="/suppliers" className="block rounded-xl border-r-4 border-violet-500 bg-violet-50 p-3"><p className="flex items-center gap-2 font-bold"><Truck className="h-4 w-4" />תוקף ספק: {item.supplier_name}</p><p className="mt-1 text-xs text-slate-500">{[item.product_service, item.certification_type].filter(Boolean).join(" • ") || "תוקף הסמכת ספק"}</p></Link>)}
            {selectedEvents.followups.map((item) => <Link key={item.id} href="/followups" className="block rounded-xl border-r-4 border-red-500 bg-red-50 p-3"><p className="flex items-center gap-2 font-bold"><ListChecks className="h-4 w-4" />התראת {item.category === "pka" ? 'פק״ע' : item.category === "eco" ? "ECO" : "אי התאמה"}: {item.reference_number}{item.name ? ` — ${item.name}` : ""}</p>{item.category === "pka" && item.quantity !== null && <p className="mt-1 text-xs text-slate-600">כמות: {item.quantity}</p>}<p className="mt-1 text-xs text-red-600">לא נסגרה בתוך שבוע</p></Link>)}
            {!selectedEvents.tasks.length && !selectedEvents.reminders.length && !selectedEvents.calibrations.length && !selectedEvents.suppliers.length && !selectedEvents.followups.length && <p className="py-5 text-center text-sm text-slate-500">אין אירועים בתאריך הזה</p>}
          </div>
        </section>
      </aside>
    </div>
    <div className="flex flex-wrap gap-5 text-sm font-semibold text-slate-600"><span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-amber-300" /> משימה עם דדליין</span><span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-blue-300" /> תזכורת ידנית</span><span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-emerald-300" /> כיול</span><span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-violet-300" /> תוקף ספק</span><span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-red-300" /> התראת מעקב</span></div>
  </div>;
}
