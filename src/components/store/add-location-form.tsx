"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Input, Label, Textarea } from "@/components/ui/primitives";
import { GlassChip, GlassSelect } from "@/components/ui/glass";
import { StoreAddressFields } from "@/components/store/store-address-fields";
import {
  BUSINESS_ENTITY_TYPES,
  STORE_TRIAL_DAYS,
} from "@/lib/config/constants";
import { JOIN_REQUEST_CATEGORIES } from "@/lib/services/category-routing";
import {
  formatEin,
  normalizeEin,
  storeSelectionSuggestsCustomerId,
} from "@findit/domain";
import { submitAdditionalLocationAction } from "@/lib/services/additional-location";

export function AddLocationForm({
  ownerName,
  ownerEmail,
}: {
  ownerName: string;
  ownerEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [legalName, setLegalName] = useState("");
  const [ein, setEin] = useState("");
  const [entityType, setEntityType] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("VA");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [whyLegit, setWhyLegit] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [requiresCustomerId, setRequiresCustomerId] = useState(false);

  function toggleCategory(id: string) {
    setCategories((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      if (
        storeSelectionSuggestsCustomerId({
          businessType,
          requestCategories: next,
        })
      ) {
        setRequiresCustomerId(true);
      }
      return next;
    });
  }

  function submit() {
    startTransition(async () => {
      const result = await submitAdditionalLocationAction({
        businessName,
        businessType,
        legalName: legalName || businessName,
        ein: normalizeEin(ein),
        entityType,
        streetAddress,
        city,
        state,
        postalCode,
        phone,
        website: website || undefined,
        ownerName,
        ownerEmail,
        whyLegit,
        confirmedLegitimate: true,
        requestCategories: categories,
        requiresCustomerId,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message || "Location submitted for review");
      router.push("/store");
      router.refresh();
    });
  }

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">New location details</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Same review as a new business. When approved, it appears in your location
          switcher ({STORE_TRIAL_DAYS}-day trial on approval).
        </p>
        <p className="mt-2 text-xs text-ink-subtle">
          Owner account: {ownerName} · {ownerEmail}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="loc-name">Location / DBA name</Label>
          <Input
            id="loc-name"
            className="mt-1.5"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="FINDIT Market — Clarendon"
          />
        </div>
        <div>
          <Label htmlFor="loc-type">Business type</Label>
          <Input
            id="loc-type"
            className="mt-1.5"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            placeholder="Dispensary"
          />
        </div>
        <div>
          <Label htmlFor="loc-entity">Entity type</Label>
          <GlassSelect
            id="loc-entity"
            className="mt-1.5"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">Select</option>
            {BUSINESS_ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </GlassSelect>
        </div>
        <div>
          <Label htmlFor="loc-legal">Legal name</Label>
          <Input
            id="loc-legal"
            className="mt-1.5"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Same as main company if shared"
          />
        </div>
        <div>
          <Label htmlFor="loc-ein">EIN</Label>
          <Input
            id="loc-ein"
            className="mt-1.5"
            value={ein}
            onChange={(e) => setEin(formatEin(e.target.value))}
            placeholder="12-3456789"
          />
        </div>
      </div>

      <StoreAddressFields
        street={streetAddress}
        city={city}
        state={state}
        postalCode={postalCode}
        onChange={(next) => {
          setStreetAddress(next.street);
          setCity(next.city);
          setState(next.state);
          setPostalCode(next.postalCode);
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="loc-phone">Store phone</Label>
          <Input
            id="loc-phone"
            className="mt-1.5"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="loc-web">Website (optional)</Label>
          <Input
            id="loc-web"
            className="mt-1.5"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>Request categories</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {JOIN_REQUEST_CATEGORIES.map((cat) => (
            <GlassChip
              key={cat}
              selected={categories.includes(cat)}
              onClick={() => toggleCategory(cat)}
            >
              {cat}
            </GlassChip>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="loc-why">Why this location belongs on FINDIT</Label>
        <Textarea
          id="loc-why"
          className="mt-1.5"
          rows={4}
          value={whyLegit}
          onChange={(e) => setWhyLegit(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="button" disabled={pending} onClick={submit}>
          {pending ? "Submitting…" : "Submit location for review"}
        </Button>
        <Button asChild type="button" variant="ghost">
          <Link href="/store">Cancel</Link>
        </Button>
      </div>
    </Card>
  );
}
