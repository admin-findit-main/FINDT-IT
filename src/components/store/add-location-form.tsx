"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/primitives";
import { GlassSelect } from "@/components/ui/glass";
import { StoreAddressFields } from "@/components/store/store-address-fields";
import { STORE_CATEGORIES } from "@/lib/config/constants";
import { FINDIT_CATALOG, storeSelectionSuggestsCustomerId } from "@findit/domain";
import { submitAdditionalLocationAction } from "@/lib/services/additional-location";

function defaultRequestCategories(businessType: string): string[] {
  const fromCatalog = FINDIT_CATALOG.find(
    (t) => t.name === businessType || t.id === businessType
  );
  if (fromCatalog) return [fromCatalog.productCategory];
  if (businessType === "Smoke Shop") return ["Tobacco & Vape"];
  if (businessType === "Dispensary") return ["Dispensary"];
  if (businessType === "Coffee Shop") return ["Coffee"];
  if (businessType === "Nail Salon") return ["Nails"];
  if (businessType === "Auto Parts") return ["Auto Parts"];
  return [businessType === "Specialty Retail" ? "Specialty" : businessType];
}

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
  const [businessType, setBusinessType] = useState<string>(STORE_CATEGORIES[0]!);
  const [legalName, setLegalName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("VA");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  function submit() {
    if (!confirmed) {
      toast.error("Confirm this location to continue");
      return;
    }
    const requestCategories = defaultRequestCategories(businessType);
    const needsId = storeSelectionSuggestsCustomerId({
      businessType,
      requestCategories,
    });
    startTransition(async () => {
      const result = await submitAdditionalLocationAction({
        businessName,
        businessType,
        legalName: legalName.trim() || businessName.trim(),
        ein: "",
        entityType: "Other",
        streetAddress,
        city,
        state,
        postalCode,
        phone,
        website: website || undefined,
        ownerName,
        ownerEmail,
        whyLegit: "Pending FINDIT store review.",
        confirmedLegitimate: true,
        requestCategories:
          requestCategories.length > 0 ? requestCategories : ["Specialty"],
        requiresCustomerId: needsId,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Location submitted for review");
      router.push("/store");
      router.refresh();
    });
  }

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <p className="text-sm text-ink-muted">
        Same short form as join. No EIN needed. FINDIT reviews each location.
      </p>
      <div>
        <Label htmlFor="add-store-name">Store name</Label>
        <Input
          id="add-store-name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="add-legal-name">Company name</Label>
        <Input
          id="add-legal-name"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder="Legal name on business papers"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="add-type">Store type</Label>
        <GlassSelect
          id="add-type"
          className="mt-1.5"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
        >
          {STORE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </GlassSelect>
      </div>
      <StoreAddressFields
        idPrefix="add-loc"
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
      <div>
        <Label htmlFor="add-phone">Store phone</Label>
        <Input
          id="add-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="add-web">Website (optional)</Label>
        <Input
          id="add-web"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-hairline-strong"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>This is a real location. FINDIT will review it before it goes live.</span>
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" disabled={pending} onClick={submit}>
          {pending ? "Submitting…" : "Submit location"}
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href="/store">Cancel</Link>
        </Button>
      </div>
    </Card>
  );
}
