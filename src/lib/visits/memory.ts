import type { VerifiedVisit } from "@/types/database";

type Memory = {
  tokens: {
    id: string;
    storeId: string;
    deviceId: string;
    tokenHash: string;
    secret: string;
    expiresAt: string;
    usedAt: string | null;
  }[];
  selections: {
    id: string;
    shopperId: string;
    storeId: string;
    requestId: string;
    createdAt: string;
  }[];
  visits: VerifiedVisit[];
  rewards: { userId: string; points: number; audience: "shopper" | "employee" }[];
};

const g = globalThis as typeof globalThis & { __finditVisitMem?: Memory };

export function visitsMemory(): Memory {
  if (!g.__finditVisitMem) {
    g.__finditVisitMem = { tokens: [], selections: [], visits: [], rewards: [] };
  }
  return g.__finditVisitMem;
}
