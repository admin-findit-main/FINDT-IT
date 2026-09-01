"use client";

import { useEffect, useRef, useState } from "react";
import {
  US_STATES,
  digitsPostalCode,
  lookupUsStreetAddress,
  lookupUsZip,
  normalizeStateCode,
  splitUsMailingAddress,
  streetLineOnly,
  type StreetAddressSuggestion,
} from "@findit/domain";
import { Input, Label } from "@/components/ui/primitives";

export function StoreAddressFields({
  street,
  city,
  state,
  postalCode,
  onChange,
  disabled = false,
  idPrefix = "store-address",
}: {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  onChange: (next: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
  }) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const [suggestions, setSuggestions] = useState<StreetAddressSuggestion[]>([]);
  const streetReq = useRef(0);
  const zipReq = useRef(0);

  function patch(
    next: Partial<{ street: string; city: string; state: string; postalCode: string }>
  ) {
    onChange({
      street,
      city,
      state,
      postalCode,
      ...next,
    });
  }

  useEffect(() => {
    const zip = digitsPostalCode(postalCode);
    if (zip.length !== 5) return;
    const id = ++zipReq.current;
    const t = window.setTimeout(() => {
      lookupUsZip(zip).then((place) => {
        if (id !== zipReq.current || !place) return;
        patch({
          city: city.trim() || place.city,
          state: normalizeStateCode(state) || place.state,
          postalCode: place.postalCode,
        });
      });
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digitsPostalCode(postalCode)]);

  useEffect(() => {
    const q = street.trim();
    if (disabled || q.length < 5) {
      setSuggestions([]);
      return;
    }
    const id = ++streetReq.current;
    const t = window.setTimeout(() => {
      lookupUsStreetAddress(q).then((rows) => {
        if (id !== streetReq.current) return;
        setSuggestions(rows);
      });
    }, 280);
    return () => window.clearTimeout(t);
  }, [street, disabled]);

  function applySuggestion(row: StreetAddressSuggestion) {
    onChange({
      street: row.street,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
    });
    setSuggestions([]);
  }

  function finishStreet() {
    const split = splitUsMailingAddress(street);
    if (split) {
      onChange(split);
      setSuggestions([]);
      return;
    }
    patch({
      street: streetLineOnly(street, { city, state, postalCode }),
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`${idPrefix}-street`}>Street</Label>
        <Input
          id={`${idPrefix}-street`}
          value={street}
          disabled={disabled}
          autoComplete="street-address"
          placeholder="123 Main St"
          onChange={(e) => patch({ street: e.target.value })}
          onBlur={finishStreet}
        />
        <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
          Start typing the street. We’ll fill city, state, and ZIP. Only the
          street line is saved — not the whole address.
        </p>
        {suggestions.length > 0 ? (
          <ul className="mt-2 overflow-hidden rounded-2xl border border-hairline-strong bg-white">
            {suggestions.map((row) => (
              <li key={row.label}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center px-4 text-left text-sm text-ink hover:bg-black/[0.03]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(row)}
                >
                  {row.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label htmlFor={`${idPrefix}-city`}>City</Label>
          <Input
            id={`${idPrefix}-city`}
            value={city}
            disabled={disabled}
            autoComplete="address-level2"
            onChange={(e) => patch({ city: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-zip`}>ZIP</Label>
          <Input
            id={`${idPrefix}-zip`}
            value={postalCode}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            className="tabular-nums"
            onChange={(e) =>
              patch({ postalCode: digitsPostalCode(e.target.value) })
            }
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-state`}>State</Label>
        <select
          id={`${idPrefix}-state`}
          aria-label="State"
          disabled={disabled}
          value={normalizeStateCode(state) || ""}
          onChange={(e) => patch({ state: e.target.value })}
          className="mt-1.5 h-12 w-full rounded-2xl border border-hairline-strong bg-white px-4 text-sm text-ink"
        >
          <option value="">State</option>
          {US_STATES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
