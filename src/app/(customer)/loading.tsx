import { Skeleton } from "@/components/ui/primitives";

export default function CustomerLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-4 px-5 py-8 sm:px-8">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
