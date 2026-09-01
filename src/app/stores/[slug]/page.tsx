import { notFound } from "next/navigation";
import { MarketingHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { StoreProfile } from "@/components/store/store-profile";
import { getStoreBySlugAction } from "@/lib/services/actions";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlugAction(slug);
  if (!store) return { title: "Store not found" };
  return {
    title: store.name,
    description: `${store.name} on FINDIT — ${store.city}, ${store.state}`,
  };
}

export default async function PublicStorePage({ params }: Props) {
  const { slug } = await params;
  const store = await getStoreBySlugAction(slug);
  if (!store) notFound();

  return (
    <div className="app-canvas min-h-screen">
      <MarketingHeader />
      <main className="mx-auto max-w-2xl px-5 pb-16 pt-6">
        <StoreProfile store={store} />
      </main>
      <SiteFooter />
    </div>
  );
}
