"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useRef, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./Button";
import { cx } from "./cx";
import { useFocusTrap, useIsClient, useScrollLock } from "./hooks";
import styles from "./Modal.module.css";

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action buttons, right-aligned. */
  footer?: ReactNode;
  /** Close when the backdrop is clicked (default true). Set false for forms with unsaved input. */
  closeOnBackdrop?: boolean;
  /** Hide the × button. */
  hideClose?: boolean;
  /** Wrap the body+footer in a <form> (Enter submits). */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  className?: string;
}

export interface ModalProps extends OverlayProps {
  size?: "sm" | "md" | "lg" | "xl";
  /** dialog (default) or alertdialog (confirmations). */
  role?: "dialog" | "alertdialog";
}

const EASE = [0.22, 1, 0.36, 1] as const;

function Header({ id, descId, title, eyebrow, description, hideClose, onClose }: { id: string; descId: string } & Pick<OverlayProps, "title" | "eyebrow" | "description" | "hideClose" | "onClose">) {
  return (
    <div className={styles.head}>
      <div className={styles.titles}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {description && (
          <p id={descId} className={styles.desc}>
            {description}
          </p>
        )}
      </div>
      {!hideClose && (
        <span data-no-autofocus>
          <IconButton label="Close" icon={<X />} size="sm" onClick={onClose} tooltip={false} />
        </span>
      )}
    </div>
  );
}

function Content({ onSubmit, footer, children }: Pick<OverlayProps, "onSubmit" | "footer" | "children">) {
  const inner = (
    <>
      {children !== undefined && <div className={styles.body}>{children}</div>}
      {footer && <div className={styles.foot}>{footer}</div>}
    </>
  );
  return onSubmit ? (
    <form onSubmit={onSubmit} noValidate style={{ display: "contents" }}>
      {inner}
    </form>
  ) : (
    inner
  );
}

/** Centered dialog (bottom sheet on phones). Focus trapped, Esc closes, focus restored on close. */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  closeOnBackdrop = true,
  hideClose,
  onSubmit,
  size = "md",
  role = "dialog",
  className,
}: ModalProps) {
  const isClient = useIsClient();
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useFocusTrap(ref, open && isClient, onClose);
  useScrollLock(open && isClient);
  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            aria-hidden
          />
          <div key="layer" className={styles.layer} onMouseDown={(e) => closeOnBackdrop && e.target === e.currentTarget && onClose()}>
            <motion.div
              ref={ref}
              role={role}
              aria-modal="true"
              aria-labelledby={`${id}-t`}
              aria-describedby={description ? `${id}-d` : undefined}
              tabIndex={-1}
              className={cx(styles.dialog, styles[size], className)}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985, transition: { duration: 0.14 } }}
              transition={{ duration: 0.26, ease: EASE }}
            >
              <Header id={`${id}-t`} descId={`${id}-d`} title={title} eyebrow={eyebrow} description={description} hideClose={hideClose} onClose={onClose} />
              <Content onSubmit={onSubmit} footer={footer}>
                {children}
              </Content>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export interface DrawerProps extends OverlayProps {
  /** Panel width in px on wide screens (default 520). Full width on phones. */
  width?: number;
}

/** Side panel sliding in from the right — for detail views and longer forms. */
export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  closeOnBackdrop = true,
  hideClose,
  onSubmit,
  width = 520,
  className,
}: DrawerProps) {
  const isClient = useIsClient();
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useFocusTrap(ref, open && isClient, onClose);
  useScrollLock(open && isClient);
  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onMouseDown={() => closeOnBackdrop && onClose()}
            aria-hidden
          />
          <div key="layer" className={styles.drawerLayer}>
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${id}-t`}
              aria-describedby={description ? `${id}-d` : undefined}
              tabIndex={-1}
              className={cx(styles.drawer, className)}
              style={{ ["--drawer-w" as string]: `${width}px` }}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
              transition={{ duration: 0.34, ease: EASE }}
            >
              <Header id={`${id}-t`} descId={`${id}-d`} title={title} eyebrow={eyebrow} description={description} hideClose={hideClose} onClose={onClose} />
              <Content onSubmit={onSubmit} footer={footer}>
                {children}
              </Content>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
