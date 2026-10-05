// A rent receipt as printed in Tamil Nadu receipt books: "Received with thanks from … the sum of Rupees … towards
// rent for …", the amount in a box, a revenue-stamp box for cash over ₹5,000, and the landlord's signature line.
// Light paper in both places (screen preview and print). Every value comes from /api/payments/[id]/invoice.
import { useId } from "react";
import { PrintMark } from "@/components/reports/print";
import { cx } from "@/components/ui";
import { inr } from "@/components/hud/format";
import { formatDate } from "@/lib/dates";
import type { InvoiceData } from "@/lib/schemas/payment";
import s from "./invoice.module.css";

const PAID_BY: Record<InvoiceData["method"], string> = { cash: "Cash", bank: "Bank transfer", upi: "UPI", other: "Other" };

/** Receipts for cash above ₹5,000 carry a ₹1 revenue stamp (Indian Stamp Act); bank / UPI receipts don't need one. */
const needsStamp = (inv: InvoiceData) => inv.method === "cash" && inv.amount > 5000;

/** "18 JUL 2026" for the round stamp. */
function stampDate(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function Receipt({ inv, print = false }: { inv: InvoiceData; print?: boolean }) {
  const premises = [`${inv.property.unitName} (${inv.property.unitType})`, inv.property.address ?? inv.property.townName].filter(Boolean).join(", ");
  return (
    <article className={cx(s.receipt, print && s.receiptPrint)} aria-label={`Rent receipt ${inv.invoiceNumber}`}>
      <span className={s.band} aria-hidden />

      <header className={s.head}>
        <div className={s.brand}>
          <PrintMark size={print ? 40 : 46} className={s.mark} />
          <div className={s.brandText}>
            <span className={s.brandName}>{inv.brand.brandName}</span>
            <span className={s.brandSub}>
              {inv.brand.subtitle && <span>{inv.brand.subtitle}</span>}
            </span>
          </div>
        </div>
        <div className={s.title}>
          <span className={s.titleEn}>Rent receipt</span>
        </div>
      </header>

      <div className={s.meta}>
        <span>
          Receipt no. <b className={s.metaNum}>{inv.invoiceNumber}</b>
        </span>
        <span>
          Date <b className={s.metaNum}>{formatDate(inv.issueDate)}</b>
        </span>
      </div>

      <div className={s.body}>
        <p className={s.line}>
          <span className={s.lbl}>Received with thanks from</span>
          <span className={s.fill}>
            {inv.tenant.name}
            {inv.tenant.phone && <span className={s.fillDim}> · {inv.tenant.phone}</span>}
          </span>
        </p>
        <p className={s.line}>
          <span className={s.lbl}>the sum of</span>
          <span className={cx(s.fill, s.words)}>{inv.amountInWords}</span>
        </p>
        <p className={s.lineSplit}>
          <span className={s.line}>
            <span className={s.lbl}>towards rent for</span>
            <span className={s.fill}>{inv.period.label}</span>
          </span>
          <span className={s.line}>
            <span className={s.lbl}>paid by</span>
            <span className={s.fill}>
              {PAID_BY[inv.method]} on {formatDate(inv.paymentDate)}
            </span>
          </span>
        </p>
        <p className={s.line}>
          <span className={s.lbl}>for the premises</span>
          <span className={s.fill}>{premises}</span>
        </p>
        {inv.notes && (
          <p className={s.line}>
            <span className={s.lbl}>note</span>
            <span className={s.fill}>{inv.notes}</span>
          </p>
        )}
      </div>

      <div className={s.foot}>
        <div className={s.amountBox}>
          <span className={s.amountLbl}>Amount received</span>
          <span className={s.amount}>{inr(inv.amount)}</span>
        </div>

        <RoundStamp brand={inv.brand.brandName} date={stampDate(inv.paymentDate)} />

        <div className={s.signArea}>
          {needsStamp(inv) && (
            <span className={s.revenue}>
              Revenue
              <br />
              stamp
            </span>
          )}
          <span className={s.sign}>
            <span className={s.signLine} aria-hidden />
            <span className={s.signFor}>For {inv.brand.brandName}</span>
            <span className={s.signWho}>Landlord&rsquo;s signature</span>
          </span>
        </div>
      </div>

      <footer className={s.small}>
        <span>Monthly rent {inr(inv.lease.monthlyRent)}</span>
        <span>
          Tenancy from {formatDate(inv.lease.startDate)}
          {inv.lease.endDate ? ` to ${formatDate(inv.lease.endDate)}` : ""}
        </span>
        {inv.lease.securityDeposit > 0 && <span>Security deposit {inr(inv.lease.securityDeposit)} held separately — not part of this payment</span>}
        {inv.brand.ownerEmail && <span>{inv.brand.ownerEmail}</span>}
      </footer>
    </article>
  );
}

/** Faded round "rent received" seal with the payment date — like an office rubber stamp. */
function RoundStamp({ brand, date }: { brand: string; date: string }) {
  const id = useId().replace(/:/g, "");
  const ring = `${brand.toUpperCase()} · RENT RECEIVED · `;
  return (
    <svg className={s.stamp} viewBox="0 0 120 120" aria-hidden>
      <defs>
        <path id={`${id}c`} d="M60 60 m-43 0 a43 43 0 1 1 86 0 a43 43 0 1 1 -86 0" />
      </defs>
      <circle cx="60" cy="60" r="55" className={s.stampRing} />
      <circle cx="60" cy="60" r="33" className={s.stampRingThin} />
      <text className={s.stampRingText}>
        <textPath href={`#${id}c`} startOffset="0" textLength="268" lengthAdjust="spacingAndGlyphs">
          {ring}
        </textPath>
      </text>
      <text x="60" y="57" textAnchor="middle" className={s.stampPaid}>
        PAID
      </text>
      <text x="60" y="71" textAnchor="middle" className={s.stampDate}>
        {date}
      </text>
    </svg>
  );
}
