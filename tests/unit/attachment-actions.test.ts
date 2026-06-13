import { describe, it, expect, beforeEach, vi } from "vitest";

// App-layer authorization proofs for the attachment server actions. The data
// layer (RLS-scoped lookups, signing, delete) is mocked so we exercise only the
// guard logic added on top of RLS.
const session = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getCurrentPermissions: vi.fn(),
}));
const data = vi.hoisted(() => ({
  getAttachmentByStoragePath: vi.fn(),
  getAttachmentById: vi.fn(),
  getAttachmentSignedUrl: vi.fn(),
  deleteAttachment: vi.fn(),
  uploadAttachment: vi.fn(),
  MAX_ATTACHMENT_BYTES: 10 * 1024 * 1024,
}));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/data/attachments", () => data);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  getAttachmentUrlAction,
  deleteAttachmentAction,
} from "@/lib/actions/collaboration";

const OWNER = { id: "owner-1", role: "employee" } as never;
const OTHER = { id: "other-2", role: "employee" } as never;
const PATH = "task-1/abc-file.pdf";
const ROW = {
  id: "att-1",
  task_id: "task-1",
  uploaded_by: "owner-1",
  storage_path: PATH,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAttachmentUrlAction", () => {
  it("rejects an unauthenticated caller", async () => {
    session.getCurrentProfile.mockResolvedValue(null);
    const res = await getAttachmentUrlAction(PATH);
    expect(res.ok).toBe(false);
    expect(data.getAttachmentSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects a caller without attachments.download", async () => {
    session.getCurrentProfile.mockResolvedValue(OTHER);
    session.getCurrentPermissions.mockResolvedValue([]);
    const res = await getAttachmentUrlAction(PATH);
    expect(res.ok).toBe(false);
    expect(data.getAttachmentSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects retrieving an attachment the caller cannot see (IDOR)", async () => {
    session.getCurrentProfile.mockResolvedValue(OTHER);
    session.getCurrentPermissions.mockResolvedValue(["attachments.download"]);
    // RLS-scoped lookup returns null -> not visible to this user.
    data.getAttachmentByStoragePath.mockResolvedValue(null);
    const res = await getAttachmentUrlAction(PATH);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("Not authorized.");
    expect(data.getAttachmentSignedUrl).not.toHaveBeenCalled();
  });

  it("signs a URL for a visible attachment", async () => {
    session.getCurrentProfile.mockResolvedValue(OWNER);
    session.getCurrentPermissions.mockResolvedValue(["attachments.download"]);
    data.getAttachmentByStoragePath.mockResolvedValue(ROW);
    data.getAttachmentSignedUrl.mockResolvedValue("https://signed.example/x");
    const res = await getAttachmentUrlAction(PATH);
    expect(res.ok).toBe(true);
    expect(res.url).toBe("https://signed.example/x");
    expect(data.getAttachmentSignedUrl).toHaveBeenCalledWith(PATH);
  });
});

describe("deleteAttachmentAction", () => {
  it("rejects an unauthenticated caller", async () => {
    session.getCurrentProfile.mockResolvedValue(null);
    const res = await deleteAttachmentAction("att-1", "task-1");
    expect(res.ok).toBe(false);
    expect(data.deleteAttachment).not.toHaveBeenCalled();
  });

  it("rejects deleting an attachment the caller cannot see", async () => {
    session.getCurrentProfile.mockResolvedValue(OTHER);
    session.getCurrentPermissions.mockResolvedValue(["attachments.download"]);
    data.getAttachmentById.mockResolvedValue(null);
    const res = await deleteAttachmentAction("att-1", "task-1");
    expect(res).toEqual({ ok: false, error: "Not authorized." });
    expect(data.deleteAttachment).not.toHaveBeenCalled();
  });

  it("rejects a non-owner without tasks.delete", async () => {
    session.getCurrentProfile.mockResolvedValue(OTHER);
    session.getCurrentPermissions.mockResolvedValue(["attachments.download"]);
    data.getAttachmentById.mockResolvedValue(ROW); // uploaded_by = owner-1
    const res = await deleteAttachmentAction("att-1", "task-1");
    expect(res).toEqual({ ok: false, error: "Not authorized." });
    expect(data.deleteAttachment).not.toHaveBeenCalled();
  });

  it("allows the uploader to delete their own attachment", async () => {
    session.getCurrentProfile.mockResolvedValue(OWNER);
    session.getCurrentPermissions.mockResolvedValue(["attachments.download"]);
    data.getAttachmentById.mockResolvedValue(ROW);
    const res = await deleteAttachmentAction("att-1", "task-1");
    expect(res.ok).toBe(true);
    expect(data.deleteAttachment).toHaveBeenCalledWith("att-1");
  });

  it("allows a manager with tasks.delete to delete any attachment", async () => {
    session.getCurrentProfile.mockResolvedValue(OTHER);
    session.getCurrentPermissions.mockResolvedValue(["tasks.delete"]);
    data.getAttachmentById.mockResolvedValue(ROW); // uploaded_by = owner-1
    const res = await deleteAttachmentAction("att-1", "task-1");
    expect(res.ok).toBe(true);
    expect(data.deleteAttachment).toHaveBeenCalledWith("att-1");
  });
});
