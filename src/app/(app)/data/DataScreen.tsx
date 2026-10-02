"use client";
// /data — the ledger. ONE-SCREEN: tab rail + one panel; tables scroll inside with sticky headers and totals.
// The active tab lives in the URL hash (/data#payments), so other screens can deep-link here.
import { FileText, FileSignature, Landmark, ListTodo, ReceiptIndianRupee, Coins, Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Screen, useHashTab } from "@/components/ui";
import {
  QuickAddHost,
  RailScreen,
  leasePhase,
  useActions,
  useExpenses,
  useLeases,
  usePayments,
  usePropertyTax,
  useTenants,
  type RailItem,
} from "@/components/forms";
import { ReportsHub } from "@/components/reports/ReportsHub";
import { todayIST } from "@/lib/dates";
import { ExpensesTab } from "./ExpensesTab";
import { LeasesTab } from "./LeasesTab";
import { PaymentsTab } from "./PaymentsTab";
import { PropertyTaxTab } from "./PropertyTaxTab";
import { TenantsTab } from "./TenantsTab";
import { TodosTab } from "./TodosTab";
import { DATA_TABS, type DataTab, type TabProps } from "./tabs";

export function DataScreen() {
  const [tab, setTab] = useHashTab([...DATA_TABS], "tenants");
  const [pending, setPending] = useState<{ tab: DataTab; id: string } | null>(null);
  const [newSignal, setNewSignal] = useState(0);

  const tenants = useTenants();
  const leases = useLeases();
  const payments = usePayments();
  const expenses = useExpenses({});
  const taxes = usePropertyTax();
  const todos = useActions("pending");

  const items = useMemo<RailItem[]>(() => {
    const current = leases.data?.items.filter((l) => leasePhase(l) === "current").length;
    const thisYear = todayIST().getUTCFullYear();
    const due = taxes.data?.items.filter((t) => t.status === "Due");
    const late = todos.data?.items.filter((a) => a.isOverdue).length ?? 0;
    return [
      { id: "tenants", label: "Tenants", icon: <Users />, count: tenants.data?.items.length, note: "People who rent" },
      { id: "leases", label: "Leases", icon: <FileSignature />, count: current, note: current === undefined ? undefined : `${current} current` },
      { id: "payments", label: "Payments", icon: <Coins />, count: payments.data?.count, note: "Rent received" },
      { id: "expenses", label: "Expenses", icon: <ReceiptIndianRupee />, count: expenses.data?.count, note: "Money spent" },
      {
        id: "property-tax",
        label: "Property tax",
        icon: <Landmark />,
        count: due?.length || undefined,
        alert: Boolean(due?.some((t) => t.year < thisYear)),
        note: due ? (due.length ? `${due.length} due` : "All paid") : undefined,
      },
      { id: "todos", label: "To-dos", icon: <ListTodo />, count: todos.data?.items.length, alert: late > 0, note: late ? `${late} late` : "Things to do" },
      { id: "reports", label: "Reports", icon: <FileText />, note: "Printable statements", divider: true },
    ];
  }, [tenants.data, leases.data, payments.data, expenses.data, taxes.data, todos.data]);

  const goto = useCallback(
    (t: DataTab, id?: string) => {
      setTab(t);
      setPending(id ? { tab: t, id } : null);
    },
    [setTab],
  );
  const onOpened = useCallback(() => setPending(null), []);
  const props = (t: DataTab): TabProps => ({ openId: pending?.tab === t ? pending.id : null, onOpened, goto, newSignal });

  const active = tab as DataTab;
  return (
    <Screen>
      <RailScreen
        label="Ledger sections"
        eyebrow="Ledger"
        title="Data"
        tamil="பதிவேடு"
        items={items}
        value={active}
        onChange={(id) => goto(id as DataTab)}
        onNew={active === "reports" ? undefined : () => setNewSignal((n) => n + 1)}
      >
        {active === "tenants" && <TenantsTab {...props("tenants")} />}
        {active === "leases" && <LeasesTab {...props("leases")} />}
        {active === "payments" && <PaymentsTab {...props("payments")} />}
        {active === "expenses" && <ExpensesTab {...props("expenses")} />}
        {active === "property-tax" && <PropertyTaxTab {...props("property-tax")} />}
        {active === "todos" && <TodosTab {...props("todos")} />}
        {active === "reports" && <ReportsHub />}
      </RailScreen>
      <QuickAddHost />
    </Screen>
  );
}
