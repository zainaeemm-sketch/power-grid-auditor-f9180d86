import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import type { Database } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------ types */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type CaseFixSuggestion = {
  value: JsonValue;
  rationale: string;
  confidence: "low" | "medium" | "high";
  model: string;
};

export type CaseMetaOverrideRow = {
  id: string;
  case_key: string;
  field: string;
  value: JsonValue;
  source: "ai_suggested" | "manual";
  ai_rationale: string | null;
  ai_model: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseMetaOverrideAuditRow = {
  id: string;
  override_id: string | null;
  case_key: string;
  field: string;
  action: "accept" | "revert";
  source: "ai_suggested" | "manual" | null;
  previous_value: JsonValue | null;
  new_value: JsonValue | null;
  ai_model: string | null;
  ai_rationale: string | null;
  created_at: string;
};

/* ------------------------------------------------------- in-memory rate limit
 * Per-user token bucket: 20 suggest calls per rolling 60 s window.
 * Server functions in this codebase run inside a long-lived Worker, so a
 * Map<userId, timestamps[]> is sufficient. Best-effort — a cold start resets
 * the counter, which is acceptable for an interactive panel.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const rateLog = new Map<string, number[]>();

function checkRate(userId: string) {
  const now = Date.now();
  const arr = (rateLog.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    throw new Error(
      `Rate limit exceeded — max ${RATE_MAX} AI suggestions per minute. Try again shortly.`,
    );
  }
  arr.push(now);
  rateLog.set(userId, arr);
}

/* --------------------------------------------------- OpenAI tool-call call */

const SUGGEST_TOOL = {
  type: "function" as const,
  function: {
    name: "propose_case_meta_fix",
    description:
      "Propose a corrected value for an invalid or missing CASE_META field on a power-system test case. Always include a one-line rationale and a confidence rating.",
    parameters: {
      type: "object",
      properties: {
        value: {
          description:
            "The proposed value. Use a string for prompt_version/dataset_version, an integer for random_seed, or an array of strings for standardized/simplified notes.",
        },
        rationale: {
          type: "string",
          description: "One short sentence explaining why this value is appropriate.",
        },
        confidence: {
          type: "string",
          enum: ["low", "medium", "high"],
          description:
            "high = derived from existing siblings or canonical data; medium = plausible but inferred; low = wild guess.",
        },
      },
      required: ["value", "rationale", "confidence"],
      additionalProperties: false,
    },
  },
};

async function callOpenAi({
  prompt,
  systemPrompt,
}: {
  prompt: string;
  systemPrompt: string;
}): Promise<CaseFixSuggestion> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      tools: [SUGGEST_TOOL],
      tool_choice: { type: "function", function: { name: "propose_case_meta_fix" } },
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    if (resp.status === 429) throw new Error("OpenAI rate limit hit — please retry in a moment.");
    if (resp.status === 401) throw new Error("OpenAI auth failed — check OPENAI_API_KEY.");
    throw new Error(`OpenAI error ${resp.status}: ${text.slice(0, 300)}`);
  }

  const json = await resp.json();
  const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("OpenAI did not return a tool call. Try again.");
  }
  let parsed: { value: unknown; rationale?: string; confidence?: string };
  try {
    parsed = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new Error("OpenAI returned malformed JSON arguments.");
  }
  const confidence: "low" | "medium" | "high" =
    parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low";
  return {
    value: (parsed.value ?? null) as JsonValue,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    confidence,
    model,
  };
}

/* -------------------------------------------- system prompt + user prompt */

function buildSystemPrompt() {
  return [
    "You are a meticulous research-data assistant for GridArena, a power-system LLM benchmark.",
    "You will be asked to propose a single corrected value for one CASE_META field belonging to a benchmark case (e.g. case5, case14, case30).",
    "Field formats:",
    "- prompt_version: '<slug>@<major>.<minor>.<patch>' where slug = letters/digits/./_/-. Example: 'case14-baseline@1.0.0'.",
    "- random_seed: a non-negative safe integer, e.g. 0, 42, 2025.",
    "- dataset_version: a free-form versioned identifier such as 'gridarena-case14@1.0.0'.",
    "- standardized / simplified: an array of one-line strings describing what was kept vs simplified.",
    "- source: a short citation string. source_url: a full URL.",
    "- last_reviewed: ISO date YYYY-MM-DD.",
    "Use any sibling cases provided as inspiration. Prefer values that obviously fit the convention used by the project. Never invent unrelated data.",
    "Always call the `propose_case_meta_fix` function exactly once.",
  ].join("\n");
}

