import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  // Already signed in? Skip the form.
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
