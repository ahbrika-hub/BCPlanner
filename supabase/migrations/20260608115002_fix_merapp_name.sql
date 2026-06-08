-- Fix the business-line display name: "Meraap" → "Merapp" (the canonical brand
-- is Merapp / مرآب). business_lines.id is a uuid and is NOT changed, so no FK
-- updates are needed — task/recurring/snapshot references (by id) are untouched.
-- The dashboard logo for this line resolves by the snapshot/workbook slug
-- `merapp` → public/business-lines/merapp.svg (and by the `logo_url` override,
-- matched on the corrected name). Idempotent.

update public.business_lines
set name = 'Merapp'
where name = 'Meraap';
