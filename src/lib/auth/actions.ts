"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  signupSchema,
  isAllowedSignupDomain,
  ALLOWED_SIGNUP_DOMAINS,
  type SignupInput,
} from "@/lib/validations/auth";

export type SignInState = { error?: string };

/**
 * Sign-in server action, shaped for React 19 `useActionState`
 * (prevState, formData). On success redirects to /dashboard; on failure
 * returns an inline error message.
 */
export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export type SignUpResult =
  | { ok: true; status: "confirm" }
  | { ok: false; status: "domain" | "invalid" | "error"; message: string };

/**
 * Public self-registration. Anonymous flow (no service-role key). Restricted to
 * the allowed email domains (validated here AND enforced in handle_new_user).
 * On success the auth user is created with email confirmation required; the
 * profile is created pending/inactive (employee) and awaits admin/section-head
 * approval. Stores nothing privileged.
 */
export async function signUp(input: SignupInput): Promise<SignUpResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: "invalid",
      message: parsed.error.issues[0]?.message ?? "Invalid details.",
    };
  }
  const { full_name, email, password } = parsed.data;

  // Layer (a): domain restriction in the server action (handle_new_user is layer b).
  if (!isAllowedSignupDomain(email)) {
    return {
      ok: false,
      status: "domain",
      message: `Registration is limited to ${ALLOWED_SIGNUP_DOMAINS.map((d) => "@" + d).join(", ")} addresses.`,
    };
  }

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ??
    (hdrs.get("host") ? `https://${hdrs.get("host")}` : "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: origin ? `${origin}/login?confirmed=1` : undefined,
      // self_signup drives the pending/inactive status + approver notification
      // in handle_new_user; full_name is stored on the profile.
      data: { full_name, self_signup: "true" },
    },
  });

  if (error) {
    // The DB domain guard surfaces here too (defense in depth).
    const msg = error.message ?? "";
    if (/limited to/i.test(msg)) {
      return { ok: false, status: "domain", message: msg };
    }
    return { ok: false, status: "error", message: msg || "Sign-up failed." };
  }

  return { ok: true, status: "confirm" };
}

/** Sign out and return to the login page. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
