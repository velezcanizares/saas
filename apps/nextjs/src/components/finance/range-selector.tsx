"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@saasfly/ui";

export const RANGE_OPTIONS = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "month", label: "Este mes" },
  { key: "year", label: "Este año" },
] as const;

/** Selector de rango de fechas para los reportes; navega por query param. */
export function RangeSelector({ current }: { current: string }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1">
      {RANGE_OPTIONS.map((o) => (
        <Link
          key={o.key}
          href={`${pathname}?range=${o.key}`}
          scroll={false}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm transition-colors",
            current === o.key
              ? "border-primary bg-primary text-primary-foreground"
              : "hover:bg-accent",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
