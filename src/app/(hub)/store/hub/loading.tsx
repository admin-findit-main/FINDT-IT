import { Skeleton } from "@/components/ui/primitives";

export default function HubLoading() {
  return (
    <div className="grid h-dvh place-items-center bg-canvas px-6">
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="mx-auto h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
