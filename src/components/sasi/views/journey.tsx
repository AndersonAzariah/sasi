"use client";

/* Single journey run — placeholder scaffold. Task 28 (Agent C) replaces
   this with the real journey runner (start / pause / resume / step
   completion, persisted in the JourneyRun table). */

import { Route } from "lucide-react";

import { EmptyState } from "@/components/sasi/primitives";

export default function JourneyView() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <EmptyState
        icon={Route}
        title="Journey"
        description="This journey is being connected. Open it again from Services or Ask SASI."
      />
    </div>
  );
}
