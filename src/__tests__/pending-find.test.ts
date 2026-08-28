import { describe, expect, it } from "vitest";
import {
  clearPendingFind,
  readPendingFind,
  writePendingFind,
  type PendingFind,
  type PendingFindStorage,
} from "@/lib/customer/pending-find";

function memoryStore(seed: Record<string, string> = {}): PendingFindStorage {
  const data = { ...seed };
  return {
    getItem(key) {
      return data[key] ?? null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

const find: PendingFind = {
  id: "req-1",
  productName: "Cherry Coke Zero",
  city: "Falls Church",
  state: "VA",
  postalCode: "22044",
  imageUrl: null,
  createdAt: "2026-08-28T21:00:00.000Z",
  expiresAt: "2026-08-29T21:00:00.000Z",
  storesTargeted: 3,
  startedAt: Date.now(),
};

describe("pending find handoff", () => {
  it("returns the Find only for the matching request id", () => {
    const storage = memoryStore();
    writePendingFind(find, storage);
    expect(readPendingFind("req-1", storage)?.productName).toBe("Cherry Coke Zero");
    expect(readPendingFind("other", storage)).toBeNull();
  });

  it("clears the matching Find so a later open does not reuse it", () => {
    const storage = memoryStore();
    writePendingFind(find, storage);
    clearPendingFind("req-1", storage);
    expect(readPendingFind("req-1", storage)).toBeNull();
  });
});
