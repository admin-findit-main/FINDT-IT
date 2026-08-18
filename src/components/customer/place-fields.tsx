"use client";

import { useEffect, useRef, useState } from "react";
import {
  US_STATES,
  digitsPostalCode,
  lookupUsCity,
  lookupUsZip,
  normalizeStateCode,
  type ShortPlace,
} from "@findit/domain";
import { Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function PlaceFields({
  value,
  onChange,
  idPrefix = "place",
}: {
  value: ShortPlace;
  onChange: (next: ShortPlace) => void;
  idPrefix?: string;
}) {
  const [suggestions, setSuggestions] = useState<ShortPlace[]>([]);
  const [looking, setLooking] = useState(false);
  const zipReq = useRef(0);
  const cityReq = useRef(0);

  useEffect(() => {
    const zip = digitsPostalCode(value.postalCode);
    if (zip.length !== 5) return;
    const id = ++zipReq.current;
    setLooking(true);
    const t = window.setTimeout(() => {
      lookupUsZip(zip).then((place) => {
        if (id !== zipReq.current) return;
        setLooking(false);
        if (!place) return;
        onChange({
          city: value.city.trim() || place.city,
          state: normalizeStateCode(value.state) || place.state,
          postalCode: place.postalCode,
        });
        setSuggestions([]);
      });
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digitsPostalCode(value.postalCode)]);

  useEffect(() => {
    const city = value.city.trim();
    const state = normalizeStateCode(value.state);
    if (city.length < 3 || !state || digitsPostalCode(value.postalCode).length === 5) {
      setSuggestions([]);
      return;
    }
    const id = ++cityReq.current;
    const t = window.setTimeout(() => {
      lookupUsCity(state, city).then((places) => {
        if (id !== cityReq.current) return;
        setSuggestions(places);
      });
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.city, value.state]);

  return (
    <div className="space-y-3">
      <Input
        id={`${idPrefix}-city`}
        placeholder="City"
        autoComplete="address-level2"
        value={value.city}
        onChange={(e) => onChange({ ...value, city: e.target.value })}
      />
      <div className="grid grid-cols-[1.3fr_0.9fr] gap-3">
        <select
          id={`${idPrefix}-state`}
          aria-label="State"
          value={normalizeStateCode(value.state) || ""}
          onChange={(e) => onChange({ ...value, state: e.target.value })}
          className="h-12 w-full rounded-glass-lg border border-hairline-strong bg-white px-3 text-base text-ink"
        >
          <option value="">State</option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} · {s.name}
            </option>
          ))}
        </select>
        <Input
          id={`${idPrefix}-zip`}
          placeholder="ZIP"
          inputMode="numeric"
          autoComplete="postal-code"
          value={value.postalCode}
          onChange={(e) =>
            onChange({ ...value, postalCode: digitsPostalCode(e.target.value) })
          }
        />
      </div>
      {looking ? (
        <p className="text-xs text-ink-subtle">Finding that ZIP…</p>
      ) : suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((place) => (
            <button
              key={`${place.postalCode}-${place.city}`}
              type="button"
              onClick={() => {
                onChange(place);
                setSuggestions([]);
              }}
              className={cn(
                "min-h-8 rounded-full bg-[var(--solid-3)] px-3 text-xs font-semibold text-ink"
              )}
            >
              {place.postalCode} · {place.city}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-ink-subtle">
          City, state, ZIP — no street address. Type a ZIP to fill the rest.
        </p>
      )}
    </div>
  );
}
