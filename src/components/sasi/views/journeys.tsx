"use client";

/* Journeys list — placeholder scaffold. Task 28 (Agent C) replaces this
   with the real journey catalogue backed by the service registry. */

import { Route } from "lucide-react";

import { EmptyState } from "@/components/sasi/primitives";

export default function JourneysView() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <EmptyState
        icon={Route}
        title="Step-by-step journeys"
        description="Guided service journeys are being connected to real service data. Check back shortly."
      />
    </div>
  );
}
