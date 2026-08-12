import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createTask } from "@/app/tasks/new/actions";

export default function NewTaskPage() {
  return (
    <>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h2 className="text-4xl font-extrabold">משימה חדשה</h2>
          <p className="mt-2 text-lg text-slate-500">
            הזן את פרטי המשימה ושייך אותה לעובדים הרלוונטיים
          </p>
        </div>

        <form
          action={createTask}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <div className="space-y-2">
            <label htmlFor="title" className="text-base font-bold">
              כותרת המשימה
            </label>

            <Input
              id="title"
              name="title"
              required
              placeholder="לדוגמה: בדיקת חלק CNC"
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-base font-bold">
              תיאור
            </label>

            <textarea
              id="description"
              name="description"
              placeholder="פרט מה נדרש לבצע"
              className="min-h-36 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-base font-bold">סטטוס</label>

              <Select name="status" defaultValue="new">
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>

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
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>

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
              <label htmlFor="due_date" className="text-base font-bold">
                תאריך יעד
              </label>

              <Input
                id="due_date"
                name="due_date"
                type="date"
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <label className="text-base font-bold">אחראים</label>

              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <label className="flex items-center gap-3 text-base">
                  <input
                    name="assignees"
                    value="eden"
                    type="checkbox"
                    defaultChecked
                    className="h-5 w-5"
                  />
                  <span>עדן</span>
                </label>

                <label className="flex items-center gap-3 text-base">
                  <input
                    name="assignees"
                    value="sergey"
                    type="checkbox"
                    defaultChecked
                    className="h-5 w-5"
                  />
                  <span>סרגיי</span>
                </label>

                <label className="flex items-center gap-3 text-base">
                  <input
                    name="assignees"
                    value="quality_manager"
                    type="checkbox"
                    className="h-5 w-5"
                  />
                  <span>מנהל איכות</span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="files" className="text-base font-bold">
              קבצים מצורפים
            </label>

            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-base font-bold text-slate-700">
                בחר קבצים לצירוף למשימה
              </p>

              <p className="mt-2 text-sm text-slate-500">
                תמונות, PDF, Word או Excel — עד 10MB לקובץ
              </p>

              <Input
                id="files"
                name="files"
                type="file"
                multiple
                className="mx-auto mt-5 max-w-md cursor-pointer bg-white"
              />
            </div>
          </div>

          <div className="flex justify-start gap-3 border-t border-slate-200 pt-6">
            <SubmitButton
              idleText="שמור משימה"
              pendingText="שומר משימה..."
            />

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="px-8 text-base font-bold"
            >
              ביטול
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}


