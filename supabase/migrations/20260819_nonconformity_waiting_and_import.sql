alter table public.quality_followups
  drop constraint if exists quality_followups_status_check;

alter table public.quality_followups
  add constraint quality_followups_status_check
  check (
    status in ('open', 'closed')
    or (category = 'nonconformity' and status = 'waiting')
  );

with creator as (
  select id
  from public.profiles
  where lower(email) = 'eden@caeli.pro'
  limit 1
), source(reference_number, name, opened_at, status, closed_at, notes) as (
  values
    ('001-2026', 'אי התאמה חקירה מטולרנסים אין את גריז', date '2026-01-01', 'closed', date '2026-03-18', 'תלונת ספק: כן; תלונת לקוח: N/A; פעולה: במשלוח הבא של חלקי בדיקה והרכבה; תאריך בדיקת אפקטיביות בפועל: 25.02.2026'),
    ('002-2026', 'אי התאמה חלקי ריאה פלסטומולד', date '2026-01-08', 'closed', date '2026-04-20', 'תלונת ספק: כן; תלונת לקוח: N/A; פעולה: בעת קבלת המוצרים הנ״ל חלקי ריאה במשלוח הבא; תאריך בדיקת אפקטיביות בפועל: 16.04.2026'),
    ('003-2026', 'אי התאמה חלקי דרגה שנייה ווירטיים', date '2026-03-30', 'closed', date '2026-04-23', 'תלונת ספק: כן; תלונת לקוח: N/A; פעולה: בעת קבלת מוצרים לאחר תיקון ובמנת ייצור נוספת; תאריך בדיקת אפקטיביות בפועל: 16.04.2026'),
    ('004-2026', 'אי התאמה פקק ראש קניסטר LMI', date '2026-03-31', 'closed', date '2026-04-15', 'תלונת ספק: כן; תלונת לקוח: N/A; פעולה: במשלוח הבא של חלקי תלת מימד - לא רלוונטי ראש קניסטר שונה מעודכן ב-ECO 021-2026; תאריך בדיקת אפקטיביות בפועל: 18.08.2026'),
    ('005-2026', 'אי התאמה טקסטיל טרנטולה', date '2026-03-31', 'closed', date '2026-04-09', 'תלונת ספק: כן; תלונת לקוח: N/A; פעולה: במשלוח הבא של טקסטיל; תאריך בדיקת אפקטיביות בפועל: 20.04.2026'),
    ('006-2026', 'אי התאמה מפוחים בנטל', date '2026-04-19', 'closed', date '2026-07-20', 'תלונת ספק: כן; תלונת לקוח: N/A; פעולה: N/A; תאריך בדיקת אפקטיביות בפועל: N/A'),
    ('007-2026', 'אי התאמה מרצון בית משאבה', date '2026-04-23', 'waiting', null, 'תלונת ספק: כן; תלונת לקוח: N/A; מצב מקור: ממתין לאפקטיביות; תאריך סגירת טיפול: 11.06.2026; פעולה: במשלוח הבא של חלקי בית משאבה'),
    ('008-2026', 'אי התאמה סוללה מאירסל', date '2026-05-26', 'closed', date '2026-06-18', 'תלונת ספק: כן; תלונת לקוח: N/A; פעולה: בבדיקה של הסוללות שיחזרו, נבדקו ביום 22.06.2026 ונמצאו תקינות; תאריך בדיקת אפקטיביות בפועל: 22.06.2026'),
    ('009-2026', 'אי התאמה קופסת סוללה', date '2026-06-15', 'waiting', null, 'תלונת ספק: כן; תלונת לקוח: N/A; מצב מקור: ממתין לאפקטיביות; תאריך סגירת טיפול: 15.07.2026; פעולה: בקבלת סחורה הבאה של מארזי סוללות מערכת HLH'),
    ('010-2026', 'אי התאמה מערכת קירור', date '2026-07-21', 'waiting', null, 'תלונת ספק: כן; תלונת לקוח: N/A; מצב מקור: ממתין לאפקטיביות; תאריך סגירת טיפול: 22.07.2026; פעולה: בקבלת משלוח חדש לאחר הדפסה של כנפית ועיבוד של LMI'),
    ('012-2026', 'אי התאמה ריאה', date '2026-08-18', 'waiting', null, 'תלונת ספק: לא; תלונת לקוח: N/A; מצב מקור: ממתין לתיקון ואפקטיביות; פעולה: לאחר התיקון')
)
insert into public.quality_followups (
  category, reference_number, name, quantity, opened_at, status, closed_at,
  notes, created_by, assignee_key, alerts_enabled
)
select
  'nonconformity', source.reference_number, source.name, null, source.opened_at,
  source.status, source.closed_at, source.notes, creator.id, null, true
from source
cross join creator
on conflict (category, reference_number) do update
set
  name = excluded.name,
  opened_at = excluded.opened_at,
  status = excluded.status,
  closed_at = excluded.closed_at,
  notes = coalesce(public.quality_followups.notes, excluded.notes),
  updated_at = now();
