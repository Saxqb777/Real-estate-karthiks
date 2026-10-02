// "Email me my pending actions": subject + dark HUD-styled HTML (inline styles, table layout for mail clients)
// + plain-text fallback. Pure string building — the route does the sending.
import { daysBetween, formatDate } from "@/lib/dates";
import type { PriorityValue } from "@/lib/schemas/action";

export const DEFAULT_EMAIL_FROM = "Pattukottai Estates <onboarding@resend.dev>";

export interface EmailAction {
  title: string;
  type: string;
  priority: PriorityValue;
  dueDate: Date | string | null;
  unitName: string | null;
  isOverdue: boolean;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

// Design tokens (docs/DESIGN.md), as solid colours — many mail clients ignore rgba / CSS variables.
const C = {
  bg0: "#070B16",
  bg1: "#0D1426",
  bg2: "#121B33",
  line: "#1F2A47",
  text: "#EAF0FF",
  dim: "#9AA7C7",
  faint: "#5E6B8C",
  marigold: "#FFB547",
  saffron: "#FF8A3D",
  teal: "#2DD4BF",
  coral: "#FF5D73",
  sky: "#60A5FA",
  coralBg: "#2A1424",
};
const PRIORITY_COLOR: Record<PriorityValue, string> = { High: C.coral, Medium: C.marigold, Low: C.sky };
const DISPLAY = "'Rajdhani','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const BODY = "'Manrope','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const pendingActionsSubject = (count: number, brandName: string) =>
  `${plural(count, "pending action")} — ${brandName}`;

/** "Overdue by 3 days (due 1/10/2026)", "Due today", "Due 15/10/2026", "No due date". */
function dueLabel(a: EmailAction, today: Date): string {
  if (!a.dueDate) return "No due date";
  const days = daysBetween(new Date(a.dueDate), today);
  if (a.isOverdue) return `Overdue by ${plural(days, "day")} (due ${formatDate(a.dueDate)})`;
  if (days === 0) return `Due today (${formatDate(a.dueDate)})`;
  return `Due ${formatDate(a.dueDate)}`;
}

/** Overdue → coral, due today → marigold, otherwise dim. */
function dueColor(a: EmailAction, today: Date): string {
  if (a.isOverdue) return C.coral;
  return a.dueDate && daysBetween(new Date(a.dueDate), today) === 0 ? C.marigold : C.dim;
}

function actionRow(a: EmailAction, today: Date): string {
  const accent = a.isOverdue ? C.coral : PRIORITY_COLOR[a.priority];
  const pill = (label: string, color: string) =>
    `<span style="display:inline-block;padding:2px 8px;border:1px solid ${color};border-radius:999px;color:${color};` +
    `font-family:${DISPLAY};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${esc(label)}</span>`;
  const meta = [
    `<span style="color:${dueColor(a, today)};font-weight:${a.isOverdue ? 700 : 400};">${esc(dueLabel(a, today))}</span>`,
    a.unitName && `<span style="color:${C.dim};">${esc(a.unitName)}</span>`,
    a.type && a.type !== "Custom" && `<span style="color:${C.faint};">${esc(a.type)}</span>`,
  ].filter(Boolean);
  return `
<tr><td style="padding:0 0 10px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${a.isOverdue ? C.coralBg : C.bg2};border:1px solid ${a.isOverdue ? C.coral : C.line};border-left:4px solid ${accent};border-radius:10px;">
    <tr><td style="padding:14px 16px;">
      <div style="margin:0 0 8px 0;">${pill(a.priority, PRIORITY_COLOR[a.priority])}${a.isOverdue ? `&nbsp;${pill("Overdue", C.coral)}` : ""}</div>
      <div style="font-family:${BODY};font-size:16px;line-height:22px;font-weight:700;color:${C.text};">${esc(a.title)}</div>
      <div style="font-family:${BODY};font-size:13px;line-height:20px;margin-top:4px;">${meta.join(`<span style="color:${C.faint};">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`)}</div>
    </td></tr>
  </table>
</td></tr>`;
}

function stat(label: string, value: number, color: string): string {
  return `<td style="padding:0 24px 0 0;" valign="top">
    <div style="font-family:${DISPLAY};font-size:34px;line-height:38px;font-weight:700;color:${color};">${value}</div>
    <div style="font-family:${DISPLAY};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.dim};">${label}</div>
  </td>`;
}

/** Subject, HTML and text for the pending-actions digest (actions already sorted: overdue / soonest first). */
export function buildPendingActionsEmail(opts: {
  brandName: string;
  actions: EmailAction[];
  today: Date;
  appUrl?: string | null;
}): BuiltEmail {
  const { brandName, actions, today, appUrl } = opts;
  const overdue = actions.filter((a) => a.isOverdue).length;
  const high = actions.filter((a) => a.priority === "High").length;
  const subject = pendingActionsSubject(actions.length, brandName);
  const preheader = actions.length
    ? `${plural(actions.length, "action")} waiting${overdue ? `, ${overdue} overdue` : ""}.`
    : "You're all caught up.";

  const rows = actions.length
    ? actions.map((a) => actionRow(a, today)).join("")
    : `<tr><td style="padding:24px 16px;border:1px dashed ${C.line};border-radius:10px;text-align:center;font-family:${BODY};font-size:15px;color:${C.teal};">All caught up — no pending actions.</td></tr>`;

  const button = appUrl
    ? `<tr><td style="padding:8px 28px 22px 28px;">
        <a href="${esc(appUrl)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:${C.marigold};background-image:linear-gradient(90deg,${C.marigold},${C.saffron});color:${C.bg0};font-family:${DISPLAY};font-size:14px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;">Open dashboard</a>
      </td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg0};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg0};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${C.bg1};border:1px solid ${C.line};border-radius:14px;">
    <tr><td style="height:4px;line-height:4px;font-size:0;background:${C.marigold};background-image:linear-gradient(90deg,${C.marigold},${C.saffron});border-radius:14px 14px 0 0;">&nbsp;</td></tr>
    <tr><td style="padding:24px 28px 8px 28px;">
      <div style="font-family:${DISPLAY};font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${C.marigold};">${esc(brandName)}</div>
      <div style="font-family:${DISPLAY};font-size:26px;line-height:32px;font-weight:700;color:${C.text};margin-top:4px;">Pending actions</div>
      <div style="font-family:${BODY};font-size:13px;color:${C.dim};margin-top:2px;">As of ${formatDate(today)} (IST)</div>
    </td></tr>
    <tr><td style="padding:12px 28px 18px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        ${stat("Pending", actions.length, actions.length ? C.marigold : C.teal)}${stat("Overdue", overdue, overdue ? C.coral : C.faint)}${stat("High priority", high, high ? C.coral : C.faint)}
      </tr></table>
    </td></tr>
    <tr><td style="padding:0 28px 8px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    </td></tr>
    ${button}
    <tr><td style="padding:16px 28px 24px 28px;border-top:1px solid ${C.line};font-family:${BODY};font-size:12px;line-height:18px;color:${C.faint};">
      Sent from ${esc(brandName)} because you asked for your pending actions.
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;

  const lines = actions.map((a) => {
    const parts = [`[${a.priority}] ${a.title}`, dueLabel(a, today), a.unitName].filter(Boolean);
    return `${a.isOverdue ? "! " : "- "}${parts.join(" · ")}`;
  });
  const text = [
    subject,
    `As of ${formatDate(today)} (IST) — ${plural(actions.length, "pending action")}, ${overdue} overdue`,
    "",
    ...(lines.length ? lines : ["All caught up — no pending actions."]),
    ...(appUrl ? ["", `Open dashboard: ${appUrl}`] : []),
  ].join("\n");

  return { subject, html, text };
}
