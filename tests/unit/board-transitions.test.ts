import { describe, it, expect } from "vitest";

import {
  LANES,
  laneForStatus,
  descriptorForDrop,
  resolveBoardDrop,
  actionableTargets,
  isCardDraggable,
} from "@/lib/tasks/board";
import { ACTIONS } from "@/lib/tasks/transitions";
import { TASK_STATUSES } from "@/lib/tasks/status";
import type { TaskStatus } from "@/lib/data/types";

// The board is a presentation layer ONLY. These tests prove a drop never invents
// a transition: it always resolves to one of the existing ACTIONS descriptors
// (which mirror the DB guard), and the board's legal/illegal verdict matches
// what that action's `from`/`to` allow — so the guard decides, not the UI.

const ALL_PERMS = ACTIONS.map((a) => a.permission);

describe("lane model", () => {
  it("maps every one of the 12 statuses to exactly one lane", () => {
    const seen = new Map<TaskStatus, number>();
    for (const lane of LANES) {
      for (const s of lane.statuses) seen.set(s, (seen.get(s) ?? 0) + 1);
    }
    // Every status mapped, and none mapped twice.
    for (const s of TASK_STATUSES) expect(seen.get(s)).toBe(1);
    expect(seen.size).toBe(TASK_STATUSES.length);
    expect(TASK_STATUSES.length).toBe(12);
  });

  it("laneForStatus is consistent with the lane membership", () => {
    for (const lane of LANES) {
      for (const s of lane.statuses) {
        expect(laneForStatus(s).key).toBe(lane.key);
      }
    }
  });
});

describe("descriptorForDrop never invents a transition", () => {
  it("only ever returns an ACTIONS descriptor whose `to` is the lane's primary target", () => {
    for (const lane of LANES) {
      for (const from of TASK_STATUSES) {
        const desc = descriptorForDrop(from, lane);
        if (desc === null) continue;
        // It is a real descriptor from the single source of truth…
        expect(ACTIONS).toContain(desc);
        // …it targets exactly the lane's primary status…
        expect(desc.to).toBe(lane.primaryTarget);
        // …and the card's current status is in that action's legal `from` set.
        expect(desc.from).toContain(from);
      }
    }
  });

  it("returns null for a lane that accepts no drops (In Progress)", () => {
    const inProgress = LANES.find((l) => l.key === "in_progress")!;
    expect(inProgress.primaryTarget).toBeNull();
    for (const from of TASK_STATUSES) {
      expect(descriptorForDrop(from, inProgress)).toBeNull();
    }
  });
});

const lane = (key: string) => LANES.find((l) => l.key === key)!;

describe("resolveBoardDrop verdicts", () => {
  it("LEGAL no-extra-fields move → ready (assigned → Review = submit_review)", () => {
    const r = resolveBoardDrop("assigned", lane("review"), ["tasks.submit_review"]);
    expect(r.kind).toBe("ready");
    if (r.kind === "ready") expect(r.descriptor.action).toBe("submit_review");
  });

  it("LEGAL reopen → ready (completed → To Do = reopen)", () => {
    const r = resolveBoardDrop("completed", lane("todo"), ["tasks.reopen"]);
    expect(r.kind).toBe("ready");
    if (r.kind === "ready") expect(r.descriptor.action).toBe("reopen");
  });

  it("LEGAL cancel → ready (in_progress → Closed = cancel)", () => {
    const r = resolveBoardDrop("in_progress", lane("closed"), ["tasks.cancel"]);
    expect(r.kind).toBe("ready");
    if (r.kind === "ready") expect(r.descriptor.action).toBe("cancel");
  });

  it("ILLEGAL move → illegal (draft → Review is not a guard-legal pair)", () => {
    const r = resolveBoardDrop("draft", lane("review"), ALL_PERMS);
    expect(r.kind).toBe("illegal");
  });

  it("required-fields move → needs_fields, NOT a silent commit (pending_review → Done = close)", () => {
    const r = resolveBoardDrop("pending_review", lane("done"), ["tasks.close"]);
    expect(r.kind).toBe("needs_fields");
    if (r.kind === "needs_fields") {
      expect(r.descriptor.action).toBe("close");
      expect(r.descriptor.requires).toBe("closure");
    }
  });

  it("legal move but missing permission → needs_permission (no affordance / server rejects)", () => {
    const r = resolveBoardDrop("assigned", lane("review"), []);
    expect(r.kind).toBe("needs_permission");
  });

  it("dropping onto the card's own lane → noop", () => {
    const r = resolveBoardDrop("pending_review", lane("review"), ALL_PERMS);
    expect(r.kind).toBe("noop");
  });

  it("dropping onto In Progress → not_target (reached via Log Progress only)", () => {
    const r = resolveBoardDrop("assigned", lane("in_progress"), ALL_PERMS);
    expect(r.kind).toBe("not_target");
  });
});

describe("drag affordance", () => {
  it("a card with no permitted move is not draggable", () => {
    expect(isCardDraggable("assigned", [])).toBe(false);
    expect(actionableTargets("assigned", [])).toEqual([]);
  });

  it("a card with a permitted move is draggable and lists its targets", () => {
    const targets = actionableTargets("assigned", ["tasks.submit_review"]);
    expect(targets).toContain("review");
    expect(isCardDraggable("assigned", ["tasks.submit_review"])).toBe(true);
  });

  it("a completed card is draggable only for reopen (To Do), nothing else", () => {
    expect(actionableTargets("completed", ALL_PERMS)).toEqual(["todo"]);
  });

  it("every actionable target resolves to ready or needs_fields (never illegal/forbidden)", () => {
    for (const from of TASK_STATUSES) {
      for (const key of actionableTargets(from, ALL_PERMS)) {
        const r = resolveBoardDrop(from, lane(key), ALL_PERMS);
        expect(["ready", "needs_fields"]).toContain(r.kind);
      }
    }
  });
});
