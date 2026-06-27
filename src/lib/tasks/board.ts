import { can } from "@/lib/permissions";
import { ACTIONS, type ActionDescriptor } from "@/lib/tasks/transitions";
import { TASK_STATUS_LABELS, TASK_STATUSES } from "@/lib/tasks/status";
import type { TaskStatus } from "@/lib/data/types";

/**
 * Kanban lane model — a PURELY presentational grouping of the 12 task statuses
 * into a handful of lanes. It carries NO authority: a drag never writes a status
 * directly. Every drop is resolved to ONE existing transition action (see
 * {@link resolveBoardDrop}) and committed through the SAME `transitionTaskAction`
 * the task action bar uses, so the DB `validate_task_transition` guard — not this
 * file — decides legality. This module is framework-agnostic (no React, no
 * server imports beyond the shared descriptors) so it is unit-testable.
 *
 * ── Lane → status grouping (every status mapped exactly once) ────────────────
 *   To Do      draft, pending_approval, approved, assigned, reopened
 *   In Progress in_progress, pending_update          (display only — see below)
 *   In Review  pending_review, returned_for_modification
 *   Done       completed
 *   Closed     cancelled, rejected
 *
 * ── Per-lane PRIMARY drop target + the action a drop resolves to ─────────────
 *   To Do       → reopened        via `reopen`        (from completed/cancelled/rejected)
 *   In Progress → (none)          NOT a drop target — see note
 *   In Review   → pending_review  via `submit_review` (from assigned/approved/in_progress/
 *                                  pending_update/returned_for_modification/reopened)
 *   Done        → completed       via `close`         (from pending_review) — requires fields
 *   Closed      → cancelled       via `cancel`        (from the in-flight statuses)
 *
 * NOTE — In Progress has NO primary target: the lifecycle reaches `in_progress`
 * only through logging progress (`log_progress`, which intentionally has no `to`
 * and is rejected by `transitionTaskAction`). There is no guard-legal *status
 * write* into in_progress, so the board does not offer it as a drop target;
 * "start work" stays the Log Progress action on the task detail. Documented in
 * the report.
 */

export type LaneKey = "todo" | "in_progress" | "review" | "done" | "closed";

export type Lane = {
  key: LaneKey;
  label: string;
  /** Statuses whose cards appear in this lane. */
  statuses: TaskStatus[];
  /**
   * The single status a drop onto this lane targets, or null when the lane
   * accepts no drops (display only). A drop resolves the action whose `to`
   * equals this and whose `from` includes the card's current status.
   */
  primaryTarget: TaskStatus | null;
};

export const LANES: readonly Lane[] = [
  {
    key: "todo",
    label: "To Do",
    statuses: ["draft", "pending_approval", "approved", "assigned", "reopened"],
    // Dropping a finished/closed card back here REOPENS it (no extra fields).
    primaryTarget: "reopened",
  },
  {
    key: "in_progress",
    label: "In Progress",
    statuses: ["in_progress", "pending_update"],
    // Reached via Log Progress, not a status write — not a drop target.
    primaryTarget: null,
  },
  {
    key: "review",
    label: "In Review",
    statuses: ["pending_review", "returned_for_modification"],
    primaryTarget: "pending_review",
  },
  {
    key: "done",
    label: "Done",
    statuses: ["completed"],
    primaryTarget: "completed",
  },
  {
    key: "closed",
    label: "Cancelled / Rejected",
    statuses: ["cancelled", "rejected"],
    primaryTarget: "cancelled",
  },
] as const;

const LANE_BY_STATUS: Record<TaskStatus, Lane> = (() => {
  const map = {} as Record<TaskStatus, Lane>;
  for (const lane of LANES) {
    for (const status of lane.statuses) map[status] = lane;
  }
  // Drift guard: a future TaskStatus that isn't added to a lane fails loudly
  // here at module load, instead of laneForStatus() returning undefined and
  // crashing later at `.key`. (The board unit test asserts this too.)
  for (const status of TASK_STATUSES) {
    if (!map[status]) {
      throw new Error(`board lane model is missing task status: ${status}`);
    }
  }
  return map;
})();

