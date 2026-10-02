"use client";
import { HandCoins, Plus } from "lucide-react";
import { Badge, Button, EmptyState, Panel, Skeleton, cx } from "@/components/ui";
import { closeQuickAdd, quickAdd, unitLabel, useDashboard, useUnits } from "@/components/forms";
import { useApi } from "@/lib/client";
import type { UnitBreakdown } from "@/lib/dashboard-types";
import { formatDate } from "@/lib/dates";
import { formatINR, formatINRCompact } from "@/lib/format";
import type { OfferDTO } from "@/lib/schemas/offer";
import type { UnitListItem } from "@/lib/schemas/unit";
import { DeleteButton } from "../data/shared";
import s from "./config.module.css";

/** Offers per unit, highest first; the best one is what "Best offer" and "Worth now (est.)" use. */
export function OffersTab() {
  const units = useUnits();
  const dash = useDashboard();
  const items = units.data?.items;
  if (!items) {
    return (
      <Panel fill>
        <Skeleton lines={5} />
      </Panel>
    );
  }
  if (!items.length) {
    return (
      <Panel fill eyebrow="Paper value" title="Offers">
        <EmptyState title="No units yet" description="Build a unit first (Config → Units). Then record any offers buyers make for it." />
      </Panel>
    );
  }
  const sorted = [...items].sort((a, b) => Number(b.isActive) - Number(a.isActive));
  return (
    <div className={s.offerGrid}>
      {sorted.map((u) => (
        <UnitOffers key={u.id} unit={u} info={dash.data?.units.find((x) => x.id === u.id)} />
      ))}
    </div>
  );
}

function UnitOffers({ unit, info }: { unit: UnitListItem; info?: UnitBreakdown }) {
  const offers = useApi<{ items: OfferDTO[] }>(`/api/offers?unitId=${encodeURIComponent(unit.id)}`);
  const list = offers.data?.items;
  const best = list?.[0];
  const add = () => quickAdd("offer", { unitId: unit.id, purchasePrice: unit.purchasePrice });
  const edit = (o: OfferDTO) =>
    quickAdd("offer", {
      offer: o,
      purchasePrice: unit.purchasePrice,
      actionsLeft: <DeleteButton path={`/api/offers/${o.id}`} what={`the ${formatINR(o.amount)} offer`} onDeleted={closeQuickAdd} />,
    });

  return (
    <Panel
      fill
      padding="none"
      eyebrow={unit.isActive ? "Paper value" : "Inactive unit"}
      title={unitLabel(unit)}
      actions={
        <Button size="sm" variant="secondary" icon={<Plus />} onClick={add}>
          Offer
        </Button>
      }
      className={s.offerPanel}
    >
      <div className={s.valueStrip}>
        <div>
          <span className={s.vLabel}>Invested</span>
          <b className="num" title={formatINR(unit.purchasePrice)}>
            {formatINRCompact(unit.purchasePrice)}
          </b>
          <span className={s.vSub}>bought {formatDate(unit.purchaseDate)}</span>
        </div>
        <div>
          <span className={s.vLabel}>Best offer</span>
          {unit.bestOffer !== null ? (
            <b className={cx("num", s.paperNum)} title={formatINR(unit.bestOffer)}>
              {formatINRCompact(unit.bestOffer)}
            </b>
          ) : (
            <b className="faint">—</b>
          )}
          <span className={s.vSub}>{unit.bestOffer === null ? "no offer yet" : best ? `on ${formatDate(best.offerDate)}` : "\u00a0"}</span>
        </div>
        {info && (
          <div>
            <span className={s.vLabel}>Gain {info.valuationSource === "estimate" ? "(est.)" : ""}</span>
            <b className={cx("num", s.paperNum, info.appreciation < 0 && "neg")} title={formatINR(info.appreciation)}>
              {info.appreciation < 0 ? "−" : "+"}
              {formatINRCompact(Math.abs(info.appreciation))}
            </b>
            <span className={s.vSub}>{info.valuationSource === "offer" ? "best offer − invested" : "estimate − invested"}</span>
          </div>
        )}
      </div>
      <div className={s.offerList}>
        {!list ? (
          <div className={s.loading}>
            <Skeleton lines={3} />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            compact
            art={<HandCoins width={44} height={44} aria-hidden />}
            title="No offers yet"
            description="Record a price when a buyer names one. Nothing is paid — it's paper value."
          />
        ) : (
          <ul>
            {list.map((o, i) => (
              <li key={o.id}>
                <button type="button" className={cx(s.offerRow, i === 0 && s.offerBest)} onClick={() => edit(o)}>
                  <span className={s.offerMain}>
                    <span className={cx("num", s.offerAmt)}>{formatINR(o.amount)}</span>
                    {i === 0 && (
                      <Badge size="sm" tone="marigold" marker>
                        Best offer
                      </Badge>
                    )}
                  </span>
                  <span className={s.offerMeta}>
                    {formatDate(o.offerDate)}
                    {o.notes ? ` · ${o.notes}` : ""}
                  </span>
                </button>
              </li>
            ))}
            <li className={s.listHint}>Click an offer to change or delete it</li>
          </ul>
        )}
      </div>
    </Panel>
  );
}
