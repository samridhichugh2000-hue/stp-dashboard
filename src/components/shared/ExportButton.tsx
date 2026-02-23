"use client";

import { Download } from "lucide-react";

interface ExportButtonProps {
  label?: string;
  onExport?: () => void;
}

export function ExportButton({ label = "Export PDF", onExport }: ExportButtonProps) {
  function handlePrint() {
    onExport?.();
    window.print();
  }

  return (
    <button
      onClick={handlePrint}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors no-print"
      aria-label={label}
    >
      <Download size={13} />
      {label}
    </button>
  );
}
