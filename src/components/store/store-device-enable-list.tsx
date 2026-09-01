"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IosSwitch } from "@/components/ui/ios-switch";
import { formatRelativeTime } from "@/lib/utils";
import {
  setStoreDeviceEnabledAction,
  type StoreDeviceView,
} from "@/lib/services/hub-devices";

export function StoreDeviceEnableList({
  devices,
  canManage,
  onChanged,
}: {
  devices: StoreDeviceView[];
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (devices.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No Hub devices yet. Pair a counter tablet from Devices.
      </p>
    );
  }

  async function setEnabled(device: StoreDeviceView, enabled: boolean) {
    if (!canManage || busyId) return;
    setBusyId(device.id);
    const result = await setStoreDeviceEnabledAction(device.id, enabled);
    setBusyId(null);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      enabled
        ? `${device.device_name} is on.`
        : `${device.device_name} is off. It will not see Finds until you turn it back on.`
    );
    onChanged?.();
  }

  return (
    <ul className="space-y-3">
      {devices.map((device) => {
        const enabled = !device.revoked_at;
        return (
          <li
            key={device.id}
            className="flex items-center justify-between gap-3 rounded-glass-md bg-glass-1 px-3 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {device.device_name}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {enabled
                  ? device.online
                    ? "Online"
                    : "Offline"
                  : "Disabled"}
                {" · "}
                {device.last_seen_at
                  ? `Last active ${formatRelativeTime(device.last_seen_at)}`
                  : "Never seen"}
              </p>
            </div>
            <IosSwitch
              label={
                enabled
                  ? `Disable ${device.device_name}`
                  : `Enable ${device.device_name}`
              }
              checked={enabled}
              disabled={!canManage || busyId === device.id}
              onCheckedChange={(next) => void setEnabled(device, next)}
            />
          </li>
        );
      })}
    </ul>
  );
}