function buildUserPrompt(input: {
  caseKey: string;
  field: string;
  severity: "error" | "warning";
  message: string;
  currentMeta: Record<string, unknown> | null;
  siblingMeta: Record<string, Record<string, unknown>>;
}) {
  const { caseKey, field, severity, message, currentMeta, siblingMeta } = input;
  return [
    `Case: ${caseKey}`,
    `Field: ${field}`,
    `Severity: ${severity} (${severity === "error" ? "missing required field" : "invalid format"})`,
    message ? `Validator message: ${message}` : "",
    "",
    "Current CASE_META for this case:",
    JSON.stringify(currentMeta ?? {}, null, 2),
    "",
    "Sibling cases (for inspiration on conventions):",
    JSON.stringify(siblingMeta, null, 2),
    "",
    "Propose a single corrected value for the field above by calling propose_case_meta_fix.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* --------------------------------------------------------- server fns ---- */

const SuggestInput = z.object({
  caseKey: z.string().min(1).max(64),
  field: z.string().min(1).max(64),
  severity: z.enum(["error", "warning"]),
  message: z.string().max(2000).default(""),
  currentMeta: z.record(z.string(), z.unknown()).nullable().optional(),
  siblingMeta: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
});

export const suggestCaseMetaFix = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => SuggestInput.parse(input))
  .handler(async ({ data, context }): Promise<CaseFixSuggestion> => {
    checkRate(context.userId);
    const result = await callOpenAi({
      systemPrompt: buildSystemPrompt(),
      prompt: buildUserPrompt({
        caseKey: data.caseKey,
        field: data.field,
        severity: data.severity,
        message: data.message ?? "",
        currentMeta: data.currentMeta ?? null,
        siblingMeta: data.siblingMeta ?? {},
      }),
    });
    return result;
  });

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

const AcceptInput = z.object({
  caseKey: z.string().min(1).max(64),
  field: z.string().min(1).max(64),
  value: JsonValueSchema,
  source: z.enum(["ai_suggested", "manual"]).default("ai_suggested"),
  rationale: z.string().max(2000).nullable().optional(),
  model: z.string().max(128).nullable().optional(),
});

export const acceptCaseMetaFix = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => AcceptInput.parse(input))
  .handler(async ({ data, context }): Promise<CaseMetaOverrideRow> => {
    // Read the previous override (if any) BEFORE the upsert so we can record
    // the value transition in the audit log. RLS scopes this to the user.
    const { data: prevRow } = await context.supabase
      .from("case_meta_overrides")
      .select("value")
      .eq("user_id", context.userId)
      .eq("case_key", data.caseKey)
      .eq("field", data.field)
      .maybeSingle();
    const previousValue = (prevRow?.value ?? null) as JsonValue | null;

    const row = {
      user_id: context.userId,
      case_key: data.caseKey,
      field: data.field,
      value: data.value as never,
      source: data.source,
      ai_rationale: data.rationale ?? null,
      ai_model: data.model ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data: result, error } = await context.supabase
      .from("case_meta_overrides")
      .upsert(row as never, { onConflict: "user_id,case_key,field" })
      .select("id, case_key, field, value, source, ai_rationale, ai_model, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);

    // Append-only audit entry. Best-effort: a failed audit insert must not
    // mask a successful override write. We surface to server logs only.
    const { error: auditErr } = await context.supabase
      .from("case_meta_override_audit")
      .insert({
        user_id: context.userId,
        override_id: (result as CaseMetaOverrideRow).id,
        case_key: data.caseKey,
        field: data.field,
        action: "accept",
        source: data.source,
        previous_value: previousValue as never,
        new_value: data.value as never,
        ai_model: data.model ?? null,
        ai_rationale: data.rationale ?? null,
      } as never);
    if (auditErr) console.warn("audit insert (accept) failed:", auditErr.message);

    return result as CaseMetaOverrideRow;
  });

/**
 * Discriminated-union envelope returned by `listCaseMetaOverrides`.
 *
 * The frontend used to receive a thrown `Response` (e.g. 401 for anon
 * visitors on the public docs page) which surfaced as the dreaded
 * `[object Response]` runtime error. This envelope makes every outcome a
 * plain JSON object so callers never have to special-case throws.
 */
export type ListCaseMetaOverridesResult =
  | { ok: true; overrides: CaseMetaOverrideRow[] }
  | {
      ok: false;
      /** Stable machine-readable code for branching logic. */
      error: "unauthenticated" | "config_missing" | "db_error";
      /** Human-readable description; safe to surface in a toast. */
      message: string;
    };

/**
 * Read every override owned by the current user.
 *
 * Unlike most server fns in this file, this handler does NOT use
 * `requireSupabaseAuth` middleware — the middleware throws raw `Response`
 * objects on auth failure, and we want to keep this endpoint "always
 * returns JSON" so the docs page never blanks out for signed-out visitors.
 */
export const listCaseMetaOverrides = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders])
  .handler(async (): Promise<ListCaseMetaOverridesResult> => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return {
        ok: false,
        error: "config_missing",
        message: "Server is missing Supabase configuration.",
      };
    }

    // `withAuthHeaders` (client) attaches `Authorization: Bearer <token>` if
    // the user has a session. Anonymous visitors simply won't have one, and
    // we surface that as a typed `unauthenticated` result instead of a 401.
    const authHeader = getRequestHeader("authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return { ok: true, overrides: [] };
    }
    const token = authHeader.slice("bearer ".length).trim();
    if (!token) return { ok: true, overrides: [] };

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const claims = await supabase.auth.getClaims(token);
    if (claims.error || !claims.data?.claims?.sub) {
      // Token expired / invalid — treat the same as anonymous so the docs
      // page renders cleanly. The client can refresh the session and retry.
      return { ok: true, overrides: [] };
    }
    const userId = claims.data.claims.sub;

    const { data, error } = await supabase
      .from("case_meta_overrides")
      .select(
        "id, case_key, field, value, source, ai_rationale, ai_model, created_at, updated_at",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) {
      return { ok: false, error: "db_error", message: error.message };
    }
    return { ok: true, overrides: (data ?? []) as CaseMetaOverrideRow[] };
  });

