import { z } from "zod";

import { userRoleSchema } from "./users";

/**
 * Domains permitted to self-register. The DB (`app_settings.signup_allowed_domains`
 * + handle_new_user) is the authoritative source; this constant is the
 * client/server-action layer of the same policy (app_settings is not readable by
 * the anonymous signup context).
 */
export const ALLOWED_SIGNUP_DOMAINS = ["saptco.com", "tss.test"] as const;

export function isAllowedSignupDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return (ALLOWED_SIGNUP_DOMAINS as readonly string[]).includes(domain);
}

export const signupSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name").max(255),
    email: z
      .email("Enter a valid email address")
      .trim()
      .toLowerCase()
      .refine(isAllowedSignupDomain, {
        message: `Registration is limited to ${ALLOWED_SIGNUP_DOMAINS.map((d) => "@" + d).join(", ")} addresses.`,
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
