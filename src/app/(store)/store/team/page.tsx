"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Input, Label } from "@/components/ui/primitives";
import { GlassBadge, GlassChip } from "@/components/ui/glass";
import { BackLink } from "@/components/shared/app-header";
import {
  getUserStoresAction,
  inviteEmployeeAction,
  setMemberStatusAction,
} from "@/lib/services/actions";
import { getStoreInvitesAction, getStoreTeamAction } from "@/lib/services/team";
import type { Store } from "@/types/database";

type MemberRow = {
  id: string;
  role: string;
  status: string;
  email: string | null;
  name: string | null;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  name: string | null;
  expires_at: string;
};

export default function TeamPage() {
  const [store, setStore] = useState<(Store & { role: string }) | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "employee">("employee");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  async function refresh(storeId: string) {
    const [rows, pending] = await Promise.all([
      getStoreTeamAction(storeId),
      getStoreInvitesAction(storeId),
    ]);
    setMembers(rows as MemberRow[]);
    setInvites(pending as InviteRow[]);
  }

  useEffect(() => {
    getUserStoresAction().then(async (stores) => {
      const s = stores[0] || null;
      setStore(s);
      if (s) await refresh(s.id);
    });
  }, []);

  if (store && store.role === "employee") {
    return (
      <div className="px-5 pt-6 md:px-8 md:pt-8">
        <BackLink href="/store" label="Store home" className="mb-4" />
        <EmptyState
          title="Team is for owners and managers"
          description="Answer incoming requests from the Requests tab."
        />
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 md:px-8 md:pt-8">
      <BackLink href="/store" label="Store home" className="mb-2" />
      <h1 className="text-2xl font-bold tracking-tight text-ink">Team</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Invite staff by name and email. They open the invite link, create an account
        with that email, and join this store automatically — they never pick a store.
      </p>

      <Card sheen className="mt-6 space-y-4 p-5 sm:p-6">
        <div>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Rivera"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@store.com"
          />
        </div>
        <div>
          <Label>Role</Label>
          <div className="mt-2 flex gap-2">
            {(["employee", "manager"] as const).map((r) => (
              <GlassChip
                key={r}
                selected={role === r}
                onClick={() => setRole(r)}
                className="px-4 py-2 text-sm capitalize"
              >
                {r}
              </GlassChip>
            ))}
          </div>
        </div>
        <Button
          className="w-full"
          onClick={async () => {
            if (!store) return;
            const result = await inviteEmployeeAction(store.id, email, role, name);
            if (result.error) toast.error(result.error);
            else {
              const token = "token" in result ? result.token : null;
              if (token) {
                setLastInviteUrl(`${window.location.origin}/invite/${token}`);
              }
              toast.success("Invite created — copy the link below");
              setEmail("");
              setName("");
              await refresh(store.id);
            }
          }}
        >
          Create invite link
        </Button>
        {lastInviteUrl ? (
          <div className="glass-subtle rounded-glass-lg p-4 text-sm">
            <p className="font-semibold text-ink">Share this link</p>
            <p className="mt-1 break-all text-ink-muted">{lastInviteUrl}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={async () => {
                await navigator.clipboard.writeText(lastInviteUrl);
                toast.success("Link copied");
              }}
            >
              Copy link
            </Button>
          </div>
        ) : null}
      </Card>

      <div className="mt-8 space-y-3">
        <h2 className="font-semibold text-ink">Members</h2>
        {members.length === 0 ? (
          <EmptyState title="No team members yet" />
        ) : (
          members.map((m) => (
            <Card key={m.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {m.name || m.email || "Member"}
                </p>
                <p className="truncate text-xs text-ink-muted">{m.email}</p>
              </div>
              <GlassBadge className="shrink-0 text-[11px] capitalize">
                {m.role} · {m.status}
              </GlassBadge>
              {m.role !== "owner" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!store) return;
                    const next = m.status === "active" ? "disabled" : "active";
                    const result = await setMemberStatusAction(store.id, m.id, next);
                    if (result.error) toast.error(result.error);
                    else {
                      toast.success(next === "disabled" ? "Deactivated" : "Reactivated");
                      await refresh(store.id);
                    }
                  }}
                >
                  {m.status === "active" ? "Remove access" : "Restore access"}
                </Button>
              ) : null}
            </Card>
          ))
        )}
      </div>

      {invites.length ? (
        <div className="mt-8 space-y-3">
          <h2 className="font-semibold text-ink">Pending invites</h2>
          {invites.map((invite) => (
            <Card key={invite.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-ink">{invite.name || invite.email}</p>
                <p className="truncate text-xs text-ink-muted">
                  {invite.email} · {invite.role}
                </p>
              </div>
              <GlassBadge className="shrink-0 text-[11px]">Invited</GlassBadge>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
