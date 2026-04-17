interface Props {
  headers: string[];
  rows: (string | number | null | undefined)[][];
  caption?: string;
}

export function ReportTable({ headers, rows, caption }: Props) {
  return (
    <table className="report-table w-full text-sm border-collapse">
      {caption && <caption className="caption-bottom mt-2 text-xs text-muted-foreground italic">{caption}</caption>}
      <thead>
        <tr className="border-b-2 border-foreground/60">
          {headers.map((h) => (
            <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={`border-b border-border/50 ${i % 2 === 1 ? "bg-muted/30" : ""}`}>
            {row.map((cell, j) => (
              <td key={j} className="px-3 py-2 align-top">{cell ?? "—"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
