// A rent receipt in the owner's printable style C (5/10/2026): a dark band with the name and the receipt reference, the
// amount in a cream box with a gold edge, a short list of facts, and the owner's signature line. No logo, no stamp.
// A ₹1 revenue-stamp box appears only for cash above ₹5,000 (Indian Stamp Act). Light paper on screen and in print.
// Every value comes from /api/payments/[id]/invoice.
import { cx } from "@/components/ui";
import { inr } from "@/components/hud/format";
import { formatDate } from "@/lib/dates";
import type { InvoiceData } from "@/lib/schemas/payment";
import s from "./invoice.module.css";

const PAID_BY: Record<InvoiceData["method"], string> = { cash: "Cash", bank: "Bank transfer", upi: "UPI", other: "Other" };

/** Receipts for cash above ₹5,000 carry a ₹1 revenue stamp (Indian Stamp Act); bank / UPI receipts don't need one. */
const needsStamp = (inv: InvoiceData) => inv.method === "cash" && inv.amount > 5000;

export function Receipt({ inv, print = false }: { inv: InvoiceData; print?: boolean }) {
  const premises = [inv.property.unitName, inv.property.address ?? inv.property.townName].filter(Boolean).join(" · ");
  return (
    <article className={cx(s.cr, print && s.crPrint)} aria-label={`Rent receipt ${inv.invoiceNumber}`}>
      <header className={s.crBand}>
        <div>
          <span className={s.crName}>{inv.brand.brandName}</span>
          <span className={s.crSub}>{inv.property.townName}</span>
        </div>
        <div className={s.crRight}>
          <span className={s.crTitle}>Rent receipt</span>
          <span className={s.crSub}>
            {inv.invoiceNumber} · {formatDate(inv.issueDate)}
          </span>
        </div>
      </header>

      <div className={s.crIn}>
        <div className={s.crHero}>
          <div>
            <span className={s.crLbl}>Amount received</span>
            <span className={s.crAmount}>{inr(inv.amount)}</span>
            <span className={s.crWords}>{inv.amountInWords}</span>
          </div>
          <div className={s.crRight}>
            <span className={s.crLbl}>Rent for</span>
            <span className={s.crPeriod}>{inv.period.label}</span>
          </div>
        </div>

        <dl className={s.crList}>
          <div>
            <dt>Received from</dt>
            <dd>
              {inv.tenant.name}
              {inv.tenant.phone ? ` · ${inv.tenant.phone}` : ""}
            </dd>
          </div>
          <div>
            <dt>Property</dt>
            <dd>{premises}</dd>
          </div>
          <div>
            <dt>Paid by</dt>
            <dd>
              {PAID_BY[inv.method]} · {formatDate(inv.paymentDate)}
            </dd>
          </div>
          <div>
            <dt>Monthly rent</dt>
            <dd>{inr(inv.lease.monthlyRent)}</dd>
          </div>
        </dl>

        <div className={s.crSign}>
          {needsStamp(inv) && (
            <span className={s.crStamp}>
              Revenue
              <br />
              stamp
            </span>
          )}
          <span className={s.crSignLine}>Owner&rsquo;s signature</span>
        </div>
      </div>

      {inv.lease.securityDeposit > 0 && <footer className={s.crFoot}>Security deposit {inr(inv.lease.securityDeposit)} held separately</footer>}
    </article>
  );
}
