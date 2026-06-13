import { describe, it, expect, beforeEach, vi } from "vitest";

// The write actions are gated by templates.manage (admin/section_head) and map
// the validated defaults onto the table columns (undefined → null), stamping
// created_by from the session. Mirrors the projects action pattern.
const session = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getCurrentPermissions: vi.fn(),
}));
const data = vi.hoisted(() => ({
  createTaskTemplate: vi.fn(),
  updateTaskTemplate: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/data/task-templates", () => data);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createTaskTemplateAction,
  updateTaskTemplateAction,
  setTaskTemplateActiveAction,
} from "@/lib/actions/task-templates";

beforeEach(() => {
  vi.clearAllMocks();
  data.createTaskTemplate.mockResolvedValue({ id: "tpl-1" });
  data.updateTaskTemplate.mockResolvedValue({ id: "tpl-1" });
});

function asUser(permissions: string[]) {
  session.getCurrentProfile.mockResolvedValue({ id: "u1" });
  session.getCurrentPermissions.mockResolvedValue(permissions);
}

describe("createTaskTemplateAction", () => {
  it("refuses a caller without templates.manage", async () => {
    asUser(["templates.read"]);
    const res = await createTaskTemplateAction({ name: "Onboarding" });
    expect(res).toEqual({ ok: false, error: "Not authorized." });
    expect(data.createTaskTemplate).not.toHaveBeenCalled();
  });

  it("rejects an invalid template (name too short) before any write", async () => {
    asUser(["templates.manage"]);
    const res = await createTaskTemplateAction({ name: "a" });
    expect(res.ok).toBe(false);
    expect(data.createTaskTemplate).not.toHaveBeenCalled();
  });

  it("maps defaults to columns (undefined → null) and stamps created_by", async () => {
    asUser(["templates.manage"]);
    const res = await createTaskTemplateAction({
      name: "Onboarding",
      title: "Set up workstation",
      priority: "high",
    });
    expect(res).toEqual({ ok: true, id: "tpl-1" });
    expect(data.createTaskTemplate).toHaveBeenCalledWith({
      name: "Onboarding",
      title: "Set up workstation",
      description: null,
      priority: "high",
      business_line_id: null,
      estimated_effort_hours: null,
      created_by: "u1",
    });
  });
});

describe("updateTaskTemplateAction / setTaskTemplateActiveAction", () => {
  it("edits an existing template when authorized", async () => {
    asUser(["templates.manage"]);
    const res = await updateTaskTemplateAction("tpl-1", {
      name: "Renamed",
      priority: "low",
    });
    expect(res.ok).toBe(true);
    const patch = data.updateTaskTemplate.mock.calls[0]![1];
    expect(patch).toMatchObject({ name: "Renamed", priority: "low" });
  });

  it("toggles active only with templates.manage", async () => {
    asUser(["templates.read"]);
    const denied = await setTaskTemplateActiveAction("tpl-1", false);
    expect(denied).toEqual({ ok: false, error: "Not authorized." });
    expect(data.updateTaskTemplate).not.toHaveBeenCalled();

    asUser(["templates.manage"]);
    const ok = await setTaskTemplateActiveAction("tpl-1", false);
    expect(ok.ok).toBe(true);
    expect(data.updateTaskTemplate).toHaveBeenCalledWith("tpl-1", {
      is_active: false,
    });
  });
});
