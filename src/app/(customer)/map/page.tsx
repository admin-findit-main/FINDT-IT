import { StoresMap } from "@/components/customer/stores-map";

export default function CustomerStoresMapPage() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] flex-col">
      <div className="px-5 pt-5 sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Stores</h1>
        <p className="mt-1 text-sm text-ink-muted">
          FINDIT stores near you. Tap a pin or card for hours and directions.
        </p>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <StoresMap />
      </div>
    </div>
  );
}
