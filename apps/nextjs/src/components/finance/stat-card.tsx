import * as React from "react";

import { cn } from "@saasfly/ui";
import { Card, CardContent } from "@saasfly/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  /** Colorea el valor: positivo (verde), negativo (rojo) o neutro. */
  tone?: "default" | "positive" | "negative";
}

export function StatCard({ label, value, hint, icon, tone = "default" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums tracking-tight",
              tone === "positive" && "text-emerald-600 dark:text-emerald-400",
              tone === "negative" && "text-red-600 dark:text-red-400",
            )}
          >
            {value}
          </p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && <div className="text-muted-foreground/70">{icon}</div>}
      </CardContent>
    </Card>
  );
}
