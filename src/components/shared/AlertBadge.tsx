import { clsx } from "clsx";

type AlertType = "PA" | "PIP" | "EXIT";
type Severity = "green" | "amber" | "red" | "gray";

interface AlertBadgeProps {
  type: AlertType | string;
  label?: string;
  size?: "sm" | "md";
}

const TYPE_CONFIG: Record<string, { label: string; severity: Severity }> = {
  PA: { label: "PA", severity: "amber" },
  PIP: { label: "PIP", severity: "red" },
  EXIT: { label: "EXIT", severity: "red" },
};

const SEVERITY_CLASSES: Record<Severity, string> = {
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-gray-100 text-gray-600",
};

export function AlertBadge({ type, label, size = "sm" }: AlertBadgeProps) {
  const config = TYPE_CONFIG[type] ?? { label: type, severity: "gray" as Severity };
  const displayLabel = label ?? config.label;

  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-full",
        SEVERITY_CLASSES[config.severity],
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
      role="status"
      aria-label={`Alert: ${displayLabel}`}
    >
      {displayLabel}
    </span>
  );
}
