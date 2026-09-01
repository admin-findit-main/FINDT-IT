"use client";

import { useEffect, useState } from "react";
import { browserNotifyPermission } from "@/lib/browser-notify";

/** Subtle reminder when this device blocked notifications. */
export function NotificationDeniedHint({ className }: { className?: string }) {
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    setDenied(browserNotifyPermission() === "denied");
  }, []);

  if (!denied) return null;

  return (
    <p className={className ?? "text-sm leading-relaxed text-ink-muted"}>
      Notifications are off. Enable them in your device or browser settings to
      receive store responses.
    </p>
  );
}
