import { Link } from "@tanstack/react-router";
import { Github } from "lucide-react";
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
        {" · "}
        <a
          href="https://github.com/zainaeemm-sketch/power-grid-auditor-f9180d86"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
          aria-label="View source on GitHub"
        >
          <Github className="h-3.5 w-3.5" />
          GitHub
        </a>
        . Designed by {authors} in collaboration with {CITATION.affiliation}!
      </div>
    </footer>
  );
}
