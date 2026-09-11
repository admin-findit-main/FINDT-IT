"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { setActiveStoreAction } from "@/lib/services/active-store-actions";
import { cn } from "@/lib/utils";

export type LocationOption = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
};

export function StoreLocationSwitcher({
  locations,
  activeId,
  canAdd = false,
  compact = false,
}: {
  locations: LocationOption[];
  activeId: string | null;
  canAdd?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (locations.length === 0) return null;

  function switchTo(storeId: string) {
    if (storeId === activeId) return;
    startTransition(async () => {
      const result = await setActiveStoreAction(storeId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Location switched");
      router.refresh();
    });
  }

  if (locations.length === 1 && !canAdd) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-ink-muted",
          compact && "justify-center"
        )}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate font-medium text-ink">{locations[0].name}</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", compact && "px-1")}>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        Location
      </label>
      <select
        className="h-11 w-full rounded-xl border border-hairline-strong bg-white px-3 text-sm font-medium text-ink"
        value={activeId || locations[0]?.id || ""}
        disabled={pending}
        onChange={(event) => switchTo(event.target.value)}
        aria-label="Active store location"
      >
        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
            {loc.city ? ` · ${loc.city}${loc.state ? `, ${loc.state}` : ""}` : ""}
          </option>
        ))}
      </select>
      {canAdd ? (
        <Link
          href="/store/locations/add"
          className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-[#8E1F2D] hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another location
        </Link>
      ) : null}
    </div>
  );
}
