"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock,
  KeyRound,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Input, Label, Skeleton } from "@/components/ui/primitives";
import { StoreTeamPanel } from "@/components/store/store-team-panel";
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

type StaffTab = "floor" | "hours" | "access";

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

function parseTab(value: string | null): StaffTab {
  if (value === "hours" || value === "access" || value === "floor") return value;
  if (value === "team" || value === "login") return "access";
  return "floor";
}

const TABS: { id: StaffTab; label: string; hint: string; icon: typeof KeyRound }[] = [
  {
    id: "floor",
    label: "Floor staff",
    hint: "Hub PIN clock-in",
    icon: KeyRound,
  },
  {
    id: "hours",
    label: "Hours",
    hint: "Punches & totals",
    icon: CalendarClock,
  },
  {
    id: "access",
    label: "Login access",
    hint: "Dashboard invites",
    icon: UserPlus,
  },
];

export function StoreStaffPage({ storeId }: { storeId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  function setTab(next: StaffTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "floor") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-sm leading-relaxed text-ink-muted">
          Counter PINs, timesheets, and people who can sign in.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Staff sections"
        className="flex gap-1 overflow-x-auto rounded-xl border border-hairline-strong bg-white p-1"
      >
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                "flex min-h-12 min-w-[8.5rem] flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
                active
                  ? "bg-[var(--fd-black)] text-ink-inverse"
                  : "text-ink-muted hover:bg-black/[0.04] hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.4 : 2} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">
                  {item.label}
                </span>
                <span
                  className={cn(
                    "block truncate text-[11px] leading-tight",
                    active ? "text-white/70" : "text-ink-subtle"
                  )}
                >
                  {item.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {tab === "access" ? (
        <StoreTeamPanel storeId={storeId} />
      ) : tab === "hours" ? (
        <HoursPanel />
      ) : (
        <FloorPanel />
      )}
    </div>
  );
}

function FloorPanel() {
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

  const selected = people.find((row) => row.id === selectedId) || null;
  const onShift = people.filter((row) => row.on_shift);

  useEffect(() => {
    if (!selectedId && people.length) {
      setSelectedId(people[0]!.id);
    }
  }, [people, selectedId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="On shift" value={String(onShift.length)} hint="Clocked in now" />
        <Stat label="Floor staff" value={String(people.length)} hint="With Hub PINs" />
        <Stat label="Hours today" value={formatShiftHours(totals.today)} />
        <Stat label="This week" value={formatShiftHours(totals.week)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-ink">Add floor employee</h2>
            <p className="mt-1 text-xs text-ink-muted">
              They clock in on the Hub with a 4-digit PIN. No login needed.
            </p>
            <div className="mt-3">
              <Label htmlFor="shift-name">Name</Label>
              <Input
                id="shift-name"
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                className="mt-1.5"
              />
            </div>
            <Button
              className="mt-3 w-full"
              disabled={busy || !name.trim()}
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
                  setShownPins((current) => ({
                    ...current,
                    [result.employee.id]: true,
                  }));
                  setName("");
                  toast.success("Employee added");
                  await load();
                }
              }}
            >
              Add employee
            </Button>
            {justAdded?.pin ? (
              <p className="mt-3 rounded-xl bg-black/[0.04] px-3 py-2.5 text-sm text-ink">
                {justAdded.display_name}&apos;s PIN is{" "}
                <span className="font-semibold tracking-[0.2em]">{justAdded.pin}</span>
              </p>
            ) : null}
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-hairline-strong px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Roster</h2>
            </div>
            {people.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No floor staff yet"
                  description="Add someone so they can clock in on the Hub."
                />
              </div>
            ) : (
              <ul className="max-h-[28rem] divide-y divide-black/[0.06] overflow-y-auto">
                {people.map((row) => {
                  const hours = hoursFor(row.punches, now);
                  const open = selectedId === row.id;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        aria-pressed={open}
                        onClick={() => setSelectedId(row.id)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                          open ? "bg-black/[0.06]" : "hover:bg-black/[0.03]"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            row.on_shift ? "bg-emerald-500" : "bg-black/15"
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {row.display_name}
                          </span>
                          <span className="mt-0.5 block text-xs text-ink-muted">
                            {row.on_shift ? "On shift" : "Off"} ·{" "}
                            {formatShiftHours(hours.today)} today
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div>
          {selected ? (
            <EmployeeDetail
              row={selected}
              now={now}
              shown={Boolean(shownPins[selected.id])}
              editing={editingId === selected.id}
              editPin={editPin}
              busyId={busyId}
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
            <Card className="flex min-h-[20rem] items-center justify-center p-8">
              <EmptyState
                title="Select someone"
                description="Choose a person from the roster to manage their PIN and punches."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function HoursPanel() {
  const [people, setPeople] = useState<ShiftEmployeeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [lookDate, setLookDate] = useState(() => localDateValue());
  const [lookStart, setLookStart] = useState("");
  const [lookEnd, setLookEnd] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const windowStart = lookWindow?.start;
  const windowEnd = lookWindow?.end;
  const storeSelected =
    windowStart != null && windowEnd != null
      ? hoursFor(
          people.flatMap((row) => row.punches),
          now,
          windowStart,
          windowEnd
        ).selected
      : 0;

  const ranked = useMemo(() => {
    return [...people]
      .map((row) => ({
        row,
        hours: hoursFor(row.punches, now, windowStart, windowEnd),
      }))
      .sort((a, b) => b.hours.selected - a.hours.selected);
  }, [people, now, windowStart, windowEnd]);

  const selected = people.find((row) => row.id === selectedId) || null;

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Timesheet window</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Filter punches by day. Times are optional.
            </p>
          </div>
          {lookWindow ? (
            <p className="text-sm font-medium text-ink">
              {formatShiftHours(storeSelected)} store total
            </p>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="hours-day">Day</Label>
            <Input
              id="hours-day"
              type="date"
              value={lookDate}
              onChange={(e) => setLookDate(e.target.value || localDateValue())}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="hours-from">From</Label>
            <Input
              id="hours-from"
              type="time"
              value={lookStart}
              onChange={(e) => setLookStart(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="hours-to">To</Label>
            <Input
              id="hours-to"
              type="time"
              value={lookEnd}
              onChange={(e) => setLookEnd(e.target.value)}
              className="mt-1.5"
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
          </p>
        ) : (
          <p className="mt-3 text-sm text-accent-ink">Pick a valid day.</p>
        )}
      </Card>

      {people.length === 0 ? (
        <EmptyState
          title="No punches to review"
          description="Add floor staff first, then open Hours after they clock in on the Hub."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-hairline-strong px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">By person</h2>
            </div>
            <ul className="divide-y divide-black/[0.06]">
              {ranked.map(({ row, hours }) => {
                const open = selectedId === row.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedId((current) => (current === row.id ? null : row.id))
                      }
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-4 py-3 text-left",
                        open ? "bg-black/[0.06]" : "hover:bg-black/[0.03]"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {row.display_name}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-muted">
                          Today {formatShiftHours(hours.today)} · Week{" "}
                          {formatShiftHours(hours.week)}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                        {formatShiftHours(hours.selected)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-4 sm:p-5">
            {selected && windowStart != null && windowEnd != null ? (
              <>
                <h2 className="text-base font-semibold text-ink">
                  {selected.display_name}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Punches in this window
                </p>
                <PunchList
                  punches={punchesInWindow(
                    selected.punches,
                    windowStart,
                    windowEnd,
                    now
                  )}
                  windowStart={windowStart}
                  windowEnd={windowEnd}
                  now={now}
                />
              </>
            ) : (
              <EmptyState
                title="Pick a person"
                description="Select someone on the left to see punch detail for this window."
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function PunchList({
  punches,
  windowStart,
  windowEnd,
  now,
}: {
  punches: ShiftPunchView[];
  windowStart: number;
  windowEnd: number;
  now: number;
}) {
  if (!punches.length) {
    return (
      <p className="mt-4 text-sm text-ink-muted">No punches in this window.</p>
    );
  }
  return (
    <ul className="mt-4 space-y-2 border-t border-hairline-strong pt-3">
      {punches.map((punch) => {
        const minutes = minutesInWindow({
          ...punch,
          windowStart,
          windowEnd,
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
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-hairline-strong bg-white px-3 py-3.5 sm:px-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-bold tabular-nums tracking-[-0.02em] text-ink">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function EmployeeDetail({
  row,
  now,
  shown,
  editing,
  editPin,
  busyId,
  onTogglePin,
  onStartEdit,
  onEditPin,
  onSavePin,
  onDeletePin,
  onRemove,
}: {
  row: ShiftEmployeeView;
  now: number;
  shown: boolean;
  editing: boolean;
  editPin: string;
  busyId: string | null;
  onTogglePin: () => void;
  onStartEdit: () => void;
  onEditPin: (value: string) => void;
  onSavePin: () => Promise<void>;
  onDeletePin: () => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const hours = hoursFor(row.punches, now);
  const punches = row.punches.slice(0, 10);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-ink">{row.display_name}</h2>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                row.on_shift
                  ? "bg-emerald-500/15 text-emerald-800"
                  : "bg-black/[0.06] text-ink-muted"
              )}
            >
              {row.on_shift ? "On shift" : "Off"}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {row.on_shift
              ? "Clocked in on the Hub"
              : row.last_clocked_out_at
                ? `Last out ${formatRelativeTime(row.last_clocked_out_at)}`
                : "Not clocked in yet"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat label="Today" value={formatShiftHours(hours.today)} />
        <MiniStat label="Week" value={formatShiftHours(hours.week)} />
        <MiniStat
          label="PIN"
          value={row.pin ? (shown ? row.pin : "••••") : "None"}
          mono={Boolean(row.pin)}
        />
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
              onChange={(e) =>
                onEditPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
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

      <div className="mt-5 border-t border-hairline-strong pt-4">
        <h3 className="text-sm font-semibold text-ink">Recent punches</h3>
        <PunchList
          punches={punches}
          windowStart={0}
          windowEnd={Number.MAX_SAFE_INTEGER}
          now={now}
        />
      </div>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-black/[0.04] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold text-ink",
          mono && "font-mono tracking-[0.2em]"
        )}
      >
        {value}
      </p>
    </div>
  );
}
