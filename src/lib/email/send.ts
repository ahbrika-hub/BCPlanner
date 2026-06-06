import "server-only";

/**
 * Feature-flagged transactional email via Resend (HTTP API; no SDK dependency).
 * Sends only when EMAIL_ENABLED === 'true' and RESEND_API_KEY + EMAIL_FROM are
 * set. Otherwise a silent no-op. Never throws — email must not break an action.
 * No keys are hardcoded.
 */
export function emailEnabled(): boolean {
  return (
    process.env.EMAIL_ENABLED === "true" &&
    !!process.env.RESEND_API_KEY &&
    !!process.env.EMAIL_FROM
  );
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<void> {
  if (!emailEnabled()) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });
  } catch {
    // Swallow — a failed email must never fail the surrounding action.
  }
}
