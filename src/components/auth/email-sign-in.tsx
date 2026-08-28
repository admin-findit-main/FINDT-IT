"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { LoginAudience } from "@findit/domain";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { GlassNotice } from "@/components/ui/glass";
import { WrongLoginSideNotice } from "@/components/auth/auth-audience";
import { loginEmailPassword } from "@/lib/auth/client-login";
import { sendMagicLinkAction } from "@/lib/services/actions";
import { cn } from "@/lib/utils";

export type AuthMethod = "password" | "onetime";

export function AuthMethodSwitch({
  value,
  onChange,
  passwordLabel = "Password",
  onetimeLabel = "One-time login",
}: {
  value: AuthMethod;
  onChange: (next: AuthMethod) => void;
  passwordLabel?: string;
  onetimeLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="How to sign in"
      className="grid grid-cols-2 gap-1 rounded-glass-lg bg-[var(--solid-3)] p-1"
    >
      {(
        [
          ["password", passwordLabel],
          ["onetime", onetimeLabel],
        ] as const
      ).map(([id, label]) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={cn(
              "min-h-10 rounded-glass-md px-3 text-sm font-semibold transition-colors",
              selected
                ? "bg-[var(--solid-1)] text-ink shadow-sm"
                : "text-ink-muted hover:text-ink"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function OneTimeLoginPanel({
  emailId = "onetime-email",
  email,
  onEmailChange,
  autoFocus = false,
  onNoAccount,
  onUsePassword,
  audience,
}: {
  emailId?: string;
  email?: string;
  onEmailChange?: (value: string) => void;
  autoFocus?: boolean;
  onNoAccount?: () => void;
  onUsePassword?: () => void;
  audience?: LoginAudience;
}) {
  const [internalEmail, setInternalEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [wrongSide, setWrongSide] = useState<LoginAudience | null>(null);
  const value = email ?? internalEmail;

  function setValue(next: string) {
    setWrongSide(null);
    onEmailChange?.(next);
    if (email === undefined) setInternalEmail(next);
  }

  async function send(address: string) {
    const trimmed = address.trim();
    if (!trimmed.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setLoading(true);
    const result = await sendMagicLinkAction(trimmed, audience);
    setLoading(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      if ("code" in result && result.code === "wrong_side" && result.requiredAudience) {
        setWrongSide(result.requiredAudience);
        return;
      }
      if ("code" in result && result.code === "no_account") onNoAccount?.();
      return;
    }
    setWrongSide(null);
    const message =
      "message" in result && result.message ? result.message : "";
    if (message.toLowerCase().includes("demo mode")) {
      toast.message(message);
      return;
    }
    setSentTo(trimmed);
    toast.success(message || "Check your email for a one-time login");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await send(value);
  }

  if (sentTo) {
    return (
      <div className="space-y-3">
        <GlassNotice tone="stock">
          We emailed a one-time login to{" "}
          <span className="font-semibold text-ink">{sentTo}</span>. Open it on
          this phone. It expires shortly and works once.
        </GlassNotice>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="lg"
          disabled={loading}
          onClick={() => void send(sentTo)}
        >
          {loading ? "Sending…" : "Send another link"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => setSentTo(null)}
        >
          Use a different email
        </Button>
        {onUsePassword ? (
          <p className="text-center text-sm text-ink-muted">
            <button
              type="button"
              className="font-semibold text-ink underline-offset-2 hover:underline"
              onClick={onUsePassword}
            >
              Use password instead
            </button>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {wrongSide ? <WrongLoginSideNotice requiredAudience={wrongSide} /> : null}
      <div>
        <Label htmlFor={emailId}>Email</Label>
        <Input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <p className="text-sm leading-relaxed text-ink-muted">
        We email a link that signs you in once. No password on this step.
      </p>
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Sending link…" : "Email me a one-time login"}
      </Button>
    </form>
  );
}

export function EmailSignIn({
  next,
  emailId = "signin-email",
  initialEmail = "",
  audience,
}: {
  next?: string | null;
  emailId?: string;
  initialEmail?: string;
  audience?: LoginAudience;
}) {
  const [method, setMethod] = useState<AuthMethod>("password");
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [wrongSide, setWrongSide] = useState<LoginAudience | null>(null);

  async function onPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await loginEmailPassword(
      String(fd.get("email") || email),
      String(fd.get("password")),
      next,
      audience
    );
    setLoading(false);
    if (result.code === "wrong_side" && result.requiredAudience) {
      setWrongSide(result.requiredAudience);
      toast.error(result.error);
      return;
    }
    setWrongSide(null);
    if (result.error) toast.error(result.error);
  }

  return (
    <div className="mt-6 space-y-5">
      <AuthMethodSwitch
        value={method}
        onChange={(nextMethod) => {
          setMethod(nextMethod);
          setWrongSide(null);
        }}
      />
      {method === "onetime" ? (
        <OneTimeLoginPanel
          emailId={`${emailId}-onetime`}
          email={email}
          onEmailChange={(value) => {
            setEmail(value);
            setWrongSide(null);
          }}
          autoFocus
          audience={audience}
          onNoAccount={() => setMethod("password")}
          onUsePassword={() => setMethod("password")}
        />
      ) : (
        <form onSubmit={onPassword} className="space-y-4">
          {wrongSide ? <WrongLoginSideNotice requiredAudience={wrongSide} /> : null}
          <div>
            <Label htmlFor={emailId}>Email</Label>
            <Input
              id={emailId}
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setWrongSide(null);
              }}
            />
          </div>
          <div>
            <Label htmlFor={`${emailId}-password`}>Password</Label>
            <Input
              id={`${emailId}-password`}
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-ink-muted">
            <Link
              href="/forgot-password"
              className="underline underline-offset-2 transition-colors hover:text-ink"
            >
              Forgot password?
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
