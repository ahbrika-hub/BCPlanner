import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";

import {
  buildDigests,
  renderDigestEmail,
  type OverdueTask,
  type RecipientProfile,
} from "@/lib/notifications/digest";
import { emailEnabled } from "@/lib/email/send";

function task(id: string, assignee: string | null): OverdueTask {
  return {
    id,
    task_no: `T-${id}`,
    title: `Task ${id}`,
    due_date: "2026-01-01",
    status: "in_progress",
    priority: "high",
    assignee_id: assignee,
    assignee_name: assignee ? `User ${assignee}` : null,
  };
}

const profiles: Record<string, RecipientProfile> = {
  u1: { id: "u1", email: "u1@x.io", full_name: "Una" },
  u2: { id: "u2", email: "u2@x.io", full_name: "Uma" },
  m1: { id: "m1", email: "m1@x.io", full_name: "Mara" },
  noemail: { id: "noemail", email: null, full_name: "No Email" },
};

describe("buildDigests", () => {
  // u1: assignee-only; u2: assignee AND manager; m1: manager-only.
  const overdue = [
    task("1", "u1"),
    task("2", "u1"),
    task("3", "u2"),
    task("4", null), // unassigned overdue — oversight only
  ];

  it("scopes assignee digests to own tasks and managers to org-wide oversight", () => {
    const digests = buildDigests({
      overdue,
      managerIds: ["u2", "m1"],
      profilesById: profiles,
    });
    const byId = new Map(digests.map((d) => [d.userId, d]));
    const u1 = byId.get("u1")!;
    const u2 = byId.get("u2")!;
    const m1 = byId.get("m1")!;

    // assignee-only
    expect(u1.ownTasks.map((t) => t.id)).toEqual(["1", "2"]);
    expect(u1.teamTasks).toEqual([]);

    // assignee + manager → ONE digest, both sections; team excludes own (id 3)
    expect(u2.ownTasks.map((t) => t.id)).toEqual(["3"]);
    expect(u2.teamTasks.map((t) => t.id).sort()).toEqual(["1", "2", "4"]);

    // manager-only → team is all overdue (none assigned to m1), no own
    expect(m1.ownTasks).toEqual([]);
    expect(m1.teamTasks.map((t) => t.id).sort()).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  it("de-dupes: a manager who is also an assignee appears exactly once", () => {
    const digests = buildDigests({
      overdue,
      managerIds: ["u2", "m1"],
      profilesById: profiles,
    });
    expect(digests.filter((d) => d.userId === "u2")).toHaveLength(1);
  });

  it("skips recipients with no resolvable email", () => {
    const digests = buildDigests({
      overdue: [task("9", "noemail")],
      managerIds: ["noemail"],
      profilesById: profiles,
    });
    expect(digests).toEqual([]);
  });

  it("never produces an empty digest (no overdue → no recipients)", () => {
    expect(
      buildDigests({ overdue: [], managerIds: ["m1"], profilesById: profiles }),
    ).toEqual([]);
  });
});

describe("renderDigestEmail", () => {
  it("renders both sections with counts in the subject", () => {
    const digest = buildDigests({
      overdue: [task("1", "u2"), task("2", "u1")],
      managerIds: ["u2"],
      profilesById: profiles,
    }).find((d) => d.userId === "u2")!;
    const { subject, html } = renderDigestEmail(digest);
    expect(subject).toContain("assigned to you");
    expect(html).toContain("Your overdue tasks");
    expect(html).toContain("Team overdue tasks");
  });
});

describe("emailEnabled gating boundary", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("is OFF (no-op) unless EMAIL_ENABLED + RESEND_API_KEY + EMAIL_FROM all set", () => {
    delete process.env.EMAIL_ENABLED;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    expect(emailEnabled()).toBe(false);

    process.env.EMAIL_ENABLED = "true"; // only one of three
    expect(emailEnabled()).toBe(false);
  });

  it("would send when all three are configured", () => {
    process.env.EMAIL_ENABLED = "true";
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "no-reply@example.com";
    expect(emailEnabled()).toBe(true);
  });
});

describe("cron route auth (mirrors generate-recurring)", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  async function call(headers: Record<string, string>) {
    const { GET } = await import(
      "@/app/api/cron/generate-overdue-digest/route"
    );
    const req = new NextRequest(
      "http://localhost/api/cron/generate-overdue-digest",
      { headers },
    );
    return GET(req);
  }

  it("401 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await call({});
    expect(res.status).toBe(401);
  });

  it("401 with a wrong/absent Bearer token", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await call({ authorization: "Bearer nope" });
    expect(res.status).toBe(401);
  });

  it("503 with valid Bearer but no service-role key", async () => {
    process.env.CRON_SECRET = "s3cret";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await call({ authorization: "Bearer s3cret" });
    expect(res.status).toBe(503);
  });
});
