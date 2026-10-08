"use client";
// Renew a rental agreement (owner 8/10/2026): the usual 11 months, from the day after the current one ends (or from the
// lease's first day when none is recorded yet). One click + confirm → PUT /api/leases/[id] { agreementEndDate }.
import { RefreshCw } from "lucide-react";
import { Button, confirmDialog, type ButtonProps } from "@/components/ui";
import { api, useMutation } from "@/lib/client";
import { formatDate, toInputDate, todayIST } from "@/lib/dates";
import { elevenMonthsFrom } from "./data";

/** The end of the next 11-month agreement (YYYY-MM-DD): from the day after the current one ends, else from the start. */
export function nextAgreementEnd(currentEnd: string | null | undefined, startDate?: string): string {
  if (!currentEnd) return elevenMonthsFrom((startDate ?? toInputDate(todayIST())).slice(0, 10));
  const d = new Date(`${currentEnd.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return elevenMonthsFrom(d.toISOString().slice(0, 10));
}

export interface RenewAgreementButtonProps {
  lease: { id: string; startDate?: string; agreementEndDate: string | null };
  tenantName: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}

export function RenewAgreementButton({ lease, tenantName, size = "sm", variant = "secondary" }: RenewAgreementButtonProps) {
  const to = nextAgreementEnd(lease.agreementEndDate, lease.startDate);
  const renew = useMutation(() => api(`/api/leases/${lease.id}`, { method: "PUT", body: { agreementEndDate: to } }), {
    success: `Agreement renewed to ${formatDate(to)}`,
  });
  return (
    <Button
      size={size}
      variant={variant}
      icon={<RefreshCw />}
      loading={renew.loading}
      onClick={async () => {
        const ok = await confirmDialog({ title: `Renew ${tenantName}'s agreement?`, message: `11 months, to ${formatDate(to)}.`, confirmLabel: "Renew" });
        if (ok) await renew.run();
      }}
    >
      Renew 11 months
    </Button>
  );
}
