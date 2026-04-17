import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Printer, FileDown, FileText, ArrowLeft } from "lucide-react";

interface Props {
  backTo: string;
  backLabel?: string;
  onPrint?: () => void;
  onCsv?: () => void;
  onLatex?: () => void;
}

export function ReportToolbar({ backTo, backLabel = "Back", onPrint, onCsv, onLatex }: Props) {
  return (
    <div className="report-toolbar sticky top-0 z-30 mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/90 py-3 backdrop-blur print:hidden">
      <Button variant="ghost" size="sm" asChild>
        <Link to={backTo}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          {backLabel}
        </Link>
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        {onCsv && (
          <Button variant="outline" size="sm" onClick={onCsv}>
            <FileDown className="mr-1.5 h-3.5 w-3.5" /> CSV
          </Button>
        )}
        {onLatex && (
          <Button variant="outline" size="sm" onClick={onLatex}>
            <FileText className="mr-1.5 h-3.5 w-3.5" /> LaTeX
          </Button>
        )}
        <Button variant="default" size="sm" onClick={onPrint ?? (() => window.print())}>
          <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / PDF
        </Button>
      </div>
    </div>
  );
}
