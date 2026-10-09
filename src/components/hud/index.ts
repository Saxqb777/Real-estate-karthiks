// Game-screen HUD building blocks — compose them on the Overview (see HudGallery.tsx for every piece in use).
//   import { StatusChips, PropertyPanel, UnitPanel, Dock, PeriodControl, useInspect, InspectLayer, HudPanelFor } from "@/components/hud";
// Every figure comes from DashboardData (/api/dashboard) and its `explain` map — nothing here re-does the maths.
export type { SceneObject, SceneObjectKind, PeriodKind, PanelTarget, PanelKind, DrillView, ChipTarget, DockTab } from "./types";

export { BUCKETS, fmt, inr, inrCompact, explainKey, scopeLabel, unitTitle, positionLabel, type Bucket } from "./format";
export { usePeriod, usePinned, useExplored, useEscape, isTyping, PERIOD_KEY } from "./store";

export { Fig, FigLine, FigCell, FigCells, PaperTag, ScopeChip, BucketHead, BucketIcon, Rupees, type FigProps, type FigLineProps, type ScopeChipProps } from "./Figure";
export { HudPanel, PanelSection, type HudPanelProps, type Crumb } from "./HudPanel";
export { ExplainView, HowLink, type ExplainViewProps } from "./ExplainView";
export {
  DrillPanel,
  DrillContent,
  useDrillStack,
  inputDrill,
  drillLabel,
  type DrillStack,
  type DrillPanelProps,
} from "./DrillDown";
export { parseExplainKey, relatedExplains } from "./explain-keys";
export { useFormDrawer, type HudFormRequest } from "./FormDrawer";
export { LedgerBadge, type LedgerBadgeProps } from "./LedgerBadge";
export { StatusChips, type StatusChipsProps } from "./StatusChips";
export { buildStatusChips, type StatusChip, type ChipTone } from "./chips";
export { PeriodControl, useHudDashboard, type PeriodControlProps } from "./PeriodControl";

export { PropertyPanel, type PropertyPanelProps } from "./PropertyPanel";
export { UnitPanel, UnitStatusPill, RentStatePill, Electricity, type UnitPanelProps } from "./UnitPanel";
export { MailboxPanel, type MailboxPanelProps } from "./MailboxPanel";
export { NoticeBoardPanel, type NoticeBoardPanelProps } from "./NoticeBoardPanel";
export { PolePanel, type PolePanelProps } from "./PolePanel";
export { TaxPanel, type TaxPanelProps } from "./TaxPanel";

export { useInspect, InspectLayer, WorldHint, HudPanelFor, panelFor, hintFor, type InspectController, type UseInspectOptions, type HudPanelForProps } from "./Inspect";
export { Dock, DOCK_TABS, dockTabLabel, type DockProps } from "./Dock";
export { IncomeExpenseChart } from "./charts/IncomeExpenseChart";
export { SpendingDonut } from "./charts/SpendingDonut";
export { UnitsCompare } from "./charts/UnitsCompare";
export { OccupancyGantt } from "./charts/OccupancyGantt";
export { GrowthChart } from "./charts/GrowthChart";
export { PaymentsList } from "./charts/PaymentsList";
