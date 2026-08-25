"use client";

import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LocateMeButton({
  onPress,
  busy = false,
  emphasized = false,
  className,
}: {
  onPress: () => void;
  busy?: boolean;
  emphasized?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={emphasized ? "default" : "outline"}
      className={cn("w-full", className)}
      disabled={busy}
      onClick={onPress}
    >
      <MapPin className="h-4 w-4" aria-hidden />
      {busy ? "Finding your ZIP…" : "Locate me"}
    </Button>
  );
}
