import { notFound } from "next/navigation";
import { boundUuid } from "@findit/domain";
import { BackLink } from "@/components/shared/app-header";
import { StoreProfile } from "@/components/store/store-profile";
import { getStoreBySlugAction } from "@/lib/services/actions";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function ShopperStorePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { from } = await searchParams;
  const store = await getStoreBySlugAction(slug);
  if (!store) notFound();

  const requestId = boundUuid(from);
  const backHref = requestId ? `/requests/${requestId}` : "/requests";
  const backLabel = requestId ? "Back to Find" : "Back to requests";

  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-6 sm:px-8">
      <BackLink href={backHref} label={backLabel} />
      <div className="mt-4">
        <StoreProfile store={store} />
      </div>
    </div>
  );
}
