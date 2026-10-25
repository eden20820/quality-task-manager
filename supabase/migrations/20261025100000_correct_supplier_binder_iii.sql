-- Correct Binder III names from the latest photographed physical label.
-- The position-based update preserves any manual supplier links already made.
update public.supplier_binder_entries
set display_name = case sort_order
  when 1 then 'CHEMSOL'
  when 2 then 'WINEXT'
  when 3 then 'גדעון שמיים'
  when 4 then 'גבריאל-טק'
  when 5 then 'Tarantula'
  when 6 then 'DIGIKEY'
  when 7 then 'ברקוד סנטר'
  when 8 then 'גוטמן ברזילי'
  when 9 then 'AMRON'
  when 10 then 'MASTERAN LTD'
  when 11 then 'Shenzhen Tianzhi'
  else display_name
end,
updated_at = now()
where binder_id = '10000000-0000-4000-8000-000000000003'::uuid
  and sort_order between 1 and 11;
