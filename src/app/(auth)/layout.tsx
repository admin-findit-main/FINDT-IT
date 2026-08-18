import { AuthBrandLink } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-canvas min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <AuthBrandLink className="mb-10 self-start" />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
