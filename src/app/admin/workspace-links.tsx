"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/lib/services/actions";

export function AdminWorkspaceLinks() {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
      <Link
        href="/home"
        className="text-ink-muted transition-colors hover:text-ink"
      >
        Exit to customer
      </Link>
      <Link
        href="/store"
        className="text-ink-muted transition-colors hover:text-ink"
      >
        Exit to store
      </Link>
      <button
        type="button"
        className="text-accent-ink underline underline-offset-2 transition-colors hover:text-accent"
        onClick={async () => {
          await signOutAction();
          router.push("/login");
          router.refresh();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
