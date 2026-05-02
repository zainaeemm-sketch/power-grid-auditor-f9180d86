/**
 * Unit tests for `normalizeServerFnError`.
 *
 * Goal: prove the helper turns every "weird" thrown value (raw `Response`
 * objects from server-fn middleware, `Error` instances, plain strings, etc.)
 * into a consistent `{ silent, status, message }` triple. A regression here
 * would let `[object Response]` bubble back into the UI as a blank screen.
 */
import { describe, expect, it } from "vitest";
import { normalizeServerFnError } from "./server-fn-errors";

/* ---------------------------------------------------------------- helpers */

function makeResponse(status: number, body: string | null = null): Response {
  // Some statuses (204/205/304) refuse to construct with a body. Use null
  // for those — the helper still needs to behave correctly.
  return new Response(body, { status });
}

/* ------------------------------------------------------------------ tests */

describe("normalizeServerFnError", () => {
  describe("Response objects (the original blank-screen cause)", () => {
    it("normalizes a 401 with body text and marks it silent", async () => {
      const res = await normalizeServerFnError(
        makeResponse(401, "Unauthorized — please sign in"),
        "Failed to load",
      );
      expect(res).toEqual({
        silent: true,
        status: 401,
        message: "Unauthorized — please sign in",
      });
    });

    it("normalizes a 403 and marks it silent (auth required, not actionable)", async () => {
      const res = await normalizeServerFnError(
        makeResponse(403, "Forbidden"),
        "Failed to load",
      );
      expect(res.silent).toBe(true);
      expect(res.status).toBe(403);
      expect(res.message).toBe("Forbidden");
    });

    it("normalizes a 500 as NOT silent so the UI surfaces a toast", async () => {
      const res = await normalizeServerFnError(
        makeResponse(500, "Internal Server Error"),
        "Failed to load",
      );
      expect(res).toEqual({
        silent: false,
        status: 500,
        message: "Internal Server Error",
      });
    });

    it("falls back to 'fallback (HTTP <status>)' when the body is empty", async () => {
      const res = await normalizeServerFnError(
        makeResponse(401, ""),
        "Failed to load audit log",
      );
      expect(res).toEqual({
        silent: true,
        status: 401,
        message: "Failed to load audit log (HTTP 401)",
      });
    });

    it("falls back to '<fallback> (HTTP <status>)' for bodyless statuses (204)", async () => {
      const res = await normalizeServerFnError(
        makeResponse(204),
        "Refresh failed",
      );
      // 204 has no body → text() returns "" → fallback string used.
      expect(res.silent).toBe(false);
      expect(res.status).toBe(204);
      expect(res.message).toBe("Refresh failed (HTTP 204)");
    });

    it("never returns the literal '[object Response]' for any status", async () => {
      for (const status of [400, 401, 403, 404, 418, 429, 500, 502, 503]) {
        const res = await normalizeServerFnError(
          makeResponse(status, status === 401 ? "" : `boom ${status}`),
          "fallback",
        );
        expect(res.message).not.toContain("[object Response]");
        expect(res.status).toBe(status);
        expect(typeof res.message).toBe("string");
        expect(res.message.length).toBeGreaterThan(0);
        expect(res.silent).toBe(status === 401 || status === 403);
      }
    });

    it("survives a Response whose body has already been consumed", async () => {
      const r = makeResponse(500, "first read");
      // Drain the body so a second .text() throws — the helper must still
      // return a valid envelope, falling back to the HTTP-status string.
      await r.text();
      const res = await normalizeServerFnError(r, "Backend exploded");
      expect(res.silent).toBe(false);
      expect(res.status).toBe(500);
      expect(res.message).toBe("Backend exploded (HTTP 500)");
    });
  });

  describe("Error instances", () => {
    it("uses error.message and is never silent", async () => {
      const res = await normalizeServerFnError(
        new Error("DB connection refused"),
        "Failed to load",
      );
      expect(res).toEqual({ silent: false, message: "DB connection refused" });
      expect(res.status).toBeUndefined();
    });

    it("falls back to the fallback when error.message is empty", async () => {
      const res = await normalizeServerFnError(new Error(""), "Falling back");
      expect(res).toEqual({ silent: false, message: "Falling back" });
    });

    it("handles subclasses of Error (e.g. TypeError)", async () => {
      const res = await normalizeServerFnError(
        new TypeError("not a function"),
        "Failed",
      );
      expect(res.silent).toBe(false);
      expect(res.message).toBe("not a function");
    });
  });

  describe("Unknown thrown values", () => {
    it("returns the fallback for thrown strings", async () => {
      const res = await normalizeServerFnError("nope", "Default message");
      expect(res).toEqual({ silent: false, message: "Default message" });
    });

    it("returns the fallback for thrown plain objects", async () => {
      const res = await normalizeServerFnError(
        { code: "X" },
        "Default message",
      );
      expect(res).toEqual({ silent: false, message: "Default message" });
    });

    it("returns the fallback for null/undefined", async () => {
      const a = await normalizeServerFnError(null, "fb");
      const b = await normalizeServerFnError(undefined, "fb");
      expect(a).toEqual({ silent: false, message: "fb" });
      expect(b).toEqual({ silent: false, message: "fb" });
    });
  });

  describe("Shape contract", () => {
    it("always resolves to an object with the documented keys", async () => {
      const inputs: unknown[] = [
        makeResponse(401, "x"),
        makeResponse(500, "x"),
        new Error("e"),
        "string",
        null,
      ];
      for (const input of inputs) {
        const res = await normalizeServerFnError(input, "fb");
        expect(typeof res).toBe("object");
        expect(res).not.toBeNull();
        expect(typeof res.silent).toBe("boolean");
        expect(typeof res.message).toBe("string");
        // status is optional; when present it must be a number
        if (res.status !== undefined) expect(typeof res.status).toBe("number");
      }
    });
  });
});