const RevertInput = z.object({ id: z.string().uuid() });

export const revertCaseMetaOverride = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => RevertInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    // Capture the row's snapshot for the audit trail before deletion.
    const { data: prevRow } = await context.supabase
      .from("case_meta_overrides")
      .select("id, case_key, field, value, source, ai_rationale, ai_model")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    const { error } = await context.supabase
      .from("case_meta_overrides")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    if (prevRow) {
      const { error: auditErr } = await context.supabase
        .from("case_meta_override_audit")
        .insert({
          user_id: context.userId,
          override_id: null, // row no longer exists
          case_key: prevRow.case_key,
          field: prevRow.field,
          action: "revert",
          source: prevRow.source,
          previous_value: prevRow.value as never,
          new_value: null,
          ai_model: prevRow.ai_model,
          ai_rationale: prevRow.ai_rationale,
        } as never);
      if (auditErr) console.warn("audit insert (revert) failed:", auditErr.message);
    }

    return { ok: true };
  });

/* ---------------------------------------------------- bulk revert (batch) */

const BulkRevertInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export type BulkRevertResult = {
  reverted_ids: string[];
  /** ids the caller asked to revert that did not exist or weren't owned by them. */
  skipped_ids: string[];
};

/**
 * Revert many overrides in a single request. Implemented as one bulk DELETE
 * (RLS-scoped to the caller) plus one bulk audit INSERT, so the database
 * round-trips are O(1) regardless of selection size.
 */
