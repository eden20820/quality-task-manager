alter table public.portal_settings
  add column if not exists supplier_alerts_enabled boolean not null default true;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_number text,
  sort_order integer,
  supplier_name text not null check (char_length(trim(supplier_name)) between 1 and 300),
  product_service text,
  has_certification boolean not null default false,
  has_experience boolean not null default false,
  status text not null default 'Approved',
  certification_type text,
  expiration_date date,
  delivery_score numeric(4,2) check (delivery_score between 0 and 10),
  quality_score numeric(4,2) check (quality_score between 0 and 10),
  professionalism_score numeric(4,2) check (professionalism_score between 0 and 10),
  requirements_score numeric(4,2) check (requirements_score between 0 and 10),
  weighted_score numeric(4,2) check (weighted_score between 0 and 10),
  notes text,
  import_key text unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_expiration_date_idx on public.suppliers (expiration_date asc);
create index if not exists suppliers_name_idx on public.suppliers (supplier_name);
create index if not exists suppliers_created_by_idx on public.suppliers (created_by);

alter table public.suppliers enable row level security;
grant select, insert, update, delete on public.suppliers to authenticated;

create policy "Active users can read suppliers" on public.suppliers
for select to authenticated
using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));

create policy "Active users can add suppliers" on public.suppliers
for insert to authenticated
with check (created_by = (select auth.uid()) and exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));

create policy "Active users can update suppliers" on public.suppliers
for update to authenticated
using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active))
with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));

create policy "Active users can delete suppliers" on public.suppliers
for delete to authenticated
using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));

