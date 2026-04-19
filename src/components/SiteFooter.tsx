import { Link } from "@tanstack/react-router";
import { CITATION } from "@/lib/citation";

export function SiteFooter() {
  const authors = CITATION.authors.join(", ");
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-muted-foreground">
        GridArena {CITATION.year} · v{CITATION.version} ·{" "}
        <Link to="/docs" className="text-primary underline-offset-4 hover:underline">
          Docs
        </Link>
        . Designed by {authors} in collaboration with {CITATION.affiliation}!
      </div>
    </footer>
  );
}
