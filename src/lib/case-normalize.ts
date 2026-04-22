// Normalize a benchmark case_name string to a canonical key, then map it to
// the equivalent supported case for the built-in or PyPSA simulator.
//
// Examples handled:
//   "IEEE 14"        → "ieee14"  (supported, builtin)
//   "ieee-14"        → "ieee14"
//   "ieee_14_bus"    → "ieee14"
//   "case14"         → "case14"  (supported, pypsa)
//   "Case 30"        → "case30"
//   "pglib_opf_case14_ieee" → "case14"
//   "ieee 4"         → "ieee4"   (unsupported)
//
// Returns:
//   - canonical: the normalized key (lowercase, no spaces/separators)
//   - supportedAs: which engine accepts this case ("builtin" | "pypsa" | null)
//   - mappedTo: the canonical name the simulator expects, if supported

export type SimulatorEngine = "builtin" | "pypsa";

export interface CaseNormalization {
  original: string;
  canonical: string;
  supportedAs: SimulatorEngine | null;
  mappedTo: string | null;
}

const BUILTIN_BUSES = new Set([9, 14, 30]);
const PYPSA_BUSES = new Set([5, 14, 30]);

/** Lowercase and strip separators/whitespace/underscores/hyphens/dots/"bus" suffix. */
function canonicalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\bbus(es)?\b/g, "")
    .replace(/[\s_\-.]+/g, "")
    .trim();
}

/** Extract a bus number from a canonicalized string, if present. */
function extractBusNumber(canonical: string): number | null {
  // Matches "ieee14", "case14", "pglibopfcase14ieee", "14", etc.
  const m = canonical.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return Number.isFinite(n) ? n : null;
}

export function normalizeCaseName(raw: string | null | undefined): CaseNormalization {
  const original = (raw ?? "").trim();
  const canonical = canonicalize(original);

  if (!canonical) {
    return { original, canonical: "", supportedAs: null, mappedTo: null };
  }

  // Direct canonical match
  if (/^ieee\d+$/.test(canonical)) {
    const n = extractBusNumber(canonical);
    if (n !== null && BUILTIN_BUSES.has(n)) {
      return { original, canonical, supportedAs: "builtin", mappedTo: `ieee${n}` };
    }
  }
  if (/^case\d+$/.test(canonical)) {
    const n = extractBusNumber(canonical);
    if (n !== null && PYPSA_BUSES.has(n)) {
      return { original, canonical, supportedAs: "pypsa", mappedTo: `case${n}` };
    }
  }

  // Fallback: extract bus number and try both engines.
  const busNum = extractBusNumber(canonical);
  if (busNum !== null) {
    const mentionsIeee = canonical.includes("ieee");
    const mentionsCase = canonical.includes("case") || canonical.includes("pglib");
    if (mentionsIeee && BUILTIN_BUSES.has(busNum)) {
      return { original, canonical, supportedAs: "builtin", mappedTo: `ieee${busNum}` };
    }
    if (mentionsCase && PYPSA_BUSES.has(busNum)) {
      return { original, canonical, supportedAs: "pypsa", mappedTo: `case${busNum}` };
    }
    // Bare number or ambiguous — accept if either engine supports it (prefer builtin).
    if (BUILTIN_BUSES.has(busNum)) {
      return { original, canonical, supportedAs: "builtin", mappedTo: `ieee${busNum}` };
    }
    if (PYPSA_BUSES.has(busNum)) {
      return { original, canonical, supportedAs: "pypsa", mappedTo: `case${busNum}` };
    }
  }

  return { original, canonical, supportedAs: null, mappedTo: null };
}

export function isSupportedCase(raw: string | null | undefined): boolean {
  return normalizeCaseName(raw).supportedAs !== null;
}
