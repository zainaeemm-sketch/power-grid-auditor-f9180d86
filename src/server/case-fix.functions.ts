import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";

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

export const listCaseMetaOverrides = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }): Promise<CaseMetaOverrideRow[]> => {
    const { data, error } = await context.supabase
      .from("case_meta_overrides")
      .select("id, case_key, field, value, source, ai_rationale, ai_model, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CaseMetaOverrideRow[];
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

const ListAuditInput = z
  .object({
    caseKey: z.string().min(1).max(64).optional(),
    field: z.string().min(1).max(64).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  })
  .default({ limit: 50 });

export const listCaseMetaOverrideAudit = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => ListAuditInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<CaseMetaOverrideAuditRow[]> => {
    let q = context.supabase
      .from("case_meta_override_audit")
      .select(
        "id, override_id, case_key, field, action, source, previous_value, new_value, ai_model, ai_rationale, created_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.caseKey) q = q.eq("case_key", data.caseKey);
    if (data.field) q = q.eq("field", data.field);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as CaseMetaOverrideAuditRow[];
  });

