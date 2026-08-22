"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { sendMagicLinkAction } from "@/lib/services/actions";

export function MagicLinkForm({
  emailId = "magic-email",
}: {
  emailId?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await sendMagicLinkAction(String(fd.get("email") || ""));
    setLoading(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      "message" in result && result.message
        ? result.message
        : "Check your email for a sign-in link."
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor={emailId}>Email</Label>
        <Input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </div>
      <Button type="submit" className="w-full" variant="outline" disabled={loading}>
        {loading ? "Sending link…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