export const bulkRevertCaseMetaOverrides = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkRevertInput.parse(input))
  .handler(async ({ data, context }): Promise<BulkRevertResult> => {
    // De-dupe ids defensively — DELETE ... IN (...) tolerates duplicates,
    // but the audit insert should not write duplicate rows.
    const requestedIds = Array.from(new Set(data.ids));

    // Snapshot the rows we're about to delete so we can write the audit
    // trail with previous_value for each. RLS scopes to the caller.
    const { data: prevRows, error: snapErr } = await context.supabase
      .from("case_meta_overrides")
      .select("id, case_key, field, value, source, ai_rationale, ai_model")
      .eq("user_id", context.userId)
      .in("id", requestedIds);
    if (snapErr) throw new Error(snapErr.message);

    const snapshotById = new Map(
      ((prevRows ?? []) as Array<{
        id: string;
        case_key: string;
        field: string;
        value: JsonValue;
        source: "ai_suggested" | "manual";
        ai_rationale: string | null;
        ai_model: string | null;
      }>).map((r) => [r.id, r] as const),
    );

    const presentIds = Array.from(snapshotById.keys());
    const skippedIds = requestedIds.filter((id) => !snapshotById.has(id));

    if (presentIds.length === 0) {
      return { reverted_ids: [], skipped_ids: skippedIds };
    }

    const { error: delErr } = await context.supabase
      .from("case_meta_overrides")
      .delete()
      .eq("user_id", context.userId)
      .in("id", presentIds);
    if (delErr) throw new Error(delErr.message);

    const auditRows = presentIds.map((id) => {
      const r = snapshotById.get(id)!;
      return {
        user_id: context.userId,
        override_id: null, // row no longer exists
        case_key: r.case_key,
        field: r.field,
        action: "revert" as const,
        source: r.source,
        previous_value: r.value as never,
        new_value: null,
        ai_model: r.ai_model,
        ai_rationale: r.ai_rationale,
      };
    });
    const { error: auditErr } = await context.supabase
      .from("case_meta_override_audit")
      .insert(auditRows as never);
    if (auditErr) console.warn("audit insert (bulk revert) failed:", auditErr.message);

    return { reverted_ids: presentIds, skipped_ids: skippedIds };
  });

const ListAuditInput = z
  .object({
    caseKey: z.string().min(1).max(64).optional(),
    field: z.string().min(1).max(64).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  })
  .default({ limit: 50 });

/**
 * Discriminated-union envelope for the audit-trail list. Same shape rules as
 * `ListCaseMetaOverridesResult` — anonymous visitors get a typed
 * `unauthenticated` result instead of a thrown 401 Response.
 */
export type ListCaseMetaOverrideAuditResult =
  | { ok: true; rows: CaseMetaOverrideAuditRow[] }
  | {
      ok: false;
      error: "unauthenticated" | "config_missing" | "db_error";
      message: string;
    };

/**
 * Pure handler logic for `listCaseMetaOverrideAudit`, exported separately so
 * contract tests can exercise every branch without going through the
 * `createServerFn` client/server bridge (which rewrites return values and
 * makes raw-Response regressions hard to detect from a unit test).
 *
 * MUST match the behavior of the wrapped server fn 1:1.
 */
export async function listCaseMetaOverrideAuditHandler(
  data: { caseKey?: string; field?: string; limit: number },
): Promise<ListCaseMetaOverrideAuditResult> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return {
      ok: false,
      error: "config_missing",
      message: "Server is missing Supabase configuration.",
    };
  }

  const authHeader = getRequestHeader("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return {
      ok: false,
      error: "unauthenticated",
      message: "Sign in to view audit logs.",
    };
  }
  const token = authHeader.slice("bearer ".length).trim();
  if (!token) {
    return {
      ok: false,
      error: "unauthenticated",
      message: "Sign in to view audit logs.",
    };
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const claims = await supabase.auth.getClaims(token);
  if (claims.error || !claims.data?.claims?.sub) {
    return {
      ok: false,
      error: "unauthenticated",
      message: "Your session has expired — sign in again to view audit logs.",
    };
  }
  const userId = claims.data.claims.sub;

  let q = supabase
    .from("case_meta_override_audit")
    .select(
      "id, override_id, case_key, field, action, source, previous_value, new_value, ai_model, ai_rationale, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(data.limit);
  if (data.caseKey) q = q.eq("case_key", data.caseKey);
  if (data.field) q = q.eq("field", data.field);
  const { data: rows, error } = await q;
  if (error) {
    return { ok: false, error: "db_error", message: error.message };
  }
  return { ok: true, rows: (rows ?? []) as CaseMetaOverrideAuditRow[] };
}

export const listCaseMetaOverrideAudit = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders])
  .inputValidator((input: unknown) => ListAuditInput.parse(input ?? {}))
  .handler(({ data }) => listCaseMetaOverrideAuditHandler(data));

