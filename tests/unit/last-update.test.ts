import { describe, it, expect } from "vitest";

import { pickLatestUpdate } from "@/lib/tasks/last-update";

const u = (
  created_at: string,
  progress_percentage: number,
  comment: string | null = null,
  name: string | null = null,
) => ({
  created_at,
  progress_percentage,
  status_update_comment: comment,
  updater: name ? { full_name: name } : null,
});

describe("pickLatestUpdate", () => {
  it("selects the most recent update by created_at (independent of input order)", () => {
    const updates = [
      u("2026-06-10T09:00:00Z", 30, "early"),
      u("2026-06-14T11:00:00Z", 70, "latest note", "Meshari"),
      u("2026-06-12T08:00:00Z", 50, "middle"),
    ];
    expect(pickLatestUpdate(updates)).toEqual({
      progress_percentage: 70,
      status_update_comment: "latest note",
      created_at: "2026-06-14T11:00:00Z",
      updater_name: "Meshari",
    });
  });

  it("works when the list is already DESC (as listUpdates returns it)", () => {
    const updates = [
      u("2026-06-14T11:00:00Z", 70),
      u("2026-06-10T09:00:00Z", 30),
    ];
    expect(pickLatestUpdate(updates)?.progress_percentage).toBe(70);
  });

  it("returns null for the no-updates case", () => {
    expect(pickLatestUpdate([])).toBeNull();
    expect(pickLatestUpdate(null)).toBeNull();
    expect(pickLatestUpdate(undefined)).toBeNull();
  });

  it("maps a missing updater name to null", () => {
    expect(pickLatestUpdate([u("2026-06-14T11:00:00Z", 40)])?.updater_name).toBeNull();
  });
});
