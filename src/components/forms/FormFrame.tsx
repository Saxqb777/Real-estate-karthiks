"use client";
// Where a form lives: inline on a page, in a Modal or in a Drawer. Every entity form builds its parts
// (body + action buttons + submit handler) and hands them to a frame, so the same form works everywhere:
//   <TenantForm />                                            inline (default)
//   <TenantForm frame={modalFrame({ open, onClose, title })} />  quick-add pop-up
import { TriangleAlert } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { Button, Drawer, Modal, cx, type ModalProps } from "@/components/ui";
import type { FormApi } from "./useForm";
import s from "./forms.module.css";

export interface FormParts {
  body: ReactNode;
  actions: ReactNode;
  onSubmit: (e?: FormEvent) => void;
  dirty: boolean;
  busy: boolean;
}
export type FormFrame = (parts: FormParts) => ReactNode;

/** Default: a <form> that fills its parent column — fields scroll, the action bar stays put. */
export const inlineFrame: FormFrame = ({ body, actions, onSubmit, dirty }) => (
  <form noValidate onSubmit={onSubmit} className={s.inline}>
    <div className={s.inlineBody}>{body}</div>
    <div className={s.inlineActions} data-dirty={dirty || undefined}>
      {actions}
    </div>
  </form>
);

interface OverlayFrameOptions {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
}

/** Centered dialog (bottom sheet on phones). Backdrop clicks are ignored once something was typed. */
export function modalFrame(o: OverlayFrameOptions & { size?: ModalProps["size"] }): FormFrame {
  // Returns elements (not a component defined here) so the Modal keeps its identity across renders.
  return function renderInModal({ body, actions, onSubmit, dirty }) {
    return (
    <Modal
      open={o.open}
      onClose={o.onClose}
      title={o.title}
      eyebrow={o.eyebrow}
      description={o.description}
      size={o.size ?? "md"}
      onSubmit={onSubmit}
      footer={actions}
      closeOnBackdrop={!dirty}
    >
      {body}
    </Modal>
    );
  };
}

/** Side panel from the right. */
export function drawerFrame(o: OverlayFrameOptions & { width?: number }): FormFrame {
  return function renderInDrawer({ body, actions, onSubmit, dirty }) {
    return (
    <Drawer
      open={o.open}
      onClose={o.onClose}
      title={o.title}
      eyebrow={o.eyebrow}
      description={o.description}
      width={o.width ?? 520}
      onSubmit={onSubmit}
      footer={actions}
      closeOnBackdrop={!dirty}
    >
      {body}
    </Drawer>
    );
  };
}

/** Field area of a form: wires focus tracking and shows the form-level error (conflicts the server explains in words). */
export function FormBody({
  form,
  intro,
  children,
  className,
}: {
  form: Pick<FormApi<Record<string, unknown>>, "bodyProps" | "formError">;
  /** One plain sentence above the fields (what this form does). */
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div {...form.bodyProps} className={cx(s.body, className)}>
      {intro && <p className={s.intro}>{intro}</p>}
      {form.formError && (
        <div className={s.formError} role="alert" data-form-error>
          <TriangleAlert aria-hidden />
          <span>{form.formError}</span>
        </div>
      )}
      {children}
    </div>
  );
}

/** Cancel + primary submit (+ an optional left-side slot such as Delete). */
export function FormActions({
  form,
  submitLabel,
  onCancel,
  cancelLabel = "Cancel",
  left,
  submitIcon,
}: {
  form: Pick<FormApi<Record<string, unknown>>, "busy" | "dirty">;
  submitLabel: string;
  onCancel?: () => void;
  cancelLabel?: string;
  left?: ReactNode;
  submitIcon?: ReactNode;
}) {
  return (
    <>
      {left && <div className={s.actionsLeft}>{left}</div>}
      {onCancel && (
        <Button variant="ghost" onClick={onCancel} disabled={form.busy}>
          {cancelLabel}
        </Button>
      )}
      <Button type="submit" variant="primary" loading={form.busy} icon={submitIcon}>
        {submitLabel}
      </Button>
    </>
  );
}

/** Small uppercase sub-heading that groups fields ("On the plot", "Money"). */
/** `note` is accepted but not shown (owner: no instruction text anywhere). */
export function FormSection({ title, children }: { title: ReactNode; note?: ReactNode; children: ReactNode }) {
  return (
    <section className={s.section}>
      <header className={s.sectionHead}>
        <h3 className={s.sectionTitle}>{title}</h3>
      </header>
      {children}
    </section>
  );
}

/** Calm marigold note inside a form ("Marking Paid also adds a ₹4,820 expense"). */
export function FormNote({ children, tone = "info", icon }: { children: ReactNode; tone?: "info" | "warn"; icon?: ReactNode }) {
  return (
    <div className={cx(s.note, tone === "warn" && s.noteWarn)}>
      {icon}
      <div>{children}</div>
    </div>
  );
}

/** Props every entity form shares. `record` switches the form to edit mode. */
export interface BaseFormProps<R> {
  /** Saved result (the API response), e.g. to select a new tenant in a picker or close a dialog. */
  onSaved?: (result: R) => void;
  /** Shows a Cancel button. */
  onCancel?: () => void;
  /** Where the form lives (default inline). */
  frame?: FormFrame;
  submitLabel?: string;
  /** Extra buttons at the left of the action bar (e.g. Delete). */
  actionsLeft?: ReactNode;
}
