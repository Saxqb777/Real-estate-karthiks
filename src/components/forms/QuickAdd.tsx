"use client";
// Quick-add pop-ups for any screen (world objects, ⌘K):
//   quickAdd("payment", { defaults: { leaseId } });   quickAdd("lease", { defaults: { unitId } });
//   quickAdd("moveOut", { lease });                     quickAdd("tenant", { tenant })  // edit
// Mount <QuickAddHost /> once (the app shell); extra hosts stay dormant, so pages may mount one too.
// It also adds "Record rent", "Add expense", "Add to-do"… to the ⌘K palette.
import { Coins, FileSignature, Landmark, ListTodo, ReceiptIndianRupee, UserPlus } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRegisterCommands, type Command } from "@/components/ui";
import { ActionForm, type ActionFormProps } from "./ActionForm";
import { CategoryForm, type CategoryFormProps } from "./CategoryForm";
import { ExpenseForm, type ExpenseFormProps } from "./ExpenseForm";
import { modalFrame } from "./FormFrame";
import { LeaseForm, type LeaseFormProps } from "./LeaseForm";
import { MoveOutForm, type MoveOutFormProps } from "./MoveOutForm";
import { OfferForm, type OfferFormProps } from "./OfferForm";
import { PaymentForm, type PaymentFormProps } from "./PaymentForm";
import { MarkTaxPaidForm, PropertyTaxForm, type PropertyTaxFormProps } from "./PropertyTaxForm";
import { TenantForm, type TenantFormProps } from "./TenantForm";
import { UnitForm, type UnitFormProps } from "./UnitForm";
import type { PropertyTaxDTO } from "@/lib/schemas/property-tax";

type NoFrame<P> = Omit<P, "frame">;

export interface QuickAddPropsMap {
  payment: NoFrame<PaymentFormProps>;
  expense: NoFrame<ExpenseFormProps>;
  action: NoFrame<ActionFormProps>;
  tenant: NoFrame<TenantFormProps>;
  lease: NoFrame<LeaseFormProps>;
  moveOut: NoFrame<MoveOutFormProps>;
  propertyTax: NoFrame<PropertyTaxFormProps>;
  markTaxPaid: NoFrame<{ tax: PropertyTaxDTO; onSaved?: (t: PropertyTaxDTO) => void; onCancel?: () => void }>;
  offer: NoFrame<OfferFormProps>;
  unit: NoFrame<UnitFormProps>;
  category: NoFrame<CategoryFormProps>;
}
export type QuickAddKind = keyof QuickAddPropsMap;

type Request = { [K in QuickAddKind]: { kind: K; props: QuickAddPropsMap[K]; seq: number } }[QuickAddKind];

// ---------------------------------------------------------------- store

let current: Request | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Open a form in a pop-up from anywhere (needs a mounted <QuickAddHost />). */
export function quickAdd<K extends QuickAddKind>(kind: K, ...[props]: QuickAddPropsMap[K] extends { lease: unknown } | { tax: unknown } ? [QuickAddPropsMap[K]] : [QuickAddPropsMap[K]?]) {
  current = { kind, props: (props ?? {}) as QuickAddPropsMap[K], seq: ++seq } as Request;
  emit();
}

export function closeQuickAdd() {
  current = null;
  emit();
}

// ---------------------------------------------------------------- titles

function titles(r: Request): { eyebrow: string; title: ReactNode; size?: "md" | "lg" } {
  switch (r.kind) {
    case "payment":
      return { eyebrow: "Payments", title: "Record rent" };
    case "expense":
      return { eyebrow: "Expenses", title: r.props.expense ? "Edit expense" : "Add expense" };
    case "action":
      return { eyebrow: "To-dos", title: r.props.action ? "Edit to-do" : "Add a to-do" };
    case "tenant":
      return { eyebrow: "Tenants", title: r.props.tenant ? `Edit · ${r.props.tenant.name}` : "New tenant" };
    case "lease":
      return { eyebrow: "Leases", title: r.props.lease ? "Edit lease" : "Sign a lease" };
    case "moveOut":
      return { eyebrow: "Leases", title: `Move out · ${r.props.lease.tenant.name}` };
    case "propertyTax":
      return { eyebrow: "Property tax", title: r.props.tax ? `Property tax ${r.props.tax.year}` : "Add property tax" };
    case "markTaxPaid":
      return { eyebrow: "Property tax", title: `Mark ${r.props.tax.year} paid · ${r.props.tax.unit.name}`, size: "md" };
    case "offer":
      return { eyebrow: "Offers", title: r.props.offer ? "Edit offer" : "Record an offer" };
    case "unit":
      return { eyebrow: "Units", title: r.props.unit ? `Edit · ${r.props.unit.name}` : "Build a unit", size: "lg" };
    case "category":
      return { eyebrow: "Categories", title: r.props.category ? `Edit · ${r.props.category.name}` : "New category" };
  }
}

// ---------------------------------------------------------------- modal

