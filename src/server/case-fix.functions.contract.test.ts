/**
 * Contract tests for `listCaseMetaOverrideAuditHandler`.
 *
 * Goal: prove the handler ALWAYS resolves with a typed
 * `ListCaseMetaOverrideAuditResult` envelope and NEVER throws raw `Response`
 * objects (or anything else) to the caller. A regression here re-introduces
 * the `[object Response]` blank-screen bug on the public docs page.
 *
 * We test the extracted handler (`listCaseMetaOverrideAuditHandler`) rather
 * than going through the `createServerFn` client/server bridge — that bridge
 * rewrites return values during transport and obscures the raw contract we
 * want to lock down. The wrapped server fn delegates to this handler 1:1.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* -------------------------------------------------------------- mocks ---- */

let mockAuthHeader: string | null = null;
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) =>
    name.toLowerCase() === "authorization" ? mockAuthHeader : undefined,
}));

type SupabaseStub = {
  auth: { getClaims: (token: string) => Promise<unknown> };
  from: (table: string) => unknown;
};
let mockSupabase: SupabaseStub = {
  auth: { getClaims: async () => ({ data: null, error: null }) },
  from: () => ({}),
};
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mockSupabase,
}));

// `withAuthHeaders` middleware (transitively imported) reaches for the real
// Supabase browser client; stub it so jsdom doesn't try to open a session.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

/* --------------------------------------------------- helpers / fixtures -- */

/**
 * Build a minimal Postgrest-like query chain that resolves to the given
 * `{ data, error }` payload regardless of which `.eq/.order/.limit/...`
 * methods are chained on it. Postgrest builders are then-able, so we attach
 * `.then` to make `await q` resolve to the configured result.
 */
function makeQueryChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  for (const m of ["select", "eq", "in", "order", "limit", "maybeSingle"]) {
    chain[m] = passthrough;
  }
  (chain as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
  ) => resolve(result);
  return chain;
}

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "test-anon-key";
  mockAuthHeader = null;
  mockSupabase = {
    auth: { getClaims: async () => ({ data: null, error: null }) },
    from: () => makeQueryChain({ data: [], error: null }),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* --------------------------------------------------------------- tests -- */

describe("listCaseMetaOverrideAuditHandler — contract", () => {
  /**
   * Wrapper that fails loudly if the handler ever throws ANY value (and
   * especially a raw Response — the original blank-screen bug). On success,
   * returns the resolved envelope for further assertions.
   */
  async function invoke(input: { caseKey?: string; field?: string; limit?: number } = {}) {
    const { listCaseMetaOverrideAuditHandler } = await import(
      "./case-fix.functions"
    );
    try {
      return await listCaseMetaOverrideAuditHandler({
        limit: 50,
        ...input,
      });
    } catch (e) {
      if (e instanceof Response) {
        throw new Error(
          `Contract violated: handler threw a raw Response (status ${e.status}).`,
        );
      }
      throw new Error(
        `Contract violated: handler threw instead of returning an envelope: ${String(e)}`,
      );
    }
  }

  it("returns { ok:false, error:'unauthenticated' } when no Authorization header is present", async () => {
    mockAuthHeader = null;
    const res = await invoke();
    expect(res).toMatchObject({ ok: false, error: "unauthenticated" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(typeof res.message).toBe("string");
  });

  it("returns 'unauthenticated' when the Authorization header is malformed", async () => {
    mockAuthHeader = "NotBearer something";
    const res = await invoke();
    expect(res).toMatchObject({ ok: false, error: "unauthenticated" });
  });

  it("returns 'unauthenticated' when the bearer token is empty", async () => {
    mockAuthHeader = "Bearer   ";
    const res = await invoke();
    expect(res).toMatchObject({ ok: false, error: "unauthenticated" });
  });

  it("returns 'unauthenticated' when getClaims rejects the token", async () => {
    mockAuthHeader = "Bearer expired-token";
    mockSupabase = {
      auth: {
        getClaims: async () => ({ data: null, error: { message: "expired" } }),
      },
      from: () => makeQueryChain({ data: [], error: null }),
    };
    const res = await invoke();
    expect(res).toMatchObject({ ok: false, error: "unauthenticated" });
  });

  it("returns 'config_missing' when SUPABASE_URL is unset", async () => {
    delete process.env.SUPABASE_URL;
    mockAuthHeader = "Bearer whatever";
    const res = await invoke();
    expect(res).toMatchObject({ ok: false, error: "config_missing" });
  });

  it("returns { ok:true, rows:[] } for an authenticated user with no audit history", async () => {
    mockAuthHeader = "Bearer good-token";
    mockSupabase = {
      auth: {
        getClaims: async () => ({
          data: { claims: { sub: "user-123" } },
          error: null,
        }),
      },
      from: () => makeQueryChain({ data: [], error: null }),
    };
    const res = await invoke();
    expect(res).toEqual({ ok: true, rows: [] });
  });

  it("returns { ok:true, rows:[…] } for an authenticated user with history", async () => {
    mockAuthHeader = "Bearer good-token";
    const fakeRow = {
      id: "a1",
      override_id: "o1",
      case_key: "case14",
      field: "random_seed",
      action: "accept",
      source: "ai_suggested",
      previous_value: null,
      new_value: 42,
      ai_model: "gpt-4o-mini",
      ai_rationale: "matches sibling convention",
      created_at: "2026-05-01T00:00:00Z",
    };
    mockSupabase = {
      auth: {
        getClaims: async () => ({
          data: { claims: { sub: "user-123" } },
          error: null,
        }),
      },
      from: () => makeQueryChain({ data: [fakeRow], error: null }),
    };
    const res = await invoke({ caseKey: "case14", limit: 10 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.rows).toHaveLength(1);
  });

  it("returns 'db_error' when the Supabase query fails", async () => {
    mockAuthHeader = "Bearer good-token";
    mockSupabase = {
      auth: {
        getClaims: async () => ({
          data: { claims: { sub: "user-123" } },
          error: null,
        }),
      },
      from: () =>
        makeQueryChain({ data: null, error: { message: "permission denied" } }),
    };
    const res = await invoke();
    expect(res).toMatchObject({ ok: false, error: "db_error" });
    if (!res.ok) expect(res.message).toContain("permission denied");
  });

  it("never returns the literal string '[object Response]' in any branch", async () => {
    // Run through every failure branch and assert no field stringifies to
    // the signature error message that gave this bug its name.
    const scenarios: Array<() => void> = [
      () => {
        mockAuthHeader = null;
      },
      () => {
        mockAuthHeader = "Bearer bad";
        mockSupabase = {
          auth: {
            getClaims: async () => ({ data: null, error: { message: "x" } }),
          },
          from: () => makeQueryChain({ data: [], error: null }),
        };
      },
      () => {
        delete process.env.SUPABASE_URL;
        mockAuthHeader = "Bearer x";
      },
    ];
    for (const setup of scenarios) {
      setup();
      const res = await invoke();
      expect(JSON.stringify(res)).not.toContain("[object Response]");
      // Reset env between iterations.
      process.env.SUPABASE_URL = "https://example.supabase.co";
    }
  });

  it("always resolves to an object shaped like the discriminated union", async () => {
    // Smoke check across the same scenarios above: the result must always
    // be an object with a boolean `ok` key, and either `rows` (when ok) or
    // `error` + `message` (when not). No undefined, no thrown values.
    const cases: Array<() => void> = [
      () => {
        mockAuthHeader = "Bearer good";
        mockSupabase = {
          auth: {
            getClaims: async () => ({
              data: { claims: { sub: "u" } },
              error: null,
            }),
          },
          from: () => makeQueryChain({ data: [], error: null }),
        };
      },
      () => {
        mockAuthHeader = null;
      },
    ];
    for (const setup of cases) {
      setup();
      const res = await invoke();
      expect(typeof res).toBe("object");
      expect(res).not.toBeNull();
      expect(typeof res.ok).toBe("boolean");
      if (res.ok) {
        expect(Array.isArray(res.rows)).toBe(true);
      } else {
        expect(typeof res.error).toBe("string");
        expect(typeof res.message).toBe("string");
      }
    }
  });
});
