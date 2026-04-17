import type { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  description?: string;
}

export function ReportSection({ title, children, description }: Props) {
  return (
    <section className="report-section mb-8 break-inside-avoid">
      <h2 className="report-heading mb-2 text-xl font-semibold border-b border-border pb-2">{title}</h2>
      {description && <p className="mb-3 text-sm text-muted-foreground italic">{description}</p>}
      <div className="report-body">{children}</div>
    </section>
  );
}
