// Pattukottai Estates UI kit — import everything from "@/components/ui".
export { cx } from "./cx";
export { useIsClient, useIsMac, useFocusTrap, useScrollLock, isFocusTrapActive } from "./hooks";

export { Panel, type PanelProps } from "./Panel";
export { PageHeader, type PageHeaderProps } from "./PageHeader";
export { Screen, ScrollArea, type ScreenProps, type ScrollAreaProps } from "./Screen";
export { Button, LinkButton, IconButton, buttonClass, type ButtonProps, type LinkButtonProps, type IconButtonProps, type ButtonVariant, type ButtonSize } from "./Button";

export { Field, FormGrid, useField, type FieldProps, type FormGridProps } from "./Field";
export {
  Input,
  NumberInput,
  DateInput,
  Select,
  Textarea,
  type InputProps,
  type NumberInputProps,
  type DateInputProps,
  type SelectProps,
  type SelectOption,
  type TextareaProps,
} from "./Input";
export { Toggle, Switch, type ToggleProps } from "./Toggle";

export { Tabs, useHashTab, type TabsProps, type TabItem } from "./Tabs";
export { Table, type TableProps, type Column } from "./Table";
export { Badge, StatusPill, type BadgeProps, type BadgeTone, type StatusPillProps, type StatusKind } from "./Badge";

export { AnimatedNumber, type AnimatedNumberProps } from "./AnimatedNumber";
export { Delta, type DeltaProps } from "./Delta";
export { formatNumber, type NumberFormat } from "./format-number";
export { StatTile, type StatTileProps, type StatDelta } from "./StatTile";
export { Sparkline, type SparklineProps } from "./Sparkline";
export { SegmentedBar, type SegmentedBarProps } from "./SegmentedBar";
export { LevelBadge, tierFor, type LevelBadgeProps, type Tier } from "./LevelBadge";

export { Modal, Drawer, type ModalProps, type DrawerProps } from "./Modal";
export { InspectCard, type InspectCardProps } from "./InspectCard";
export { ConfirmDialog, ConfirmHost, confirmDialog, type ConfirmDialogProps, type ConfirmOptions } from "./ConfirmDialog";
export { Toaster } from "./Toaster";
export { toast, dismissToast, type ToastKind, type ToastOptions, type ToastItem } from "./toast";

export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { Kolam } from "./Kolam";
export { Coin } from "./Coin";
export { Skeleton, type SkeletonProps } from "./Skeleton";
export { Tooltip, type TooltipProps } from "./Tooltip";
export { Kbd, type KbdProps } from "./Kbd";
export {
  CommandProvider,
  useCommandPalette,
  useRegisterCommands,
  fuzzyMatch,
  type Command,
  type CommandProviderProps,
} from "./CommandPalette";
