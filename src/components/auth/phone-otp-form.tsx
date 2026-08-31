"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import {
  OTP_RESEND_SECONDS,
  formatUsNationalInput,
  maskPhoneE164,
} from "@findit/domain";
import {
  sendPhoneOtpAction,
  verifyPhoneOtpAction,
} from "@/lib/services/phone-auth-actions";
import { WrongLoginSideNotice } from "@/components/auth/auth-audience";
import type { AppHomePath } from "@/lib/auth/home-path";
import type { LoginAudience } from "@findit/domain";

type Step = "phone" | "otp";

export function PhoneOtpForm({
  createIfMissing,
  continueLabel = "Continue",
  audience = "shopper",
  onFinished,
}: {
  createIfMissing: boolean;
  continueLabel?: string;
  audience?: LoginAudience;
  onFinished: (result: { homePath: AppHomePath; needsName: boolean }) => void;
}) {
  const [step, setStep] = useState<Step>("phone");
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
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

  async function sendCode(phoneValue: string) {
    setLoading(true);
    const result = await sendPhoneOtpAction({
      phone: phoneValue,
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
    setPhoneE164(result.phone || phoneValue);
    setMasked(result.masked || maskPhoneE164(result.phone || phoneValue));
    setSeconds(OTP_RESEND_SECONDS);
    setCode("");
    setStep("otp");
    return true;
  }

  async function onPhone(e: React.FormEvent) {
    e.preventDefault();
    await sendCode(phoneDisplay);
  }

  async function onOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await verifyPhoneOtpAction({
      phone: phoneE164 || phoneDisplay,
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
          <Label htmlFor="otp">Enter the code we sent to {masked}</Label>
          <Input
            id="otp"
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
              setStep("phone");
              setCode("");
            }}
          >
            Use a different number
          </button>
          <button
            type="button"
            className="font-medium text-ink underline-offset-2 hover:underline disabled:text-ink-muted disabled:no-underline"
            disabled={loading || seconds > 0}
            onClick={() => sendCode(phoneE164 || phoneDisplay)}
          >
            {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onPhone} className="mt-6 space-y-4">
      {wrongSide ? <WrongLoginSideNotice requiredAudience={wrongSide} /> : null}
      <div>
        <Label htmlFor="phone">Enter your phone number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+1 (703) 555-1234"
          value={phoneDisplay}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw.trim().startsWith("+") && raw.replace(/\D/g, "").length > 11) {
              setPhoneDisplay(raw);
              return;
            }
            setPhoneDisplay(formatUsNationalInput(raw));
          }}
          required
          autoFocus
        />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Sending…" : continueLabel}
      </Button>
    </form>
  );
}
