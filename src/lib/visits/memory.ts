import type { VerifiedVisit } from "@/types/database";

type Memory = {
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
    g.__finditVisitMem = { selections: [], visits: [], rewards: [] };
  }
  return g.__finditVisitMem;
}
