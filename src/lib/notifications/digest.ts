/**
 * Overdue-escalation digest assembly — PURE functions (no I/O), so the recipient
 * scoping and rendering are unit-testable independent of email/DB. The cron route
 * supplies the data (overdue tasks from the `overdue_tasks` SQL fn + recipient
 * profiles via the service-role client) and sends the rendered emails through the
 * existing, flag-gated email layer.
 */

export type OverdueTask = {
  id: string;
  task_no: string | null;
  title: string;
  due_date: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  assignee_name: string | null;
};

export type RecipientProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
};

/** One coherent digest for one person (see de-dup note in the report). */
export type Digest = {
  userId: string;
  email: string;
  name: string;
  /** The recipient's OWN overdue tasks (they are the assignee). */
  ownTasks: OverdueTask[];
  /** Oversight: other people's overdue tasks (managers only; excludes own). */
  teamTasks: OverdueTask[];
};

/** Max rows rendered per section in one email; overflow is summarised. */
export const MAX_ROWS_PER_SECTION = 100;

/**
 * Build at most ONE digest per recipient (de-duped). A person who is both an
 * assignee with overdue work AND a manager gets a SINGLE email with two clearly
 * separated sections — see the report for the justification. A digest with no
 * rows in either section is never produced (never send an empty digest), and a
 * recipient with no resolvable email is skipped.
 *
 * @param overdue      ALL overdue tasks (from `overdue_tasks()` with no arg).
 * @param managerIds   Active section_head/admin ids (org-wide oversight scope).
 * @param profilesById Email/name for every potential recipient.
 */
export function buildDigests(args: {
  overdue: OverdueTask[];
  managerIds: Iterable<string>;
  profilesById: Record<string, RecipientProfile>;
}): Digest[] {
  const { overdue, profilesById } = args;
  const managerIds = new Set(args.managerIds);

  // Candidate recipients: anyone with overdue work assigned to them, plus every
  // manager (who receives the oversight view even with no personal overdue work).
  const assigneeIds = new Set(
    overdue.map((t) => t.assignee_id).filter((x): x is string => !!x),
  );
  const recipientIds = new Set<string>([...assigneeIds, ...managerIds]);

  const digests: Digest[] = [];
  for (const userId of recipientIds) {
    const profile = profilesById[userId];
    const email = profile?.email?.trim();
    if (!email) continue; // can't send without an address

    const ownTasks = overdue.filter((t) => t.assignee_id === userId);
    const teamTasks = managerIds.has(userId)
      ? overdue.filter((t) => t.assignee_id !== userId)
      : [];

    if (ownTasks.length === 0 && teamTasks.length === 0) continue; // never empty

    digests.push({
      userId,
      email,
      name: profile?.full_name?.trim() || email,
      ownTasks,
      teamTasks,
    });
  }

  // Stable order for deterministic runs/tests.
  digests.sort((a, b) => a.userId.localeCompare(b.userId));
  return digests;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rows(tasks: OverdueTask[], withAssignee: boolean): string {
  const shown = tasks.slice(0, MAX_ROWS_PER_SECTION);
  const items = shown
    .map((t) => {
      const ref = t.task_no ? `${escapeHtml(t.task_no)} — ` : "";
      const who =
        withAssignee && t.assignee_name
          ? ` <em>(${escapeHtml(t.assignee_name)})</em>`
          : "";
      return `<li>${ref}${escapeHtml(t.title)} — due ${escapeHtml(
        t.due_date ?? "",
      )} · ${escapeHtml(t.status)}${who}</li>`;
    })
    .join("");
  const more =
    tasks.length > shown.length
      ? `<li>…and ${tasks.length - shown.length} more</li>`
      : "";
  return `<ul>${items}${more}</ul>`;
}

/** Render a digest to a subject + HTML body. */
export function renderDigestEmail(digest: Digest): {
  subject: string;
  html: string;
} {
  const total = digest.ownTasks.length + digest.teamTasks.length;
  const subject = `Overdue tasks digest — ${digest.ownTasks.length} assigned to you${
    digest.teamTasks.length ? `, ${digest.teamTasks.length} across the team` : ""
  }`;

  const parts: string[] = [`<p>Hello ${escapeHtml(digest.name)},</p>`];
  if (digest.ownTasks.length > 0) {
    parts.push(
      `<h3>Your overdue tasks (${digest.ownTasks.length})</h3>`,
      rows(digest.ownTasks, false),
    );
  }
  if (digest.teamTasks.length > 0) {
    parts.push(
      `<h3>Team overdue tasks — oversight (${digest.teamTasks.length})</h3>`,
      rows(digest.teamTasks, true),
    );
  }
  parts.push(
    `<p style="color:#666;font-size:12px">You are receiving this because you have overdue tasks or hold an oversight role. This is an automated daily digest (${total} task${
      total === 1 ? "" : "s"
    }).</p>`,
  );

  return { subject, html: parts.join("\n") };
}
