// A rent receipt, design D "modern" (owner picked D, 9/10/2026 — no footer, no town under the heading): the brand in
// small gold capitals, "Rent receipt" + its number, AMOUNT PAID · DATE PAID · PAID BY, a summary of the rent month (its
// rent, anything paid for it earlier, this payment, the balance left — calculations receiptMonthFor), the amount in
// words, who paid + the property, and the owner's signature. A ₹1 revenue-stamp box appears only for cash above ₹5,000
// (Indian Stamp Act). Light paper on screen and in print. Every value comes from /api/payments/[id]/invoice.
import { cx } from "@/components/ui";
import { inr, phoneText } from "@/components/hud/format";
import { formatDate } from "@/lib/dates";
import type { InvoiceData } from "@/lib/schemas/payment";
import s from "./invoice.module.css";

const PAID_BY: Record<InvoiceData["method"], string> = { cash: "Cash", bank: "Bank transfer", upi: "UPI", other: "Other" };

/** Receipts for cash above ₹5,000 carry a ₹1 revenue stamp (Indian Stamp Act); bank / UPI receipts don't need one. */
const needsStamp = (inv: InvoiceData) => inv.method === "cash" && inv.amount > 5000;

export function Receipt({ inv, print = false }: { inv: InvoiceData; print?: boolean }) {
  const { month } = inv;
  // the property's address + town (the town only when the address doesn't already name it)
  const addr = inv.property.address?.trim() || "";
  const town = inv.property.townName;
  const where = !addr ? town : addr.toLowerCase().includes(town.toLowerCase()) ? addr : `${addr}, ${town}`;
  return (
    <article className={cx(s.rc, print && s.rcPrint)} aria-label={`Rent receipt ${inv.invoiceNumber}`}>
      <span className={s.rcBrand}>{inv.brand.brandName}</span>
      <h2 className={s.rcTitle}>Rent receipt</h2>
      <span className={s.rcSub}>Receipt {inv.invoiceNumber}</span>

      <div className={s.rcKpis}>
        <div>
          <span className={s.rcLbl}>Amount paid</span>
          <b className={cx(s.rcBig, s.rcNum)}>{inr(inv.amount)}</b>
        </div>
        <div>
          <span className={s.rcLbl}>Date paid</span>
          <b className={s.rcNum}>{formatDate(inv.paymentDate)}</b>
        </div>
        <div>
          <span className={s.rcLbl}>Paid by</span>
          <b>{PAID_BY[inv.method]}</b>
        </div>
      </div>

      <span className={cx(s.rcLbl, s.rcH)}>Summary</span>
      <div className={s.rcSum}>
        <div>
          <span>
            Rent · {inv.period.label} · {inv.property.unitName}
          </span>
          <span className={s.rcNum}>{inr(month.rent)}</span>
        </div>
        {month.paidBefore > 0 && (
          <div className={s.rcMute}>
            <span>Paid earlier</span>
            <span className={s.rcNum}>{inr(month.paidBefore)}</span>
          </div>
        )}
        <div className={s.rcMute}>
          <span>Amount paid</span>
          <span className={s.rcNum}>{inr(inv.amount)}</span>
        </div>
        <div className={s.rcTot}>
          <span>{month.balance < 0 ? "Extra paid" : `Balance for ${inv.period.label}`}</span>
          <span className={s.rcNum}>{inr(Math.abs(month.balance))}</span>
        </div>
      </div>
      <span className={s.rcWords}>{inv.amountInWords}</span>

      <div className={s.rcParties}>
        <div>
          <span className={s.rcLbl}>From</span>
          <b>{inv.tenant.name}</b>
          {inv.tenant.phone && <span className={s.rcNum}>{phoneText(inv.tenant.phone)}</span>}
        </div>
        <div>
          <span className={s.rcLbl}>Property</span>
          <b>{inv.property.unitName}</b>
          {where && <span>{where}</span>}
        </div>
      </div>

      <div className={s.rcSign}>
        {needsStamp(inv) && (
          <span className={s.rcStamp}>
            Revenue
            <br />
            stamp
          </span>
        )}
        <span className={s.rcSignLine}>Owner&rsquo;s signature</span>
      </div>
    </article>
  );
}
