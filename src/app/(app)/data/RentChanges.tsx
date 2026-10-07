"use client";
// Rent changes on a lease (owner, 7/10/2026): the starting rent, each rent change from its month, and an inline row to
// add one (month + new rent). Months before a change keep their old rent; the maths lives in calculations.rentForMonth.
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button, NumberInput, Select, confirmDialog } from "@/components/ui";
import { api, useMutation } from "@/lib/client";
import { periodLabel, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import type { LeaseDetail } from "@/lib/schemas/lease";
import { DetailSection, Stack2 } from "./shared";
import s from "./data.module.css";

const monthNo = (iso: string | Date) => {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
};
const toKey = (mi: number) => `${Math.floor(mi / 12)}-${String((mi % 12) + 1).padStart(2, "0")}`;
const labelOf = (mi: number) => periodLabel({ year: Math.floor(mi / 12), month: (mi % 12) + 1 });

/** Months a rent change can start: the lease's 2nd month → its last month (open leases: 12 months past today). */
function monthChoices(l: LeaseDetail): number[] {
  const first = monthNo(l.startDate) + 1;
  const last = l.endDate ? monthNo(l.endDate) : monthNo(todayIST()) + 12;
  const out: number[] = [];
  for (let mi = first; mi <= last; mi++) out.push(mi);
  return out;
}

export function RentChanges({ lease: l }: { lease: LeaseDetail }) {
  const choices = monthChoices(l);
  const now = monthNo(todayIST());
  const [month, setMonth] = useState(() => toKey(choices.includes(now) ? now : (choices.find((m) => m > now) ?? choices[choices.length - 1] ?? now)));
  const [rent, setRent] = useState<number | null>(null);
  const changes = l.rentChanges ?? [];

  const add = useMutation(
    () => api<LeaseDetail>(`/api/leases/${l.id}/rent-changes`, { method: "POST", body: { fromMonth: month, monthlyRent: rent } }),
    { success: () => `Rent from ${labelOf(monthNo(`${month}-01T00:00:00Z`))} saved`, onSuccess: () => setRent(null) },
  );
  const remove = useMutation((id: string) => api<LeaseDetail>(`/api/leases/${l.id}/rent-changes/${id}`, { method: "DELETE" }), {
    success: "Rent change removed",
  });

  if (!choices.length && !changes.length) return null;

  return (
    <DetailSection title="Rent changes">
      <ul className={s.miniList}>
        <li>
          <div className={s.miniRow} data-static>
            <Stack2 top="Starting rent" bottom={`from ${labelOf(monthNo(l.startDate))}`} />
            <span className={s.miniRight}>
              <span className="num">{formatINR(l.startingRent ?? l.monthlyRent)}</span>
              <span className={s.iconSpacer} />
            </span>
          </div>
        </li>
        {changes.map((c) => (
          <li key={c.id}>
            <div className={s.miniRow} data-static>
              <Stack2 top="New rent" bottom={`from ${labelOf(monthNo(c.effectiveFrom))}`} />
              <span className={s.miniRight}>
                <span className="num">{formatINR(c.monthlyRent)}</span>
                <button
                  type="button"
                  className={s.iconLink}
                  aria-label={`Remove the rent change from ${labelOf(monthNo(c.effectiveFrom))}`}
                  disabled={remove.loading}
                  onClick={async () => {
                    const ok = await confirmDialog({
                      title: `Remove the rent change from ${labelOf(monthNo(c.effectiveFrom))}?`,
                      confirmLabel: "Remove",
                      tone: "danger",
                    });
                    if (ok) await remove.run(c.id);
                  }}
                >
                  <X aria-hidden />
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {choices.length > 0 && (
        <form
          className={s.rentChangeRow}
          onSubmit={(e) => {
            e.preventDefault();
            if (rent) void add.run();
          }}
        >
          <Select
            compact
            aria-label="New rent from"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            options={choices.map((mi) => ({ value: toKey(mi), label: `From ${labelOf(mi)}` }))}
          />
          <NumberInput compact currency hideHint aria-label="New monthly rent" placeholder="New rent" value={rent} onValueChange={setRent} />
          <Button type="submit" size="sm" icon={<Plus />} disabled={!rent} loading={add.loading}>
            Rent change
          </Button>
        </form>
      )}
    </DetailSection>
  );
}