/** The lane a status belongs to (every status is mapped exactly once). */
export function laneForStatus(status: TaskStatus): Lane {
  return LANE_BY_STATUS[status];
}

/**
 * Resolution of dropping a card (currently `fromStatus`) onto `targetLane`,
 * given the viewer's permissions. The board UI uses the discriminant to decide
 * affordance + behavior; tests assert it matches the guard's legal pairs.
 */
export type BoardDropResolution =
  /** Card is already in this lane — ignore the drop. */
  | { kind: "noop" }
  /** Lane accepts no drops (e.g. In Progress). */
  | { kind: "not_target" }
  /** No guard-legal action maps (fromStatus → lane.primaryTarget). */
  | { kind: "illegal"; fromLabel: string; toLabel: string }
  /** A legal action exists but the viewer lacks its permission. */
  | { kind: "needs_permission"; descriptor: ActionDescriptor }
  /** Legal + permitted, but the action needs extra input → open task detail. */
  | { kind: "needs_fields"; descriptor: ActionDescriptor }
  /** Legal + permitted + no extra input → commit via transitionTaskAction. */
  | { kind: "ready"; descriptor: ActionDescriptor };

/**
 * Find the transition descriptor a drop onto `targetLane` would use for a card
 * in `fromStatus`: the action whose `to` is the lane's primary target and whose
 * `from` includes the card's status. Mirrors the ACTIONS source of truth (which
 * itself mirrors the DB guard) — it never invents a transition.
 */
export function descriptorForDrop(
  fromStatus: TaskStatus,
  targetLane: Lane,
): ActionDescriptor | null {
  if (!targetLane.primaryTarget) return null;
  return (
    ACTIONS.find(
      (a) =>
        a.to === targetLane.primaryTarget && a.from.includes(fromStatus),
    ) ?? null
  );
}

/**
 * Classify a drop of a card (`fromStatus`) onto `targetLane` for the given
 * viewer into one {@link BoardDropResolution} the UI acts on. Order: lanes that
 * accept no drops → own-lane no-op → no guard-legal action (illegal) → missing
 * permission → needs extra fields → ready to commit. Never writes a status.
 */
export function resolveBoardDrop(
  fromStatus: TaskStatus,
  targetLane: Lane,
  permissions: string[],
): BoardDropResolution {
  if (!targetLane.primaryTarget) return { kind: "not_target" };
  // Dropping onto the card's own lane changes nothing on this board.
  if (laneForStatus(fromStatus).key === targetLane.key) return { kind: "noop" };

  const descriptor = descriptorForDrop(fromStatus, targetLane);
  if (!descriptor) {
    return {
      kind: "illegal",
      fromLabel: TASK_STATUS_LABELS[fromStatus],
      toLabel: TASK_STATUS_LABELS[targetLane.primaryTarget],
    };
  }
  if (!can(descriptor.permission, permissions)) {
    return { kind: "needs_permission", descriptor };
  }
  if (descriptor.requires !== "none") {
    return { kind: "needs_fields", descriptor };
  }
  return { kind: "ready", descriptor };
}

/**
 * Lane keys this card can be dropped onto with an *actionable* outcome (a direct
 * commit or an open-detail completion) for the given viewer. Used to (a) decide
 * whether a card is draggable at all and (b) highlight valid target lanes during
 * a drag. A card with an empty set gets no drag affordance.
 */
export function actionableTargets(
  fromStatus: TaskStatus,
  permissions: string[],
): LaneKey[] {
  return LANES.filter((lane) => {
    const r = resolveBoardDrop(fromStatus, lane, permissions);
    return r.kind === "ready" || r.kind === "needs_fields";
  }).map((lane) => lane.key);
}

/** True when the card has at least one actionable board move for the viewer. */
export function isCardDraggable(
  fromStatus: TaskStatus,
  permissions: string[],
): boolean {
  return actionableTargets(fromStatus, permissions).length > 0;
}
