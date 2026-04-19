/**
 * GridArena citation metadata.
 *
 * Edit this file to personalize author / affiliation. All citation
 * displays across the app (/about, /docs, README) read from here.
 */

export const CITATION = {
  title: "GridArena: An LLM Agent Research Platform for Power System Operations",
  shortTitle: "GridArena",
  authors: ["Zain Naeem"],
  affiliation: "University of Palermo",
  year: 2026,
  url: "https://gridarena.eu",
  version: "1.0",
} as const;

export function citationApa(): string {
  const authors = CITATION.authors.join(", ");
  return `${authors} (${CITATION.year}). ${CITATION.title} (Version ${CITATION.version}) [Computer software]. ${CITATION.url}`;
}

export function citationBibtex(): string {
  const key = `gridarena${CITATION.year}`;
  const authorField = CITATION.authors.join(" and ");
  return `@software{${key},
  title   = {${CITATION.title}},
  author  = {${authorField}},
  year    = {${CITATION.year}},
  version = {${CITATION.version}},
  url     = {${CITATION.url}},
  note    = {${CITATION.affiliation}}
}`;
}
