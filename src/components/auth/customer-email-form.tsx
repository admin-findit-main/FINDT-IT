"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { loginEmailPassword } from "@/lib/auth/client-login";
import { PlaceFields } from "@/components/customer/place-fields";
import { signUpAction } from "@/lib/services/actions";
import type { ShortPlace } from "@findit/domain";
import type { AppHomePath } from "@/lib/auth/home-path";

type Finished = { homePath: AppHomePath; needsName?: boolean };

export function CustomerEmailLoginForm({
  next,
}: {
  onFinished?: (result: Finished) => void;
  next?: string | null;
}) {
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await loginEmailPassword(
      String(fd.get("email")),
      String(fd.get("password")),
      next
    );
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function CustomerEmailSignupForm({
  onFinished,
}: {
  onFinished: (result: Finished) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [place, setPlace] = useState<ShortPlace>({
    city: "",
    state: "VA",
    postalCode: "",
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const result = await signUpAction({
        firstName: String(fd.get("firstName") || "Friend"),
        email: String(fd.get("email")),
        password: String(fd.get("password")),
        accountType: "customer",
        city: place.city,
        state: place.state || "VA",
        postalCode: place.postalCode,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if ("needsEmailConfirm" in result && result.needsEmailConfirm) {
        toast.message("Open the email we just sent — tapping the link signs you in.");
        return;
      }
        onFinished({
          homePath: ("homePath" in result && result.homePath ? result.homePath : "/home") as AppHomePath,
        });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Sign up failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="firstName">First name</Label>
        <Input id="firstName" name="firstName" autoComplete="given-name" required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </div>
      <div>
        <Label>Place</Label>
        <PlaceFields value={place} onChange={setPlace} idPrefix="signup" />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
