"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { OTP_RESEND_SECONDS, maskEmail } from "@findit/domain";
import {
  sendEmailOtpAction,
  verifyEmailOtpAction,
} from "@/lib/services/phone-auth-actions";
import { WrongLoginSideNotice } from "@/components/auth/auth-audience";
import type { AppHomePath } from "@/lib/auth/home-path";
import type { LoginAudience } from "@findit/domain";

type Step = "email" | "otp";

export function EmailOtpForm({
  createIfMissing,
  continueLabel = "Email me a code",
  audience = "shopper",
  emailInputId = "signin-email",
  sendDisabled = false,
  sendBlockedMessage,
  onFinished,
}: {
  createIfMissing: boolean;
  continueLabel?: string;
  audience?: LoginAudience;
  emailInputId?: string;
  sendDisabled?: boolean;
  sendBlockedMessage?: string;
  onFinished: (result: { homePath: AppHomePath; needsName: boolean }) => void;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [masked, setMasked] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [wrongSide, setWrongSide] = useState<LoginAudience | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [seconds]);

  async function sendCode(emailValue: string) {
    setLoading(true);
    const result = await sendEmailOtpAction({
      email: emailValue,
      createIfMissing,
      audience,
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      if (result.code === "wrong_side" && result.requiredAudience) {
        setWrongSide(result.requiredAudience);
      }
      return false;
    }
    setWrongSide(null);
    setSentEmail(result.email || emailValue);
    setMasked(result.masked || maskEmail(result.email || emailValue));
    setSeconds(OTP_RESEND_SECONDS);
    setCode("");
    setStep("otp");
    return true;
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    if (sendDisabled) {
      if (sendBlockedMessage) toast.error(sendBlockedMessage);
      return;
    }
    await sendCode(email);
  }

  async function onOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await verifyEmailOtpAction({
      email: sentEmail || email,
      token: code,
      createIfMissing,
      audience,
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      if (result.code === "wrong_side" && result.requiredAudience) {
        setWrongSide(result.requiredAudience);
      }
      return;
    }
    setWrongSide(null);
    onFinished({
      homePath: result.homePath || "/home",
      needsName: Boolean(result.needsName),
    });
  }

  if (step === "otp") {
    return (
      <form onSubmit={onOtp} className="mt-6 space-y-4">
        {wrongSide ? <WrongLoginSideNotice requiredAudience={wrongSide} /> : null}
        <div>
          <Label htmlFor="email-otp">Enter the code we sent to {masked}</Label>
          <Input
            id="email-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            autoFocus
            className="mt-1 tracking-[0.4em]"
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={loading || code.length !== 6}
        >
          {loading ? "Checking…" : "Continue"}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
          <button
            type="button"
            className="font-medium text-ink underline-offset-2 hover:underline"
            onClick={() => {
              setStep("email");
              setCode("");
            }}
          >
            Use a different email
          </button>
          <button
            type="button"
            className="font-medium text-ink underline-offset-2 hover:underline disabled:text-ink-muted disabled:no-underline"
            disabled={loading || seconds > 0}
            onClick={() => sendCode(sentEmail || email)}
          >
            {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onEmail} className="mt-6 space-y-4">
      {wrongSide ? <WrongLoginSideNotice requiredAudience={wrongSide} /> : null}
      <div>
        <Label htmlFor={emailInputId}>Email</Label>
        <Input
          id={emailInputId}
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={loading || sendDisabled}
      >
        {loading ? "Sending…" : continueLabel}
      </Button>
    </form>
  );
}
