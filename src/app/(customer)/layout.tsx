import { CustomerTopBar } from "@/components/customer/app-menu";
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
      <div className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-3xl">
        {children}
      </div>
    </div>
  );
}
