import React from 'react';
import { cn } from "@/lib/utils";

interface StatusPillProps {
  status: 'draft' | 'in-review' | 'publish' | string;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const label = status === 'in-review' ? 'In Review' : status === 'publish' ? 'Publish' : status;
  return (
    <div className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide",
      status === 'publish' ? "bg-green-500/20 text-green-400" :
      status === 'in-review' ? "bg-amber-500/20 text-amber-400" :
      "bg-slate-500/20 text-slate-400",
      className
    )}>
      {label}
    </div>
  );
}
