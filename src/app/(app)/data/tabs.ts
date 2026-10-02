// Contract between the Data screen and its tabs.
export const DATA_TABS = ["tenants", "leases", "payments", "expenses", "property-tax", "todos", "reports"] as const;
export type DataTab = (typeof DATA_TABS)[number];

export interface TabProps {
  /** A record another tab asked us to open (cleared via onOpened). */
  openId: string | null;
  onOpened: () => void;
  /** Switch tab and open a record there. */
  goto: (tab: DataTab, id?: string) => void;
  /** Increments when the owner presses N — open this tab's "add" form. */
  newSignal: number;
}
