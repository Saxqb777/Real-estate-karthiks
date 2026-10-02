"use client";
// PLACEHOLDER — the reports agent replaces this file. Data → Reports renders <ReportsHub /> inside a one-screen panel
// (a flex column with min-height: 0; scroll inside your own content).
import { FileText } from "lucide-react";
import { EmptyState, Panel } from "@/components/ui";

export function ReportsHub() {
  return (
    <Panel fill eyebrow="Printable" title="Reports">
      <EmptyState
        art={<FileText width={56} height={56} aria-hidden />}
        title="Reports are on the way"
        description="Annual statement, unit story and rent ledger — printable, and always matching the dashboard."
      />
    </Panel>
  );
}

export default ReportsHub;
