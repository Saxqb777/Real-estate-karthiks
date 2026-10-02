"use client";
// Quick actions from HUD panels open the entity forms (src/components/forms) in a Drawer sliding in from the right.
//   const forms = useFormDrawer();
//   <Button onClick={() => forms.open({ kind: "payment", props: { defaults: { leaseId } } })}>Record rent</Button>
//   {forms.element}
import { useCallback, useState, type ReactNode } from "react";
import {
  ActionForm,
  ExpenseForm,
  LeaseForm,
  MarkTaxPaidForm,
  MoveOutForm,
  PaymentForm,
  PropertyTaxForm,
  TenantForm,
  drawerFrame,
  type ActionFormProps,
  type ExpenseFormProps,
  type LeaseFormProps,
  type MoveOutFormProps,
  type PaymentFormProps,
  type PropertyTaxFormProps,
  type TenantFormProps,
} from "@/components/forms";
import type { PropertyTaxDTO } from "@/lib/schemas/property-tax";

type NoFrame<P> = Omit<P, "frame" | "onCancel">;

export type HudFormRequest =
  | { kind: "payment"; props?: NoFrame<PaymentFormProps>; title?: string }
  | { kind: "expense"; props?: NoFrame<ExpenseFormProps>; title?: string }
  | { kind: "lease"; props?: NoFrame<LeaseFormProps>; title?: string }
  | { kind: "moveOut"; props: NoFrame<MoveOutFormProps>; title?: string }
  | { kind: "action"; props?: NoFrame<ActionFormProps>; title?: string }
  | { kind: "tenant"; props?: NoFrame<TenantFormProps>; title?: string }
  | { kind: "propertyTax"; props?: NoFrame<PropertyTaxFormProps>; title?: string }
  | { kind: "markTaxPaid"; props: { tax: PropertyTaxDTO; onSaved?: (t: PropertyTaxDTO) => void }; title?: string };

const HEAD: Record<HudFormRequest["kind"], { eyebrow: string; title: string }> = {
  payment: { eyebrow: "Payments", title: "Record rent" },
  expense: { eyebrow: "Expenses", title: "Add expense" },
  lease: { eyebrow: "Leases", title: "Sign a lease" },
  moveOut: { eyebrow: "Leases", title: "Move out" },
  action: { eyebrow: "To-dos", title: "Add a to-do" },
  tenant: { eyebrow: "Tenants", title: "Tenant" },
  propertyTax: { eyebrow: "Property tax", title: "Add property tax" },
  markTaxPaid: { eyebrow: "Property tax", title: "Mark tax paid" },
};

function render(r: HudFormRequest, open: boolean, onClose: () => void): ReactNode {
  const frame = drawerFrame({ open, onClose, eyebrow: HEAD[r.kind].eyebrow, title: r.title ?? HEAD[r.kind].title, width: 480 });
  const done =
    <T,>(cb?: (v: T) => void) =>
    (v: T) => {
      cb?.(v);
      onClose();
    };
  switch (r.kind) {
    case "payment":
      return <PaymentForm {...r.props} frame={frame} onSaved={done(r.props?.onSaved)} onCancel={onClose} />;
    case "expense":
      return <ExpenseForm {...r.props} frame={frame} onSaved={done(r.props?.onSaved)} onCancel={onClose} />;
    case "lease":
      return <LeaseForm {...r.props} frame={frame} onSaved={done(r.props?.onSaved)} onCancel={onClose} />;
    case "moveOut":
      return <MoveOutForm {...r.props} frame={frame} onSaved={done(r.props.onSaved)} onCancel={onClose} />;
    case "action":
      return <ActionForm {...r.props} frame={frame} onSaved={done(r.props?.onSaved)} onCancel={onClose} />;
    case "tenant":
      return <TenantForm {...r.props} frame={frame} onSaved={done(r.props?.onSaved)} onCancel={onClose} />;
    case "propertyTax":
      return <PropertyTaxForm {...r.props} frame={frame} onSaved={done(r.props?.onSaved)} onCancel={onClose} />;
    case "markTaxPaid":
      return <MarkTaxPaidForm tax={r.props.tax} frame={frame} onSaved={done(r.props.onSaved)} onCancel={onClose} />;
  }
}

/** One drawer form at a time, owned by the panel that opens it. */
export function useFormDrawer() {
  const [req, setReq] = useState<{ r: HudFormRequest; seq: number } | null>(null);
  const [open, setOpen] = useState(false);
  const openForm = useCallback((r: HudFormRequest) => {
    setReq((cur) => ({ r, seq: (cur?.seq ?? 0) + 1 }));
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  // the request stays mounted while the drawer animates out
  const element = req ? <FormSlot key={req.seq} request={req.r} open={open} onClose={close} /> : null;
  return { open: openForm, close, element, isOpen: open };
}

function FormSlot({ request, open, onClose }: { request: HudFormRequest; open: boolean; onClose: () => void }) {
  return <>{render(request, open, onClose)}</>;
}
