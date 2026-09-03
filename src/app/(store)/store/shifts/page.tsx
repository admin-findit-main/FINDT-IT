"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Input, Label, Skeleton } from "@/components/ui/primitives";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  formatShiftHours,
  localDateValue,
  minutesInWindow,
  startOfLocalDay,
  startOfLocalWeek,
  windowFromLocalParts,
} from "@/lib/shifts/hours";
import {
  addShiftEmployeeAction,
  deleteShiftEmployeeAction,
  listShiftEmployeesAction,
  setShiftEmployeePinAction,
  type ShiftEmployeeView,
  type ShiftPunchView,
} from "@/lib/services/shifts";

function hoursFor(
  punches: ShiftPunchView[],
  now: number,
  windowStart?: number,
  windowEnd?: number
) {
  const dayStart = startOfLocalDay(new Date(now)).getTime();
  const weekStart = startOfLocalWeek(new Date(now)).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
  const inWindow = (start: number, end: number) =>
    punches.reduce(
      (sum, punch) =>
        sum +
        minutesInWindow({
          ...punch,
          windowStart: start,
          windowEnd: end,
          now,
        }),
      0
    );
  return {
    today: inWindow(dayStart, dayEnd),
    week: inWindow(weekStart, weekEnd),
    selected:
      windowStart != null && windowEnd != null
        ? inWindow(windowStart, windowEnd)
        : inWindow(dayStart, dayEnd),
  };
}

