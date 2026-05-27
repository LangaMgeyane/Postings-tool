import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2 p-4 border border-border rounded-lg bg-card/50">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/4" />
      <div className="flex gap-2 mt-2">
        <Skeleton className="h-4 w-12 rounded-full" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
    </div>
  );
}
