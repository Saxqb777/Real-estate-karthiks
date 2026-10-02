"use client";
// Dock tab 6 — Payments: the latest rent received with receipt links (data.recentPayments).
import { ExternalLink, ReceiptIndianRupee } from "lucide-react";
import { Button, cx } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import { inr } from "../format";
import s from "./charts.module.css";

export interface PaymentsListProps {
  data: DashboardData;
  onRecord?: () => void;
  onPayment?: (id: string, invoiceNumber: string) => void;
  className?: string;
}

export function PaymentsList({ data, onRecord, onPayment, className }: PaymentsListProps) {
  const rows = data.recentPayments;
  return (
    <div className={cx(s.pay, className)}>
      <div className={s.payTableWrap}>
        {rows.length === 0 ? (
          <div className={s.empty}>No rent recorded yet.</div>
        ) : (
          <table className={s.payTable}>
            <thead>
              <tr>
                <th scope="col">Received</th>
                <th scope="col">Tenant</th>
                <th scope="col">Unit</th>
                <th scope="col">Receipt</th>
                <th scope="col" className={s.right}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={onPayment ? s.payRowBtn : undefined} onClick={onPayment ? () => onPayment(r.id, r.invoiceNumber) : undefined}>
                  <td className="num">{formatDate(r.paymentDate)}</td>
                  <td>{r.tenantName}</td>
                  <td className="dim">{r.unitName}</td>
                  <td>
                    <a className={s.invoice} href={`/invoice/${r.id}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
                      {r.invoiceNumber}
                      <ExternalLink aria-hidden />
                    </a>
                  </td>
                  <td className={cx(s.right, "num", s.tIncome)}>{inr(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <aside className={s.payAside}>
        <span className={s.payAsideLabel}>Overdue now</span>
        <span className={cx("num", s.payAsideValue, data.kpis.overdueAmount > 0 && s.tExpense)}>{inr(data.kpis.overdueAmount)}</span>
        <span className={s.payAsideNote}>{data.kpis.overdueAmount > 0 ? `${data.kpis.overdueMonths} months across ${data.kpis.overdueCount} ${data.kpis.overdueCount === 1 ? "tenant" : "tenants"}` : "Everyone is paid up"}</span>
        {onRecord && (
          <Button size="sm" variant="primary" icon={<ReceiptIndianRupee />} onClick={onRecord}>
            Record rent
          </Button>
        )}
      </aside>
    </div>
  );
}