function punchesInWindow(
  punches: ShiftPunchView[],
  windowStart: number,
  windowEnd: number,
  now: number
) {
  return punches.filter(
    (punch) =>
      minutesInWindow({
        ...punch,
        windowStart,
        windowEnd,
        now,
      }) > 0
  );
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

function formatPunchTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWindowLabel(input: {
  date: string;
  startTime: string;
  endTime: string;
  start: number;
  end: number;
}) {
  const day = new Date(input.start).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (!input.startTime && !input.endTime) return `${day} · all day`;
  const from = input.startTime
    ? formatPunchTime(new Date(input.start).toISOString())
    : "start";
  const to = input.endTime
    ? formatPunchTime(new Date(input.end).toISOString())
    : "end of day";
  return `${day} · ${from}–${to}`;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lookDate, setLookDate] = useState(() => localDateValue());
  const [lookStart, setLookStart] = useState("");
  const [lookEnd, setLookEnd] = useState("");

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

  const lookWindow = useMemo(
    () =>
      windowFromLocalParts({
        date: lookDate,
        startTime: lookStart || undefined,
        endTime: lookEnd || undefined,
      }),
    [lookDate, lookStart, lookEnd]
  );

  const totals = useMemo(() => {
    const punches = people.flatMap((row) => row.punches);
    return hoursFor(punches, now);
  }, [people, now]);

  const selected = people.find((row) => row.id === selectedId) || null;

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const onShift = people.filter((row) => row.on_shift);
  const windowStart = lookWindow?.start;
  const windowEnd = lookWindow?.end;

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
              setSelectedId(result.employee.id);
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
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {onShift.map((row) => {
              const live = hoursFor(row.punches, now);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedId((current) => (current === row.id ? null : row.id))
                    }
                    className="w-full rounded-2xl border border-hairline-strong bg-white px-3 py-3 text-left"
                  >
                    <p className="truncate text-sm font-semibold text-ink">{row.display_name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {formatShiftHours(live.today)} today
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Employees</h2>
        <Card className="p-4">
          <p className="text-sm font-medium text-ink">Look at a day</p>
          <p className="mt-1 text-xs text-ink-muted">
            Tap a person to open them. Times are optional.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="shift-day">Day</Label>
              <Input
                id="shift-day"
                type="date"
                value={lookDate}
                onChange={(e) => setLookDate(e.target.value || localDateValue())}
              />
            </div>
            <div>
              <Label htmlFor="shift-from">From</Label>
              <Input
                id="shift-from"
                type="time"
                value={lookStart}
                onChange={(e) => setLookStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="shift-to">To</Label>
              <Input
                id="shift-to"
                type="time"
                value={lookEnd}
                onChange={(e) => setLookEnd(e.target.value)}
              />
            </div>
          </div>
          {lookWindow ? (
            <p className="mt-3 text-sm text-ink-muted">
              {formatWindowLabel({
                date: lookDate,
                startTime: lookStart,
                endTime: lookEnd,
                start: lookWindow.start,
                end: lookWindow.end,
              })}
              {" · "}
              {formatShiftHours(
                hoursFor(
                  people.flatMap((row) => row.punches),
                  now,
                  lookWindow.start,
                  lookWindow.end
                ).selected
              )}{" "}
              across the store
            </p>
          ) : (
            <p className="mt-3 text-sm text-accent-ink">Pick a valid day.</p>
          )}
        </Card>
        {people.length === 0 ? (
          <EmptyState
            title="No employees yet"
            description="Add someone so they can clock in on the Hub."
          />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {people.map((row) => {
                const hours = hoursFor(row.punches, now, windowStart, windowEnd);
                const open = selectedId === row.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      aria-pressed={open}
                      onClick={() =>
                        setSelectedId((current) => (current === row.id ? null : row.id))
                      }
                      className={cn(
                        "h-full w-full rounded-2xl border px-3 py-3 text-left",
                        open
                          ? "border-ink bg-black/[0.06]"
                          : "border-hairline-strong bg-white"
                      )}
                    >
                      <p className="truncate text-sm font-semibold text-ink">
                        {row.display_name}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {row.on_shift ? "On shift" : "Off"}
                      </p>
                      <p className="mt-2 text-sm font-medium text-ink">
                        {formatShiftHours(hours.selected)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
            {selected ? (
              <EmployeeDetail
                row={selected}
                now={now}
                windowStart={windowStart}
                windowEnd={windowEnd}
                shown={Boolean(shownPins[selected.id])}
                editing={editingId === selected.id}
                editPin={editPin}
                busyId={busyId}
                onClose={() => setSelectedId(null)}
                onTogglePin={() =>
                  setShownPins((current) => ({
                    ...current,
                    [selected.id]: !current[selected.id],
                  }))
                }
                onStartEdit={() => {
                  setEditingId(selected.id);
                  setEditPin(selected.pin || "");
                }}
                onEditPin={setEditPin}
                onSavePin={async () => {
                  setBusyId(selected.id);
                  const result = await setShiftEmployeePinAction(selected.id, editPin);
                  setBusyId(null);
                  if ("error" in result && result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("PIN updated");
                  setEditingId(null);
                  setShownPins((current) => ({ ...current, [selected.id]: true }));
                  await load();
                }}
                onDeletePin={async () => {
                  if (
                    !window.confirm(
                      `Delete ${selected.display_name}'s PIN? They can't clock in until you set a new one.`
                    )
                  ) {
                    return;
                  }
                  setBusyId(selected.id);
                  const result = await setShiftEmployeePinAction(selected.id, null);
                  setBusyId(null);
                  if ("error" in result && result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("PIN deleted");
                  setShownPins((current) => ({ ...current, [selected.id]: false }));
                  await load();
                }}
                onRemove={async () => {
                  if (
                    !window.confirm(
                      `Remove ${selected.display_name}? They leave the shift list and can't clock in.`
                    )
                  ) {
                    return;
                  }
                  setBusyId(selected.id);
                  const result = await deleteShiftEmployeeAction(selected.id);
                  setBusyId(null);
                  if ("error" in result && result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Employee removed");
                  setJustAdded((current) =>
                    current?.id === selected.id ? null : current
                  );
                  setSelectedId(null);
                  await load();
                }}
              />
            ) : (
              <p className="text-sm text-ink-muted">Tap a card to see PIN and punches.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmployeeDetail({
  row,
  now,
  windowStart,
  windowEnd,
  shown,
  editing,
  editPin,
  busyId,
  onClose,
  onTogglePin,
  onStartEdit,
  onEditPin,
  onSavePin,
  onDeletePin,
  onRemove,
}: {
  row: ShiftEmployeeView;
  now: number;
  windowStart?: number;
  windowEnd?: number;
  shown: boolean;
  editing: boolean;
  editPin: string;
  busyId: string | null;
  onClose: () => void;
  onTogglePin: () => void;
  onStartEdit: () => void;
  onEditPin: (value: string) => void;
  onSavePin: () => Promise<void>;
  onDeletePin: () => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const hours = hoursFor(row.punches, now, windowStart, windowEnd);
  const punches =
    windowStart != null && windowEnd != null
      ? punchesInWindow(row.punches, windowStart, windowEnd, now)
      : row.punches.slice(0, 8);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
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
            This window {formatShiftHours(hours.selected)}
            <span className="text-ink-subtle"> · </span>
            Today {formatShiftHours(hours.today)}
            <span className="text-ink-subtle"> · </span>
            Week {formatShiftHours(hours.week)}
          </p>
          <p className="mt-2 font-mono text-lg tracking-[0.35em] text-ink">
            {row.pin ? (shown ? row.pin : "••••") : "No PIN"}
          </p>
        </div>
        <Button size="sm" variant="ghost" className="shrink-0" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {row.pin ? (
          <Button size="sm" variant="outline" onClick={onTogglePin}>
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
              onChange={(e) => onEditPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="New 4-digit PIN"
            />
            <Button
              size="sm"
              disabled={busyId === row.id}
              onClick={() => void onSavePin()}
            >
              Save PIN
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={onStartEdit}>
            {row.pin ? "Change PIN" : "Set PIN"}
          </Button>
        )}
        {row.pin ? (
          <Button
            size="sm"
            variant="outline"
            className="text-accent-ink"
            disabled={busyId === row.id}
            onClick={() => void onDeletePin()}
          >
            Delete PIN
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          className="text-accent-ink"
          disabled={busyId === row.id}
          onClick={() => void onRemove()}
        >
          Remove
        </Button>
      </div>
      {punches.length ? (
        <ul className="mt-4 space-y-2 border-t border-hairline-strong pt-3">
          {punches.map((punch) => {
            const minutes = minutesInWindow({
              ...punch,
              windowStart: windowStart ?? 0,
              windowEnd: windowEnd ?? Number.MAX_SAFE_INTEGER,
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
      ) : (
        <p className="mt-4 border-t border-hairline-strong pt-3 text-sm text-ink-muted">
          No punches in this window.
        </p>
      )}
    </Card>
  );
}
