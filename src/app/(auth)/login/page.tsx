import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm, type LoginNotice } from "@/components/auth/login-form";

function notice(params: {
  error?: string;
  confirmed?: string;
}): LoginNotice | undefined {
  if (params.confirmed) {
    return {
      type: "info",
      message:
        "Email confirmed. Your account is awaiting administrator approval.",
    };
  }
  if (params.error === "pending") {
    return {
      type: "info",
      message:
        "Your registration is awaiting administrator approval. You'll be able to sign in once it's approved.",
    };
  }
  if (params.error === "inactive") {
    return {
      type: "error",
      message: "Your account is inactive. Contact an administrator.",
    };
  }
  return undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; confirmed?: string }>;
}) {
  // Already signed in? Skip the form.
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }
  const sp = await searchParams;
  return <LoginForm notice={notice(sp)} />;
}
