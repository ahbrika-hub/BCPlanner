import { z } from "zod";

import { userRoleSchema } from "./users";

/**
 * Self-registration allow-list. Each entry is either a DOMAIN (match the email's
 * domain portion) or a FULL EMAIL when it contains '@' (match the whole address)
 * — so a specific gmail is allowed without opening the entire gmail.com domain.
 * The DB (`app_settings.signup_allowed_domains` + handle_new_user) is the
 * authoritative source; this constant mirrors it for the anonymous signup
 * context (app_settings is not readable there). Keep the two in sync.
 */
export const ALLOWED_SIGNUP_ENTRIES = [
  "saptco.com.sa",
  "tss.bc2026@gmail.com",
  "ahbrika@gmail.com",
] as const;

export function isAllowedSignupEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  const domain = e.split("@")[1] ?? "";
  return (ALLOWED_SIGNUP_ENTRIES as readonly string[]).some((entry) =>
    entry.includes("@") ? e === entry : domain === entry,
  );
}

/** Human-readable allow-list for hints/errors (domains shown as "@domain"). */
export function signupAllowlistLabel(): string {
  return ALLOWED_SIGNUP_ENTRIES.map((e) =>
    e.includes("@") ? e : `@${e}`,
  ).join(", ");
}

export const signupSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name").max(255),
    email: z
      .email("Enter a valid email address")
      .trim()
      .toLowerCase()
      .refine(isAllowedSignupEmail, {
        message: `Registration is limited to ${signupAllowlistLabel()}.`,
      }),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be at most 72 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

/** Request a password-reset email. Any existing-account domain is allowed. */
export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** Set a new password during a recovery session. */
export const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be at most 72 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

/** Approving a pending registration: activate + assign role/department. */
export const approveSignupSchema = z.object({
  role: userRoleSchema,
  department_id: z.uuid().nullable().optional(),
});

export type ApproveSignupInput = z.infer<typeof approveSignupSchema>;
