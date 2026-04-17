import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  identifier: string;
  children: ReactNode;
  reproducibility?: Array<{ label: string; value: string | null | undefined }>;
}

export function ReportLayout({ title, subtitle, identifier, children, reproducibility }: Props) {
  const generatedAt = new Date().toISOString();
  return (
    <main className="report-root mx-auto max-w-4xl px-6 py-8 print:py-0">
      <header className="report-header mb-8 border-b-2 border-foreground/70 pb-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">GridArena Research Report</p>
        <h1 className="report-title mt-1 text-3xl font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-base text-muted-foreground">{subtitle}</p>}
        <p className="mt-3 text-xs text-muted-foreground">
          ID: <span className="font-mono">{identifier}</span> · Generated {generatedAt}
        </p>
      </header>

      <div className="report-content">{children}</div>

      {reproducibility && reproducibility.length > 0 && (
        <footer className="report-footer mt-12 border-t border-border pt-4 text-xs text-muted-foreground">
          <p className="mb-2 font-semibold uppercase tracking-wide">Reproducibility</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {reproducibility.map((r) => (
              <div key={r.label} className="flex flex-col">
                <dt className="font-medium">{r.label}</dt>
                <dd className="font-mono text-[11px]">{r.value || "—"}</dd>
              </div>
            ))}
          </dl>
        </footer>
      )}
    </main>
  );
}
