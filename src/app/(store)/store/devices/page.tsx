"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Panel } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/primitives";
import { IosSwitch } from "@/components/ui/ios-switch";
import { formatRelativeTime } from "@/lib/utils";
import {
  claimHubPairingAction,
  deleteStoreDeviceAction,
  listStoreDevicesAction,
  previewHubPairingAction,
  renameStoreDeviceAction,
  setStoreDeviceEnabledAction,
  type StoreDeviceView,
} from "@/lib/services/hub-devices";

export default function StoreDevicesPage() {
  return (
    <Suspense>
      <StoreDevicesClient />
    </Suspense>
  );
}

function StoreDevicesClient() {
  const params = useSearchParams();
  const [devices, setDevices] = useState<StoreDeviceView[]>([]);
  const [code, setCode] = useState(params.get("pair") || "");
  const [deviceName, setDeviceName] = useState("Front Counter");
  const [preview, setPreview] = useState<{ storeName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setDevices(await listStoreDevicesAction());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const pair = params.get("pair");
    if (!pair) return;
    setCode(pair);
    let cancelled = false;
    void (async () => {
      const result = await previewHubPairingAction(pair);
      if (cancelled) return;
      if ("storeName" in result) setPreview({ storeName: result.storeName });
      else if ("error" in result && result.error) toast.error(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <div className="space-y-6">
      <Panel
        title="FINDIT Hub"
        action={
          <Link
            href="/store/hub"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
          >
            Open Hub
          </Link>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">
          Pair a counter tablet or store computer without signing in as the
          owner on that device. Open{" "}
          <span className="font-medium text-ink">/store/hub/connect</span> in
          the browser on the new device, then enter the code here.
        </p>
      </Panel>

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Add device</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pair-code">6-digit code</Label>
            <Input
              id="pair-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setPreview(null);
              }}
              placeholder="482 731"
            />
          </div>
          <div>
            <Label htmlFor="device-name">Device name</Label>
            <Input
              id="device-name"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Front Counter iPad"
            />
          </div>
        </div>
        {preview ? (
          <p className="mt-4 text-sm text-ink">
            Connect this device to <span className="font-semibold">{preview.storeName}</span>?
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {!preview ? (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const result = await previewHubPairingAction(code);
                setBusy(false);
                if ("error" in result && result.error) {
                  toast.error(result.error);
                  return;
                }
                if ("storeName" in result) setPreview({ storeName: result.storeName });
              }}
            >
              Check code
            </Button>
          ) : (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const result = await claimHubPairingAction({ code, deviceName });
                setBusy(false);
                if ("error" in result && result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Device connected");
                setCode("");
                setPreview(null);
                await load();
              }}
            >
              Connect device
            </Button>
          )}
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Connected devices</h2>
        {devices.length === 0 ? (
          <p className="text-sm text-ink-muted">No devices connected yet.</p>
        ) : (
          devices.map((device) => {
            const enabled = !device.revoked_at;
            return (
              <Card key={device.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {renaming === device.id ? (
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="max-w-xs"
                      />
                    ) : (
                      <p className="text-base font-semibold text-ink">{device.device_name}</p>
                    )}
                    <p className="mt-1 text-sm text-ink-muted">
                      <span
                        className={
                          enabled && device.online ? "text-emerald-700" : "text-ink-subtle"
                        }
                      >
                        {!enabled ? "Disabled" : device.online ? "Online" : "Offline"}
                      </span>
                      {" · "}
                      Last active:{" "}
                      {device.last_seen_at ? formatRelativeTime(device.last_seen_at) : "Never"}
                    </p>
                    <p className="mt-1 text-xs text-ink-subtle">
                      Connected {formatRelativeTime(device.paired_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {renaming === device.id ? (
                      <Button
                        size="sm"
                        onClick={async () => {
                          const result = await renameStoreDeviceAction(
                            device.id,
                            renameValue
                          );
                          if ("error" in result && result.error) toast.error(result.error);
                          else {
                            setRenaming(null);
                            await load();
                          }
                        }}
                      >
                        Save
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!enabled}
                        onClick={() => {
                          setRenaming(device.id);
                          setRenameValue(device.device_name);
                        }}
                      >
                        Rename
                      </Button>
                    )}
                    <IosSwitch
                      label={
                        enabled
                          ? `Disable ${device.device_name}`
                          : `Enable ${device.device_name}`
                      }
                      checked={enabled}
                      disabled={busyId === device.id}
                      onCheckedChange={async (next) => {
                        setBusyId(device.id);
                        const result = await setStoreDeviceEnabledAction(
                          device.id,
                          next
                        );
                        setBusyId(null);
                        if ("error" in result && result.error) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success(next ? "Device is on" : "Device is off");
                        await load();
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11 border-[var(--accent-ring)] text-accent-ink"
                      disabled={busyId === device.id}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Remove ${device.device_name}? That tablet leaves this store and will show a new pairing code.`
                          )
                        ) {
                          return;
                        }
                        setBusyId(device.id);
                        const result = await deleteStoreDeviceAction(device.id);
                        setBusyId(null);
                        if ("error" in result && result.error) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("Device removed");
                        setRenaming((current) =>
                          current === device.id ? null : current
                        );
                        await load();
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
