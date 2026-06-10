import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import { TssLogo } from "@/components/brand/tss-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export default async function UpdatePasswordPage() {
  // Reaching this page requires the recovery session that /auth/confirm
  // established. If it's missing/expired, send the user back to request a link.
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center space-y-3 text-center">
          <TssLogo />
          <CardTitle className="text-xl">Reset link required</CardTitle>
          <CardDescription>
            Open this page from a valid password-reset email. If your link
            expired, request a new one.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/forgot-password">Request a reset link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <UpdatePasswordForm />;
}
