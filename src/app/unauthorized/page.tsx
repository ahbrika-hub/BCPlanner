import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <div className="bg-muted/40 flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader className="space-y-2">
          <div className="text-muted-foreground mx-auto">
            <ShieldAlert className="size-10" />
          </div>
          <CardTitle>Access restricted</CardTitle>
          <CardDescription>
            You don&apos;t have permission to view that page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="ghost" className="w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
