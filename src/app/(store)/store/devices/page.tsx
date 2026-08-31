"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Panel } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/primitives";
import { formatRelativeTime } from "@/lib/utils";
import {
  claimHubPairingAction,
  listStoreDevicesAction,
  previewHubPairingAction,
  renameStoreDeviceAction,
  revokeStoreDeviceAction,
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

  const active = devices.filter((d) => !d.revoked_at);
  const removed = devices.filter((d) => d.revoked_at);

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
          Pair a counter tablet or store computer without entering the owner password
          on that device. Install the FINDIT Hub Android app, or open{" "}
          <span className="font-medium text-ink">/store/hub/connect</span> on
          the new device, then enter the code here.
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
        {active.length === 0 ? (
          <p className="text-sm text-ink-muted">No devices connected yet.</p>
        ) : (
          active.map((device) => (
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
                    <span className={device.online ? "text-emerald-700" : "text-ink-subtle"}>
                      {device.online ? "Online" : "Offline"}
                    </span>
                    {" · "}
                    Last active:{" "}
                    {device.last_seen_at ? formatRelativeTime(device.last_seen_at) : "Never"}
                  </p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    Connected {formatRelativeTime(device.paired_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {renaming === device.id ? (
                    <Button
                      size="sm"
                      onClick={async () => {
                        const result = await renameStoreDeviceAction(device.id, renameValue);
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
                      onClick={() => {
                        setRenaming(device.id);
                        setRenameValue(device.device_name);
                      }}
                    >
                      Rename
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const result = await revokeStoreDeviceAction(device.id);
                      if ("error" in result && result.error) toast.error(result.error);
                      else {
                        toast.success("Device removed");
                        await load();
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {removed.length ? (
        <p className="text-xs text-ink-subtle">
          {removed.length} previously removed device{removed.length === 1 ? "" : "s"} no longer
          have access.
        </p>
      ) : null}
    </div>
  );
}
