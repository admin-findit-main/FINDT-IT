"use client";

import { useEffect, useState } from "react";
import { getHubEmployeeRewardsAction } from "@/lib/visits/engine";

export function HubEmployeeRewards() {
  const [stats, setStats] = useState<{
    answeredToday: number;
    arrivedToday: number;
    helpedWeek: number;
    points: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await getHubEmployeeRewardsAction();
      if (!cancelled) setStats(result);
    }
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!stats) return null;

  return (
    <div className="mt-8 grid w-full max-w-3xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
      <RewardStat label="Answered today" value={stats.answeredToday} />
      <RewardStat label="Customers arrived" value={stats.arrivedToday} />
      <RewardStat label="Helped this week" value={stats.helpedWeek} />
      <RewardStat label="FINDIT Points" value={stats.points} />
    </div>
  );
}

function RewardStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/8 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
