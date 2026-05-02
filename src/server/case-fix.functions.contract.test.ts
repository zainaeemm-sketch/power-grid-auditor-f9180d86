/**
 * Contract tests for `listCaseMetaOverrideAudit`.
 *
 * Goal: prove the handler ALWAYS resolves with a typed
 * `ListCaseMetaOverrideAuditResult` envelope and NEVER throws raw `Response`
 * objects to the client. A regression here re-introduces the
 * `[object Response]` blank-screen bug on the public docs page.
 *
 * We exercise the handler directly (the value returned by `createServerFn`
 * exposes the wrapped callable). External boundaries are mocked:
 *   - `@tanstack/react-start/server` → `getRequestHeader` controls auth state
 *   - `@supabase/supabase-js` → `createClient` controls token claims + DB rows
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

// The auth-headers middleware imports the real Supabase browser client,
// which we don't need for these handler-level tests.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

/* --------------------------------------------------- helpers / fixtures -- */

/**
 * Build a minimal Postgrest-like query chain that resolves to the given
 * `{ data, error }` payload regardless of which `.eq/.order/.limit/...`
 * methods are chained on it.
 */
function makeQueryChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  for (const m of ["select", "eq", "in", "order", "limit", "maybeSingle"]) {
    chain[m] = passthrough;
  }
  // Awaiting the chain resolves to the result (Postgrest is then-able).
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

describe("listCaseMetaOverrideAudit — contract", () => {
  /**
   * Helper: invoke the server fn and guarantee the call never rejects with
   * a raw Response (which is the failure mode this contract exists to
   * prevent). Returns the resolved envelope.
   */
  async function invoke(input?: unknown) {
    const { listCaseMetaOverrideAudit } = await import("./case-fix.functions");
    try {
      return (await listCaseMetaOverrideAudit({ data: input })) as Record<
        string,
        unknown
      >;
    } catch (e) {
      if (e instanceof Response) {
        throw new Error(
          `Contract violated: handler threw a raw Response (status ${e.status}).`,
        );
      }
      throw e;
    }
  }

  it("returns { ok:false, error:'unauthenticated' } when no Authorization header is present", async () => {
    mockAuthHeader = null;
    const res = await invoke();
    expect(res).toMatchObject({ ok: false, error: "unauthenticated" });
    expect(typeof (res as { message: string }).message).toBe("string");
  });

  it("returns 'unauthenticated' when the Authorization header is malformed", async () => {
    mockAuthHeader = "NotBearer something";
    const res = await invoke();
    expect(res).toMatchObject({ ok: false, error: "unauthenticated" });
  });

  it("returns 'unauthenticated' when bearer token is empty", async () => {
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
    expect(res).toMatchObject({ ok: true });
    expect((res as { rows: unknown[] }).rows).toHaveLength(1);
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
    expect((res as { message: string }).message).toContain("permission denied");
  });

  it("never returns the literal string '[object Response]' in any field", async () => {
    // Run through every branch and assert no field stringifies to the
    // signature error message that gave this bug its name.
    const scenarios: Array<() => void> = [
      () => {
        mockAuthHeader = null;
      },
      () => {
        mockAuthHeader = "Bearer bad";
        mockSupabase = {
          auth: {
            getClaims: async () => ({
              data: null,
              error: { message: "x" },
            }),
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
      // Reset env for next iteration.
      process.env.SUPABASE_URL = "https://example.supabase.co";
    }
  });
});
