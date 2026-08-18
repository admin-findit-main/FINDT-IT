"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Card } from "@/components/ui/primitives";
import { completeCustomerFirstNameAction } from "@/lib/services/phone-auth-actions";

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await completeCustomerFirstNameAction(String(fd.get("firstName") || ""));
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        What&apos;s your first name?
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        That’s all we need to get you into FINDIT.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            required
            maxLength={60}
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Saving…" : "Continue"}
        </Button>
      </form>
    </Card>
  );
}
