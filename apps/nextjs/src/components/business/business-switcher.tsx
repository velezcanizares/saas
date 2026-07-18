"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { cn } from "@saasfly/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@saasfly/ui/dropdown-menu";
import * as Icons from "@saasfly/ui/icons";

// Debe coincidir con ACTIVE_BUSINESS_COOKIE en ~/lib/business (server-only).
const ACTIVE_BUSINESS_COOKIE = "activeBusinessId";

interface BusinessOption {
  id: string;
  name: string;
  role?: string;
}

export function BusinessSwitcher({
  businesses,
  activeId,
}: {
  businesses: BusinessOption[];
  activeId?: string;
}) {
  const router = useRouter();
  if (businesses.length === 0) return null;

  const active = businesses.find((b) => b.id === activeId) ?? businesses[0]!;

  // Un solo negocio: etiqueta estática, sin dropdown.
  if (businesses.length === 1) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icons.Store className="h-4 w-4 text-muted-foreground" />
        <span className="max-w-[160px] truncate">{active.name}</span>
      </div>
    );
  }

  function selectBusiness(id: string) {
    if (id === active.id) return;
    document.cookie = `${ACTIVE_BUSINESS_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent">
        <Icons.Store className="h-4 w-4 text-muted-foreground" />
        <span className="max-w-[160px] truncate">{active.name}</span>
        <Icons.ArrowRight className="h-3 w-3 rotate-90 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {businesses.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onSelect={() => selectBusiness(b.id)}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate">{b.name}</span>
            {b.id === active.id && (
              <Icons.Check className={cn("h-4 w-4 shrink-0")} />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
