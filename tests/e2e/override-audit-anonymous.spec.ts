/**
 * Cross-browser visual contract for `OverrideAuditSection` when no user is
 * signed in.
 *
 * Regression target: the audit panel used to render a blank box (or worse,
 * the literal string "[object Response]") for anonymous visitors because
 * `listCaseMetaOverrideAudit` threw a raw `Response` on 401. The handler
 * now returns a typed envelope and the component shows an explicit
 * "Sign in to view audit logs" CTA instead.
 *
 * What this test guards:
 *   1. The `<aside aria-label="Case-meta override audit trail">` region is
 *      present and visible on `/docs/cases` for an anonymous visitor.
 *   2. It is NOT empty (would indicate a render crash or missing branch).
 *   3. It contains the expected unauthenticated CTA text.
 *   4. Nowhere on the page does the text "[object Response]" appear.
 *   5. No uncaught page errors fire while the panel mounts and fetches.
 *   6. A screenshot of the panel is captured per browser as a visual record
 *      (used for manual review on failure; not a pixel-diff snapshot so
 *      Lovable's font/AA differences across browsers don't cause flakes).
 *
 * Runs across chromium/firefox/webkit via the projects in playwright.config.
 *
 * Run locally:
 *   bunx playwright install                 # one-time, all 3 browsers
 *   bun run test:e2e -- override-audit-anonymous
 */
import { test, expect, type Page } from "@playwright/test";

const AUDIT_REGION = 'aside[aria-label="Case-meta override audit trail"]';

/**
 * The docs page is public, but the test must guarantee no Supabase session
 * has been restored from storage. Clearing storage AFTER the first navigation
 * (so the origin is known) and reloading is the most reliable way.
 */
async function ensureAnonymous(page: Page) {
  await page.goto("/docs/cases", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* some browsers throw on storage access in odd contexts — ignore */
    }
  });
  const ctx = page.context();
  await ctx.clearCookies();
  await page.reload({ waitUntil: "domcontentloaded" });
}

test.describe("OverrideAuditSection — anonymous visitor", () => {
  test("renders a friendly state, never blank or '[object Response]'", async ({
    page,
  }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await ensureAnonymous(page);

    // 1) The audit region exists and is visible.
    const audit = page.locator(AUDIT_REGION);
    await expect(audit, "audit panel should mount on /docs/cases").toBeVisible({
      timeout: 15_000,
    });

    // 2) Header is always rendered, even mid-load. This catches the worst
    //    failure mode (blank panel from a thrown Response).
    await expect(audit.getByText(/Override audit trail/i)).toBeVisible();

    // 3) The fetch has settled — wait for the loading skeleton to leave so
    //    we're asserting against the final UI state, not the placeholder.
    await expect(audit).not.toHaveAttribute("aria-busy", "true", {
      timeout: 15_000,
    });

    // 4) For an anonymous visitor we expect the unauthenticated CTA, not
    //    an error toast and not the loaded list.
    await expect(
      audit.getByText(/Sign in to view audit logs/i),
      "anonymous visitors should see the sign-in CTA",
    ).toBeVisible();
    await expect(
      audit.getByRole("link", { name: /sign in/i }),
    ).toBeVisible();

    // 5) The panel must have non-trivial textual content — a regression
    //    that wipes the children would still leave the <aside> mounted.
    const text = (await audit.innerText()).trim();
    expect(text.length, "audit panel should not be visually blank").toBeGreaterThan(
      20,
    );

    // 6) The signature regression: "[object Response]" must never reach
    //    the DOM, anywhere on the page.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("[object Response]");

    // 7) No uncaught errors fired during mount + fetch.
    expect(
      pageErrors,
      `uncaught page errors: ${pageErrors.join(" | ")}`,
    ).toEqual([]);

    // 8) Visual record per browser. Attached to the test report rather than
    //    diffed, because subpixel rendering across engines would make a
    //    strict snapshot flaky and add no real signal.
    const shot = await audit.screenshot();
    await testInfo.attach(`audit-panel-${testInfo.project.name}`, {
      body: shot,
      contentType: "image/png",
    });
  });
});
