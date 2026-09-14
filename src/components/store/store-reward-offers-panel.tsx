"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import {
  createStoreRewardOfferAction,
  updateStoreRewardOfferAction,
} from "@/lib/services/loyalty";

type OfferRow = {
  id: string;
  title: string;
  description: string | null;
  points_cost: number;
  max_value_cents: number | null;
  is_active: boolean;
};

function formatUpTo(cents: number | null) {
  if (cents == null) return null;
  return `up to $${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function StoreRewardOffersPanel({
  storeName,
  initialOffers,
}: {
  storeName: string;
  initialOffers: OfferRow[];
}) {
  const [offers, setOffers] = useState(initialOffers);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointsCost, setPointsCost] = useState("350");
  const [maxDollars, setMaxDollars] = useState("10");
  const [saving, setSaving] = useState(false);

  async function addOffer() {
    setSaving(true);
    const dollars = Number(maxDollars);
    const result = await createStoreRewardOfferAction({
      title,
      description,
      pointsCost: Number(pointsCost),
      maxValueCents:
        maxDollars.trim() === "" || !Number.isFinite(dollars)
          ? null
          : Math.round(dollars * 100),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setOffers((prev) => [...prev, result.offer]);
    setTitle("");
    setDescription("");
    toast.success("Reward added");
  }

  async function toggleActive(offer: OfferRow) {
    const result = await updateStoreRewardOfferAction(offer.id, {
      title: offer.title,
      description: offer.description || "",
      pointsCost: offer.points_cost,
      maxValueCents: offer.max_value_cents,
      isActive: !offer.is_active,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setOffers((prev) =>
      prev.map((row) =>
        row.id === offer.id ? { ...row, is_active: !row.is_active } : row
      )
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-ink">Reward menu</p>
        <p className="mt-1 text-sm text-ink-muted">
          Examples for {storeName}: 350 points = free vape up to $10. Staff
          redeem these on the Hub.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-hairline-strong p-4">
        <div>
          <Label htmlFor="offer-title">Reward name</Label>
          <Input
            id="offer-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Free vape"
            className="mt-1.5"
            maxLength={80}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="offer-points">Points needed</Label>
            <Input
              id="offer-points"
              type="number"
              min={1}
              value={pointsCost}
              onChange={(e) => setPointsCost(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="offer-max">Up to ($)</Label>
            <Input
              id="offer-max"
              inputMode="decimal"
              value={maxDollars}
              onChange={(e) => setMaxDollars(e.target.value)}
              placeholder="10"
              className="mt-1.5"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="offer-desc">Details (optional)</Label>
          <Input
            id="offer-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any disposable under the cap"
            className="mt-1.5"
            maxLength={280}
          />
        </div>
        <Button type="button" disabled={saving} onClick={() => void addOffer()}>
          {saving ? "Adding…" : "Add reward"}
        </Button>
      </div>

      {offers.length === 0 ? (
        <p className="text-sm text-ink-muted">No rewards yet. Add the first one above.</p>
      ) : (
        <ul className="divide-y divide-black/[0.06]">
          {offers.map((offer) => {
            const upTo = formatUpTo(offer.max_value_cents);
            return (
              <li
                key={offer.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3.5"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {offer.points_cost} pts = {offer.title}
                    {upTo ? ` (${upTo})` : ""}
                  </p>
                  {offer.description ? (
                    <p className="mt-0.5 text-sm text-ink-muted">{offer.description}</p>
                  ) : null}
                  {!offer.is_active ? (
                    <p className="mt-1 text-xs font-semibold text-ink-subtle">Off</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void toggleActive(offer)}
                >
                  {offer.is_active ? "Turn off" : "Turn on"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
