# Business-line logos (weekly dashboard filter)

The weekly dashboard renders each business line as a clickable logo button.
Resolution order per line:

1. `business_lines.logo_url` (DB override, matched by line **name**)
2. `public/business-lines/<id>.svg`
3. `public/business-lines/<id>.png`
4. branded initials chip (no asset needed)

`<id>` is the **snapshot business-line id** — the `id` your upstream workbook
uses in its `BusinessLines` sheet (a slug like `tss`), NOT the DB uuid.

Suggested filenames for the seeded lines (name → id slug):

| Business line  | logo                | file                              |
| -------------- | ------------------- | --------------------------------- |
| TSS            | SAPTCO TSS          | `public/business-lines/tss.svg`   |
| Meraap         | merapp / مرآب       | `public/business-lines/meraap.svg`|
| ARTC           | Aalam Alreyadah     | `public/business-lines/artc.svg`  |
| Driving School | SAPTCO Driving School | `public/business-lines/driving-school.svg` |

Use the exact id your workbook emits. SVG or transparent PNG, roughly square.
