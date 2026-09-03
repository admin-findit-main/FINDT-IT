import { beforeEach, describe, expect, it } from "vitest";
import { normalizeHubPin } from "@findit/domain";
import {
  demoAddShiftEmployee,
  demoClockInHub,
  demoClockOutHub,
  demoCountClockableEmployees,
  demoDeleteShiftEmployee,
  demoGetOpenPunch,
  demoLogin,
  demoSetShiftEmployeePin,
  getDemoState,
  resetDemoState,
} from "@/lib/demo/store";
import {
  formatShiftHours,
  minutesInWindow,
  windowFromLocalParts,
} from "@/lib/shifts/hours";

beforeEach(() => {
  resetDemoState();
  process.env.FINDIT_DEMO_MODE = "true";
});

describe("Hub PINs and shifts", () => {
  it("normalizes a 4-digit PIN", () => {
    expect(normalizeHubPin("4821")).toBe("4821");
    expect(normalizeHubPin("48 21")).toBe("4821");
    expect(normalizeHubPin("482")).toBeNull();
    expect(normalizeHubPin("48211")).toBeNull();
  });

  it("lets the owner add a person, show the PIN, change it, and delete it", () => {
    const owner = demoLogin("owner@demo.findit.local", "demo1234")!;
    const store = getDemoState().stores.find((s) => s.owner_id === owner.id)!;
    const added = demoAddShiftEmployee(store.id, "Alex Rivera");
    expect("error" in added).toBe(false);
    if ("error" in added) throw new Error(added.error);
    expect(added.pin).toMatch(/^\d{4}$/);
    expect(demoCountClockableEmployees(store.id)).toBe(1);

    const changed = demoSetShiftEmployeePin(store.id, added.id, "1234");
    expect("error" in changed).toBe(false);
    if ("error" in changed) throw new Error(changed.error);
    expect(changed.pin).toBe("1234");

    const cleared = demoSetShiftEmployeePin(store.id, added.id, null);
    expect("error" in cleared).toBe(false);
    if ("error" in cleared) throw new Error(cleared.error);
    expect(cleared.pin).toBeNull();
    expect(demoCountClockableEmployees(store.id)).toBe(0);
  });

  it("clocks in with the PIN and clocks out", () => {
    const owner = demoLogin("owner@demo.findit.local", "demo1234")!;
    const store = getDemoState().stores.find((s) => s.owner_id === owner.id)!;
    const added = demoAddShiftEmployee(store.id, "Sam");
    if ("error" in added) throw new Error(added.error);
    const pin = added.pin!;

    const wrong = demoClockInHub({ storeId: store.id, pin: "0000" === pin ? "1111" : "0000", deviceId: null });
    expect("error" in wrong).toBe(true);

    const inShift = demoClockInHub({ storeId: store.id, pin, deviceId: null });
    expect("punch" in inShift).toBe(true);
    if ("error" in inShift) throw new Error(inShift.error);
    expect(demoGetOpenPunch(inShift.punch.id, store.id)?.employee.display_name).toBe("Sam");

    const again = demoClockInHub({ storeId: store.id, pin, deviceId: null });
    if ("error" in again) throw new Error(again.error);
    expect(again.punch.id).toBe(inShift.punch.id);

    const out = demoClockOutHub(inShift.punch.id, store.id);
    expect("error" in out).toBe(false);
    expect(demoGetOpenPunch(inShift.punch.id, store.id)).toBeNull();

    const back = demoClockInHub({ storeId: store.id, pin, deviceId: null });
    if ("error" in back) throw new Error(back.error);
    expect(back.punch.id).not.toBe(inShift.punch.id);
    expect(demoGetOpenPunch(back.punch.id, store.id)?.employee.display_name).toBe("Sam");

    const cleared = demoSetShiftEmployeePin(store.id, added.id, null);
    expect("error" in cleared).toBe(false);
    expect(demoGetOpenPunch(back.punch.id, store.id)).toBeNull();
    expect(
      demoClockInHub({ storeId: store.id, pin, deviceId: null })
    ).toMatchObject({ error: expect.any(String) });
  });

  it("rejects a PIN already used at the store and can remove the person", () => {
    const owner = demoLogin("owner@demo.findit.local", "demo1234")!;
    const store = getDemoState().stores.find((s) => s.owner_id === owner.id)!;
    const first = demoAddShiftEmployee(store.id, "One");
    const second = demoAddShiftEmployee(store.id, "Two");
    if ("error" in first || "error" in second) throw new Error("add failed");
    const clash = demoSetShiftEmployeePin(store.id, second.id, first.pin);
    expect("error" in clash).toBe(true);
    expect(demoDeleteShiftEmployee(store.id, first.id)).toEqual({ ok: true });
    expect(
      getDemoState().shiftEmployees.some((row) => row.id === first.id)
    ).toBe(false);
  });

  it("saves worked minutes from clock in to clock out", () => {
    expect(formatShiftHours(0)).toBe("0m");
    expect(formatShiftHours(45)).toBe("45m");
    expect(formatShiftHours(90)).toBe("1h 30m");
    expect(
      minutesInWindow({
        clocked_in_at: "2026-09-03T12:00:00.000Z",
        clocked_out_at: "2026-09-03T14:00:00.000Z",
        windowStart: Date.parse("2026-09-03T00:00:00.000Z"),
        windowEnd: Date.parse("2026-09-04T00:00:00.000Z"),
        now: Date.parse("2026-09-03T18:00:00.000Z"),
      })
    ).toBe(120);
    const day = windowFromLocalParts({ date: "2026-09-03" });
    expect(day).not.toBeNull();
    expect(day!.end - day!.start).toBe(24 * 60 * 60 * 1000);
    const shift = windowFromLocalParts({
      date: "2026-09-03",
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(shift!.end - shift!.start).toBe(8 * 60 * 60 * 1000);
    const overnight = windowFromLocalParts({
      date: "2026-09-03",
      startTime: "22:00",
      endTime: "02:00",
    });
    expect(overnight!.end - overnight!.start).toBe(4 * 60 * 60 * 1000);
    expect(windowFromLocalParts({ date: "bad" })).toBeNull();
  });
});
