"use client";
// /invoice/[id] — the printable rent receipt. On screen: the paper receipt on the dark desk with a slim toolbar.
// Print / Save PDF: only the receipt is printed, on a clean white A4 page.
import { ArrowLeft, Printer, ReceiptText, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button, EmptyState, Kbd, LinkButton, Screen, Skeleton } from "@/components/ui";
import { PrintPortal, printDocument } from "@/components/reports/print";
import { inr } from "@/components/hud/format";
import { useApi } from "@/lib/client";
import { formatDate } from "@/lib/dates";
import type { InvoiceData } from "@/lib/schemas/payment";
import { Receipt } from "./Receipt";
import s from "./invoice.module.css";

export function InvoiceScreen({ id }: { id: string }) {
  const q = useApi<InvoiceData>(`/api/payments/${encodeURIComponent(id)}/invoice`);
  const inv = q.data?.paymentId === id ? q.data : undefined;
  const fileName = inv ? `Rent receipt ${inv.invoiceNumber} — ${inv.tenant.name} — ${inv.period.label}` : "Rent receipt";

  // the tab title doubles as the suggested PDF name when printing with Ctrl/⌘ P
  useEffect(() => {
    if (!inv) return;
    const prev = document.title;
    document.title = `${inv.invoiceNumber} · Rent receipt`;
    return () => {
      document.title = prev;
    };
  }, [inv]);

  return (
    <Screen className={s.screen}>
      <div className={s.toolbar}>
        <LinkButton href="/data#payments" variant="ghost" size="sm" icon={<ArrowLeft />}>
          Payments
        </LinkButton>
        <div className={s.toolTitle}>
          <ReceiptText aria-hidden className={s.toolIcon} />
          <div className={s.toolText}>
            <span className={s.toolEyebrow}>Rent receipt</span>
            <h1 className={s.toolH}>{inv ? inv.invoiceNumber : q.error ? "Not found" : <Skeleton width={140} height={20} />}</h1>
          </div>
          {inv && (
            <span className={s.toolFacts}>
              <b className="num">{inr(inv.amount)}</b> · {inv.tenant.name} · {inv.period.label} · received {formatDate(inv.paymentDate)}
            </span>
          )}
        </div>
        {!q.error && (
          <div className={s.toolActions}>
            <span className={s.toolHint} title="Prints the receipt">
              <Kbd keys={["mod", "p"]} />
            </span>
            <Button variant="primary" size="sm" icon={<Printer />} disabled={!inv} onClick={() => printDocument(fileName)}>
              Print / Save PDF
            </Button>
          </div>
        )}
      </div>

      <div className={s.desk}>
        {inv ? (
          <div className={s.sheet}>
            <Receipt inv={inv} />
          </div>
        ) : q.error ? (
          <div className={s.missing}>
            <EmptyState
              title={q.error.status === 404 ? "This receipt doesn't exist" : "The receipt couldn't load"}
              description={q.error.status === 404 ? undefined : q.error.message}
              action={
                q.error.status === 404 ? (
                  <LinkButton href="/data#payments" size="sm" variant="primary">
                    Back to payments
                  </LinkButton>
                ) : (
                  <Button size="sm" icon={<RotateCcw />} onClick={() => void q.reload()}>
                    Try again
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className={s.sheet} aria-busy="true">
            <div className={s.sheetSkeleton}>
              <Skeleton width="40%" height={22} />
              <Skeleton width="25%" height={12} />
              <Skeleton lines={5} />
              <Skeleton width="30%" height={48} />
            </div>
          </div>
        )}
      </div>

      {inv && (
        <PrintPortal running={{ pageNumbers: false, margin: "14mm 14mm 14mm" }}>
          <Receipt inv={inv} print />
        </PrintPortal>
      )}
    </Screen>
  );
}
