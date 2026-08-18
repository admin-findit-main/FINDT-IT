"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassNav, GlassNotice } from "@/components/ui/glass";
import { BrandHomeLink } from "@/components/brand/logo";
import { Card } from "@/components/ui/primitives";
import { roleLabel } from "@/lib/auth/store-role";
import {
  acceptStoreInviteAction,
  getCurrentProfile,
  getInviteByTokenAction,
  signOutAction,
} from "@/lib/services/actions";
import type { StoreMemberRole } from "@/types/database";

type InvitePreview = {
  email: string;
  role: StoreMemberRole;
  store_name: string;
  expires_at: string;
};

export default function AcceptInvitePage() {
  const params = useParams();
  const token = String(params.token || "");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getInviteByTokenAction(token), getCurrentProfile()]).then(
      ([inv, profile]) => {
        if ("error" in inv && inv.error) setError(inv.error);
        else if ("invite" in inv && inv.invite) setInvite(inv.invite);
        setEmail(profile?.email || null);
        setLoading(false);
      }
    );
  }, [token]);

  function accept() {
    startTransition(async () => {
      const result = await acceptStoreInviteAction(token);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("You're on the team");
      router.push("/store");
      router.refresh();
    });
  }

  return (
    <div className="app-canvas min-h-screen">
      <GlassNav>
        <div className="mx-auto flex max-w-md items-center px-6 py-4">
          <BrandHomeLink href="/" />
        </div>
      </GlassNav>
      <main className="mx-auto max-w-md px-6 py-16">
        <Card level="strong" sheen className="p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Store invite
          </h1>
          {loading ? (
            <p className="mt-4 text-sm text-ink-muted">Checking invite…</p>
          ) : error ? (
            <>
              <GlassNotice tone="accent" className="mt-4">
                {error}
              </GlassNotice>
              <Button asChild className="mt-6 w-full" variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
            </>
          ) : invite ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                You&apos;ve been invited to work at{" "}
                <span className="font-semibold text-ink">
                  {invite.store_name}
                </span>{" "}
                as{" "}
                <span className="font-semibold text-ink">
                  {roleLabel(invite.role)}
                </span>
                .
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                Invite email: {invite.email}
              </p>
              {!email ? (
                <div className="mt-6 space-y-3">
                  <Button asChild className="w-full" size="lg">
                    <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>
                      Log in to accept
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}>
                      Create account
                    </Link>
                  </Button>
                  <p className="text-xs text-ink-muted">
                    Use the email {invite.email} so the invite can match.
                  </p>
                </div>
              ) : email.toLowerCase() !== invite.email.toLowerCase() ? (
                <div className="mt-6 space-y-3">
                  <GlassNotice tone="order">
                    You&apos;re signed in as {email}. Sign out and use{" "}
                    {invite.email}.
                  </GlassNotice>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      await signOutAction();
                      router.push(
                        `/login?next=${encodeURIComponent(`/invite/${token}`)}`
                      );
                      router.refresh();
                    }}
                  >
                    Sign out and switch account
                  </Button>
                </div>
              ) : (
                <Button
                  className="mt-6 w-full"
                  size="lg"
                  disabled={pending}
                  onClick={accept}
                >
                  {pending ? "Joining…" : "Accept invite"}
                </Button>
              )}
            </>
          ) : null}
        </Card>
      </main>
    </div>
  );
}
