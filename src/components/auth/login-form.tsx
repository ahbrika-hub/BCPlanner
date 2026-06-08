"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import Link from "next/link";

import { signIn, type SignInState } from "@/lib/auth/actions";
import { TssLogo } from "@/components/brand/tss-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignInState = {};

export type LoginNotice = { type: "info" | "error"; message: string };

export function LoginForm({ notice }: { notice?: LoginNotice }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <Card className="w-full max-w-sm shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <div className="flex justify-center">
          <TssLogo />
        </div>
        <CardDescription>Business Consulting</CardDescription>
      </CardHeader>
      <CardContent>
        {notice && (
          <div
            role="status"
            className={
              notice.type === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-md border px-3 py-2 text-sm"
                : "border-primary/30 bg-primary/10 text-primary mb-4 rounded-md border px-3 py-2 text-sm"
            }
          >
            {notice.message}
          </div>
        )}
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@tss.example"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {state.error && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
            >
              {state.error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Sign In
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-fg-muted text-sm">
          New here?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
