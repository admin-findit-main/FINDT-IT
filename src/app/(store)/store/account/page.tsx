"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Overline } from "@/components/ui/glass";
import { DeleteAccountCard } from "@/components/account/delete-account-card";
import { BackLink } from "@/components/shared/app-header";
import { roleLabel } from "@/lib/auth/store-role";
import {
  getCurrentProfile,
  getStoreWorkspaceAction,
  signOutAction,
} from "@/lib/services/actions";
import type { Profile } from "@/types/database";
import type { StoreWorkspace } from "@/lib/auth/store-role";

export default function StoreAccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<StoreWorkspace | null>(null);

  useEffect(() => {
    getCurrentProfile().then(setProfile);
    getStoreWorkspaceAction().then(setWorkspace);
  }, []);

  if (!profile) {
    return <div className="px-5 pt-8 text-sm text-ink-muted">Loading…</div>;
  }

  const role = workspace?.role || "employee";
  const storeName = workspace?.store?.name || "Your store";

  return (
    <div className="px-5 pt-6 md:px-8 md:pt-8">
      <BackLink href="/store" label="Store home" className="mb-2 md:hidden" />
      <h1 className="text-2xl font-bold tracking-tight text-ink">Account</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Your login for this store. Same FINDIT account can also ask as a
        customer.
      </p>

      <Card sheen className="mt-6 space-y-4 p-5 sm:p-6">
        <div>
          <Overline>Working as</Overline>
          <p className="mt-1 text-lg font-semibold text-ink">{storeName}</p>
          <p className="text-sm text-ink-muted">{roleLabel(role)}</p>
        </div>
        <div className="border-t border-hairline-strong pt-4">
          <Overline>{profile.email ? "Email" : "Phone"}</Overline>
          <p className="mt-1 text-sm text-ink">
            {profile.email || profile.phone_e164 || "—"}
          </p>
        </div>
        <div>
          <Overline>Name</Overline>
          <p className="mt-1 text-sm text-ink">
            {[profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
              "—"}
          </p>
        </div>
      </Card>

      <Card className="mt-4 space-y-3 p-5">
        <Button asChild variant="outline" className="w-full">
          <Link href="/home">Ask as a customer</Link>
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            await signOutAction();
            router.push("/login");
            router.refresh();
          }}
        >
          Log out
        </Button>
      </Card>

      <div className="mt-4">
        <DeleteAccountCard />
      </div>
    </div>
  );
}
