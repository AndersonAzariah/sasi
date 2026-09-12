"use client";

/* Documents — placeholder scaffold. Task 28 (Agent D) replaces this with
   the real document intelligence flow: upload → analyse → summary →
   important information → dates → actions → ask → delete. */

import { FileText } from "lucide-react";

import { EmptyState } from "@/components/sasi/primitives";

export default function DocumentsView() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <EmptyState
        icon={FileText}
        title="Your documents"
        description="Document intelligence is being connected. You will be able to analyse, summarise and delete your own documents here."
      />
    </div>
  );
}
