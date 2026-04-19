
Add a global footer rendered on every page with the text:
**"GridArena 2026 · v1.0 · Docs. Designed by Zain Naeem in collaboration with University of Palermo"**

Where "v1.0" pulls from `CITATION.version`, year from `CITATION.year`, "Docs" links to `/docs`, and author/affiliation from `CITATION.authors` / `CITATION.affiliation`.

**Steps:**

1. **Create `src/components/SiteFooter.tsx`** — small footer component reading from `@/lib/citation`, rendering a centered muted line: `GridArena {year} · v{version} · <Link to="/docs">Docs</Link>. Designed by {authors} in collaboration with {affiliation}`.

2. **Mount globally in `src/routes/__root.tsx`** — wrap the existing `<Outlet />` in a flex column (`min-h-screen flex flex-col`) with `<main className="flex-1">` containing the Outlet, and `<SiteFooter />` after it. This ensures the footer appears on every route (including login, docs, authenticated pages) and sticks to the bottom on short pages.

3. **Remove the duplicate footer from `src/routes/about.tsx`** — delete the existing `<footer>` block at the bottom of `AboutPage` so the global one isn't doubled.

No schema, route, or dependency changes.
