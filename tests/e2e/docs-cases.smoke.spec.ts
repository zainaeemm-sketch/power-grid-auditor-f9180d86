/**
 * Smoke test: the docs/cases page renders.
 *
 * The CaseMetaDevPanel (where SuggestionReviewDrawer + OverridesSection are
 * wired) only renders when import.meta.env.DEV is true, so on a published
 * deployment we don't see those buttons. We only assert that the cases docs
 * page itself is reachable and renders the case list — confirming the route
 * is healthy and nothing crashed during SSR.
 *
 * Component-level coverage of list/accept/revert lives in
 * src/components/docs/*.test.tsx (Vitest + RTL).
 *
 * Run:
 *   bunx playwright install chromium    # one-time
 *   PLAYWRIGHT_BASE_URL=https://<your-preview>.lovable.app bun run test:e2e
 */
import { test, expect } from "@playwright/test";

test.describe("docs/cases smoke", () => {
  test("page loads and renders case content", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    const resp = await page.goto("/docs/cases", { waitUntil: "domcontentloaded" });
    expect(resp?.ok(), "navigation response should be 2xx").toBeTruthy();

    // The docs page should mention at least one of the benchmark cases.
    await expect(
      page.getByText(/case14|case30|case5/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    expect(errors, `page errors: ${errors.join(" | ")}`).toEqual([]);
  });
});
