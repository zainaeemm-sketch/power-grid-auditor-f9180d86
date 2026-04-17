import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Download, Image as ImageIcon } from "lucide-react";
import { downloadSvg, downloadPng } from "@/lib/svg-export";

interface Props {
  title: string;
  filenameBase: string;
  children: ReactNode;
  caption?: string;
}

export function ReportChart({ title, filenameBase, children, caption }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const findSvg = (): SVGSVGElement | null =>
    wrapRef.current?.querySelector("svg") ?? null;

  return (
    <figure className="report-chart mb-6 break-inside-avoid">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="flex gap-1 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const svg = findSvg();
              if (svg) downloadSvg(svg, `${filenameBase}.svg`);
            }}
          >
            <Download className="mr-1 h-3 w-3" /> SVG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const svg = findSvg();
              if (svg) downloadPng(svg, `${filenameBase}.png`);
            }}
          >
            <ImageIcon className="mr-1 h-3 w-3" /> PNG
          </Button>
        </div>
      </div>
      <div ref={wrapRef} className="rounded-md border border-border bg-card p-3">
        {children}
      </div>
      {caption && <figcaption className="mt-2 text-xs text-muted-foreground italic">{caption}</figcaption>}
    </figure>
  );
}