insert into public.suppliers (
  supplier_number, supplier_name, product_service, has_certification, has_experience,
  status, certification_type, expiration_date, delivery_score, quality_score,
  professionalism_score, requirements_score, weighted_score, notes, import_key
)
values
('1', 'לייזר מודלינג', 'הדפסת תלת מימד', true, true, 'Approved', 'ISO 9001:2015', null, 8, 7, 8, 9, 7.95, null, 'legacy-supplier-001'),
('2', 'טכנו עד', 'אורינגים', true, true, 'Approved', 'ISO 9001:2015 / ISO 14401/ISO 45001/ISO13485', '2028-04-22', 8, 8, 7, 8, 7.85, null, 'legacy-supplier-002'),
('3', 'SMC', 'פנאומטיקה', true, true, 'Approved', 'ISO 9001:2015', '2028-10-05', 8, 9, 8, 8, 8.3, null, 'legacy-supplier-003'),
('4', 'HLH', 'עיבוד שבבי', true, true, 'Approved', 'ISO 9001:2015 / ISO27001', '2027-12-12', 8, 8, 8, 8, 8, null, 'legacy-supplier-004'),
('5', 'PCBWAY', 'אלקטרוניקה', true, true, 'Approved', 'ISO 9001:2015 / ISO13485', '2028-11-28', 7, 8, 8, 8, 7.7, null, 'legacy-supplier-005'),
('6', 'גומי תל אביב', 'גומי לתעשיה', true, true, 'Approved', 'ISO 9001:2015', '2027-01-29', 9, 9, 9, 9, 9, null, 'legacy-supplier-006'),
('7', 'משף אספקה', 'אספקה טכנית', false, true, 'Approved', 'NA', null, 9, 9, 9, 9, 9, null, 'legacy-supplier-007'),
('8', 'DIGITKEY', 'אלקטרוניקה', true, true, 'Approved', 'ISO9001:2015', '2029-04-06', 9, 9, 8, 9, 8.85, null, 'legacy-supplier-008'),
('9', 'ARROW', 'צנרת פנאומטית', true, true, 'Approved', 'ISO 9001:2015/ISO13485', '2027-11-13', 8, 8, 9, 8, 8.15, null, 'legacy-supplier-009'),
('10', 'מגן אופטיק', 'פילטרים', true, true, 'Approved', 'ISO 9001:2015', '2029-01-19', 9, 8, 8, 8, 8.3, null, 'legacy-supplier-010'),
('11', 'AMPHENOL', 'כבלים וקונקטורים', true, true, 'Approved', 'ISO 9001:2015', '2027-09-04', 9, 9, 9, 9, 9, null, 'legacy-supplier-011'),
('12', 'טלדור', 'כבלים', true, true, 'Approved', 'ISO 9001:2015/ISO45001/ISO14001', '2027-12-30', 9, 8, 9, 8, 8.45, null, 'legacy-supplier-012'),
('13', 'וולפסון סיליקון', 'מוצרי סיליקון', true, true, 'Approved', 'ISO 13485:2016/ISO9001:2015', '2029-05-12', 8, 8, 8, 8, 8, null, 'legacy-supplier-013'),
('14', 'AGFRC', 'מנועי סרוו', false, true, 'Approved', 'CE-EMC/FCC SDOC', null, 9, 9, 9, 9, 9, null, 'legacy-supplier-014'),
('15', 'בנטל', 'בלאוורים', true, true, 'Approved', 'ISO 9001:2015', '2029-06-08', 8, 8, 9, 8, 8.15, null, 'legacy-supplier-015'),
('16', 'דקו סטופ -קריטי', 'מילוי חמצן', false, true, 'Approved', 'מוסמך לדחיסת חמצן משרד התרבות והספורט', '2026-09-17', 9, 9, 9, 9, 9, 'ספק קריטי', 'legacy-supplier-016'),
('17', 'אילן את גביש', 'CNC וסימולטור', true, true, 'Approved', 'ISO 9001:2015', '2028-11-18', 8, 8, 8, 8, 8, null, 'legacy-supplier-017'),
('18', 'אקסטל', 'קניסטרים CNC', true, true, 'Approved', 'ISO 9001:2015/ISO14001', '2026-09-25', 9, 8, 8, 8, 8.3, null, 'legacy-supplier-018'),
('19', 'אלקון', 'מתמרי לחץ', true, true, 'Approved', 'ISO 9001:2015', '2028-02-16', 9, 9, 9, 9, 9, null, 'legacy-supplier-019'),
('20', 'קמסול', 'מדבקות שיכוך', true, true, 'Approved', 'ISO 9001:2015', '2028-01-29', 8, 8, 7, 8, 7.85, null, 'legacy-supplier-020'),
('21', 'מרעום דולפין', 'טקסטיל ומנשא גב', true, true, 'Approved', 'ISO 9001:2015', '2027-03-18', 8, 8, 8, 8, 8, null, 'legacy-supplier-021'),
('22', 'ארגזי נשיאה', 'ארגזי נשיאה', true, true, 'Approved', 'ISO 9001:2015', '2028-06-12', 9, 9, 9, 9, 9, null, 'legacy-supplier-022'),
('23', 'ק.ש.ר תעשיות', 'מוצרי פלסטיק', true, true, 'Approved', 'ISO 9001:2015', '2027-04-03', 8, 9, 8, 9, 8.55, null, 'legacy-supplier-023'),
('24', 'מחם קשיחים', 'מכאניקה', true, true, 'Approved', 'ISO 9001:2015', '2028-02-09', 8, 9, 8, 9, 8.55, null, 'legacy-supplier-024'),
('25', 'STEELCOAT', 'ציפוי', true, true, 'Approved', 'ISO 9001:2015/AS9100D', '2028-04-15', 9, 9, 8, 8, 8.6, null, 'legacy-supplier-025'),
('26', 'טרנטולה', 'טקסטיל', true, true, 'Approved', 'ISO 9001:2015', '2028-04-07', 9, 9, 9, 9, 9, null, 'legacy-supplier-026'),
('27', 'רוטל דבקים וכימיקלים', 'דבקים תעשייתים', true, true, 'Approved', 'ISO 9001:2015 /ISO14001', '2028-08-27', 8, 8, 8, 8, 8, null, 'legacy-supplier-027'),
('28', 'גט לייזר', 'CNC', true, true, 'Approved', 'ISO 9001:2015', '2027-05-21', 9, 7, 7, 8, 7.85, null, 'legacy-supplier-028'),
('29', 'כנפית', 'הדפסת תלת מימד', true, true, 'Approved', 'ISO 9001:2015/AS9100D', '2027-03-16', 9, 9, 8, 8, 8.6, null, 'legacy-supplier-029'),
('30', 'עידנים פתרונות', 'מדבקות לקסן', true, true, 'Approved', 'ISO 9001:2015', '2027-05-23', 8, 8, 9, 9, 8.4, null, 'legacy-supplier-030'),
('31', 'טיגריס פלסט', 'חלקי ריאה', false, true, 'Approved', 'NA', null, 9, 9, 9, 9, 9, null, 'legacy-supplier-031'),
('32', 'טכנובורג', 'אספקה טכנית', false, true, 'Approved', 'NA', null, 8, 8, 8, 8, 8, null, 'legacy-supplier-032'),
('33', 'רם מחקר ופיתוח- bansbach', 'בוכנות', true, true, 'Approved', 'ISO 9001:2015', '2027-03-03', 8, 9, 8, 8, 8.3, null, 'legacy-supplier-033'),
('34', 'דוגית', 'ציוד צלילה', false, true, 'Approved', 'NA', null, 8, 8, 8, 8, 8, null, 'legacy-supplier-034'),
('35', 'thomas safety', 'תחזוקה למיכלי חמצן', true, true, 'Approved', 'ISO 9001:2015/ISO45001/ISO14001', '2026-09-23', 9, 9, 9, 9, 9, null, 'legacy-supplier-035'),
('36', 'AMS COMPOSITE CYLINDER', 'מיכלי חמצן', true, true, 'Approved', 'ISO 9001:2015', '2027-12-01', 9, 9, 9, 9, 9, null, 'legacy-supplier-036'),
('37', 'שוורץ אלמוג', 'ציפויים', true, true, 'Approved', 'ISO 9001:2015', '2028-05-24', 9, 8, 8, 8, 8.3, null, 'legacy-supplier-037'),
('38', 'גיל גימורים', 'ציפויים', true, true, 'Approved', 'ISO 9001:2015/AS9100D', '2029-05-06', 9, 8, 8, 8, 8.3, null, 'legacy-supplier-038'),
('39', 'כימוגרף', 'צריבה כימית', true, true, 'Approved', 'ISO 9001:2015/ISO13485', '2027-10-13', 8, 8, 8, 8, 8, null, 'legacy-supplier-039'),
('40', 'מאירסל', 'סוללות', true, true, 'Approved', 'ISO 9001:2015/AS9100D', '2028-01-26', 8, 8, 8, 8, 8, null, 'legacy-supplier-040'),
('41', 'פלסטומוד', 'CNC', true, true, 'Approved', 'ISO 9001:2015/ISO13485', '2027-02-26', 8, 8, 8, 8, 8, null, 'legacy-supplier-041'),
('42', 'דפוס נאמן', 'דפוס', false, true, 'Approved', 'NA', null, 8, 8, 8, 8, 8, null, 'legacy-supplier-042'),
('43', 'FEDEX', 'שילוח', true, true, 'Approved', 'ISO 9001:2015', '2027-08-31', 8, 8, 8, 8, 8, null, 'legacy-supplier-043'),
('44', 'DHL', 'שילוח', true, true, 'Approved', 'ISO 9001:2015', '2027-10-03', 8, 8, 8, 8, 8, null, 'legacy-supplier-044'),
('45', 'WAVESHARE-Dongguan Yingsu Electronic Technology', 'מסכי תצוגה אלקטרוניקה', false, true, 'Approved', 'ISO 9001:2015/ISO14001', '2027-08-11', 9, 9, 9, 9, 9, null, 'legacy-supplier-045'),
('46', 'Shenzhen Breton', 'CNC', true, true, 'Approved', 'ISO 9001:2015/ISO13485/IATA16949/ISO27001', '2028-04-14', 9, 9, 9, 9, 9, null, 'legacy-supplier-046'),
('47', 'עמוס גזית', 'כימיכלים', true, true, 'Approved', 'ISO 9001:2015/ISO27001', '2027-02-22', 8, 8, 8, 8, 8, null, 'legacy-supplier-047'),
('48', 'אלכס רד', 'מעבדה', true, true, 'Approved', 'ISO 9001:2015', '2027-08-10', 8, 8, 8, 8, 8, null, 'legacy-supplier-048'),
('49', 'אלקטרוניקה הר ציון', 'מעבדה', true, true, 'Approved', 'ISO 9001:2015', '2027-04-27', 9, 8, 9, 8, 8.45, null, 'legacy-supplier-049'),
('50', 'מבא הזורע', 'כיול', true, true, 'Approved', 'ISO17025/ISO9001', '2028-05-12', 9, 9, 9, 9, 9, null, 'legacy-supplier-050'),
('51', 'זאד הנדסה', 'תחזוקה למנדף', true, true, 'Approved', 'תעודת בודק מוסמך', null, 9, 9, 9, 9, 9, null, 'legacy-supplier-051'),
('52', 'א נין נון מחשבים בעמ', 'מחשוב', false, true, 'Approved', 'NA', null, 10, 10, 9, 10, 9.85, null, 'legacy-supplier-052'),
('53', 'דפוס הטווס', 'הדפסות ומדבקות יח"צ', false, true, 'Approved', 'NA', null, 9, 8, 9, 8, 8.45, null, 'legacy-supplier-053'),
('54', 'טרי פרינט', 'הדפסות על חולצות/ציוד קד"מ', false, true, 'Approved', 'NA', null, 9, 9, 8, 9, 8.85, null, 'legacy-supplier-054'),
('55', 'אלון טכנולוגיות', 'תבניות ועיבוד שבבי', true, true, 'Approved', 'ISO 9001:2015', '2026-12-07', 9, 9, 9, 9, 9, null, 'legacy-supplier-055'),
('56', 'תירוש דגיטל', 'עבודות דפוס ומדבקות', true, false, 'Approved', 'NA', null, 9, 9, 9, 9, 9, null, 'legacy-supplier-056'),
('57', 'מטרולוגי', 'כיול', true, true, 'Approved', 'ISO17025', '2027-04-30', 9, 9, 9, 8, 8.75, null, 'legacy-supplier-057'),
('58', 'סקלר מעבדות', 'כיול', true, true, 'Approved', 'ISO17025', '2026-09-30', 9, 9, 9, 8, 8.75, null, 'legacy-supplier-058'),
('59', 'אבדור חלת', 'ציוד אלקטרוניקה', true, true, 'Approved', 'ISO 9001:2015', '2028-01-09', 9, 9, 9, 8, 8.75, null, 'legacy-supplier-059'),
('60', 'Mouser Electronics', 'חלקי אלקטרוניקה', true, true, 'Approved', 'ISO 9001:2015/iso14001', '2028-09-08', 9, 9, 9, 8, 8.75, null, 'legacy-supplier-060'),
('61', 'מאזני שביט', 'כיול', true, true, 'Approved', 'ISO17025/ISO9001', '2026-11-30', 9, 9, 9, 9, 9, null, 'legacy-supplier-061'),
('62', 'GK Calibration', 'כיול', true, true, 'Approved', 'ISO17025/ISO9001', '2027-12-31', 9, 9, 9, 9, 9, null, 'legacy-supplier-062'),
('63', 'MRC', 'ציוד וכלי מדידה', true, true, 'Approved', 'ISO 9001:2015', '2028-09-06', 8, 9, 8, 9, 8.55, null, 'legacy-supplier-063'),
('64', 'רונאר', 'ציוד וכלי מדידה', true, true, 'Approved', 'ISO 9001:2015', '2027-09-30', 9, 9, 9, 9, 9, null, 'legacy-supplier-064'),
('65', 'מאי אטמים', 'אורינגים', true, true, 'Approved', 'ISO 9001:2015', '2028-03-13', 8, 8, 9, 8, 8.15, null, 'legacy-supplier-065'),
('66', 'Shenzhen TianZhi', 'ספקי כוח', true, true, 'Approved', 'ISO 9001:2015', '2026-09-20', 8, 8, 8, 9, 8.25, null, 'legacy-supplier-066'),
('67', 'WENEXT', 'עיבוד שבבי והדפסת תלת מימד', true, true, 'Approved', 'ISO 9001:2015', '2027-09-08', 9, 9, 8, 9, 8.85, null, 'legacy-supplier-067'),
('68', 'ארי , י לוי', 'ציוד וכלי מדידה', false, true, 'Approved', 'NA', null, 9, 9, 8, 9, 8.85, null, 'legacy-supplier-068'),
('69', 'אל די אר טכנולוגיות - יצרן- KNF Micro AG', 'משאבה למערכת', true, true, 'Approved', 'ISO 9001:2015', '2026-09-12', 8, 9, 8, 9, 8.55, 'תעודות ISO יצרן', 'legacy-supplier-069'),
('70', 'טיסן חיפה', 'דבקים תעשייתים', false, true, 'Approved', 'NA', null, 9, 8, 8, 8, 8.3, null, 'legacy-supplier-070'),
('71', 'WURTH', 'ציוד אלקטרוניקה', true, true, 'Approved', 'ISO 9001:2015', '2027-04-09', 9, 8, 8, 8, 8.3, null, 'legacy-supplier-071'),
('72', 'גדעון שמנים וכימיכלים - יצרן DUPONT', 'גריז וכימיכלים', true, true, 'Approved', 'ISO 9001:2015', '2026-11-28', 9, 9, 8, 9, 8.85, 'תעודות ISO יצרן', 'legacy-supplier-072'),
('73', 'גבריאל טק', 'מוצרים למעבד אלקט', false, true, 'Approved', 'NA', null, 8, 8, 8, 9, 8.25, null, 'legacy-supplier-073'),
('74', 'marchton automation', 'עיבוד שבבי', true, true, 'Approved', 'ISOISO9001:2015', '2029-05-13', 9, 8, 9, 8, 8.45, null, 'legacy-supplier-074'),
('75', 'מאסטרן', 'עיבוד שבבי', true, true, 'Approved', 'ISO 9001:2015/ISO13485', '2029-08-06', 8, 9, 8, 9, 8.55, null, 'legacy-supplier-075'),
('76', 'ברקוד סנטר', 'מדפסת ברקודים', false, true, 'Approved', 'NA', null, 8, 9, 8, 9, 8.55, null, 'legacy-supplier-076'),
('77', 'Amron', 'גריז- מתכלים', true, true, 'Approved', 'ISO 9001:2015', '2029-04-30', 9, 8, 9, 8, 8.45, null, 'legacy-supplier-077'),
('78', 'גוטמן ברזילי', 'אספקה טכנית', false, true, 'Approved', 'NA', null, 9, 8, 9, 8, 8.45, null, 'legacy-supplier-078'),
('79', 'קפיצי נורדיה', 'קפיצים', true, true, 'Approved', 'ISO 9001:2015/as9100d/13485', '2027-05-20', 9, 8, 9, 8, 8.45, null, 'legacy-supplier-079'),
('80', 'REEF RC', 'מנועי סרוו', false, true, 'Approved', 'NA', null, 9, 8, 9, 8, 8.45, null, 'legacy-supplier-080'),
('81', 'סאלם יעקב- מקסימה', 'הובלת מיכילי חמצן ואוויר דחוס', true, true, 'Approved', 'ISO 9001:2015', '2028-08-09', 9, 9, 9, 9, 9, 'תעודות ISO יצרן', 'legacy-supplier-081'),
('82', 'זאד רכיבים', 'רכיבי אלקטרוניקה', true, true, 'Approved', 'ISO 9001:2015', '2029-02-26', 9, 9, 8, 9, 8.85, null, 'legacy-supplier-082'),
('83', 'וירטהיים בע"מ', 'CNC', true, true, 'Approved', 'ISO 9001:2015', '2029-07-30', 8, 9, 8, 9, 8.55, null, 'legacy-supplier-083'),
('84', 'לוגיסטפלסט', 'פתרונות אחסון', true, true, 'Approved', 'ISO 9001:2015', '2029-07-09', 9, 8, 8, 9, 8.55, null, 'legacy-supplier-084'),
('85', 'אסותא תעשיות אל בד', 'מסנן לקניסטר', true, true, 'Approved', 'ISO 9001:2015', '2027-11-26', 8, 9, 8, 9, 8.55, null, 'legacy-supplier-085'),
('86', 'סקופ מתכות', 'חומרי גלם', true, true, 'Approved', 'ISO 9001: 2015 /AS910-D', '2027-04-20', 9, 8, 9, 8, 8.45, null, 'legacy-supplier-086'),
('87', 'RS Components Limited', 'רכיבי אלקטרוניקה', true, true, 'Approved', 'ISO 9001: 2015', '2027-05-31', 9, 8, 8, 8, 8.3, null, 'legacy-supplier-087'),
('88', 'עולם הרפואה', 'מדי לחץ דם', true, true, 'Approved', 'ISO 9001: 2015', '2027-12-18', 9, 9, 9, 8, 8.75, null, 'legacy-supplier-088'),
('89', 'מנורז', 'שיווק מכשירי מדידה', true, true, 'Approved', 'ISO 9001: 2015', '2027-06-22', 9, 9, 8, 9, 8.85, null, 'legacy-supplier-089'),
('90', 'תמיר ערן', 'דבקים מחטוים וטיפים', true, true, 'Approved', 'ISO 9001: 2015', '2027-04-24', 9, 8, 9, 8, 8.45, null, 'legacy-supplier-090'),
('91', 'BLADETECH', 'תופסן למד תצוגה', false, true, 'Approved', 'NA', null, 9, 8, 8, 9, 8.55, null, 'legacy-supplier-091'),
('92', 'holder smith', 'תפס לבטאמן', false, true, 'Approved', 'NA', null, 8, 9, 9, 8, 8.45, null, 'legacy-supplier-092'),
('93', 'MSA ירכא', 'קבלן משנה ייצור כרטיסי אלקטרוניקה', true, true, 'Approved', 'ISO 9001: 2015 /ISO 13485', '2028-10-13', 9, 9, 9, 8, 8.75, null, 'legacy-supplier-093'),
('94', 'זיטק זיווד וטכנולוגיות בע"מ', 'זיווד ועבודות פח', true, true, 'Approved', 'ISO 9001: 2015 /ISO 13485', '2027-07-06', 9, 9, 8, 8, 8.6, null, 'legacy-supplier-094'),
('95', 'NAUTEC C', 'ברז מיכל', true, true, 'Approved', 'ITALCERT EU2016/425', '2031-10-05', 9, 9, 9, 9, 9, null, 'legacy-supplier-095'),
('96', 'JEEK PRECISISION TEC', 'עיבוד שבבי', true, true, 'Approved', 'ISO 9001: 2015 ISO13485:2016', '2028-12-30', 8, 8, 9, 8, 8.15, null, 'legacy-supplier-096'),
('97', 'JMI prototyps', 'עיבוד שבבי', true, true, 'Approved', 'ISO 9001: 2015', '2029-05-14', 8, 9, 8, 9, 8.55, 'יצרן קפיצים של JMI', 'legacy-supplier-097'),
(null, 'dongguan chuangyi', 'קפיצים', true, true, 'Approved', 'ISO 9001: 2015', '2028-06-11', 0, null, null, null, null, null, 'legacy-supplier-098'),
('98', 'גאמידה', 'ארון סוללות', true, true, 'Approved', 'ISO 9001,27001,27799', '2028-06-20', 9, 9, 9, 9, 9, null, 'legacy-supplier-099'),
('99', 'רומיכל', 'מתכלים', true, true, 'Approved', 'ISO 9001:2015', '2026-09-11', 9, 9, 9, 9, 9, null, 'legacy-supplier-100'),
('100', 'טוטאלטק בע"מ', 'אביזרים לחדר נקי', true, true, 'Approved', 'ISO 9001:2015', '2027-05-28', 9, 8, 8, 9, 8.55, null, 'legacy-supplier-101'),
('101', 'טמקס שיווק', 'אבטיה אולטרהסוני ודטרגנט', true, true, 'Approved', 'ISO 9001:2015 iso14001', '2028-08-14', 9, 9, 9, 9, 9, null, 'legacy-supplier-102'),
('102', 'KTI BITMAN', 'הדרכות IPC', true, true, 'Approved', 'ISO 9001:2015', '2029-08-05', 9, 9, 9, 9, 9, null, 'legacy-supplier-103'),
('103', '3M', 'דבקים', true, true, 'Approved', 'ISO 9001:2015', '2027-03-13', 9, 9, 9, 9, 9, null, 'legacy-supplier-104'),
('104', 'shenzhen Ruitai', 'עיבוד מתכת / תבניות', true, true, 'Approved', 'ISO 9001:2015', '2029-03-02', 9, 9, 9, 9, 9, 'shenzhen Yrshengxih יצרן פקיצים עבור הספק רוטי', 'legacy-supplier-105'),
(null, 'shenzhen Yrshengxih', 'קפיצים', true, true, 'Approved', 'ISO 9001:2015', '2028-05-28', null, null, null, null, null, null, 'legacy-supplier-106'),
('105', 'G FLOW', 'כיול מדי זרימה', true, true, 'Approved', 'ISO17025', '2027-12-13', 9, 9, 9, 9, 9, null, 'legacy-supplier-107'),
('116', 'APEKS', 'דרגה ראשונה', true, true, 'Approved', 'ISO9001 ISO14001', '2027-08-01', 9, 9, 9, 9, 9, null, 'legacy-supplier-108'),
('117', 'CFT prototypes- Dongguan Huitian Technology Co.', 'תבניות פלסטיק, ייצור מוצרי פלסטיק.', true, true, 'Approved', 'ISO 9001/ISO13485', '2028-04-22', 8, 8, 8, 9, 8.25, null, 'legacy-supplier-109'),
(null, 'CFT prototypes- Shenzhen Tuocheng Precision Hardware', 'CNC', true, true, 'Approved', 'ISO9001:2015', '2029-01-03', 8, 9, 9, 9, 8.7, null, 'legacy-supplier-110'),
('118', 'Dongguan Haowei Tec', 'ייצור תבניות סיליקון ופולימר', true, true, 'Approved', 'ISO9001:2015', '2028-04-17', 9, 9, 9, 8, 8.75, null, 'legacy-supplier-111'),
('119', 'Zetar IndustryCo.,', 'תבניות סיליקון ופלסטיק', true, true, 'Approved', 'ISO9001:2015/ISO13485:2016', '2027-03-27', 9, 9, 9, 9, 9, null, 'legacy-supplier-112'),
('120', 'אורטקס', 'ספק תחום ייצור PCB ורכיבים', true, true, 'Approved', 'ISO9001:2015 / AS9100', '2028-12-30', 9, 9, 9, 8, 8.75, 'קבלן משנה ייצור PCB עבור אורטקס', 'legacy-supplier-113'),
(null, 'Merlinhawk', 'קבלן משנה PCB', true, true, 'Approved', 'ISO9001:2015', '2027-09-23', null, null, null, null, null, null, 'legacy-supplier-114'),
('121', 'Dongguan Haowei Technology Co., Ltd/ SMARTMOLDTECH', ',תבניות סיליקון', true, true, 'Approved', 'ISO9001:2015', '2028-04-17', 9, 8, 9, 8, 8.45, null, 'legacy-supplier-115'),
('122', 'poseidon C', 'יצרן דרגה ראשונה', true, true, 'Approved', 'ISO9001:2015', '2028-04-02', 9, 9, 9, 9, 9, null, 'legacy-supplier-116')
on conflict (import_key) do update set
  supplier_number = excluded.supplier_number,
  supplier_name = excluded.supplier_name,
  product_service = excluded.product_service,
  has_certification = excluded.has_certification,
  has_experience = excluded.has_experience,
  status = excluded.status,
  certification_type = excluded.certification_type,
  expiration_date = excluded.expiration_date,
  delivery_score = excluded.delivery_score,
  quality_score = excluded.quality_score,
  professionalism_score = excluded.professionalism_score,
  requirements_score = excluded.requirements_score,
  weighted_score = excluded.weighted_score,
  notes = excluded.notes,
  updated_at = now();

update public.suppliers
set sort_order = substring(import_key from '[0-9]+$')::integer
where import_key like 'legacy-supplier-%';
