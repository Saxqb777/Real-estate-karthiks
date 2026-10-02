// POST /api/actions/email-me — emails the owner (Settings.ownerEmail) their pending actions via Resend.
// Without RESEND_API_KEY it does nothing and returns a preview instead (200, skipped).
import { Resend } from "resend";
import { ApiError, badRequest, handler, json } from "@/lib/api";
import { todayIST } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { DEFAULT_EMAIL_FROM, buildPendingActionsEmail } from "@/lib/email";
import { actionInclude, compareActions, isActionOverdue } from "@/lib/schemas/action";

export const POST = handler(async (req) => {
  const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { ownerEmail: true, brandName: true } });
  const to = settings?.ownerEmail?.trim();
  if (!to) throw badRequest("Add your email in Config → Settings first");

  const today = todayIST();
  const rows = await prisma.actionItem.findMany({ where: { isDone: false }, include: actionInclude });
  const email = buildPendingActionsEmail({
    brandName: settings?.brandName || "Pattukottai Estates",
    today,
    appUrl: process.env.APP_URL?.trim() || new URL(req.url).origin,
    actions: rows.sort(compareActions).map((a) => ({
      title: a.title,
      type: a.type,
      priority: a.priority,
      dueDate: a.dueDate,
      unitName: a.unit?.name ?? null,
      isOverdue: isActionOverdue(a, today),
    })),
  });

  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return json({
      sent: false,
      skipped: true,
      reason: "Email sending isn't set up on the server yet (RESEND_API_KEY is missing), so nothing was sent. Here is what the email would say.",
      preview: { to, subject: email.subject, text: email.text },
    });
  }

  let result: Awaited<ReturnType<Resend["emails"]["send"]>>;
  try {
    result = await new Resend(key).emails.send({
      from: process.env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  } catch (err) {
    throw new ApiError(502, `Couldn't reach the email service: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (result.error || !result.data) {
    throw new ApiError(502, `The email service refused the message: ${result.error?.message ?? "no response"}`);
  }
  return json({ sent: true, id: result.data.id });
});
