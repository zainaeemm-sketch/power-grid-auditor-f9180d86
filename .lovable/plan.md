## Add GitHub link to footer

Update `src/components/SiteFooter.tsx` to include a GitHub icon button linking to:
`https://github.com/zainaeemm-sketch/power-grid-auditor-f9180d86`

### Changes
- Import `Github` icon from `lucide-react`.
- Add an external `<a>` link (target="_blank", rel="noopener noreferrer") next to the existing "Docs" link, showing a GitHub icon + "GitHub" label, styled consistently with the existing footer link.

### Out of scope
- No layout/structure changes to the footer.
- No other pages modified.