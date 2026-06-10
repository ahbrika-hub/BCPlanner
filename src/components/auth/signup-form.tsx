"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { signUp } from "@/lib/auth/actions";
import {
  signupSchema,
  ALLOWED_SIGNUP_DOMAINS,
  type SignupInput,
} from "@/lib/validations/auth";
import { TssLogo } from "@/components/brand/tss-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { full_name: "", email: "", password: "", confirm: "" },
  });

  async function onSubmit(values: SignupInput) {
    const res = await signUp(values);
    if (res.ok) {
      toast.success("Account created — check your email to confirm.");
      setSubmitted(true);
      return;
    }
    if (res.status === "domain") {
      setError("email", { message: res.message });
    }
    toast.error(res.message);
  }

  if (submitted) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center space-y-3 text-center">
          <TssLogo />
          <CheckCircle2 className="text-success size-8" aria-hidden="true" />
          <CardTitle className="text-xl">Confirm your email</CardTitle>
          <CardDescription>
            We&apos;ve sent a confirmation link to your inbox. After you
            confirm, your account must be approved by an administrator before
            you can sign in.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild variant="outline">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <div className="flex justify-center">
          <TssLogo />
        </div>
        <CardTitle className="text-xl font-semibold tracking-tight">
          Create your account
        </CardTitle>
        <CardDescription>
          Registration is limited to{" "}
          <strong>
            {ALLOWED_SIGNUP_DOMAINS.map((d) => `@${d}`).join(" or ")}
          </strong>{" "}
          addresses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              autoComplete="name"
              aria-invalid={!!errors.full_name}
              {...register("full_name")}
            />
            {errors.full_name && (
              <p className="text-destructive text-xs">
                {errors.full_name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@saptco.com"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-destructive text-xs">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-destructive text-xs">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              {...register("confirm")}
            />
            {errors.confirm && (
              <p className="text-destructive text-xs">
                {errors.confirm.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Create account
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-fg-muted text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
