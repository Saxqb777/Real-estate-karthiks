// Data-entry forms — one per entity, each usable inline, in a Modal or in a Drawer (see FormFrame).
//   import { PaymentForm, quickAdd, QuickAddHost } from "@/components/forms";
export { useForm, fieldMessage, type FieldErrors, type Issue, type UseFormOptions, type FormApi } from "./useForm";
export {
  inlineFrame,
  modalFrame,
  drawerFrame,
  FormBody,
  FormActions,
  FormSection,
  FormNote,
  type FormFrame,
  type FormParts,
  type BaseFormProps,
} from "./FormFrame";
export { ChoiceGroup, Stepper, Swatches, SWATCHES, Dot, Facts, ScopeChip, type Choice, type Fact } from "./controls";
export { useYearMode, yearLabel, yearOf, currentYear, YEAR_MODE_KEY, type YearMode } from "./year-mode";
export {
  useUnits,
  useTenants,
  useLeases,
  usePayments,
  useCategories,
  usePropertyTax,
  useActions,
  useDashboard,
  useSettings,
  usePlot,
  useExpenses,
  unitLabel,
  unitOptions,
  tenantOptions,
  leasePhase,
  leaseLabel,
  leaseSpan,
  METHOD_LABEL,
  type LeasePhase,
} from "./data";

export { UnitForm, unitFormValues, type UnitFormProps, type UnitFormValues } from "./UnitForm";
export { OfferForm, type OfferFormProps } from "./OfferForm";
export { TenantForm, type TenantFormProps } from "./TenantForm";
export { LeaseForm, type LeaseFormProps, type LeaseSaved } from "./LeaseForm";
export { MoveOutForm, type MoveOutFormProps } from "./MoveOutForm";
export { PaymentForm, type PaymentFormProps } from "./PaymentForm";
export { ExpenseForm, type ExpenseFormProps } from "./ExpenseForm";
export { PropertyTaxForm, MarkTaxPaidForm, type PropertyTaxFormProps } from "./PropertyTaxForm";
export { ActionForm, ACTION_TYPES, type ActionFormProps } from "./ActionForm";
export { CategoryForm, type CategoryFormProps } from "./CategoryForm";
export { SettingsForm, type SettingsFormProps } from "./SettingsForm";
export { PlotForm, type PlotFormProps, type PlotFormValues } from "./PlotForm";
export { quickAdd, closeQuickAdd, QuickAddHost, QuickAddModal, type QuickAddKind, type QuickAddPropsMap } from "./QuickAdd";
export { RailScreen, type RailItem, type RailScreenProps } from "./RailScreen";
