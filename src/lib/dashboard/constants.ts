/**
 * A task is the "weekly dashboard upload" task when its category equals this
 * sentinel. Admins create a recurring weekly task with this category assigned to
 * the dashboard owner; the existing recurring generator copies `category` to
 * each generated task, so the upload control appears automatically each week.
 * (Least-invasive linkage — no task/recurring schema change.)
 */
export const DASHBOARD_UPLOAD_CATEGORY = "Dashboard Update";