/** Controlled pop-up for one form kind (use quickAdd() unless you need to own the state). */
export function QuickAddModal({ request, open, onClose }: { request: Request; open: boolean; onClose: () => void }) {
  const t = titles(request);
  const frame = modalFrame({ open, onClose, title: t.title, eyebrow: t.eyebrow, size: t.size });
  const done = <R,>(cb?: (r: R) => void) => (r: R) => {
    cb?.(r);
    onClose();
  };
  const cancel = (cb?: () => void) => () => {
    cb?.();
    onClose();
  };
  const r = request;
  switch (r.kind) {
    case "payment":
      return <PaymentForm {...r.props} frame={frame} onSaved={done(r.props.onSaved)} onCancel={cancel(r.props.onCancel)} />;
    case "expense":
      return <ExpenseForm {...r.props} frame={frame} onSaved={done(r.props.onSaved)} onCancel={cancel(r.props.onCancel)} />;
    case "action":
      return <ActionForm {...r.props} frame={frame} onSaved={done(r.props.onSaved)} onCancel={cancel(r.props.onCancel)} />;
    case "tenant":
      return <TenantForm {...r.props} frame={frame} onSaved={done(r.props.onSaved)} onCancel={cancel(r.props.onCancel)} />;
    case "lease":
      return <LeaseForm {...r.props} frame={frame} onSaved={done(r.props.onSaved)} onCancel={cancel(r.props.onCancel)} />;
    case "moveOut":
      return <MoveOutForm {...r.props} frame={frame} onSaved={done(r.props.onSaved)} onCancel={cancel(r.props.onCancel)} />;
    case "propertyTax":
      return <PropertyTaxForm {...r.props} frame={frame} onSaved={done(r.props.onSaved)} onCancel={cancel(r.props.onCancel)} />;
    case "markTaxPaid":
      return <MarkTaxPaidForm {...r.props} frame={frame} onSaved={done(r.props.onSaved)} onCancel={cancel(r.props.onCancel)} />;
    case "offer":
      return <OfferForm {...r.props} frame={frame} onSaved={done(r.props.onSaved)} onCancel={cancel(r.props.onCancel)} />;
    case "unit":
      return <UnitForm {...r.props} frame={frame} onSaved={done(r.props.onSaved)} onCancel={cancel(r.props.onCancel)} />;
    case "category":
      return <CategoryForm {...r.props} frame={frame} onSaved={done(r.props.onSaved)} onCancel={cancel(r.props.onCancel)} />;
  }
}

// ---------------------------------------------------------------- host

let owner: symbol | null = null;
const ownerListeners = new Set<() => void>();

const QUICK_COMMANDS: Command[] = [
  { id: "quick:payment", group: "Quick add", title: "Record rent", subtitle: "Payment + receipt", keywords: ["pay", "payment", "rent", "collect", "receipt", "invoice"], icon: <Coins />, perform: () => quickAdd("payment") },
  { id: "quick:expense", group: "Quick add", title: "Add expense", subtitle: "Repairs, bills, fees", keywords: ["expense", "spend", "repair", "bill", "cost"], icon: <ReceiptIndianRupee />, perform: () => quickAdd("expense") },
  { id: "quick:action", group: "Quick add", title: "Add to-do", subtitle: "Something to do for the property", keywords: ["todo", "task", "action", "reminder"], icon: <ListTodo />, perform: () => quickAdd("action") },
  { id: "quick:tenant", group: "Quick add", title: "Add tenant", keywords: ["tenant", "person", "renter"], icon: <UserPlus />, perform: () => quickAdd("tenant") },
  { id: "quick:lease", group: "Quick add", title: "Sign a lease", subtitle: "Tenant moves into a unit", keywords: ["lease", "agreement", "move in", "rent out", "to-let"], icon: <FileSignature />, perform: () => quickAdd("lease") },
  { id: "quick:tax", group: "Quick add", title: "Add property tax", keywords: ["tax", "property tax", "municipality"], icon: <Landmark />, perform: () => quickAdd("propertyTax") },
];

/** Renders quickAdd() requests. Only one host is ever active, however many are mounted. */
export function QuickAddHost() {
  const me = useRef<symbol>(Symbol("quick-add-host"));
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    const id = me.current;
    const claim = () => {
      if (owner === null) owner = id;
      setIsOwner(owner === id);
    };
    claim();
    ownerListeners.add(claim);
    return () => {
      ownerListeners.delete(claim);
      if (owner === id) {
        owner = null;
        ownerListeners.forEach((l) => l());
      }
    };
  }, []);

  useRegisterCommands(isOwner ? QUICK_COMMANDS : []);

  const req = useSyncExternalStore(subscribe, () => current, () => null);
  const [last, setLast] = useState<Request | null>(null);
  if (req && req !== last) setLast(req); // keep the form during the exit animation
  if (!isOwner || !last) return null;
  return <QuickAddModal key={last.seq} request={last} open={req !== null} onClose={closeQuickAdd} />;
}
