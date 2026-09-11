"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Input, Label, Skeleton } from "@/components/ui/primitives";
import { GlassSelect } from "@/components/ui/glass";
import { roleLabel } from "@/lib/auth/store-role";
import { inviteEmployeeAction } from "@/lib/services/actions";
import {
  cancelStoreInviteAction,
  getStoreInvitesAction,
  getStoreTeamAction,
  setStoreMemberStatusAction,
  type StoreInviteView,
  type StoreTeamMemberView,
} from "@/lib/services/team";
import { cn, formatRelativeTime } from "@/lib/utils";

function inviteHref(token: string) {
  if (typeof window === "undefined") return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}

export function StoreTeamPanel({ storeId }: { storeId: string }) {
  const [members, setMembers] = useState<StoreTeamMemberView[]>([]);
  const [invites, setInvites] = useState<StoreInviteView[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"manager" | "employee">("employee");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [team, pendingInvites] = await Promise.all([
        getStoreTeamAction(storeId),
        getStoreInvitesAction(storeId),
      ]);
      setMembers(team);
      setInvites(pendingInvites);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  function invite() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    startTransition(async () => {
      const result = await inviteEmployeeAction(
        storeId,
        trimmed,
        role,
        name.trim() || undefined
      );
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if ("token" in result && result.token) {
        const url = inviteHref(result.token);
        setLastInviteUrl(url);
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Invite created — link copied");
        } catch {
          toast.success("Invite created — copy the link below");
        }
      } else {
        toast.success("Invite created");
      }
      setEmail("");
      setName("");
      await load();
    });
  }

  function cancelInvite(inviteId: string) {
    startTransition(async () => {
      const result = await cancelStoreInviteAction(storeId, inviteId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Invite canceled");
      await load();
    });
  }

  function setStatus(memberId: string, status: "active" | "disabled") {
    startTransition(async () => {
      const result = await setStoreMemberStatusAction(storeId, memberId, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(status === "active" ? "Access restored" : "Access disabled");
      await load();
    });
  }

  async function copyLink(token: string) {
    const url = inviteHref(token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      setLastInviteUrl(url);
      toast.message("Copy this link", { description: url });
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-bold tracking-tight">Invite someone</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Managers and employees sign in with email to use the Business dashboard and
          FINDIT Hub. For counter-only workers, use Floor staff with a Hub PIN.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="team-email">Work email</Label>
            <Input
              id="team-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@store.com"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="team-name">Name (optional)</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="team-role">Role</Label>
            <GlassSelect
              id="team-role"
              className="mt-1.5"
              value={role}
              onChange={(e) =>
                setRole(e.target.value === "manager" ? "manager" : "employee")
              }
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
            </GlassSelect>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" onClick={invite} disabled={pending}>
            Send invite link
          </Button>
          <p className="text-xs text-ink-muted">
            They open the link, sign in with that email, and join this store.
          </p>
        </div>
        {lastInviteUrl ? (
          <p className="mt-4 break-all rounded-xl border border-hairline-strong bg-[var(--solid-chrome)] px-3 py-2 text-xs text-ink-muted">
            {lastInviteUrl}
          </p>
        ) : null}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-hairline-strong px-5 py-4">
          <h2 className="text-base font-bold tracking-tight">People with login access</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Disable access if someone leaves. Owners stay active.
          </p>
        </div>
        {members.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No team yet" description="Invite a manager or employee to get started." />
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {members.map((member) => {
              const disabled = member.status === "disabled";
              return (
                <li
                  key={member.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {member.name || member.email || "Team member"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      {member.email || "No email"} · {roleLabel(member.role as "owner" | "manager" | "employee")}
                      {disabled ? " · Disabled" : ""}
                    </p>
                  </div>
                  {member.role === "owner" ? (
                    <span className="text-xs font-medium text-ink-subtle">Owner</span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        setStatus(member.id, disabled ? "active" : "disabled")
                      }
                    >
                      {disabled ? "Restore access" : "Disable"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-hairline-strong px-5 py-4">
          <h2 className="text-base font-bold tracking-tight">Open invites</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Links expire. Copy again or cancel if you sent the wrong email.
          </p>
        </div>
        {invites.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No open invites" description="New invites show up here until they’re accepted." />
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {invites.map((inviteRow) => (
              <li
                key={inviteRow.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{inviteRow.email}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {roleLabel(inviteRow.role as "owner" | "manager" | "employee")}
                    {inviteRow.name ? ` · ${inviteRow.name}` : ""}
                    {" · expires "}
                    {formatRelativeTime(inviteRow.expires_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => void copyLink(inviteRow.token)}
                  >
                    Copy link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    className={cn("text-[#8E1F2D]")}
                    onClick={() => cancelInvite(inviteRow.id)}
                  >
                    Cancel
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
