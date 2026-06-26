import { z } from "zod";

// Task comment + @mentions. commentType is derived server-side from the author's
// role (general vs ceo_office_comment), so it is intentionally NOT part of the
// client payload. mentionedUserIds are the picker selections; the server
// re-validates them against the task's real visibility audience before notifying.
export const addCommentSchema = z.object({
  text: z.string().trim().min(1, "Comment cannot be empty.").max(5000),
  mentionedUserIds: z.array(z.uuid()).max(50).default([]),
});

export type AddCommentInput = z.infer<typeof addCommentSchema>;
