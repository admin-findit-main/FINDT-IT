"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Input, Label, Skeleton } from "@/components/ui/primitives";
import { formatRelativeTime } from "@/lib/utils";
import {
  formatShiftHours,
  minutesInWindow,
  startOfLocalDay,
  startOfLocalWeek,
} from "@/lib/shifts/hours";
import {
  addShiftEmployeeAction,
  deleteShiftEmployeeAction,
  listShiftEmployeesAction,
  setShiftEmployeePinAction,
  type ShiftEmployeeView,
  type ShiftPunchView,
} from "@/lib/services/shifts";

function hoursFor(punches: ShiftPunchView[], now: number) {
  const dayStart = startOfLocalDay(new Date(now)).getTime();
  const weekStart = startOfLocalWeek(new Date(now)).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
  return {
    today: punches.reduce(
      (sum, punch) =>
        sum +
        minutesInWindow({
          ...punch,
          windowStart: dayStart,
          windowEnd: dayEnd,
          now,
        }),
      0
    ),
    week: punches.reduce(
      (sum, punch) =>
        sum +
        minutesInWindow({
          ...punch,
          windowStart: weekStart,
          windowEnd: weekEnd,
          now,
        }),
      0
    ),
  };
}

function formatPunchClock(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ShiftsPage() {
  const [people, setPeople] = useState<ShiftEmployeeView[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shownPins, setShownPins] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPin, setEditPin] = useState("");
  const [justAdded, setJustAdded] = useState<ShiftEmployeeView | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setPeople(await listShiftEmployeesAction());
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const totals = useMemo(() => {
    const punches = people.flatMap((row) => row.punches);
    return hoursFor(punches, now);
  }, [people, now]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const onShift = people.filter((row) => row.on_shift);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">
        Add people who work the counter. Clock-in on the Hub saves their hours
        so you can see today and this week.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Hours today
          </p>
          <p className="mt-1 text-2xl font-bold text-ink">{formatShiftHours(totals.today)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            This week
          </p>
          <p className="mt-1 text-2xl font-bold text-ink">{formatShiftHours(totals.week)}</p>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Add employee</h2>
        <div className="mt-4">
          <Label htmlFor="shift-name">Name</Label>
          <Input
            id="shift-name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Rivera"
          />
        </div>
        <Button
          className="mt-4 min-h-11 w-full sm:w-auto"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const result = await addShiftEmployeeAction(name);
            setBusy(false);
            if ("error" in result && result.error) {
              toast.error(result.error);
              return;
            }
            if ("ok" in result && result.ok) {
              setJustAdded(result.employee);
              setShownPins((current) => ({ ...current, [result.employee.id]: true }));
              setName("");
              toast.success("Employee added");
              await load();
            }
          }}
        >
          Add employee
        </Button>
        {justAdded?.pin ? (
          <p className="mt-4 rounded-2xl bg-black/[0.04] px-4 py-3 text-sm text-ink">
            {justAdded.display_name}&apos;s PIN is{" "}
            <span className="font-semibold tracking-[0.2em]">{justAdded.pin}</span>
            . They enter it on the Hub to clock in.
          </p>
        ) : null}
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-ink">On shift now</h2>
        {onShift.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nobody is clocked in.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {onShift.map((row) => {
              const live = hoursFor(row.punches, now);
              return (
                <li
                  key={row.id}
                  className="rounded-2xl border border-hairline-strong bg-white px-4 py-3"
                >
                  <p className="font-semibold text-ink">{row.display_name}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    In since{" "}
                    {row.clocked_in_at ? formatPunchClock(row.clocked_in_at) : "now"}
                    {" · "}
                    {formatShiftHours(live.today)} today
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Employees</h2>
        {people.length === 0 ? (
          <EmptyState
            title="No employees yet"
            description="Add someone so they can clock in on the Hub."
          />
        ) : (
          people.map((row) => {
            const shown = Boolean(shownPins[row.id]);
            const editing = editingId === row.id;
            const hours = hoursFor(row.punches, now);
            const recent = row.punches.slice(0, 6);
            return (
              <Card key={row.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-ink">{row.display_name}</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {row.on_shift
                        ? "On shift"
                        : row.last_clocked_out_at
                          ? `Last out ${formatRelativeTime(row.last_clocked_out_at)}`
                          : "Not clocked in yet"}
                    </p>
                    <p className="mt-2 text-sm font-medium text-ink">
                      Today {formatShiftHours(hours.today)}
                      <span className="text-ink-subtle"> · </span>
                      Week {formatShiftHours(hours.week)}
                    </p>
                    <p className="mt-2 font-mono text-lg tracking-[0.35em] text-ink">
                      {row.pin ? (shown ? row.pin : "••••") : "No PIN"}
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                    {row.pin ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() =>
                          setShownPins((current) => ({
                            ...current,
                            [row.id]: !shown,
                          }))
                        }
                      >
                        {shown ? "Hide PIN" : "Show PIN"}
                      </Button>
                    ) : null}
                    {editing ? (
                      <div className="flex w-full flex-col gap-2 sm:w-56">
                        <Input
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={4}
                          value={editPin}
                          onChange={(e) =>
                            setEditPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                          }
                          placeholder="New 4-digit PIN"
                        />
                        <Button
                          size="sm"
                          className="min-h-11"
                          disabled={busyId === row.id}
                          onClick={async () => {
                            setBusyId(row.id);
                            const result = await setShiftEmployeePinAction(
                              row.id,
                              editPin
                            );
                            setBusyId(null);
                            if ("error" in result && result.error) {
                              toast.error(result.error);
                              return;
                            }
                            toast.success("PIN updated");
                            setEditingId(null);
                            setShownPins((current) => ({ ...current, [row.id]: true }));
                            await load();
                          }}
                        >
                          Save PIN
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => {
                          setEditingId(row.id);
                          setEditPin(row.pin || "");
                        }}
                      >
                        {row.pin ? "Change PIN" : "Set PIN"}
                      </Button>
                    )}
                    {row.pin ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11 text-accent-ink"
                        disabled={busyId === row.id}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Delete ${row.display_name}'s PIN? They can't clock in until you set a new one.`
                            )
                          ) {
                            return;
                          }
                          setBusyId(row.id);
                          const result = await setShiftEmployeePinAction(row.id, null);
                          setBusyId(null);
                          if ("error" in result && result.error) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success("PIN deleted");
                          setShownPins((current) => ({ ...current, [row.id]: false }));
                          await load();
                        }}
                      >
                        Delete PIN
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11 text-accent-ink"
                      disabled={busyId === row.id}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Remove ${row.display_name}? They leave the shift list and can't clock in.`
                          )
                        ) {
                          return;
                        }
                        setBusyId(row.id);
                        const result = await deleteShiftEmployeeAction(row.id);
                        setBusyId(null);
                        if ("error" in result && result.error) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("Employee removed");
                        setJustAdded((current) =>
                          current?.id === row.id ? null : current
                        );
                        await load();
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                {recent.length ? (
                  <ul className="mt-4 space-y-2 border-t border-hairline-strong pt-3">
                    {recent.map((punch) => {
                      const minutes = minutesInWindow({
                        ...punch,
                        windowStart: 0,
                        windowEnd: Number.MAX_SAFE_INTEGER,
                        now,
                      });
                      return (
                        <li key={punch.id} className="text-sm text-ink-muted">
                          <span className="font-medium text-ink">
                            {formatPunchClock(punch.clocked_in_at)}
                          </span>
                          {" → "}
                          {punch.clocked_out_at
                            ? formatPunchClock(punch.clocked_out_at)
                            : "still in"}
                          <span className="text-ink-subtle">
                            {" · "}
                            {formatShiftHours(minutes)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
