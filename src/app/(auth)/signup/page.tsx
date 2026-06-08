import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { SignupForm } from "@/components/auth/signup-form";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }
  return <SignupForm />;
}
