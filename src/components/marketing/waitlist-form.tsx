"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import {
  joinWaitlistAction,
  type WaitlistAudience,
} from "@/lib/services/waitlist";
import { cn } from "@/lib/utils";

export function WaitlistForm({
  defaultAudience = "shopper",
  id = "waitlist",
}: {
  defaultAudience?: WaitlistAudience;
  id?: string;
}) {
  const [audience, setAudience] = useState<WaitlistAudience>(defaultAudience);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<"new" | "already" | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const result = await joinWaitlistAction({
      email,
      audience,
      name,
      storeName,
      company,
    });
    setLoading(false);
    if ("ok" in result) {
      setDone(result.already ? "already" : "new");
      return;
    }
    toast.error(result.error);
  }

  if (done) {
    return (
      <div id={id} className="rounded-2xl border border-hairline-strong bg-white p-6 sm:p-8">
        <p className="text-lg font-semibold text-ink">
          {done === "already" ? "You’re already on the list." : "You’re on the list."}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          We’ll email {email || "you"} when FINDIT opens
          {audience === "store" ? " for stores" : ""}. Sign-in stays off until then.
        </p>
      </div>
    );
  }

  return (
    <form
      id={id}
      onSubmit={onSubmit}
      className="relative rounded-2xl border border-hairline-strong bg-white p-6 sm:p-8"
    >
      <p className="text-lg font-semibold text-ink">Join the waitlist</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        Public sign-in is off for now. Leave your email and we’ll tell you when
        FINDIT opens.
      </p>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-ink">I’m joining as</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["shopper", "Shopper"],
              ["store", "Store"],
            ] as const
          ).map(([value, label]) => {
            const selected = audience === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setAudience(value)}
                className={cn(
                  "min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors",
                  selected
                    ? "border-ink bg-ink text-ink-inverse"
                    : "border-hairline-strong bg-white text-ink hover:bg-[var(--solid-3)]"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        <Label htmlFor={`${id}-email`}>Email</Label>
        <Input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="mt-4">
        <Label htmlFor={`${id}-name`}>Name (optional)</Label>
        <Input
          id={`${id}-name`}
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {audience === "store" ? (
        <div className="mt-4">
          <Label htmlFor={`${id}-store`}>Store name (optional)</Label>
          <Input
            id={`${id}-store`}
            name="storeName"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
          />
        </div>
      ) : null}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor={`${id}-company`}>Company</label>
        <input
          id={`${id}-company`}
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>
      <Button type="submit" className="mt-6 w-full" size="lg" disabled={loading}>
        {loading ? "Joining…" : "Join waitlist"}
      </Button>
    </form>
  );
}
