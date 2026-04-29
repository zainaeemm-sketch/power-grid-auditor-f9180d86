# E2E tests (Playwright)

Smoke-level coverage that exercises the deployed app via a real browser.

## Why only a smoke test?

The interactive AI bulk-fix UI (`SuggestionReviewDrawer` + `OverridesSection`)
is gated behind `import.meta.env.DEV` and lives inside `CaseMetaDevPanel` —
it does not render on published builds. The full list / accept / revert flows
(including success and error paths) are covered by Vitest + React Testing
Library tests in `src/components/docs/*.test.tsx`, which mock the server
functions and run in milliseconds.

This Playwright suite only verifies that the docs/cases route itself is
reachable, renders without runtime errors, and shows expected case content.

## Running

On a normal CI runner (Debian/Ubuntu) you also need the system libs that
chromium links against — run with `--with-deps` once:

```bash
# one-time, on a fresh CI runner
npx playwright install --with-deps chromium

# against the default published URL
bun run test:e2e

# against a specific preview / branch
PLAYWRIGHT_BASE_URL=https://id-preview--<id>.lovable.app bun run test:e2e
```

## Notes on a future "real" E2E

If you later want true end-to-end coverage of accept/revert against a live
backend you'll need to add:

1. A dedicated test user (email/password) seeded via Supabase admin client.
2. Sign-in step using `page.goto('/login')` + storage-state caching.
3. Navigation to a `DEV`-only build (i.e., point `PLAYWRIGHT_BASE_URL` at a
   `vite dev` server, not the published Worker).
4. DB cleanup: delete rows in `case_meta_overrides` for the test user before
   and after each test.
5. Decide how to handle OpenAI — real calls cost money and are flaky in CI;
   route-intercept `api.openai.com/**` and fulfill with a canned tool-call
   response unless the user explicitly opts in to real calls.
