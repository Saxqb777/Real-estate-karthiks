"use client";
// Deposit refunds on a lease (owner, 4/11/2026: "add the receipt to the refund given and add a refund if I decide to
// refund more later"). Each refund = amount · day · ref no. (UTR) · its own 📎; refunds can be added later, changed or
// deleted. Once the tenancy has ended, what wasn't refunded is KEPT (income on the last day — calculations.depositRowFor).
// Simple (owner, 4/11/2026: "just keep it simple x, add, edit and add receipt"): each row has 📎 · ✏️ · ✕ and the
// header a + ; the amount / date / ref no. boxes only open for adding or changing one.
import { Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { PendingProofClip, ProofClip, usePendingProofs } from "@/components/proof";
import { Button, DateInput, Input, NumberInput, confirmDialog } from "@/components/ui";
import { api, useMutation } from "@/lib/client";
import { formatDate, toInputDate, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import type { DepositRefundDTO, LeaseDetail } from "@/lib/schemas/lease";
import { DetailSection, Stack2 } from "./shared";
import s from "./data.module.css";

const round2 = (n: number) => Math.round(n * 100) / 100;
const tidyRef = (v: string) => v.replace(/\s+/g, "").toUpperCase();

export function DepositRefunds({ lease: l }: { lease: LeaseDetail }) {
  const refunds = l.depositRefunds ?? [];
  const deposit = l.securityDeposit;
  // null = just the list; "add" = the add boxes; a refund id = that refund's boxes
  const [editing, setEditing] = useState<string | null>(null);
  const ended = l.state === "ended";
  // a tenant still living there gets their refund at Move out — the section shows once the tenancy has ended (or a
  // refund exists)
  if ((deposit <= 0 || !ended) && !refunds.length) return null;

  const refunded = round2(refunds.reduce((sum, r) => sum + r.amount, 0));
  const left = round2(Math.max(0, deposit - refunded));
  const editingRow = refunds.find((r) => r.id === editing) ?? null;
  const close = () => setEditing(null);

  return (
    <DetailSection
      title="Deposit refunds"
      aside={
        editing === null && left > 0 ? (
          <button type="button" className={s.iconLink} aria-label="Add a refund" title="Add a refund" onClick={() => setEditing("add")}>
            <Plus aria-hidden />
          </button>
        ) : (
          <span className={s.iconSlot} aria-hidden /> // keeps the heading the same height while the boxes are open
        )
      }
    >
      <ul className={s.miniList}>
        {refunds.map((r) =>
          r.id === editing ? null : <RefundRow key={r.id} lease={l} refund={r} onEdit={() => setEditing(r.id)} />,
        )}
        {refunds.length > 0 && (
          <li>
            <div className={s.miniRow} data-static>
              <Stack2 top={ended ? "Kept" : "Still held"} bottom={`of ${formatINR(deposit)}`} />
              <span className={s.miniRight}>
                <span className={ended && left > 0 ? "num pos" : "num"}>{formatINR(left)}</span>
                <span className={s.iconSpacer} />
              </span>
            </div>
          </li>
        )}
      </ul>
      {editingRow ? (
        <RefundForm key={editingRow.id} lease={l} refund={editingRow} left={round2(left + editingRow.amount)} onDone={close} />
      ) : (
        editing === "add" && <RefundForm key="add" lease={l} refund={null} left={left} onDone={close} />
      )}
    </DetailSection>
  );
}

function RefundRow({ lease: l, refund: r, onEdit }: { lease: LeaseDetail; refund: DepositRefundDTO; onEdit: () => void }) {
  const remove = useMutation(() => api<LeaseDetail>(`/api/leases/${l.id}/refunds/${r.id}`, { method: "DELETE" }), {
    success: "Refund deleted",
  });
  const what = r.amount === 0 ? "this entry" : `the ${formatINR(r.amount)} refund`;
  return (
    <li>
      <div className={s.miniRow} data-static>
        <Stack2
          top={r.amount === 0 ? "Nothing refunded" : <span className="num">{formatINR(r.amount)}</span>}
          bottom={[formatDate(r.refundDate), r.reference].filter(Boolean).join(" · ")}
        />
        <span className={s.miniRight}>
          <ProofClip owner={{ depositRefundId: r.id }} />
          <button type="button" className={s.iconLink} aria-label={`Change ${what}`} onClick={onEdit}>
            <Pencil aria-hidden />
          </button>
          <button
            type="button"
            className={s.iconLink}
            aria-label={`Delete ${what}`}
            disabled={remove.loading}
            onClick={async () => {
              const ok = await confirmDialog({ title: `Delete ${what}?`, confirmLabel: "Delete", tone: "danger" });
              if (ok) await remove.run();
            }}
          >
            <X aria-hidden />
          </button>
        </span>
      </div>
    </li>
  );
}

/** Add a refund (with files picked before saving), or change one (its files stay on its row's clip). */
function RefundForm({
  lease: l,
  refund,
  left,
  onDone,
}: {
  lease: LeaseDetail;
  refund: DepositRefundDTO | null;
  left: number;
  onDone: () => void;
}) {
  const today = toInputDate(todayIST());
  const [amount, setAmount] = useState<number | null>(refund ? refund.amount : null);
  const [date, setDate] = useState(refund ? toInputDate(refund.refundDate) : today);
  const [reference, setReference] = useState(refund?.reference ?? "");
  const pending = usePendingProofs();
  const body = { amount, refundDate: date, reference: reference || null };

  const save = useMutation(
    async () => {
      if (refund) return api<LeaseDetail>(`/api/leases/${l.id}/refunds/${refund.id}`, { method: "PATCH", body });
      const res = await api<{ refund: { id: string } }>(`/api/leases/${l.id}/refunds`, { method: "POST", body });
      await pending.uploadTo({ depositRefundId: res.refund.id });
      return res;
    },
    { success: refund ? "Refund saved" : "Refund added", onSuccess: onDone },
  );
  // ₹0 = "nothing refunded", which only stands alone; all refunds together can't pass the deposit
  const others = (l.depositRefunds ?? []).filter((r) => r.id !== refund?.id).length;
  const ready = amount !== null && (amount > 0 || others === 0) && amount <= left && Boolean(date);

  return (
    <form
      className={s.refundForm}
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void save.run();
      }}
    >
      <NumberInput compact currency hideHint aria-label="Amount refunded" placeholder="Refund" value={amount} onValueChange={setAmount} max={left} />
      <DateInput compact aria-label="Refunded on" value={date} max={today} min={toInputDate(l.startDate)} onValueChange={setDate} />
      <Input
        compact
        aria-label="Refund ref no. (UTR)"
        placeholder="Ref no. (UTR)"
        value={reference}
        maxLength={60}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        onChange={(e) => setReference(tidyRef(e.target.value))}
        suffix={refund ? undefined : <PendingProofClip pending={pending} />}
      />
      <span className={s.refundActions}>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!ready} loading={save.loading}>
          {refund ? "Save" : "Add"}
        </Button>
      </span>
    </form>
  );
}
