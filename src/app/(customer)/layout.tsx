import { CustomerNav, CustomerTopBar } from "@/components/shared/nav";
import { getCurrentProfile } from "@/lib/services/actions";
import { redirect } from "next/navigation";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login?next=/home");
  }

  return (
    <div className="app-canvas min-h-screen">
      <CustomerTopBar />
      <div className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-lg pb-24 md:max-w-3xl md:pb-10 lg:max-w-5xl">
        {children}
      </div>
      <CustomerNav />
    </div>
  );
}
