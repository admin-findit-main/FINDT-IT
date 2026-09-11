"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/primitives";
import { getShopperPointsAction } from "@/lib/visits/engine";

type PointsStats = { points: number; visits: number };
let inFlightPoints: Promise<PointsStats> | null = null;

function loadShopperPoints() {
  if (!inFlightPoints) {
    inFlightPoints = getShopperPointsAction().finally(() => {
      inFlightPoints = null;
    });
  }
  return inFlightPoints;
}

export function ShopperFinditPoints() {
  const [stats, setStats] = useState<PointsStats | null>(null);

  useEffect(() => {
    void loadShopperPoints().then(setStats);
  }, []);

  if (!stats) return null;

  return (
    <Card className="mt-3 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
        FINDIT Points
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-ink">
        {stats.points}
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        {stats.visits} verified store visit{stats.visits === 1 ? "" : "s"}.
        Points are for FINDIT participation, not for buying a product.
      </p>
    </Card>
  );
}
