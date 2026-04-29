## Goal

Document the new export & preview features of the invalid-items dev panel inline on `/docs/cases`, with a CSV column table, a JSON shape table, severity meaning, and worked examples.

## Where it goes

In `src/routes/docs.cases.tsx`, inside `CasesPage` (around line 1458–1475), insert a new `<section>` **immediately above** `<CaseMetaDevPanel />` so readers see the docs before reaching the panel itself. Use the same prose styles already in use on the page (no new components needed; the page already renders inside `DocsLayout`'s prose container).

## Section content

Heading: **"Exporting invalid items"**

Subsections:

1. **Overview** — short paragraph explaining the dev panel lists case-meta validation issues and that two scope-aware dropdowns (CSV, JSON) export the currently filtered list.
2. **Filter & sort awareness** — note that exported rows follow the active filter and the on-screen sort order, with a `display_order` column for traceability.
3. **Choosing a scope** — explain the three options (`All`, `Errors only`, `Warnings only`) and that disabled options mean an empty bucket. Define severity:
   - `error` → required field is **missing**
   - `warning` → field is present but **invalid format**
4. **Preview before download** — describe the modal: CSV shows a table of up to 50 rows (`case_key`, `severity`, `field`, `message`) plus total count and active filter; JSON shows the full payload in a code block. Both have Download / Cancel; Esc cancels.
5. **CSV schema** — table of columns:

   | Column | Type | Description |
   |---|---|---|
   | `display_order` | integer | Position in the on-screen list (preserves current sort) |
   | `case_key` | string | Identifier of the case the issue belongs to |
   | `severity` | `error` \| `warning` | `error` = missing field, `warning` = invalid format |
   | `problem_type` | `missing` \| `invalid` | Same distinction in machine-friendly form |
   | `field` | string | Name of the offending meta field |
   | `message` | string | Human-readable validation message (empty for `missing`) |

6. **JSON shape** — note JSON mirrors the same fields per row, grouped as an array of objects with the keys above.
7. **Worked examples**:

   CSV snippet:
   ```text
   display_order,case_key,severity,problem_type,field,message
   1,case14,error,missing,prompt_version,
   2,case14,warning,invalid,random_seed,"random_seed must be an integer"
   ```

   JSON snippet:
   ```json
   [
     { "display_order": 1, "case_key": "case14", "severity": "error",
       "problem_type": "missing", "field": "prompt_version", "message": "" },
     { "display_order": 2, "case_key": "case14", "severity": "warning",
       "problem_type": "invalid", "field": "random_seed",
       "message": "random_seed must be an integer" }
   ]
   ```

## Implementation notes (technical)

- Single edit to `src/routes/docs.cases.tsx`; insert a new `<section className="not-prose mt-6 mb-6 scroll-mt-20" id="exporting-invalid-items">…</section>` (or rely on prose defaults — match the surrounding pattern, which uses raw `<h2>`/`<p>` inside the prose container). Headings use `<h2>` for the section title and `<h3>` for subsections to stay consistent with the rest of the page.
- Tables: use plain `<table>`/`<thead>`/`<tbody>` — the rest of the doc uses prose tables.
- Code blocks: use `<pre><code>` blocks; no new syntax-highlighter dependency.
- No changes to the dev panel logic, exports, or routes. Memory index does not need updating (no new feature, just docs).
- No new files, no new sidebar entries.

## Out of scope

- No new `/docs/exports` page.
- No changes to the panel UI or to the `exportIssues` / `ExportPreviewModal` code.
- No screenshots.
